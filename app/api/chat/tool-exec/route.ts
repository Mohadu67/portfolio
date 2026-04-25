import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, CandidatureStatut } from "@/models/Candidature";
import { sendRelance } from "@/lib/email";
import { verifyAuth } from "@/lib/auth";
import { getTool } from "@/lib/ai/tools";

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
          { entreprise: c.entreprise, poste: c.poste, type: c.type ?? "stage" },
          prenom
        );
        await sendRelance(
          c.entreprise,
          c.poste,
          c.email,
          fullMessage,
          title,
          c.type ?? "stage",
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

      default:
        return NextResponse.json({ error: `Tool ${body.tool} not implemented` }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[tool-exec ${body.tool}]`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
