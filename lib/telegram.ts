// Client Bot API Telegram pour la validation humaine des réponses auto (human-in-the-loop).
// Config par env : TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (+ TELEGRAM_WEBHOOK_SECRET côté webhook).
// Sans ces vars, isTelegramConfigured() = false et le sync retombe sur l'envoi direct historique.
// Setup complet : docs/TELEGRAM-APPROVAL.md

import { withRetry } from "./retry";

const API_BASE = "https://api.telegram.org";

// Telegram limite un message à 4096 chars. TOUS les champs libres sont bornés (pas seulement
// extrait/réponse : un sujet de thread « TR: TR: RE: … » peut dépasser 1000 chars et faire
// échouer sendMessage en 400 MESSAGE_TOO_LONG, non retryé). Budget max ≈ 110 fixes + 600 +
// 2500 + 200 + 150 + 2×120 ≈ 3800 < 4096.
const MAX_EXCERPT_CHARS = 600;
const MAX_REPLY_CHARS = 2500;
const MAX_SUBJECT_CHARS = 200;
const MAX_SENDER_CHARS = 150;
const MAX_FIELD_CHARS = 120; // entreprise, poste

// Le webhook exige TELEGRAM_WEBHOOK_SECRET : sans lui, les demandes partiraient sur Telegram
// mais aucun tap ne serait traitable (webhook en 500) → on exige les 3 vars pour activer le
// mode approbation, sinon fallback envoi direct.
export function isTelegramConfigured(): boolean {
  return (
    !!process.env.TELEGRAM_BOT_TOKEN &&
    !!process.env.TELEGRAM_CHAT_ID &&
    !!process.env.TELEGRAM_WEBHOOK_SECRET
  );
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function tgCall<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant");
  return withRetry(
    async () => {
      const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as TelegramApiResponse<T>;
      if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? res.status}`);
      return data.result as T;
    },
    {
      retries: 2,
      baseDelayMs: 1000,
      // Les 4xx Telegram (bad request, message trop vieux…) ne se résolvent pas en réessayant.
      shouldRetry: (err) => !(err instanceof Error && /failed: (400|401|403)/.test(err.message)),
    }
  );
}

export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, max: number): string {
  const clean = s.trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export interface ApprovalRequestInput {
  approvalToken: string;
  entreprise: string;
  poste: string;
  from: string;
  fromName?: string;
  subject: string;
  inboundExcerpt: string;
  category: string;
  confidence: number;
  minConfidence: number;
  reply: string;
}

// Corps du message d'approbation (HTML Telegram). Exporté pur pour être testable.
export function buildApprovalMessage(input: ApprovalRequestInput): string {
  const pct = Math.round(input.confidence * 100);
  const lowConfidence = input.confidence < input.minConfidence;
  const sender = input.fromName ? `${input.fromName} — ${input.from}` : input.from;
  const lines = [
    `📬 <b>Réponse reçue — ${escapeTelegramHtml(truncate(input.entreprise, MAX_FIELD_CHARS))}</b>`,
    `<i>${escapeTelegramHtml(truncate(input.poste, MAX_FIELD_CHARS))}</i>`,
    ``,
    `<b>De :</b> ${escapeTelegramHtml(truncate(sender, MAX_SENDER_CHARS))}`,
    `<b>Sujet :</b> ${escapeTelegramHtml(truncate(input.subject, MAX_SUBJECT_CHARS))}`,
    `<b>Catégorie :</b> ${escapeTelegramHtml(input.category)} (confiance ${pct}%${lowConfidence ? " ⚠️ sous le seuil" : ""})`,
    ``,
    `<b>📥 Leur message :</b>`,
    `<blockquote>${escapeTelegramHtml(truncate(input.inboundExcerpt, MAX_EXCERPT_CHARS))}</blockquote>`,
    ``,
    `<b>🤖 Réponse préparée :</b>`,
    `<blockquote>${escapeTelegramHtml(truncate(input.reply, MAX_REPLY_CHARS))}</blockquote>`,
    ``,
    `J'envoie ?`,
  ];
  return lines.join("\n");
}

// Envoie la demande d'approbation avec boutons inline. Retourne le message_id Telegram
// (permet d'éditer le message après décision).
export async function sendAutoReplyApprovalRequest(input: ApprovalRequestInput): Promise<number> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID manquant");
  const msg = await tgCall<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: buildApprovalMessage(input),
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Envoyer", callback_data: `ar:ok:${input.approvalToken}` },
          { text: "❌ Rejeter", callback_data: `ar:no:${input.approvalToken}` },
        ],
      ],
    },
  });
  return msg.message_id;
}

export interface ParsedApprovalCallback {
  action: "approve" | "reject";
  token: string;
}

// callback_data des boutons : "ar:ok:<token>" / "ar:no:<token>" (max 64 bytes côté Telegram).
export function parseApprovalCallback(data: string): ParsedApprovalCallback | null {
  const m = data.match(/^ar:(ok|no):([a-f0-9]{8,64})$/);
  if (!m) return null;
  return { action: m[1] === "ok" ? "approve" : "reject", token: m[2] };
}

// Accusé du tap sur un bouton (fait disparaître le spinner côté client Telegram).
export async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<void> {
  await tgCall("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text: text.slice(0, 200), show_alert: showAlert } : {}),
  });
}

// Édite le message d'approbation après décision (texte brut, boutons retirés car
// reply_markup omis). currentText = texte rendu du message d'origine (cb.message.text).
export async function appendDecisionToMessage(messageId: number, currentText: string, decisionLine: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID manquant");
  const base = truncate(currentText, 4096 - decisionLine.length - 8);
  await tgCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: `${base}\n\n${decisionLine}`,
  });
}

// Notification simple (sans boutons) — utilitaire générique.
export async function sendTelegramMessage(text: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID manquant");
  await tgCall("sendMessage", { chat_id: chatId, text: text.slice(0, 4096) });
}

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

// Message texte brut avec clavier inline générique. Retourne le message_id.
export async function sendTelegramMessageWithButtons(
  text: string,
  buttons: TelegramInlineButton[][]
): Promise<number> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID manquant");
  const msg = await tgCall<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4096),
    reply_markup: { inline_keyboard: buttons },
  });
  return msg.message_id;
}

// Indicateur « en train d'écrire » pendant que l'agent réfléchit (expire seul après ~5 s).
export async function sendTelegramChatAction(action: string = "typing"): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID manquant");
  await tgCall("sendChatAction", { chat_id: chatId, action });
}

// Télécharge un fichier Telegram (vocal, audio…) en base64 via getFile.
// Limite Bot API : 20 MB — on borne en dessous pour protéger la mémoire.
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function getTelegramFileAsBase64(
  fileId: string
): Promise<{ base64: string; sizeBytes: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant");
  const file = await tgCall<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram getFile: file_path absent");
  if (file.file_size && file.file_size > MAX_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (${Math.round(file.file_size / 1024 / 1024)} MB, max 15 MB)`);
  }
  const res = await fetch(`${API_BASE}/file/bot${token}/${file.file_path}`);
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (${Math.round(buf.byteLength / 1024 / 1024)} MB, max 15 MB)`);
  }
  return { base64: buf.toString("base64"), sizeBytes: buf.byteLength };
}

// Envoie un fichier audio (WAV/MP3…) via sendAudio (multipart). Affiché avec un lecteur
// dans le chat ; caption optionnelle (max 1024 chars côté Telegram).
export async function sendTelegramAudio(
  audio: Buffer,
  filename: string,
  caption?: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID manquant");
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), filename);
  if (caption) form.append("caption", caption.slice(0, 1024));
  const res = await fetch(`${API_BASE}/bot${token}/sendAudio`, { method: "POST", body: form });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram sendAudio failed: ${data.description ?? res.status}`);
}

export interface ParsedActionCallback {
  approve: boolean;
  token: string;
}

// callback_data des confirmations d'action du bot IA : "act:ok:<token>" / "act:no:<token>".
// Namespace distinct de "ar:" (approbation d'auto-réponse).
export function parseActionCallback(data: string): ParsedActionCallback | null {
  const m = data.match(/^act:(ok|no):([a-f0-9]{8,64})$/);
  if (!m) return null;
  return { approve: m[1] === "ok", token: m[2] };
}
