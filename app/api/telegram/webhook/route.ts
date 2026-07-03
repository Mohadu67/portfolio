import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, IAutoReply, IEmailReceived } from "@/models/Candidature";
import { replyInThread } from "@/lib/email";
import {
  answerCallbackQuery,
  appendDecisionToMessage,
  parseApprovalCallback,
} from "@/lib/telegram";

// Webhook Telegram : reçoit les taps sur les boutons ✅/❌ des demandes d'approbation
// d'auto-réponse (cf. lib/gmail-imap.ts, branche telegramApproval).
//
// Auth : header x-telegram-bot-api-secret-token, configuré côté Telegram via setWebhook :
//   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
//     -d "url=https://<domaine>/api/telegram/webhook" \
//     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
//
// On répond toujours 200 après auth (sauf erreur interne inattendue) : un non-200 fait
// re-livrer l'update par Telegram en boucle.

export const runtime = "nodejs";
export const maxDuration = 60;

interface TelegramUpdate {
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

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const cb = update.callback_query;
  // On ne traite que les callback_query des boutons d'approbation ; tout le reste est ignoré.
  if (!cb?.data) return NextResponse.json({ ok: true });

  const parsed = parseApprovalCallback(cb.data);
  if (!parsed) {
    await answerCallbackQuery(cb.id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // Seul le chat configuré (celui de Mohammed) peut décider.
  const allowedChat = process.env.TELEGRAM_CHAT_ID;
  if (allowedChat && cb.message?.chat && String(cb.message.chat.id) !== String(allowedChat)) {
    await answerCallbackQuery(cb.id, "Non autorisé").catch(() => {});
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
    const messageId = cb.message?.message_id ?? autoReply?.telegramMessageId ?? null;
    const currentText = cb.message?.text ?? "";

    if (parsed.action === "reject") {
      await answerCallbackQuery(cb.id, "Rejeté — rien n'a été envoyé").catch(() => {});
      if (messageId) {
        await appendDecisionToMessage(
          messageId,
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
      if (messageId) {
        await appendDecisionToMessage(
          messageId,
          currentText,
          `✅ Réponse envoyée à ${candDoc.entreprise} (${inbound.from}).`
        ).catch(() => {});
      }
    } catch (sendErr) {
      // Échec SMTP : on repasse en pending pour que les boutons restent actifs (retry possible).
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      await Candidature.updateOne(
        { _id: candDoc._id, "autoReplies.approvalToken": parsed.token },
        { $set: { "autoReplies.$.approvalStatus": "pending", "autoReplies.$.error": msg } }
      );
      await answerCallbackQuery(cb.id, `Échec d'envoi : ${msg.slice(0, 150)} — retape ✅ pour réessayer`, true).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[telegram webhook]", msg);
    // 200 quand même : Telegram re-livrerait l'update en boucle sur un 5xx, et le claim
    // atomique a peut-être déjà consommé le pending (le retry ferait "déjà traité").
    return NextResponse.json({ ok: true, error: msg });
  }
}
