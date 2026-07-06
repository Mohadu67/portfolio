// Exécution serveur des tools IA — partagée entre /api/chat/tool-exec (chat dashboard)
// et le bot Telegram (lib/telegram-agent.ts). Déplacé tel quel depuis la route tool-exec.

import { connectDB } from "@/lib/mongodb";
import { Candidature, CandidatureStatut, ICandidature } from "@/models/Candidature";
import { CVSection, ICVSection } from "@/models/CVSection";
import { sendRelance, sendEmail } from "@/lib/email";
import { generateLettrePDF } from "@/lib/pdf-generator";
import { resolveCVForSend } from "@/lib/cvFile";
import { processSingleCompany } from "@/lib/auto-apply";
import { runProcessPending } from "@/lib/pending-processor";
import { sendAutoReplyApprovalRequest } from "@/lib/telegram";
import { getSettings } from "@/models/Settings";
import { resolveCompanyWebsite } from "@/lib/serpapi-resolve";
import { scrapeCompanyWebsite, findCareersPage, scrapeCareersPage } from "@/lib/web-scraper";
import { scoreCompanyFit, generateLetterProposal } from "@/lib/gemini";
import { AgentMemory, IAgentMemory, AGENT_MEMORY_CATEGORIES, normalizeFact, AgentMemoryCategory } from "@/models/AgentMemory";
import { getTelegramState, TelegramState, ITelegramState } from "@/models/TelegramState";
import { searchJSearch, searchAdzuna, searchFranceTravail, searchIndeed, SearchResult } from "@/lib/scraper";
import { normalizeUrl } from "@/lib/url-normalize";
import { ProspectedDomain, IProspectedDomain } from "@/models/ProspectedDomain";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Gemini émet parfois les booléens de tool en STRING ("true"). Un `=== true` strict raterait
// le flag — dramatique pour dry_run : l'utilisateur confirmerait un label « [dry-run] » qui
// déclenche un envoi réel. À utiliser pour TOUT flag booléen venant des args du modèle.
export function isTruthyFlag(v: unknown): boolean {
  return v === true || (typeof v === "string" && v.toLowerCase() === "true");
}

// Retire salutation d'ouverture et formules de politesse/signature de fin d'une lettre
// complète : le PDF (generateLettrePDF) ajoute lui-même « Madame, Monsieur, »,
// « Bien cordialement, » et la signature — sans strip elles apparaîtraient en double.
export function stripLetterBoilerplate(raw: string): string {
  const isSalutation = (s: string) => /^(madame,?\s*monsieur|madame|monsieur|messieurs|bonjour)\s*,?$/i.test(s);
  const isClosing = (s: string) =>
    /^((bien\s+|très\s+)?cordialement|respectueusement|mohammed\s+hamiani|concepteur\s+d[ée]veloppeur.*|(je\s+vous\s+prie\s+d'agr[ée]er|veuillez\s+(agr[ée]er|recevoir)).*)\s*,?$/i.test(s);
  const lines = raw.trim().split("\n");
  while (lines.length && (lines[0].trim() === "" || isSalutation(lines[0].trim()))) lines.shift();
  while (lines.length && (lines[lines.length - 1].trim() === "" || isClosing(lines[lines.length - 1].trim()))) {
    lines.pop();
  }
  return lines.join("\n").trim();
}

// Génère la lettre d'une candidature (consigne letterInstruction respectée), l'archive dans
// letters[] et avance identifiée → « lettre générée ». Partagé write_letter / send_letter_to_me.
async function generateAndArchiveLetter(c: ICandidature & { save: () => Promise<unknown> }): Promise<string> {
  const type = (c.type === "stage" || c.type === "cdi" ? c.type : "alternance") as "stage" | "alternance" | "cdi";
  const lettre = await generateLetterProposal(
    c.entreprise,
    c.aboutText || c.description || "",
    c.poste,
    type,
    c.letterInstruction || undefined
  );
  c.lettre = lettre;
  if (c.statut === "identifiée") c.statut = "lettre générée";
  c.letters = [
    ...(c.letters ?? []),
    { version: (c.letters?.length ?? 0) + 1, model: "gemini", content: lettre, generatedAt: new Date(), type },
  ];
  await c.save();
  return lettre;
}

// Motif insensible aux accents : chaque voyelle (et c/ç) matche toutes ses variantes.
// Les classes insérées ne contiennent pas les lettres des passes suivantes → une seule passe
// par famille suffit, pas de réécriture en cascade.
function accentInsensitivePattern(s: string): string {
  return escapeRegex(s)
    .replace(/[eéèêë]/gi, "[eéèêë]")
    .replace(/[aàâä]/gi, "[aàâä]")
    .replace(/[iîï]/gi, "[iîï]")
    .replace(/[oôö]/gi, "[oôö]")
    .replace(/[uùûü]/gi, "[uùûü]")
    .replace(/[cç]/gi, "[cç]");
}

// Recherche tolérante : CHAQUE mot (≥ 2 chars) doit matcher entreprise OU poste OU
// localisation, insensible casse/accents. Indispensable pour les follow-ups vocaux du bot
// Telegram : « Développeur Logiciel CDI Expectra » mélange poste et entreprise en un seul
// libellé — une recherche substring d'un bloc ne matche aucun champ.
export function buildCandidatureSearchFilter(search: string): Record<string, unknown> | null {
  const tokens = search.trim().split(/\s+/).filter((t) => t.length >= 2);
  // Aucun token exploitable (ex. "R") → fallback substring sur la chaîne brute plutôt que
  // de renvoyer la liste NON filtrée comme si c'étaient des résultats.
  if (tokens.length === 0) {
    const raw = search.trim();
    if (!raw) return null;
    tokens.push(raw);
  }
  return {
    $and: tokens.map((t) => {
      const rx = new RegExp(accentInsensitivePattern(t), "i");
      return { $or: [{ entreprise: rx }, { poste: rx }, { localisation: rx }] };
    }),
  };
}

const STATUTS: CandidatureStatut[] = [
  "identifiée",
  "lettre générée",
  "postulée",
  "réponse reçue",
  "entretien",
  "refus",
  "acceptée",
];

function applyVariables(text: string, c: { entreprise: string; poste: string; type: string }, prenom: string): string {
  return text
    .replaceAll("{entreprise}", c.entreprise)
    .replaceAll("{poste}", c.poste)
    .replaceAll("{type}", c.type)
    .replaceAll("{prenom}", prenom);
}

export interface ToolAction {
  id: string;
  label: string;
  tool: string;
  input: Record<string, unknown>;
  variant: "primary" | "secondary" | "danger";
}

export interface ToolRunResult {
  status: number;
  body: {
    ok?: boolean;
    summary?: string;
    actions?: ToolAction[];
    error?: string;
  };
}

function ok(body: ToolRunResult["body"]): ToolRunResult {
  return { status: 200, body };
}

function fail(status: number, error: string): ToolRunResult {
  return { status, body: { error } };
}

export async function executeTool(toolName: string, input: Record<string, unknown>): Promise<ToolRunResult> {
  const prenom = (process.env.PROFIL_NOM ?? "Mohammed Hamiani").split(" ")[0];
  await connectDB();

  switch (toolName) {
    case "list_candidatures": {
      const statut = input.statut ? String(input.statut) : null;
      const search = input.search ? String(input.search).trim() : "";
      const limit = Math.min(Math.max(Number(input.limit) || 15, 1), 50);
      const query: Record<string, unknown> = {};
      if (statut) query.statut = statut;
      if (search) {
        const filter = buildCandidatureSearchFilter(search);
        if (filter) Object.assign(query, filter);
      }
      const docs = await Candidature.find(query, {
        entreprise: 1,
        poste: 1,
        statut: 1,
        type: 1,
        plateforme: 1,
        localisation: 1,
        created_at: 1,
      })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean<ICandidature[]>();
      const items = docs.map((c) => ({
        _id: String(c._id),
        entreprise: c.entreprise,
        poste: c.poste,
        statut: c.statut,
        type: c.type,
        plateforme: c.plateforme,
        localisation: c.localisation ?? "",
        created_at:
          c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at ?? ""),
      }));
      return ok({ ok: true, summary: JSON.stringify({ count: items.length, items }) });
    }

    case "get_candidature": {
      const id = String(input.candidature_id);
      const c = await Candidature.findById(id).lean<ICandidature | null>();
      if (!c) return fail(404, "Candidature not found");
      const detail = {
        _id: String(c._id),
        entreprise: c.entreprise,
        poste: c.poste,
        statut: c.statut,
        type: c.type,
        plateforme: c.plateforme,
        localisation: c.localisation ?? "",
        email: c.email ?? "",
        url: c.url ?? "",
        description: (c.description ?? "").slice(0, 400),
        notes: c.notes ?? "",
        hasLetter: !!c.lettre,
        created_at:
          c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at ?? ""),
        relances: (c.relanceHistory ?? []).map((r, idx) => ({
          index: idx,
          scheduledFor:
            r.scheduledFor instanceof Date
              ? r.scheduledFor.toISOString()
              : String(r.scheduledFor),
          status: r.status,
          templateTitle: r.templateTitle,
          message: (r.message ?? "").slice(0, 150),
          sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : null,
        })),
        emailsSent: (c.emailsSent ?? []).map((e) => ({
          date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
          subject: e.subject,
          type: e.type,
          status: e.status,
        })),
      };
      return ok({ ok: true, summary: JSON.stringify(detail) });
    }

    case "list_relances_due": {
      const before = input.before_date
        ? new Date(String(input.before_date))
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const docs = await Candidature.find(
        { "relanceHistory.status": "programmée" },
        { entreprise: 1, poste: 1, statut: 1, relanceHistory: 1, email: 1 }
      ).lean<ICandidature[]>();
      const items: Array<Record<string, unknown>> = [];
      for (const c of docs) {
        (c.relanceHistory ?? []).forEach((r, idx) => {
          if (r.status !== "programmée") return;
          const t =
            r.scheduledFor instanceof Date ? r.scheduledFor : new Date(String(r.scheduledFor));
          if (Number.isNaN(t.getTime()) || t > before) return;
          items.push({
            candidature_id: String(c._id),
            entreprise: c.entreprise,
            poste: c.poste,
            statut: c.statut,
            has_email: !!c.email,
            relance_index: idx,
            scheduledFor: t.toISOString(),
            templateTitle: r.templateTitle,
            overdue: t.getTime() < Date.now(),
          });
        });
      }
      items.sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)));
      return ok({ ok: true, summary: JSON.stringify({ count: items.length, items }) });
    }

    case "schedule_telegram_reminder": {
      const when = new Date(String(input.when ?? ""));
      const message = String(input.message ?? "").trim();
      if (Number.isNaN(when.getTime())) return fail(400, "Date invalide (ISO 8601 attendu)");
      if (when.getTime() < Date.now() - 60_000) return fail(400, "La date du rappel est déjà passée");
      if (!message) return fail(400, "message requis");
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!chatId) return fail(500, "TELEGRAM_CHAT_ID non configuré");
      await getTelegramState(chatId); // garantit l'existence du doc
      // $push atomique (pas de réécriture du tableau : un pulse concurrent pourrait avoir
      // marqué un rappel sent entre-temps — le réécrire le ressusciterait).
      await TelegramState.updateOne(
        { chatId },
        {
          $push: {
            reminders: {
              $each: [{ message, dueAt: when, sent: false, createdAt: new Date() }],
              $slice: -40,
            },
          },
        }
      );
      return ok({
        ok: true,
        summary: `Rappel programmé pour le ${when.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} : « ${message.slice(0, 120)} »`,
      });
    }

    case "remember_fact": {
      const fact = String(input.fact ?? "").trim();
      if (!fact || fact.length < 5) return fail(400, "fact trop court");
      const category = AGENT_MEMORY_CATEGORIES.includes(input.category as AgentMemoryCategory)
        ? (input.category as AgentMemoryCategory)
        : "autre";
      // Dédup souple : même fait normalisé → update de la catégorie/timestamp, pas de doublon.
      const normalized = normalizeFact(fact);
      const existingFacts = await AgentMemory.find({}, { fact: 1 }).lean<IAgentMemory[]>();
      const dup = existingFacts.find((f) => normalizeFact(f.fact) === normalized);
      if (dup) {
        return ok({ ok: true, summary: `Déjà mémorisé : « ${fact} »` });
      }
      // Cap : garder au max 150 faits (les plus récents).
      const count = await AgentMemory.countDocuments();
      if (count >= 150) {
        const oldest = await AgentMemory.findOne().sort({ updated_at: 1 });
        if (oldest) await AgentMemory.deleteOne({ _id: oldest._id });
      }
      await AgentMemory.create({ category, fact, source: "user" });
      return ok({ ok: true, summary: `Mémorisé [${category}] : « ${fact} »` });
    }

    case "forget_fact": {
      const id = String(input.fact_id ?? "");
      const doc = await AgentMemory.findByIdAndDelete(id).lean<IAgentMemory | null>();
      if (!doc) return fail(404, "Fait introuvable (utilise list_memory pour l'_id)");
      return ok({ ok: true, summary: `Oublié : « ${doc.fact} »` });
    }

    case "list_memory": {
      const facts = await AgentMemory.find().sort({ category: 1, created_at: 1 }).lean<IAgentMemory[]>();
      return ok({
        ok: true,
        summary: JSON.stringify({
          count: facts.length,
          facts: facts.map((f) => ({ _id: String(f._id), category: f.category, fact: f.fact })),
        }),
      });
    }

    case "research_company": {
      const entreprise = String(input.entreprise ?? "").trim();
      // Normalise le schéma : Gemini passe parfois "divalto.fr" nu → new URL() throw plus bas.
      const rawUrl = typeof input.url === "string" ? input.url.trim() : "";
      const inputUrl = rawUrl ? (rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`) : null;
      const localisation = String(input.localisation ?? "").trim() || "Strasbourg";
      if (!entreprise && !inputUrl) return fail(400, "entreprise ou url requis");

      // 1. Site officiel (SerpAPI si pas d'URL fournie)
      let site = inputUrl;
      if (!site) {
        try {
          site = await resolveCompanyWebsite(entreprise, localisation);
        } catch (err) {
          // Quota SerpAPI épuisé ou API down : on dégrade au lieu d'échouer — l'agent
          // demande l'URL du site et rappelle le tool avec.
          const msg = err instanceof Error ? err.message : String(err);
          return ok({
            ok: true,
            summary: JSON.stringify({
              entreprise,
              site: null,
              note: `Résolution automatique du site impossible (${msg.slice(0, 120)}). Demande à l'utilisateur l'URL du site officiel de ${entreprise} puis rappelle research_company avec le paramètre url.`,
            }),
          });
        }
      }
      if (!site) {
        return ok({
          ok: true,
          summary: JSON.stringify({ entreprise, site: null, note: "Site officiel introuvable via la recherche — demande l'URL à l'utilisateur." }),
        });
      }

      // 2. Présentation + emails
      const scraped = await scrapeCompanyWebsite(site);

      // 3. Page carrières → offres publiées par la boîte elle-même
      let careersUrl: string | null = null;
      let offres: Array<{ titre: string; url: string }> = [];
      try {
        const homeRes = await fetch(site, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; CockpitBot/1.0)" },
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        if (homeRes.ok) {
          careersUrl = findCareersPage(site, await homeRes.text());
          if (careersUrl) {
            const careers = await scrapeCareersPage(careersUrl, 10);
            offres = careers.offers.map((o) => ({ titre: o.title, url: o.url }));
          }
        }
      } catch {
        /* page carrières = best effort */
      }

      // 4. Adéquation avec le profil (si assez de matière)
      let fit: { score: number; reason: string } | null = null;
      if ((scraped.aboutText ?? "").length > 80) {
        try {
          const f = await scoreCompanyFit(entreprise || new URL(site).hostname, scraped.aboutText);
          fit = { score: f.score, reason: f.reason };
        } catch {
          /* scoring = best effort */
        }
      }

      // 5. Déjà dans le pipeline ?
      let domain: string;
      try {
        domain = new URL(site).hostname.replace(/^www\./, "");
      } catch {
        return fail(400, `URL invalide : ${site}`);
      }
      const existing = await Candidature.findOne(
        {
          $or: [
            { url: new RegExp(escapeRegex(domain), "i") },
            { email: new RegExp(`@${escapeRegex(domain)}$`, "i") },
            ...(entreprise ? [{ entreprise: new RegExp(`^${escapeRegex(entreprise)}$`, "i") }] : []),
          ],
        },
        { entreprise: 1, poste: 1, statut: 1, created_at: 1 }
      ).lean<ICandidature | null>();

      return ok({
        ok: true,
        summary: JSON.stringify({
          entreprise: entreprise || domain,
          site,
          resume: (scraped.aboutText || scraped.description || "").slice(0, 800) || null,
          emails: (scraped.emails ?? []).slice(0, 5),
          fitScore: fit?.score ?? null,
          fitReason: fit?.reason ?? null,
          careersUrl,
          offres: offres.slice(0, 8),
          dejaContactee: existing
            ? { candidature_id: String(existing._id), poste: existing.poste, statut: existing.statut }
            : null,
          hint: "Fais un mini-récap : activité, adéquation, offres carrières trouvées, déjà contactée ou non. Si pertinent et pas déjà contactée, propose de candidater (apply_to_company avec ce site).",
        }),
      });
    }

    case "list_pending_approvals": {
      // Auto-réponses en attente de validation Telegram (human-in-the-loop).
      const docs = await Candidature.find(
        { autoReplies: { $elemMatch: { approvalStatus: "pending" } } },
        { entreprise: 1, poste: 1, statut: 1, autoReplies: 1, emailsReceived: 1 }
      ).lean<ICandidature[]>();
      const items: Array<Record<string, unknown>> = [];
      for (const c of docs) {
        for (const a of c.autoReplies ?? []) {
          if (a.approvalStatus !== "pending") continue;
          const inbound = (c.emailsReceived ?? []).find(
            (e) => !!a.inboundMessageId && e.messageId === a.inboundMessageId
          );
          items.push({
            candidature_id: String(c._id),
            entreprise: c.entreprise,
            poste: c.poste,
            category: a.category,
            confidence: a.confidence,
            from: inbound?.from ?? null,
            subject: inbound?.subject ?? null,
            since: a.date instanceof Date ? a.date.toISOString() : String(a.date),
            reply_preview: (a.reply ?? "").slice(0, 200),
          });
        }
      }
      return ok({ ok: true, summary: JSON.stringify({ count: items.length, items }) });
    }

    case "resend_pending_approval": {
      // Ré-émet le message Telegram (avec boutons ✅/❌) de TOUTES les auto-réponses pending
      // de la candidature (il peut y en avoir plusieurs : une par mail entrant).
      const id = String(input.candidature_id);
      const c = await Candidature.findById(id).lean<ICandidature | null>();
      if (!c) return fail(404, "Candidature not found");
      const pendings = (c.autoReplies ?? []).filter((a) => a.approvalStatus === "pending" && a.approvalToken);
      if (pendings.length === 0) {
        return fail(404, "Aucune auto-réponse en attente pour cette candidature");
      }
      const settings = await getSettings();
      for (const pending of pendings) {
        const inbound = (c.emailsReceived ?? []).find(
          (e) => !!pending.inboundMessageId && e.messageId === pending.inboundMessageId
        );
        await sendAutoReplyApprovalRequest({
          approvalToken: String(pending.approvalToken),
          entreprise: c.entreprise,
          poste: c.poste,
          from: inbound?.from ?? "(inconnu)",
          fromName: inbound?.fromName,
          subject: inbound?.subject ?? "(sans sujet)",
          inboundExcerpt: inbound?.snippet || inbound?.bodyText || "",
          category: pending.category,
          confidence: pending.confidence,
          minConfidence: settings.gmail.autoReplyMinConfidence ?? 0.7,
          reply: pending.reply,
        });
      }
      return ok({
        ok: true,
        summary: `${pendings.length} demande(s) d'approbation renvoyée(s) sur Telegram pour ${c.entreprise}`,
      });
    }

    case "list_cv_sections": {
      const sections = await CVSection.find({}, { key: 1, type: 1, title: 1, order: 1 })
        .sort({ order: 1 })
        .lean<ICVSection[]>();
      return ok({
        ok: true,
        summary: JSON.stringify(sections.map((s) => ({ key: s.key, type: s.type, title: s.title }))),
      });
    }

    case "get_cv_section": {
      const key = String(input.key);
      const s = await CVSection.findOne({ key }).lean<ICVSection | null>();
      if (!s) return fail(404, "Section not found");
      return ok({
        ok: true,
        summary: JSON.stringify({ key: s.key, type: s.type, title: s.title, content: s.content }),
      });
    }

    case "schedule_relance": {
      const { candidature_id, scheduled_for, title, message } = input as Record<string, string>;
      const c = await Candidature.findById(candidature_id);
      if (!c) return fail(404, "Candidature not found");
      c.relanceHistory = [
        ...(c.relanceHistory ?? []),
        {
          scheduledFor: new Date(scheduled_for),
          template: "custom",
          templateTitle: title ?? "Relance",
          message,
          status: "programmée",
        },
      ];
      await c.save();
      return ok({
        ok: true,
        summary: `Relance programmée chez ${c.entreprise} pour le ${new Date(scheduled_for).toLocaleString("fr-FR")}`,
      });
    }

    case "cancel_relance": {
      const candidature_id = String(input.candidature_id);
      const idx = Number(input.relance_index);
      const c = await Candidature.findById(candidature_id);
      if (!c) return fail(404, "Not found");
      if (!c.relanceHistory?.[idx]) return fail(404, "Relance not found");
      c.relanceHistory[idx].status = "annulée";
      await c.save();
      return ok({ ok: true, summary: `Relance #${idx + 1} chez ${c.entreprise} annulée` });
    }

    case "update_candidature_status": {
      const candidature_id = String(input.candidature_id);
      const statut = String(input.statut) as CandidatureStatut;
      if (!STATUTS.includes(statut)) return fail(400, `Invalid status: ${statut}`);
      // Annule en même temps les relances programmée si on sort de "postulée" (atomique).
      // Guard $exists : les vieux docs sans champ relanceHistory feraient planter l'update
      // arrayFilters ("The path 'relanceHistory' must exist…") — rien à annuler chez eux.
      if (statut !== "postulée") {
        await Candidature.updateOne(
          { _id: candidature_id, statut: "postulée", relanceHistory: { $exists: true } },
          {
            $set: {
              "relanceHistory.$[r].status": "annulée",
              "relanceHistory.$[r].error": `Statut passé à "${statut}"`,
            },
          },
          { arrayFilters: [{ "r.status": "programmée" }] }
        );
      }
      const c = await Candidature.findByIdAndUpdate(candidature_id, { statut }, { new: true });
      if (!c) return fail(404, "Not found");
      return ok({ ok: true, summary: `Statut de ${c.entreprise} mis à "${statut}"` });
    }

    case "update_candidature_notes": {
      const candidature_id = String(input.candidature_id);
      const notes = String(input.notes ?? "");
      const c = await Candidature.findByIdAndUpdate(candidature_id, { notes }, { new: true });
      if (!c) return fail(404, "Not found");
      return ok({ ok: true, summary: `Notes mises à jour pour ${c.entreprise}` });
    }

    case "send_relance_now": {
      const candidature_id = String(input.candidature_id);
      const title = String(input.title ?? "Relance");
      const message = String(input.message);
      const c = await Candidature.findById(candidature_id);
      if (!c) return fail(404, "Not found");
      if (!c.email) return fail(400, "Aucun email destinataire");

      const fullMessage = applyVariables(
        message,
        { entreprise: c.entreprise, poste: c.poste, type: c.type ?? "alternance" },
        prenom
      );
      await sendRelance(
        c.entreprise,
        c.poste,
        c.email,
        fullMessage,
        title,
        c.type ?? "alternance",
        process.env.PROFIL_NOM ?? "Mohammed Hamiani"
      );

      const now = new Date();
      c.relanceHistory = [
        ...(c.relanceHistory ?? []),
        {
          scheduledFor: now,
          template: "custom",
          templateTitle: title,
          message,
          status: "envoyée",
          sentAt: now,
        },
      ];
      c.emailsSent = [
        ...(c.emailsSent ?? []),
        {
          date: now,
          to: c.email,
          subject: `${title} - ${c.poste}`,
          type: "relance",
          status: "sent",
          error: null,
        },
      ];
      await c.save();
      return ok({ ok: true, summary: `Relance envoyée à ${c.email} (${c.entreprise})` });
    }

    case "apply_to_company": {
      const url = String(input.url ?? "").trim();
      if (!url) return fail(400, "url required");
      // Défaut alternance : c'est la recherche active — et describeAction/le label de
      // confirmation affichent déjà « alternance » quand type est absent.
      const type = (input.type === "stage" || input.type === "cdi") ? input.type : "alternance";
      const emailOverride = typeof input.email_override === "string" && input.email_override.trim()
        ? input.email_override.trim()
        : undefined;
      const letterInstruction = typeof input.letter_instruction === "string" && input.letter_instruction.trim()
        ? input.letter_instruction.trim()
        : undefined;
      const decision = await processSingleCompany(url, {
        dryRun: isTruthyFlag(input.dry_run),
        skipQualityScore: isTruthyFlag(input.skip_quality_score),
        allowDuplicate: isTruthyFlag(input.allow_duplicate),
        allowGenericEmail: isTruthyFlag(input.allow_generic_email),
        emailOverride,
        candidatureType: type,
        letterInstruction,
      });
      const allowGenericEmailUsed = isTruthyFlag(input.allow_generic_email);
      const emailFailure = decision.skipReason?.includes("aucun email RH") ?? false;
      const summary = JSON.stringify({
        decision: decision.decision,
        entreprise: decision.entreprise || decision.domain,
        url: decision.url,
        candidatureId: decision.candidatureId ?? null,
        email: decision.email ? { address: decision.email.email, score: decision.email.score, reasons: decision.email.reasons } : null,
        companyScore: decision.companyScore ?? null,
        companyReason: decision.companyReason ?? null,
        skipReason: decision.skipReason ?? null,
        error: decision.error ?? null,
        allowGenericEmailUsed,
        scrapedEmails: decision.scrapedEmails ?? null,
        hint: emailFailure
          ? (allowGenericEmailUsed
              ? "Le flag allow_generic_email a déjà été utilisé sans succès. NE propose PAS un autre retry de allow_generic_email. À la place : liste les candidats scrapedEmails à l'utilisateur (ils sont aussi affichés en boutons cliquables dans l'UI via le champ actions de la réponse), explique brièvement pourquoi ils ont été rejetés (souvent : domaine de l'email ≠ domaine du site cible), et propose l'utilisation de email_override OU la saisie manuelle via /candidatures."
              : "L'utilisateur peut autoriser l'envoi à un email générique (contact@/info@) en relançant apply_to_company avec allow_generic_email: true — demander confirmation explicite avant de retry.")
          : undefined,
      });

      // Action chips : boutons cliquables affichés sous le message assistant qui suit ce tool result.
      // Évite à l'utilisateur de taper "oui" + repasser une card de confirmation.
      // - 1er échec (allowGenericEmailUsed=false) : 1 chip "Réessayer en autorisant les emails génériques"
      // - 2e échec (allowGenericEmailUsed=true) + scrapedEmails : 1 chip "Envoyer à <email>" par candidat
      // Dans les deux cas, un chip "Abandonner cette cible".
      const baseInput = {
        url,
        type,
        skip_quality_score: isTruthyFlag(input.skip_quality_score),
        allow_duplicate: isTruthyFlag(input.allow_duplicate),
        ...(letterInstruction ? { letter_instruction: letterInstruction } : {}),
      };
      let actions: ToolAction[] | undefined;
      if (emailFailure && !allowGenericEmailUsed) {
        actions = [
          {
            id: `apply_retry_loose_${Date.now()}`,
            label: "Réessayer en autorisant les emails génériques",
            tool: "apply_to_company",
            input: { ...baseInput, allow_generic_email: true },
            variant: "primary",
          },
          {
            id: `apply_cancel_${Date.now()}`,
            label: "Abandonner cette cible",
            tool: "__cancel__",
            input: {},
            variant: "secondary",
          },
        ];
      } else if (emailFailure && allowGenericEmailUsed && decision.scrapedEmails?.length) {
        actions = [
          ...decision.scrapedEmails.map((email, idx) => ({
            id: `apply_override_${Date.now()}_${idx}`,
            label: `Envoyer à ${email}`,
            tool: "apply_to_company",
            input: { ...baseInput, email_override: email },
            variant: "primary" as const,
          })),
          {
            id: `apply_cancel_${Date.now()}`,
            label: "Abandonner cette cible",
            tool: "__cancel__",
            input: {},
            variant: "secondary",
          },
        ];
      }

      return ok({ ok: !decision.error, summary, actions });
    }

    case "process_pending_candidatures": {
      const ids = Array.isArray(input.ids)
        ? (input.ids as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
        : undefined;
      const force = isTruthyFlag(input.force);
      const dryRun = isTruthyFlag(input.dry_run);
      const result = await runProcessPending({ ids, force, dryRun });
      const summary = JSON.stringify({
        processed: result.processed,
        applied: result.applied,
        skipped: result.skipped,
        errors: result.errors.slice(0, 10),
        items: result.items.slice(0, 30),
      });
      return ok({ ok: result.ok, summary });
    }

    case "search_offers": {
      const keywords = String(input.keywords ?? "").trim();
      if (!keywords) return fail(400, "keywords requis");
      const location = String(input.location ?? "").trim() || "Strasbourg";
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);

      // Promise.allSettled : une API en panne/quota ne doit pas faire tomber toute la recherche.
      const settled = await Promise.allSettled([
        searchJSearch(keywords, location, limit),
        searchAdzuna(keywords, location, limit),
        searchFranceTravail(keywords, location, limit),
        searchIndeed(keywords, location, limit),
      ]);
      const raw: SearchResult[] = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));

      // Dédup cross-source par URL normalisée.
      const seen = new Set<string>();
      const deduped = raw.filter((r) => {
        if (!r.url?.trim()) return false;
        const norm = normalizeUrl(r.url) ?? r.url;
        if (seen.has(norm)) return false;
        seen.add(norm);
        return true;
      });

      const top = deduped.slice(0, limit);
      // deja_en_base par URL NORMALISÉE : la même offre revient souvent avec www/utm/slash
      // en plus — un match exact raterait la candidature déjà suivie. La collection est
      // petite, on charge toutes les urls plutôt qu'un $in exact faux-négatif.
      const existing = await Candidature.find({}, { url: 1 }).lean<{ url: string }[]>();
      const existingNorm = new Set(existing.map((e) => normalizeUrl(e.url) ?? e.url));

      const items = top.map((r) => ({
        entreprise: r.entreprise,
        poste: r.poste,
        localisation: r.localisation,
        plateforme: r.plateforme,
        url: r.url,
        description: (r.description ?? "").slice(0, 140),
        deja_en_base: existingNorm.has(normalizeUrl(r.url) ?? r.url),
      }));
      return ok({
        ok: true,
        summary: JSON.stringify({
          count: items.length,
          keywords,
          location,
          items,
          // Les fonctions de recherche avalent leurs erreurs (clé API absente, quota) et
          // renvoient [] : count=0 ne distingue pas « aucune offre » de « sources en panne ».
          note:
            items.length === 0
              ? "0 résultat : peut signifier aucune offre correspondante OU sources indisponibles/non configurées. Ne conclus pas qu'il n'y a rien sur le marché ; propose de réessayer avec d'autres mots-clés."
              : undefined,
          hint: "Présente les offres nouvelles (deja_en_base=false) en liste courte numérotée : poste — entreprise (localisation, plateforme). Si l'utilisateur veut en suivre une, appelle create_candidature avec entreprise/poste/url/localisation/description de l'offre.",
        }),
      });
    }

    case "get_lettre": {
      const id = String(input.candidature_id);
      const c = await Candidature.findById(id).lean<ICandidature | null>();
      if (!c) return fail(404, "Candidature not found");
      const lastEmail = (c.emailsSent ?? []).slice(-1)[0] ?? null;
      return ok({
        ok: true,
        summary: JSON.stringify({
          entreprise: c.entreprise,
          poste: c.poste,
          statut: c.statut,
          email: c.email || null,
          lettre: c.lettre ? c.lettre.slice(0, 3000) : null,
          note: c.lettre ? undefined : "Aucune lettre générée pour cette candidature.",
          dernierEmail: lastEmail
            ? {
                date: lastEmail.date instanceof Date ? lastEmail.date.toISOString() : String(lastEmail.date),
                to: lastEmail.to,
                subject: lastEmail.subject,
                type: lastEmail.type,
                status: lastEmail.status,
              }
            : null,
        }),
      });
    }

    case "get_stats": {
      const sentSince = (d: Date) => ({
        emailsSent: { $elemMatch: { type: "candidature", status: "sent", date: { $gte: d } } },
      });
      const chatId = process.env.TELEGRAM_CHAT_ID;
      const [byStatut, sent7, sent30, recus30, relancesProgrammees, pendingApprovals, tgState] = await Promise.all([
        Candidature.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$statut", n: { $sum: 1 } } }]),
        Candidature.countDocuments(sentSince(new Date(Date.now() - 7 * 86_400_000))),
        Candidature.countDocuments(sentSince(new Date(Date.now() - 30 * 86_400_000))),
        Candidature.countDocuments({ emailsReceived: { $elemMatch: { date: { $gte: new Date(Date.now() - 30 * 86_400_000) } } } }),
        Candidature.countDocuments({ relanceHistory: { $elemMatch: { status: "programmée" } } }),
        Candidature.countDocuments({ autoReplies: { $elemMatch: { approvalStatus: "pending" } } }),
        chatId
          ? TelegramState.findOne({ chatId }, { reminders: 1 }).lean<ITelegramState | null>()
          : Promise.resolve(null),
      ]);
      const parStatut: Record<string, number> = {};
      let total = 0;
      for (const s of byStatut) {
        parStatut[s._id] = s.n;
        total += s.n;
      }
      return ok({
        ok: true,
        summary: JSON.stringify({
          total,
          parStatut,
          candidaturesEnvoyees7j: sent7,
          candidaturesEnvoyees30j: sent30,
          // Tout email entrant compte (accusé, refus, entretien…) — pas un taux de réponse positif.
          entreprisesAvecEmailRecu30j: recus30,
          candidaturesAvecRelanceProgrammee: relancesProgrammees,
          autoReponsesEnAttente: pendingApprovals,
          rappelsAVenir: ((tgState as ITelegramState | null)?.reminders ?? []).filter((r) => !r.sent).length,
        }),
      });
    }

    case "list_reminders": {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!chatId) return fail(500, "TELEGRAM_CHAT_ID non configuré");
      const state = await TelegramState.findOne({ chatId }, { reminders: 1 }).lean<ITelegramState | null>();
      const items = (state?.reminders ?? [])
        .filter((r) => !r.sent)
        .map((r) => ({
          message: r.message,
          dueAt: r.dueAt instanceof Date ? r.dueAt.toISOString() : String(r.dueAt),
          overdue: new Date(r.dueAt).getTime() < Date.now(),
        }))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
      return ok({ ok: true, summary: JSON.stringify({ count: items.length, items }) });
    }

    case "cancel_reminder": {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!chatId) return fail(500, "TELEGRAM_CHAT_ID non configuré");
      const due = new Date(String(input.due_at ?? ""));
      if (Number.isNaN(due.getTime())) return fail(400, "due_at invalide (ISO attendu, cf. list_reminders)");
      const messageContains = String(input.message_contains ?? "").trim();
      const baseCriteria: Record<string, unknown> = { sent: false };
      if (messageContains) baseCriteria.message = { $regex: escapeRegex(messageContains), $options: "i" };
      // Match exact d'abord ; fallback ±60 s ensuite (le modèle reformule parfois l'ISO :
      // offset, millisecondes arrondies). Le fallback séparé évite d'emporter un rappel
      // voisin quand l'exact suffit.
      let res = await TelegramState.updateOne({ chatId }, { $pull: { reminders: { ...baseCriteria, dueAt: due } } });
      if (res.modifiedCount === 0) {
        res = await TelegramState.updateOne(
          { chatId },
          {
            $pull: {
              reminders: {
                ...baseCriteria,
                dueAt: { $gte: new Date(due.getTime() - 60_000), $lte: new Date(due.getTime() + 60_000) },
              },
            },
          }
        );
      }
      if (res.modifiedCount === 0) {
        return fail(404, "Aucun rappel non envoyé à cette date (utilise list_reminders pour le dueAt exact)");
      }
      return ok({ ok: true, summary: `Rappel(s) du ${due.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} annulé(s)` });
    }

    case "list_blacklist": {
      const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
      const search = String(input.search ?? "").trim();
      const query: Record<string, unknown> = {};
      if (search) {
        const rx = new RegExp(escapeRegex(search), "i");
        query.$or = [{ domain: rx }, { entreprise: rx }];
      }
      const docs = await ProspectedDomain.find(query)
        .sort({ lastEvaluatedAt: -1 })
        .limit(limit)
        .lean<IProspectedDomain[]>();
      const items = docs.map((d) => ({
        domain: d.domain,
        entreprise: d.entreprise ?? null,
        skipReason: d.skipReason,
        skipDetail: (d.skipDetail ?? "").slice(0, 120) || null,
        companyScore: d.companyScore ?? null,
        lastEvaluatedAt: d.lastEvaluatedAt instanceof Date ? d.lastEvaluatedAt.toISOString() : String(d.lastEvaluatedAt),
        reevaluableApres: d.nextEvaluateAt instanceof Date ? d.nextEvaluateAt.toISOString() : String(d.nextEvaluateAt),
      }));
      return ok({ ok: true, summary: JSON.stringify({ count: items.length, items }) });
    }

    case "unblacklist_domain": {
      const domain = String(input.domain ?? "").trim().toLowerCase().replace(/^www\./, "");
      if (!domain) return fail(400, "domain requis");
      const doc = await ProspectedDomain.findOneAndDelete({ domain }).lean<IProspectedDomain | null>();
      if (!doc) return fail(404, `Domaine « ${domain} » introuvable dans la blacklist (utilise list_blacklist)`);
      return ok({
        ok: true,
        summary: `Domaine ${domain} retiré de la blacklist (raison précédente : ${doc.skipReason}) — il redevient éligible à la prospection.`,
      });
    }

    case "create_candidature": {
      const entreprise = String(input.entreprise ?? "").trim();
      if (!entreprise) return fail(400, "entreprise requise");
      const poste = String(input.poste ?? "").trim() || "Candidature spontanée";
      const type = input.type === "stage" || input.type === "cdi" ? input.type : "alternance";
      // Même convention que POST /api/candidatures : url unique requise par le schéma →
      // placeholder "manual://" horodaté quand on n'a pas d'annonce.
      const cleanUrl = typeof input.url === "string" && input.url.trim() ? input.url.trim() : null;
      const finalUrl =
        cleanUrl ??
        `manual://${entreprise.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "candidature"}-${Date.now()}`;
      const existing = await Candidature.findOne({ url: finalUrl }, { entreprise: 1, statut: 1 }).lean<ICandidature | null>();
      if (existing) {
        return fail(409, `Une candidature existe déjà avec cette URL : ${existing.entreprise} (statut « ${existing.statut} », _id ${String(existing._id)})`);
      }
      const c = await Candidature.create({
        entreprise,
        poste,
        plateforme: "Web",
        localisation: String(input.localisation ?? "").trim(),
        url: finalUrl,
        description: String(input.description ?? "").slice(0, 500),
        email: String(input.email ?? "").trim(),
        statut: "identifiée",
        type,
        lettre: null,
        letterInstruction: String(input.letter_instruction ?? "").trim(),
        notes: String(input.notes ?? "").trim(),
        source: "manual",
        date: new Date().toISOString().split("T")[0],
        letters: [],
      });
      return ok({
        ok: true,
        summary: `Candidature créée : ${entreprise} — ${poste} (${type}, statut « identifiée », _id ${String(c._id)}). Rien n'a été envoyé.`,
      });
    }

    case "write_letter": {
      const id = String(input.candidature_id);
      const c = await Candidature.findById(id);
      if (!c) return fail(404, "Candidature not found");
      const instruction = String(input.instruction ?? "").trim();
      if (instruction) c.letterInstruction = instruction;
      let lettre: string;
      try {
        lettre = await generateAndArchiveLetter(c);
      } catch (err) {
        return fail(502, `Génération échouée : ${err instanceof Error ? err.message : String(err)}`);
      }
      return ok({
        ok: true,
        summary: JSON.stringify({
          entreprise: c.entreprise,
          version: c.letters.length,
          consigne: c.letterInstruction || null,
          lettre: lettre.slice(0, 3000),
          hint: "Montre la lettre complète à l'utilisateur et demande si elle lui convient ou ce qu'il veut ajuster (nouvelle consigne → rappelle write_letter). Rien n'a été envoyé.",
        }),
      });
    }

    case "set_lettre": {
      const id = String(input.candidature_id);
      // Le PDF ajoute lui-même « Madame, Monsieur, », « Bien cordialement, » et la signature :
      // on retire les salutations/formules que le modèle aurait incluses malgré la consigne,
      // sinon elles apparaissent en double dans la lettre envoyée.
      const lettre = stripLetterBoilerplate(String(input.lettre ?? ""));
      // Garde-fou : une « lettre » trop courte est presque sûrement un appel raté (résumé,
      // placeholder) — on refuse plutôt que d'envoyer trois lignes à un recruteur.
      if (lettre.length < 200) return fail(400, "Lettre trop courte (min 200 caractères) — envoie le texte complet.");
      const c = await Candidature.findById(id);
      if (!c) return fail(404, "Candidature not found");
      c.lettre = lettre;
      if (c.statut === "identifiée") c.statut = "lettre générée";
      c.letters = [
        ...(c.letters ?? []),
        {
          version: (c.letters?.length ?? 0) + 1,
          model: "manual",
          content: lettre,
          generatedAt: new Date(),
          type: (c.type === "stage" || c.type === "cdi" ? c.type : "alternance") as "stage" | "alternance" | "cdi",
        },
      ];
      await c.save();
      const willBeSent = c.statut === "identifiée" || c.statut === "lettre générée";
      return ok({
        ok: true,
        summary: `Lettre sur mesure enregistrée pour ${c.entreprise} (version ${c.letters.length}, ${lettre.length} caractères).${
          willBeSent
            ? " C'est elle qui partira à l'envoi."
            : ` Attention : statut « ${c.statut} » — cette candidature est déjà partie, aucun envoi automatique ne reprendra cette lettre.`
        }`,
      });
    }

    case "send_letter_to_me": {
      // Destinataire FIXE côté serveur (jamais un paramètre du modèle) : l'agent ne peut pas
      // exfiltrer la lettre vers une adresse arbitraire, d'où requiresConfirmation: false.
      const to = (process.env.PERSONAL_EMAIL || process.env.GMAIL_USER || "").trim();
      if (!to) return fail(500, "PERSONAL_EMAIL / GMAIL_USER non configurés côté serveur");

      // Strip aussi en mode texte libre : le PDF ajoute salutation et signature.
      let lettre = stripLetterBoilerplate(String(input.lettre ?? ""));
      let entreprise = String(input.entreprise ?? "").trim();
      let poste = String(input.poste ?? "").trim();
      let type: "stage" | "alternance" | "cdi" =
        input.type === "stage" || input.type === "cdi" ? input.type : "alternance";
      let generated = false;

      const id = input.candidature_id ? String(input.candidature_id) : "";
      if (id) {
        const c = await Candidature.findById(id);
        if (!c) return fail(404, "Candidature not found");
        entreprise = entreprise || c.entreprise;
        poste = poste || c.poste;
        if (input.type !== "stage" && input.type !== "cdi" && input.type !== "alternance") {
          type = c.type === "stage" || c.type === "cdi" ? c.type : "alternance";
        }
        if (!lettre) {
          lettre = (c.lettre ?? "").trim();
          if (!lettre) {
            // Pas de lettre : on la génère (même consigne persistée que write_letter) et on l'archive.
            try {
              lettre = await generateAndArchiveLetter(c);
              generated = true;
            } catch (err) {
              return fail(502, `Génération échouée : ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
      if (!lettre) return fail(400, "Fournis candidature_id ou le texte complet de la lettre");
      if (!entreprise) return fail(400, "entreprise requise (en-tête du PDF)");
      poste = poste || "Candidature spontanée";

      const slug = entreprise.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lettre";
      const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [
        {
          filename: `LM-${slug}.pdf`,
          content: await generateLettrePDF(lettre, entreprise, poste),
          contentType: "application/pdf",
        },
      ];
      const includeCv = input.include_cv === undefined ? true : isTruthyFlag(input.include_cv);
      let cvAttached = false;
      if (includeCv) {
        try {
          const cv = await resolveCVForSend({ cvFileId: null, type });
          attachments.push({ filename: cv.filename, content: cv.buffer, contentType: "application/pdf" });
          cvAttached = true;
        } catch {
          /* CV introuvable → on envoie quand même la lettre */
        }
      }

      const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      await sendEmail(
        to,
        `📄 LM prête — ${entreprise} (${poste})`,
        `<p>Lettre de motivation pour <strong>${escapeHtml(entreprise)}</strong> — ${escapeHtml(poste)}.<br>PDF en pièce jointe${cvAttached ? " (+ CV)" : ""} ; texte copiable ci-dessous :</p>
<pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:14px;border-left:3px solid #ccc;padding-left:12px;">${escapeHtml(lettre)}</pre>`,
        attachments
      );
      return ok({
        ok: true,
        summary: `Lettre envoyée sur ${to} — ${entreprise} (${poste}), PDF joint${cvAttached ? " + CV" : ""}.${
          generated ? " La lettre a été générée et archivée sur la candidature (statut « lettre générée »)." : ""
        } Rien n'est parti vers l'entreprise.`,
      });
    }

    case "delete_candidature": {
      const id = String(input.candidature_id);
      const c = await Candidature.findByIdAndDelete(id).lean<ICandidature | null>();
      if (!c) return fail(404, "Candidature not found");
      const sentCount = (c.emailsSent ?? []).length;
      return ok({
        ok: true,
        summary: `Candidature supprimée : ${c.entreprise} — ${c.poste} (statut « ${c.statut} »${sentCount ? `, ${sentCount} email(s) dans l'historique perdu(s)` : ""}).`,
      });
    }

    default:
      return fail(400, `Tool ${toolName} not implemented`);
  }
}
