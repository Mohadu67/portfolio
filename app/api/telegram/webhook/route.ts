import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, IAutoReply, IEmailReceived } from "@/models/Candidature";
import { TelegramState, getTelegramState } from "@/models/TelegramState";
import { replyInThread } from "@/lib/email";
import {
  answerCallbackQuery,
  appendDecisionToMessage,
  parseApprovalCallback,
  parseActionCallback,
  sendTelegramMessage,
} from "@/lib/telegram";
import {
  handleIncomingTelegramText,
  handleIncomingTelegramVoice,
  confirmTelegramAction,
  TELEGRAM_HELP_TEXT,
} from "@/lib/telegram-agent";

// Webhook Telegram — trois flux :
//  1. Messages texte → agent IA conversationnel (lib/telegram-agent.ts). ACK immédiat,
//     traitement asynchrone (l'agent peut dépasser le timeout webhook de Telegram, et un
//     non-200 ferait re-livrer l'update en boucle). Dédup par update_id.
//  2. Callbacks "act:" → confirmation ✅/❌ d'une action proposée par l'agent.
//  3. Callbacks "ar:" → approbation ✅/❌ d'une auto-réponse (cf. lib/gmail-imap.ts).
//
// Auth : header x-telegram-bot-api-secret-token, configuré côté Telegram via setWebhook :
//   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
//     -d "url=https://<domaine>/api/telegram/webhook" \
//     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"

export const runtime = "nodejs";
export const maxDuration = 60;

interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id: number;
    text?: string;
    voice?: { file_id: string; duration?: number; mime_type?: string };
    chat?: { id: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      text?: string;
      chat?: { id: number };
    };
  };
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // 401 (pas 500) : un 5xx ferait re-livrer l'update par Telegram en boucle.
    return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET not configured" }, { status: 401 });
  }
  if (!secretsMatch(request.headers.get("x-telegram-bot-api-secret-token") ?? "", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const allowedChat = process.env.TELEGRAM_CHAT_ID;

  // ---------- 1. Messages (texte ou vocal) → agent IA ----------
  const msg = update.message;
  if ((msg?.text || msg?.voice) && msg.chat) {
    // Fail-closed : seul le chat configuré parle à l'agent ; les autres sont ignorés.
    if (!allowedChat || String(msg.chat.id) !== String(allowedChat)) {
      return NextResponse.json({ ok: true });
    }
    try {
      await connectDB();
      const chatId = String(msg.chat.id);
      await getTelegramState(chatId);
      // Dédup : Telegram re-livre les updates non-ACKés (ou en cas de doute réseau).
      if (typeof update.update_id === "number") {
        const claim = await TelegramState.updateOne(
          { chatId, processedUpdateIds: { $ne: update.update_id } },
          { $push: { processedUpdateIds: { $each: [update.update_id], $slice: -200 } } }
        );
        if (claim.modifiedCount !== 1) return NextResponse.json({ ok: true });
      }

      if (msg.voice) {
        // Vocal : transcription Gemini puis même boucle agent. ACK immédiat.
        const voice = msg.voice;
        void handleIncomingTelegramVoice(chatId, voice.file_id, voice.duration, voice.mime_type).catch(
          async (err) => {
            const m = err instanceof Error ? err.message : String(err);
            console.error("[telegram agent voice]", m);
            await sendTelegramMessage(`⚠️ Impossible de traiter le vocal : ${m.slice(0, 300)}`).catch(() => {});
          }
        );
        return NextResponse.json({ ok: true });
      }

      const text = (msg.text ?? "").trim();
      const lower = text.toLowerCase();
      if (text === "/start" || text === "/aide" || text === "/help" || lower === "aide") {
        await sendTelegramMessage(TELEGRAM_HELP_TEXT);
        return NextResponse.json({ ok: true });
      }

      // ACK tout de suite, l'agent répond via sendMessage quand il a fini.
      void handleIncomingTelegramText(chatId, text).catch(async (err) => {
        const m = err instanceof Error ? err.message : String(err);
        console.error("[telegram agent]", m);
        await sendTelegramMessage(`⚠️ Erreur de l'agent : ${m.slice(0, 300)}`).catch(() => {});
      });
    } catch (error) {
      console.error("[telegram webhook message]", error instanceof Error ? error.message : error);
    }
    return NextResponse.json({ ok: true });
  }

  // ---------- Callbacks (boutons) ----------
  const cb = update.callback_query;
  if (!cb?.data) return NextResponse.json({ ok: true });

  // Fail-closed : si le chat est absent de l'update (callback inline-mode, message
  // inaccessible), on refuse aussi.
  const cbChatId = cb.message?.chat?.id;
  if (!allowedChat || cbChatId === undefined || String(cbChatId) !== String(allowedChat)) {
    await answerCallbackQuery(cb.id, "Non autorisé").catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const messageId = cb.message?.message_id ?? null;
  const currentText = cb.message?.text ?? "";

  // ---------- 2. Confirmation d'action de l'agent (act:) ----------
  const act = parseActionCallback(cb.data);
  if (act) {
    try {
      const res = await confirmTelegramAction(act.token, act.approve);
      if (res.outcome === "already_done") {
        await answerCallbackQuery(cb.id, "Déjà traité").catch(() => {});
      } else if (res.outcome === "cancelled") {
        await answerCallbackQuery(cb.id, "Annulé — rien n'a été exécuté").catch(() => {});
        if (messageId) {
          await appendDecisionToMessage(messageId, currentText, "❌ Annulée.").catch(() => {});
        }
      } else if (res.outcome === "executed") {
        await answerCallbackQuery(cb.id, "✅ Exécutée").catch(() => {});
        if (messageId) {
          await appendDecisionToMessage(messageId, currentText, "✅ Exécutée.").catch(() => {});
        }
        if (res.resultText) await sendTelegramMessage(res.resultText).catch(() => {});
      } else {
        // failed
        await answerCallbackQuery(cb.id, "⚠️ Échec de l'exécution", true).catch(() => {});
        if (res.resultText) await sendTelegramMessage(res.resultText).catch(() => {});
      }
    } catch (error) {
      const m = error instanceof Error ? error.message : String(error);
      console.error("[telegram webhook act]", m);
      await answerCallbackQuery(cb.id, `Erreur : ${m.slice(0, 150)}`, true).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  // ---------- 3. Approbation d'auto-réponse (ar:) ----------
  const parsed = parseApprovalCallback(cb.data);
  if (!parsed) {
    await answerCallbackQuery(cb.id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  try {
    await connectDB();

    // Claim atomique pending → approved/rejected : un double-tap (ou 2 livraisons du même
    // update) ne matche plus le filtre et répond "déjà traité" au lieu de ré-envoyer.
    const newStatus = parsed.action === "approve" ? "approved" : "rejected";
    const candDoc = await Candidature.findOneAndUpdate(
      { autoReplies: { $elemMatch: { approvalToken: parsed.token, approvalStatus: "pending" } } },
      {
        $set: {
          "autoReplies.$.approvalStatus": newStatus,
          "autoReplies.$.approvalDecidedAt": new Date(),
        },
      },
      { new: true }
    );
    if (!candDoc) {
      await answerCallbackQuery(cb.id, "Déjà traité (ou introuvable)").catch(() => {});
      return NextResponse.json({ ok: true });
    }

    const autoReply = (candDoc.autoReplies ?? []).find(
      (a: IAutoReply) => a.approvalToken === parsed.token
    );
    const arMessageId = messageId ?? autoReply?.telegramMessageId ?? null;

    if (parsed.action === "reject") {
      await answerCallbackQuery(cb.id, "Rejeté — rien n'a été envoyé").catch(() => {});
      if (arMessageId) {
        await appendDecisionToMessage(
          arMessageId,
          currentText,
          `❌ Rejeté — aucune réponse envoyée à ${candDoc.entreprise}.`
        ).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // Approve : retrouver le mail d'origine dans la même candidature pour reconstruire le thread.
    const inbound = (candDoc.emailsReceived ?? []).find(
      (e: IEmailReceived) => !!autoReply?.inboundMessageId && e.messageId === autoReply.inboundMessageId
    );
    if (!autoReply || !inbound) {
      await Candidature.updateOne(
        { _id: candDoc._id, "autoReplies.approvalToken": parsed.token },
        { $set: { "autoReplies.$.error": "Mail d'origine introuvable au moment de l'approbation" } }
      );
      await answerCallbackQuery(cb.id, "Mail d'origine introuvable — envoi impossible", true).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    try {
      const sent = await replyInThread({
        to: inbound.from,
        subject: inbound.subject,
        bodyText: autoReply.reply,
        inReplyToMessageId: inbound.messageId,
        references: inbound.references,
      });
      await Candidature.updateOne(
        { _id: candDoc._id, "autoReplies.approvalToken": parsed.token },
        {
          $set: {
            "autoReplies.$.sent": true,
            "autoReplies.$.sentMessageId": sent.messageId,
            "autoReplies.$.error": null,
          },
        }
      );
      await answerCallbackQuery(cb.id, "✅ Réponse envoyée").catch(() => {});
      if (arMessageId) {
        await appendDecisionToMessage(
          arMessageId,
          currentText,
          `✅ Réponse envoyée à ${candDoc.entreprise} (${inbound.from}).`
        ).catch(() => {});
      }
    } catch (sendErr) {
      // Échec SMTP : on repasse en pending pour que les boutons restent actifs (retry possible).
      // Trade-off assumé : sur un échec ambigu post-DATA (mail accepté mais throw avant le 250),
      // un re-tap peut doubler l'envoi — cas rare, préféré à la perte silencieuse de la réponse.
      const m = sendErr instanceof Error ? sendErr.message : String(sendErr);
      await Candidature.updateOne(
        { _id: candDoc._id, "autoReplies.approvalToken": parsed.token },
        { $set: { "autoReplies.$.approvalStatus": "pending", "autoReplies.$.error": m } }
      );
      await answerCallbackQuery(cb.id, `Échec d'envoi : ${m.slice(0, 150)} — retape ✅ pour réessayer`, true).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const m = error instanceof Error ? error.message : String(error);
    console.error("[telegram webhook]", m);
    // 200 quand même : Telegram re-livrerait l'update en boucle sur un 5xx, et le claim
    // atomique a peut-être déjà consommé le pending (le retry ferait "déjà traité").
    return NextResponse.json({ ok: true, error: m });
  }
}
