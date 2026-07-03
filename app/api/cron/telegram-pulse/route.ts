import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, ICandidature } from "@/models/Candidature";
import { TelegramState, ITelegramReminder } from "@/models/TelegramState";
import { getSettings } from "@/models/Settings";
import { recordCronRun } from "@/lib/cron-log";
import { isTelegramConfigured, sendTelegramMessage, sendAutoReplyApprovalRequest } from "@/lib/telegram";

// Cron endpoint : pulse Telegram (toutes les 30 min via crontab VPS).
//  1. Livre les rappels one-shot arrivés à échéance (tool schedule_telegram_reminder).
//  2. À 8h (Europe/Paris) : briefing quotidien — relances du jour/en retard, validations
//     en attente (avec re-envoi des boutons pour celles > 24h), réponses des dernières 24h,
//     backlog. Dédup par lastBriefingDate.
//
// Auth: Authorization: Bearer $CRON_SECRET
//   */30 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/cron/telegram-pulse >/dev/null

export const runtime = "nodejs";
export const maxDuration = 60;

const BRIEFING_HOUR_PARIS = 8;

function parisNow(): { hour: number; dateKey: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hour: Number(get("hour")), dateKey: `${get("year")}-${get("month")}-${get("day")}` };
}

async function deliverDueReminders(chatId: string): Promise<number> {
  const state = await TelegramState.findOne({ chatId });
  if (!state) return 0;
  const now = Date.now();
  let delivered = 0;
  for (const r of (state.reminders ?? []) as ITelegramReminder[]) {
    if (r.sent || new Date(r.dueAt).getTime() > now) continue;
    // Claim atomique par rappel (message+dueAt comme identité) — un pulse concurrent skip.
    const claim = await TelegramState.updateOne(
      { chatId },
      { $set: { "reminders.$[r].sent": true } },
      { arrayFilters: [{ "r.sent": false, "r.dueAt": r.dueAt, "r.message": r.message }] }
    );
    if (claim.modifiedCount !== 1) continue;
    await sendTelegramMessage(`⏰ Rappel, patron :\n${r.message}`).catch(() => {});
    delivered++;
  }
  return delivered;
}

interface BriefingData {
  enRetard: Array<{ entreprise: string; poste: string; daysLate: number }>;
  aujourdhui: Array<{ entreprise: string; heure: string }>;
  pendingApprovals: Array<{ entreprise: string; ageHours: number; candidatureId: string }>;
  reponses24h: Array<{ entreprise: string; subject: string }>;
  backlogIdentifiees: number;
  stagnantes: number;
}

async function collectBriefing(): Promise<BriefingData> {
  const now = Date.now();
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const endOfToday = startOfToday + 86_400_000;

  const docs = await Candidature.find(
    {
      $or: [
        { "relanceHistory.status": "programmée" },
        { autoReplies: { $elemMatch: { approvalStatus: "pending" } } },
        { "emailsReceived.date": { $gte: new Date(now - 86_400_000) } },
        { statut: { $in: ["identifiée", "postulée"] } },
      ],
    },
    { entreprise: 1, poste: 1, statut: 1, relanceHistory: 1, autoReplies: 1, emailsReceived: 1, updated_at: 1 }
  ).lean<ICandidature[]>();

  const data: BriefingData = {
    enRetard: [],
    aujourdhui: [],
    pendingApprovals: [],
    reponses24h: [],
    backlogIdentifiees: 0,
    stagnantes: 0,
  };

  for (const c of docs) {
    if (c.statut === "identifiée") data.backlogIdentifiees++;
    if (
      c.statut === "postulée" &&
      c.updated_at &&
      now - new Date(c.updated_at).getTime() > 7 * 86_400_000
    ) {
      data.stagnantes++;
    }
    for (const r of c.relanceHistory ?? []) {
      if (r.status !== "programmée") continue;
      const t = new Date(r.scheduledFor).getTime();
      if (Number.isNaN(t)) continue;
      if (t < startOfToday) {
        data.enRetard.push({
          entreprise: c.entreprise,
          poste: c.poste,
          daysLate: Math.floor((startOfToday - t) / 86_400_000) + 1,
        });
      } else if (t < endOfToday) {
        data.aujourdhui.push({
          entreprise: c.entreprise,
          heure: new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }),
        });
      }
    }
    for (const a of c.autoReplies ?? []) {
      if (a.approvalStatus !== "pending") continue;
      data.pendingApprovals.push({
        entreprise: c.entreprise,
        ageHours: Math.floor((now - new Date(a.date).getTime()) / 3_600_000),
        candidatureId: String(c._id),
      });
    }
    for (const e of c.emailsReceived ?? []) {
      if (new Date(e.date).getTime() >= now - 86_400_000) {
        data.reponses24h.push({ entreprise: c.entreprise, subject: e.subject });
      }
    }
  }
  return data;
}

function composeBriefing(d: BriefingData): string {
  const lines: string[] = ["☀️ Briefing du matin, patron :", ""];
  if (d.enRetard.length) {
    lines.push(`🔴 ${d.enRetard.length} relance(s) en retard :`);
    d.enRetard.slice(0, 5).forEach((r) => lines.push(`- ${r.entreprise} (${r.daysLate} j de retard)`));
  }
  if (d.aujourdhui.length) {
    lines.push(`📅 ${d.aujourdhui.length} relance(s) prévue(s) aujourd'hui :`);
    d.aujourdhui.slice(0, 5).forEach((r) => lines.push(`- ${r.entreprise} à ${r.heure}`));
  }
  if (d.pendingApprovals.length) {
    lines.push(`⏳ ${d.pendingApprovals.length} réponse(s) IA en attente de ta validation${d.pendingApprovals.some((p) => p.ageHours >= 24) ? " (je te renvoie les boutons des plus anciennes)" : ""} :`);
    d.pendingApprovals.slice(0, 5).forEach((p) => lines.push(`- ${p.entreprise} (depuis ${p.ageHours} h)`));
  }
  if (d.reponses24h.length) {
    lines.push(`📬 ${d.reponses24h.length} réponse(s) reçue(s) ces dernières 24 h :`);
    d.reponses24h.slice(0, 5).forEach((r) => lines.push(`- ${r.entreprise} : ${r.subject.slice(0, 60)}`));
  }
  if (d.backlogIdentifiees > 0) lines.push(`📦 Backlog : ${d.backlogIdentifiees} offre(s) à traiter.`);
  if (d.stagnantes > 0) lines.push(`🐌 ${d.stagnantes} candidature(s) sans nouvelles depuis plus de 7 j.`);
  if (lines.length === 2) lines.push("Rien d'urgent aujourd'hui. Profites-en pour prospecter 💪");
  return lines.join("\n");
}

// Re-envoie les boutons ✅/❌ des validations en attente depuis plus de 24 h (1×/jour via le briefing).
async function resendOldApprovals(pending: BriefingData["pendingApprovals"]): Promise<number> {
  const old = pending.filter((p) => p.ageHours >= 24);
  let resent = 0;
  const settings = await getSettings();
  for (const p of old.slice(0, 5)) {
    const c = await Candidature.findById(p.candidatureId).lean<ICandidature | null>();
    if (!c) continue;
    const a = (c.autoReplies ?? []).find((x) => x.approvalStatus === "pending" && x.approvalToken);
    if (!a?.approvalToken) continue;
    const inbound = (c.emailsReceived ?? []).find(
      (e) => !!a.inboundMessageId && e.messageId === a.inboundMessageId
    );
    await sendAutoReplyApprovalRequest({
      approvalToken: a.approvalToken,
      entreprise: c.entreprise,
      poste: c.poste,
      from: inbound?.from ?? "(inconnu)",
      fromName: inbound?.fromName,
      subject: inbound?.subject ?? "(sans sujet)",
      inboundExcerpt: inbound?.snippet || inbound?.bodyText || "",
      category: a.category,
      confidence: a.confidence,
      minConfidence: settings.gmail.autoReplyMinConfidence ?? 0.7,
      reply: a.reply,
    }).catch(() => {});
    resent++;
  }
  return resent;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json({ ok: true, skipped: "telegram not configured" });
    }
    await connectDB();
    const chatId = String(process.env.TELEGRAM_CHAT_ID);

    const reminders = await deliverDueReminders(chatId);

    let briefingSent = false;
    let approvalsResent = 0;
    const { hour, dateKey } = parisNow();
    if (hour === BRIEFING_HOUR_PARIS) {
      // Claim atomique du briefing du jour (le cron passe 2× dans l'heure).
      const claim = await TelegramState.updateOne(
        { chatId, lastBriefingDate: { $ne: dateKey } },
        { $set: { lastBriefingDate: dateKey } }
      );
      if (claim.modifiedCount === 1) {
        const data = await collectBriefing();
        await sendTelegramMessage(composeBriefing(data));
        approvalsResent = await resendOldApprovals(data.pendingApprovals);
        briefingSent = true;
      }
    }

    await recordCronRun({
      name: "telegram-pulse",
      startedAt,
      status: "success",
      summary: `${reminders} rappel(s)${briefingSent ? ", briefing envoyé" : ""}${approvalsResent ? `, ${approvalsResent} validation(s) relancée(s)` : ""}`,
    });
    return NextResponse.json({ ok: true, reminders, briefingSent, approvalsResent });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cron telegram-pulse]", msg);
    await recordCronRun({ name: "telegram-pulse", startedAt, status: "failed", error: msg });
    return NextResponse.json({ error: "Cron failed", details: msg }, { status: 500 });
  }
}
