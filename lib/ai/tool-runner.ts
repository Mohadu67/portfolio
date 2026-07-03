// Exécution serveur des tools IA — partagée entre /api/chat/tool-exec (chat dashboard)
// et le bot Telegram (lib/telegram-agent.ts). Déplacé tel quel depuis la route tool-exec.

import { connectDB } from "@/lib/mongodb";
import { Candidature, CandidatureStatut, ICandidature } from "@/models/Candidature";
import { CVSection, ICVSection } from "@/models/CVSection";
import { sendRelance } from "@/lib/email";
import { processSingleCompany } from "@/lib/auto-apply";
import { runProcessPending } from "@/lib/pending-processor";
import { sendAutoReplyApprovalRequest } from "@/lib/telegram";
import { getSettings } from "@/models/Settings";
import { resolveCompanyWebsite } from "@/lib/serpapi-resolve";
import { scrapeCompanyWebsite, findCareersPage, scrapeCareersPage } from "@/lib/web-scraper";
import { scoreCompanyFit } from "@/lib/gemini";
import { AgentMemory, IAgentMemory, AGENT_MEMORY_CATEGORIES, normalizeFact, AgentMemoryCategory } from "@/models/AgentMemory";
import { getTelegramState } from "@/models/TelegramState";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  if (tokens.length === 0) return null;
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
      const state = await getTelegramState(chatId);
      state.reminders = [
        ...(state.reminders ?? []).filter((r: { sent: boolean }) => !r.sent).slice(-30),
        { message, dueAt: when, sent: false, createdAt: new Date() },
      ];
      await state.save();
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
      const inputUrl = typeof input.url === "string" && input.url.trim() ? input.url.trim() : null;
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
      const domain = new URL(site).hostname.replace(/^www\./, "");
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
      // Ré-émet le message Telegram (avec boutons ✅/❌) d'une auto-réponse pending.
      const id = String(input.candidature_id);
      const c = await Candidature.findById(id).lean<ICandidature | null>();
      if (!c) return fail(404, "Candidature not found");
      const pending = (c.autoReplies ?? []).find((a) => a.approvalStatus === "pending" && a.approvalToken);
      if (!pending || !pending.approvalToken) {
        return fail(404, "Aucune auto-réponse en attente pour cette candidature");
      }
      const inbound = (c.emailsReceived ?? []).find(
        (e) => !!pending.inboundMessageId && e.messageId === pending.inboundMessageId
      );
      const settings = await getSettings();
      await sendAutoReplyApprovalRequest({
        approvalToken: pending.approvalToken,
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
      return ok({ ok: true, summary: `Demande d'approbation renvoyée sur Telegram pour ${c.entreprise}` });
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
      if (statut !== "postulée") {
        await Candidature.updateOne(
          { _id: candidature_id, statut: "postulée" },
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
      const type = (input.type === "alternance" || input.type === "cdi") ? input.type : "stage";
      const emailOverride = typeof input.email_override === "string" && input.email_override.trim()
        ? input.email_override.trim()
        : undefined;
      const decision = await processSingleCompany(url, {
        dryRun: input.dry_run === true,
        skipQualityScore: input.skip_quality_score === true,
        allowDuplicate: input.allow_duplicate === true,
        allowGenericEmail: input.allow_generic_email === true,
        emailOverride,
        candidatureType: type,
      });
      const allowGenericEmailUsed = input.allow_generic_email === true;
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
        skip_quality_score: input.skip_quality_score === true,
        allow_duplicate: input.allow_duplicate === true,
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
      const force = input.force === true;
      const dryRun = input.dry_run === true;
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

    default:
      return fail(400, `Tool ${toolName} not implemented`);
  }
}
