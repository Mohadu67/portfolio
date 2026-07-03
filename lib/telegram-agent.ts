// Agent IA conversationnel du bot Telegram : mêmes tools que le Chat IA du dashboard,
// avec confirmation par boutons ✅/❌ pour les tools d'action (human-in-the-loop).
// Entrées : messages texte reçus par le webhook. Sorties : sendMessage Telegram.

import { randomBytes } from "crypto";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { connectDB } from "./mongodb";
import { Candidature, ICandidature } from "@/models/Candidature";
import { getTelegramState, ITelegramPendingAction, TelegramState } from "@/models/TelegramState";
import { buildContextLite } from "./ai/context";
import { toolsForGemini, getTool } from "./ai/tools";
import { executeTool, ToolRunResult } from "./ai/tool-runner";
import {
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
  sendTelegramChatAction,
  getTelegramFileAsBase64,
} from "./telegram";

const MODEL = process.env.CHAT_MODEL ?? "gemini-2.5-flash";
const MAX_TOOL_ROUNDS = 6;
const CONVERSATION_WINDOW = 16;

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(apiKey: string): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

export const TELEGRAM_HELP_TEXT = [
  "🤖 Agent Cockpit — parle-moi normalement (texte ou vocal 🎤) :",
  "",
  "• « qu'est-ce qui est en attente de validation ? »",
  "• « liste mes candidatures postulées »",
  "• « envoie une candidature à https://entreprise.fr »",
  "• « programme une relance pour Extia lundi 9h »",
  "• « passe Divalto en entretien »",
  "",
  "Les actions sensibles (envois, modifications) te demandent toujours confirmation par boutons ✅/❌.",
  "/aide — ce message",
].join("\n");

// Durée max d'un vocal accepté — protège le quota Gemini et évite les transcriptions fleuve.
const MAX_VOICE_SECONDS = 300;

async function buildSystemPrompt(): Promise<string> {
  const lite = await buildContextLite();
  const profileName = lite.profileName ?? process.env.PROFIL_NOM ?? "Mohammed Hamiani";
  return `Tu es l'assistant personnel de ${profileName} (développeur fullstack en recherche d'alternance), joignable sur Telegram. Tu communiques en français, direct, factuel. Phrases courtes, pas de blabla, pas de markdown (texte brut Telegram : pas de **, pas de #, tirets simples pour les listes).

Brièveté : 1 phrase plutôt que 3. Pas d'introduction ni de conclusion bavarde. N'annonce pas ce que tu vas faire — fais-le.

Confirmation des actions : quand tu appelles un tool d'action (schedule_relance, cancel_relance, update_candidature_status, update_candidature_notes, send_relance_now, apply_to_company, process_pending_candidatures), le système envoie AUTOMATIQUEMENT des boutons ✅/❌ à l'utilisateur. NE demande JAMAIS de confirmation dans le texte, appelle directement le tool. Après l'appel, contente-toi d'annoncer en une phrase ce qui attend sa confirmation.

Les tools de lecture (list_candidatures, get_candidature, list_relances_due, list_pending_approvals, resend_pending_approval, list_cv_sections, get_cv_section) s'exécutent immédiatement — utilise-les librement quand la question porte sur les données.

Si l'utilisateur demande « ce qui est en attente » de validation Telegram → list_pending_approvals, puis propose resend_pending_approval pour renvoyer les boutons d'une réponse précise.

Date du jour : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
Contexte : ${lite.summary}.`;
}

function safeParseSummary(summary: string | undefined): Record<string, unknown> {
  if (!summary) return { result: "" };
  try {
    const parsed = JSON.parse(summary);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { result: parsed };
  } catch {
    return { result: summary };
  }
}

// Libellé humain d'une action proposée (affiché sur le message à boutons).
async function describeAction(tool: string, input: Record<string, unknown>): Promise<string> {
  const entrepriseOf = async (): Promise<string> => {
    const id = input.candidature_id ? String(input.candidature_id) : "";
    if (!id) return "?";
    const c = await Candidature.findById(id, { entreprise: 1 }).lean<ICandidature | null>().catch(() => null);
    return c?.entreprise ?? id;
  };
  switch (tool) {
    case "apply_to_company":
      return `Candidature spontanée (${input.type ?? "alternance"}) → ${input.url}${input.email_override ? ` [email : ${input.email_override}]` : ""}${input.dry_run ? " [dry-run]" : ""}`;
    case "send_relance_now":
      return `Envoyer une relance maintenant à ${await entrepriseOf()}`;
    case "schedule_relance":
      return `Programmer une relance chez ${await entrepriseOf()} le ${new Date(String(input.scheduled_for)).toLocaleString("fr-FR")}`;
    case "cancel_relance":
      return `Annuler la relance #${Number(input.relance_index) + 1} chez ${await entrepriseOf()}`;
    case "update_candidature_status":
      return `Passer ${await entrepriseOf()} au statut « ${input.statut} »`;
    case "update_candidature_notes":
      return `Modifier les notes de ${await entrepriseOf()}`;
    case "process_pending_candidatures": {
      const ids = Array.isArray(input.ids) ? input.ids.length : 0;
      return `Traiter les candidatures en attente${ids ? ` (${ids} ciblées)` : " (toutes)"}${input.dry_run ? " [dry-run]" : ""}`;
    }
    default:
      return `${tool}(${JSON.stringify(input).slice(0, 120)})`;
  }
}

// Résultat de tool → texte Telegram lisible.
export function formatToolResult(tool: string, result: ToolRunResult): string {
  if (result.body.error) return `⚠️ Échec : ${result.body.error}`;
  const summary = result.body.summary ?? "";
  if (tool === "apply_to_company") {
    const d = safeParseSummary(summary);
    if (d.decision === "applied") {
      const email = d.email as { address?: string } | null;
      return `✅ Candidature envoyée à ${d.entreprise}${email?.address ? ` (${email.address})` : ""}.`;
    }
    return `ℹ️ ${d.entreprise ?? d.url} : ${d.skipReason ?? d.error ?? `décision ${d.decision}`}${
      Array.isArray(d.scrapedEmails) && d.scrapedEmails.length
        ? `\nEmails trouvés : ${(d.scrapedEmails as string[]).join(", ")}`
        : ""
    }`;
  }
  if (tool === "process_pending_candidatures") {
    const d = safeParseSummary(summary);
    return `✅ Traitement terminé : ${d.applied ?? 0} envoyée(s), ${d.skipped ?? 0} skip, ${Array.isArray(d.errors) ? d.errors.length : 0} erreur(s) sur ${d.processed ?? 0} traitée(s).`;
  }
  // Les autres actions renvoient déjà des summaries humains ("Relance programmée chez X…").
  return `✅ ${summary || "Fait."}`;
}

// Message vocal : transcription Gemini (audio natif) puis même boucle agent que le texte.
// On renvoie d'abord la transcription pour que l'utilisateur vérifie ce qui a été compris.
export async function handleIncomingTelegramVoice(
  chatId: string,
  fileId: string,
  durationSeconds: number | undefined,
  mimeType: string | undefined
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await sendTelegramMessage("⚠️ GEMINI_API_KEY non configuré côté serveur — je ne peux pas transcrire.");
    return;
  }
  if (durationSeconds && durationSeconds > MAX_VOICE_SECONDS) {
    await sendTelegramMessage(`🎤 Vocal trop long (${Math.round(durationSeconds)} s, max ${MAX_VOICE_SECONDS} s) — envoie plus court ou écris-moi.`);
    return;
  }

  await sendTelegramChatAction("typing").catch(() => {});
  const { base64 } = await getTelegramFileAsBase64(fileId);

  const model = getGenAI(apiKey).getGenerativeModel({ model: MODEL });
  const result = await model.generateContent([
    {
      inlineData: {
        // Les vocaux Telegram sont en OGG/Opus ; on fait confiance au mime_type s'il est fourni.
        mimeType: mimeType || "audio/ogg",
        data: base64,
      },
    },
    {
      text: "Transcris fidèlement ce message vocal (français par défaut). Réponds UNIQUEMENT avec la transcription, sans commentaire ni guillemets. Si l'audio est vide ou inintelligible, réponds exactement : [inaudible]",
    },
  ]);
  const transcription = result.response.text().trim();

  if (!transcription || transcription === "[inaudible]") {
    await sendTelegramMessage("🎤 Je n'ai pas réussi à comprendre ce vocal — réessaie ou écris-moi.");
    return;
  }

  await sendTelegramMessage(`🎤 J'ai compris : « ${transcription.slice(0, 3000)} »`);
  await handleIncomingTelegramText(chatId, transcription);
}

// Boucle agent : Gemini + tools. Lecture directe, action → bouton de confirmation.
export async function handleIncomingTelegramText(chatId: string, text: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await sendTelegramMessage("⚠️ GEMINI_API_KEY non configuré côté serveur — je ne peux pas réfléchir.");
    return;
  }

  await connectDB();
  const state = await getTelegramState(chatId);
  await sendTelegramChatAction("typing").catch(() => {});

  const history: Content[] = (state.conversation ?? [])
    .slice(-CONVERSATION_WINDOW)
    .map((m: { role: "user" | "model"; text: string }) => ({ role: m.role, parts: [{ text: m.text }] }));
  const contents: Content[] = [...history, { role: "user", parts: [{ text }] }];

  const model = getGenAI(apiKey).getGenerativeModel({
    model: MODEL,
    systemInstruction: await buildSystemPrompt(),
    tools: toolsForGemini(),
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  });

  let finalText = "";
  const proposals: Array<Pick<ITelegramPendingAction, "token" | "tool" | "input" | "label">> = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await model.generateContent({ contents });
    const response = result.response;
    const fcs = response.functionCalls() ?? [];
    let textPart = "";
    try {
      textPart = response.text();
    } catch {
      // pas de part texte (functionCall pur)
    }

    if (fcs.length === 0) {
      finalText = textPart;
      break;
    }

    contents.push({
      role: "model",
      parts: [
        ...(textPart ? [{ text: textPart } as Part] : []),
        ...fcs.map((fc) => ({ functionCall: { name: fc.name, args: fc.args ?? {} } }) as Part),
      ],
    });

    const responseParts: Part[] = [];
    for (const fc of fcs) {
      const def = getTool(fc.name);
      const args = (fc.args ?? {}) as Record<string, unknown>;
      if (!def) {
        responseParts.push({ functionResponse: { name: fc.name, response: { error: `Tool inconnu : ${fc.name}` } } });
        continue;
      }
      if (def.requiresConfirmation) {
        const token = randomBytes(12).toString("hex");
        const label = await describeAction(fc.name, args);
        proposals.push({ token, tool: fc.name, input: args, label });
        responseParts.push({
          functionResponse: {
            name: fc.name,
            response: {
              status: "awaiting_user_confirmation",
              note: "Des boutons ✅/❌ ont été envoyés à l'utilisateur. N'appelle plus ce tool ; annonce en une phrase que ça attend sa confirmation.",
            },
          },
        });
      } else {
        try {
          const r = await executeTool(fc.name, args);
          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: r.body.error ? { error: r.body.error } : safeParseSummary(r.body.summary),
            },
          });
        } catch (err) {
          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: { error: err instanceof Error ? err.message : String(err) },
            },
          });
        }
      }
    }
    contents.push({ role: "user", parts: responseParts });
    await sendTelegramChatAction("typing").catch(() => {});
  }

  // Persister les propositions avant d'envoyer les boutons (le tap peut arriver vite).
  if (proposals.length > 0) {
    const kept = (state.pendingActions ?? []).filter(
      (a: ITelegramPendingAction) => a.status === "pending"
    ).slice(-9);
    state.pendingActions = [
      ...kept,
      ...proposals.map((p) => ({ ...p, status: "pending" as const, createdAt: new Date(), decidedAt: null })),
    ];
  }
  state.conversation = [
    ...(state.conversation ?? []),
    { role: "user" as const, text, at: new Date() },
    ...(finalText.trim() ? [{ role: "model" as const, text: finalText.trim(), at: new Date() }] : []),
  ].slice(-2 * CONVERSATION_WINDOW);
  await state.save();

  if (finalText.trim()) {
    await sendTelegramMessage(finalText.trim());
  } else if (proposals.length === 0) {
    await sendTelegramMessage("Je n'ai pas de réponse — reformule ou tape /aide.");
  }

  for (const p of proposals) {
    await sendTelegramMessageWithButtons(`⚡ Action proposée :\n${p.label}\n\nJe l'exécute ?`, [
      [
        { text: "✅ Exécuter", callback_data: `act:ok:${p.token}` },
        { text: "❌ Annuler", callback_data: `act:no:${p.token}` },
      ],
    ]);
  }
}

export interface ConfirmActionResult {
  outcome: "executed" | "cancelled" | "already_done" | "failed";
  label?: string;
  resultText?: string;
}

// Tap sur ✅/❌ d'une action proposée. Claim atomique pending → confirmed/cancelled
// (double-tap ou relivraison → already_done).
export async function confirmTelegramAction(token: string, approve: boolean): Promise<ConfirmActionResult> {
  await connectDB();
  const state = await TelegramState.findOneAndUpdate(
    { pendingActions: { $elemMatch: { token, status: "pending" } } },
    {
      $set: {
        "pendingActions.$.status": approve ? "confirmed" : "cancelled",
        "pendingActions.$.decidedAt": new Date(),
      },
    },
    { new: true }
  );
  if (!state) return { outcome: "already_done" };

  const action = (state.pendingActions ?? []).find((a: ITelegramPendingAction) => a.token === token);
  if (!action) return { outcome: "already_done" };

  if (!approve) {
    await appendModelNote(state.chatId, `Action annulée par l'utilisateur : ${action.label}`);
    return { outcome: "cancelled", label: action.label };
  }

  try {
    const result = await executeTool(action.tool, action.input ?? {});
    const resultText = formatToolResult(action.tool, result);
    await appendModelNote(state.chatId, `Action exécutée (${action.label}) → ${resultText}`);
    return { outcome: "executed", label: action.label, resultText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendModelNote(state.chatId, `Action en échec (${action.label}) → ${msg}`);
    return { outcome: "failed", label: action.label, resultText: `⚠️ Échec : ${msg}` };
  }
}

// Injecte une note dans la mémoire de conversation pour que l'agent connaisse l'issue
// des actions confirmées/annulées au tour suivant.
async function appendModelNote(chatId: string, note: string): Promise<void> {
  await TelegramState.updateOne(
    { chatId },
    {
      $push: {
        conversation: {
          $each: [{ role: "model", text: note, at: new Date() }],
          $slice: -2 * CONVERSATION_WINDOW,
        },
      },
    }
  ).catch(() => {});
}
