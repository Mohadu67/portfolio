import { NextRequest } from "next/server";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { verifyAuth } from "@/lib/auth";
import { buildContextLite } from "@/lib/ai/context";
import { toolsForGemini, getTool } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.CHAT_MODEL ?? "gemini-2.5-flash";

interface ToolCallSnapshot {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultPayload {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallSnapshot[];
  tool_results?: ToolResultPayload[];
}

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(apiKey: string): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY non configuré côté serveur" }),
      { status: 500 }
    );
  }

  let messages: ClientMessage[] = [];
  try {
    const body = await request.json();
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages array empty" }), { status: 400 });
  }

  const lite = await buildContextLite();
  const profileName = lite.profileName ?? process.env.PROFIL_NOM ?? "Mohammed Hamiani";

  const systemPrompt = `Tu es l'assistant personnel de ${profileName}, développeur fullstack en recherche de stage/alternance/CDI. Tu communiques en français, direct, factuel, opinionated. Phrases courtes, listes à puces, pas de blabla.

IMPORTANT — Confirmation des actions : quand tu appelles un tool d'action (schedule_relance, cancel_relance, update_candidature_status, update_candidature_notes, send_relance_now, apply_to_company), NE demande PAS de confirmation conversationnelle ("Tu confirmes ?", "Je peux y aller ?"). L'interface affiche automatiquement un panneau de validation que l'utilisateur peut accepter ou refuser. Appelle directement le tool — tu peux annoncer en UNE phrase courte ce que tu vas faire mais sans poser de question.

Date du jour : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Résumé du contexte : ${lite.summary}.

Tools disponibles (n'utilise un tool QUE si l'utilisateur mentionne explicitement ce qu'il veut) :
- list_candidatures(statut?, search?) → UNIQUEMENT si l'utilisateur parle d'une ou plusieurs candidatures précises ou demande une liste
- get_candidature(id) → UNIQUEMENT si l'utilisateur cite une candidature spécifique et veut un détail
- list_relances_due() → UNIQUEMENT si l'utilisateur parle de relances ou demande quoi faire aujourd'hui
- list_cv_sections() / get_cv_section(key) → UNIQUEMENT si l'utilisateur parle de son CV
- Tools d'action : schedule_relance, cancel_relance, update_candidature_status, update_candidature_notes, send_relance_now
- apply_to_company(url) → UNIQUEMENT si l'utilisateur demande explicitement « envoie une candidature à <URL> » ou « candidate chez <URL> ». Génère lettre + envoie mail à l'email RH extrait.
  • Si le tool retourne \`skipReason\` mentionnant "aucun email RH" ET \`allowGenericEmailUsed: false\` → propose à l'utilisateur de retry avec \`allow_generic_email: true\` en expliquant le risque (un email générique a moins de chance d'aboutir qu'un email RH nominatif). NE relance PAS automatiquement — attends son accord explicite.
  • Si le tool retourne \`skipReason\` mentionnant "aucun email RH" ET \`allowGenericEmailUsed: true\` → l'option permissive a déjà été tentée. NE propose PAS un autre retry. Liste les candidats \`scrapedEmails\` à l'utilisateur, explique brièvement pourquoi ils ont été rejetés (typiquement : domaine de l'email ≠ domaine du site cible), et propose-lui soit de créer la candidature à la main via le dashboard /candidatures (avec l'email choisi), soit d'abandonner cette cible.

Règle absolue : NE JAMAIS appeler un tool pour une salutation, une question générale ou un message qui ne cite pas explicitement une donnée précise. Pour une question vague, demande ce que l'utilisateur veut savoir avant d'appeler quoi que ce soit. Appelle le minimum de tools nécessaires.`;

  // Build tool_call id → name lookup. Gemini's functionResponse needs the function name,
  // not the call id used by the OpenAI shape we receive from the client.
  const idToName = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) idToName.set(tc.id, tc.name);
    }
  }

  // Convert client messages → Gemini Content[]
  const contents: Content[] = [];
  for (const m of messages) {
    if (m.role === "user" && m.tool_results && m.tool_results.length > 0) {
      const parts: Part[] = m.tool_results.map((tr) => {
        const name = idToName.get(tr.tool_use_id) ?? "unknown_tool";
        let response: Record<string, unknown>;
        if (tr.is_error) {
          response = { error: tr.content };
        } else {
          try {
            const parsed = JSON.parse(tr.content);
            response = typeof parsed === "object" && parsed !== null
              ? (parsed as Record<string, unknown>)
              : { result: parsed };
          } catch {
            response = { result: tr.content };
          }
        }
        return { functionResponse: { name, response } };
      });
      contents.push({ role: "user", parts });
    } else if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.tool_calls) {
        parts.push({ functionCall: { name: tc.name, args: tc.input } });
      }
      contents.push({ role: "model", parts });
    } else if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant" && m.content) {
      contents.push({ role: "model", parts: [{ text: m.content }] });
    }
  }

  // Sliding window: keep last 8 turns, puis garantir que le premier turn est un user
  // text turn. Gemini exige : functionCall après (user|functionResponse), functionResponse
  // après functionCall. Donc on strip jusqu'à trouver un user text turn — ça élimine d'un
  // coup les orphan functionResponse (user avec funcResp en tête) ET les orphan functionCall
  // (model turns en tête, qui causent "function call turn comes immediately after...").
  let windowed = contents.slice(-8);
  while (windowed.length > 0) {
    const first = windowed[0];
    const isUserText = first.role === "user" && !first.parts?.some((p) => "functionResponse" in p);
    if (isUserText) break;
    windowed = windowed.slice(1);
  }

  const last = windowed[windowed.length - 1];
  if (!last || last.role !== "user") {
    return new Response(
      JSON.stringify({ error: "Last message must be user or tool response" }),
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const model = getGenAI(apiKey).getGenerativeModel({
          model: MODEL,
          systemInstruction: systemPrompt,
          tools: toolsForGemini(),
          generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
        });

        const result = await model.generateContentStream({ contents: windowed });

        const toolCallsAcc: Array<{ name: string; args: Record<string, unknown> }> = [];
        let finishReason: string | null = null;

        for await (const chunk of result.stream) {
          try {
            const text = chunk.text();
            if (text) send("delta", { text });
          } catch {
            // chunk.text() throws when the chunk contains no text part (e.g., pure functionCall)
          }

          const fcs = chunk.functionCalls?.();
          if (fcs && fcs.length > 0) {
            for (const fc of fcs) {
              toolCallsAcc.push({
                name: fc.name,
                args: (fc.args ?? {}) as Record<string, unknown>,
              });
            }
          }

          const fr = chunk.candidates?.[0]?.finishReason;
          if (fr) finishReason = fr;
        }

        if (toolCallsAcc.length > 0) {
          const ts = Date.now();
          const tool_calls = toolCallsAcc.map((tc, i) => {
            const def = getTool(tc.name);
            return {
              id: `call_${ts}_${i}`,
              name: tc.name,
              input: tc.args,
              requires_confirmation: def?.requiresConfirmation ?? true,
            };
          });
          send("tool_calls", { tool_calls });
        }

        send("done", { model: MODEL, finish_reason: finishReason });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[chat]", msg);
        send("error", { error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
