import nodemailer from "nodemailer";
import { withRetry } from "./retry";
import { getSettings } from "@/models/Settings";
import { connectDB } from "./mongodb";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

interface NotificationContext {
  type: "candidature" | "relance" | "inbox";
  candidature?: {
    entreprise: string;
    poste: string;
    email?: string;
    statut?: string;
    _id?: string;
  };
  emailSubject?: string;
  emailFrom?: string;
  snippet?: string;
}

const ICON: Record<NotificationContext["type"], string> = {
  candidature: "🚀",
  relance: "📨",
  inbox: "📬",
};

const TITLE: Record<NotificationContext["type"], string> = {
  candidature: "Candidature envoyée",
  relance: "Relance envoyée",
  inbox: "Réponse reçue",
};

export async function sendNotification(ctx: NotificationContext): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  // Check user preferences
  try {
    await connectDB();
    const settings = await getSettings();
    if (
      (ctx.type === "candidature" && !settings.notifications.onCandidatureSent) ||
      (ctx.type === "relance" && !settings.notifications.onRelanceSent) ||
      (ctx.type === "inbox" && !settings.notifications.onInboxResponse)
    ) {
      return;
    }
  } catch (err) {
    console.warn("[notifications] settings check failed, sending anyway:", err);
  }

  const subject = `${ICON[ctx.type]} ${TITLE[ctx.type]}${ctx.candidature ? ` — ${ctx.candidature.entreprise}` : ""}`;

  const detailRows: string[] = [];
  if (ctx.candidature) {
    detailRows.push(`<tr><td style="padding:6px 12px;color:#888;">Entreprise</td><td style="padding:6px 12px;font-weight:600;">${escape(ctx.candidature.entreprise)}</td></tr>`);
    detailRows.push(`<tr><td style="padding:6px 12px;color:#888;">Poste</td><td style="padding:6px 12px;">${escape(ctx.candidature.poste)}</td></tr>`);
    if (ctx.candidature.email) {
      detailRows.push(`<tr><td style="padding:6px 12px;color:#888;">Email</td><td style="padding:6px 12px;font-family:monospace;">${escape(ctx.candidature.email)}</td></tr>`);
    }
    if (ctx.candidature.statut) {
      detailRows.push(`<tr><td style="padding:6px 12px;color:#888;">Statut</td><td style="padding:6px 12px;">${escape(ctx.candidature.statut)}</td></tr>`);
    }
  }
  if (ctx.emailSubject) {
    detailRows.push(`<tr><td style="padding:6px 12px;color:#888;">Sujet</td><td style="padding:6px 12px;">${escape(ctx.emailSubject)}</td></tr>`);
  }
  if (ctx.emailFrom) {
    detailRows.push(`<tr><td style="padding:6px 12px;color:#888;">De</td><td style="padding:6px 12px;font-family:monospace;">${escape(ctx.emailFrom)}</td></tr>`);
  }
  if (ctx.snippet) {
    detailRows.push(`<tr><td style="padding:6px 12px;color:#888;vertical-align:top;">Extrait</td><td style="padding:6px 12px;font-style:italic;color:#444;">${escape(ctx.snippet.slice(0, 300))}${ctx.snippet.length > 300 ? "…" : ""}</td></tr>`);
  }

  const dashboardLink = ctx.candidature?._id
    ? `https://hamiani.mohammed.harmonith.fr/dashboard/candidatures/${ctx.candidature._id}`
    : `https://hamiani.mohammed.harmonith.fr/dashboard`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f6f6f6;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">
    <div style="padding:20px 24px;background:linear-gradient(135deg,#FF9E64,#2E9FD8);color:#fff;">
      <p style="margin:0;font-size:13px;opacity:.9;">Cockpit — Recherche de stage</p>
      <h1 style="margin:6px 0 0 0;font-size:20px;">${ICON[ctx.type]} ${TITLE[ctx.type]}</h1>
    </div>
    <div style="padding:8px 12px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#222;">
        ${detailRows.join("")}
      </table>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #eee;">
      <a href="${dashboardLink}" style="display:inline-block;padding:10px 16px;background:#FF9E64;color:#000;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Ouvrir le dashboard</a>
    </div>
  </div>
  <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;">Notification automatique — désactivable dans /dashboard/settings</p>
</body></html>`;

  try {
    await withRetry(
      () =>
        getTransporter().sendMail({
          from: process.env.GMAIL_USER,
          to: process.env.GMAIL_USER,
          subject,
          html,
        }),
      { retries: 1, baseDelayMs: 500 }
    );
  } catch (err) {
    console.error("[sendNotification]", err instanceof Error ? err.message : err);
  }
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
