import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, CandidatureStatut, ICandidature } from "@/models/Candidature";
import { CVSection, ICVSection } from "@/models/CVSection";
import { sendRelance } from "@/lib/email";
import { verifyAuth } from "@/lib/auth";
import { getTool } from "@/lib/ai/tools";
import { processSingleCompany } from "@/lib/auto-apply";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

interface ExecBody {
  tool: string;
  input: Record<string, unknown>;
}

function applyVariables(text: string, c: { entreprise: string; poste: string; type: string }, prenom: string): string {
  return text
    .replaceAll("{entreprise}", c.entreprise)
    .replaceAll("{poste}", c.poste)
    .replaceAll("{type}", c.type)
    .replaceAll("{prenom}", prenom);
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ExecBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tool = getTool(body.tool);
  if (!tool) return NextResponse.json({ error: `Unknown tool: ${body.tool}` }, { status: 400 });

  const input = body.input ?? {};
  const prenom = (process.env.PROFIL_NOM ?? "Mohammed Hamiani").split(" ")[0];

  await connectDB();

  try {
    switch (body.tool) {
      case "list_candidatures": {
        const statut = input.statut ? String(input.statut) : null;
        const search = input.search ? String(input.search).trim() : "";
        const limit = Math.min(Math.max(Number(input.limit) || 15, 1), 50);
        const query: Record<string, unknown> = {};
        if (statut) query.statut = statut;
        if (search) {
          const rx = new RegExp(escapeRegex(search), "i");
          query.$or = [{ entreprise: rx }, { poste: rx }];
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
        return NextResponse.json({
          ok: true,
          summary: JSON.stringify({ count: items.length, items }),
        });
      }

      case "get_candidature": {
        const id = String(input.candidature_id);
        const c = await Candidature.findById(id).lean<ICandidature | null>();
        if (!c) return NextResponse.json({ error: "Candidature not found" }, { status: 404 });
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
        return NextResponse.json({ ok: true, summary: JSON.stringify(detail) });
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
        return NextResponse.json({
          ok: true,
          summary: JSON.stringify({ count: items.length, items }),
        });
      }

      case "list_cv_sections": {
        const sections = await CVSection.find({}, { key: 1, type: 1, title: 1, order: 1 })
          .sort({ order: 1 })
          .lean<ICVSection[]>();
        return NextResponse.json({
          ok: true,
          summary: JSON.stringify(
            sections.map((s) => ({ key: s.key, type: s.type, title: s.title }))
          ),
        });
      }

      case "get_cv_section": {
        const key = String(input.key);
        const s = await CVSection.findOne({ key }).lean<ICVSection | null>();
        if (!s) return NextResponse.json({ error: "Section not found" }, { status: 404 });
        return NextResponse.json({
          ok: true,
          summary: JSON.stringify({ key: s.key, type: s.type, title: s.title, content: s.content }),
        });
      }

      case "schedule_relance": {
        const { candidature_id, scheduled_for, title, message } = input as Record<string, string>;
        const c = await Candidature.findById(candidature_id);
        if (!c) return NextResponse.json({ error: "Candidature not found" }, { status: 404 });
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
        return NextResponse.json({
          ok: true,
          summary: `Relance programmée chez ${c.entreprise} pour le ${new Date(scheduled_for).toLocaleString("fr-FR")}`,
        });
      }

      case "cancel_relance": {
        const candidature_id = String(input.candidature_id);
        const idx = Number(input.relance_index);
        const c = await Candidature.findById(candidature_id);
        if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!c.relanceHistory?.[idx]) {
          return NextResponse.json({ error: "Relance not found" }, { status: 404 });
        }
        c.relanceHistory[idx].status = "annulée";
        await c.save();
        return NextResponse.json({ ok: true, summary: `Relance #${idx + 1} chez ${c.entreprise} annulée` });
      }

      case "update_candidature_status": {
        const candidature_id = String(input.candidature_id);
        const statut = String(input.statut) as CandidatureStatut;
        if (!STATUTS.includes(statut)) {
          return NextResponse.json({ error: `Invalid status: ${statut}` }, { status: 400 });
        }
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
        if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ ok: true, summary: `Statut de ${c.entreprise} mis à "${statut}"` });
      }

      case "update_candidature_notes": {
        const candidature_id = String(input.candidature_id);
        const notes = String(input.notes ?? "");
        const c = await Candidature.findByIdAndUpdate(candidature_id, { notes }, { new: true });
        if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ ok: true, summary: `Notes mises à jour pour ${c.entreprise}` });
      }

      case "send_relance_now": {
        const candidature_id = String(input.candidature_id);
        const title = String(input.title ?? "Relance");
        const message = String(input.message);
        const c = await Candidature.findById(candidature_id);
        if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!c.email) return NextResponse.json({ error: "Aucun email destinataire" }, { status: 400 });

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
        return NextResponse.json({ ok: true, summary: `Relance envoyée à ${c.email} (${c.entreprise})` });
      }

      case "apply_to_company": {
        const url = String(input.url ?? "").trim();
        if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
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
        let actions:
          | {
              id: string;
              label: string;
              tool: string;
              input: Record<string, unknown>;
              variant: "primary" | "secondary" | "danger";
            }[]
          | undefined;
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

        return NextResponse.json({ ok: !decision.error, summary, actions });
      }

      default:
        return NextResponse.json({ error: `Tool ${body.tool} not implemented` }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[tool-exec ${body.tool}]`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
