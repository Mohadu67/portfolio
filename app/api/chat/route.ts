import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { buildContextLite } from "@/lib/ai/context";
import { toolsForOpenAI, getTool } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.CHAT_MODEL ?? "llama-3.3-70b-versatile";

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

type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
  | { role: "tool"; tool_call_id: string; content: string };

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GROK_API_KEY (Groq Cloud) non configuré côté serveur" }),
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

Date du jour : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Résumé du contexte : ${lite.summary}.

Tu N'AS PAS le détail des candidatures/CV dans ce prompt. Pour répondre, utilise les tools de lecture :
- list_candidatures(statut?, search?) → trouve les candidatures pertinentes
- get_candidature(id) → détail complet d'une candidature
- list_relances_due() → relances programmées (priorité pour "quoi faire aujourd'hui")
- list_cv_sections() / get_cv_section(key) → infos CV

Tools d'action (nécessitent confirmation user) : schedule_relance, cancel_relance, update_candidature_status, update_candidature_notes, send_relance_now.

Stratégie :
1. Si la question implique des candidatures, COMMENCE par appeler list_candidatures ou list_relances_due pour trouver l'info.
2. Récupère le détail uniquement si nécessaire.
3. Réponds de manière concise en exploitant le résultat des tools.`;

  // Convert client messages to OpenAI format (tool_calls/tool_results expansion)
  const openaiMessages: OpenAIMessage[] = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    if (m.role === "user" && m.tool_results && m.tool_results.length > 0) {
      // Each tool_result becomes a separate "tool" role message
      for (const tr of m.tool_results) {
        openaiMessages.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: tr.is_error ? `Erreur: ${tr.content}` : tr.content,
        });
      }
    } else if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      openaiMessages.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        })),
      });
    } else if (m.role === "user") {
      openaiMessages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant" && m.content) {
      openaiMessages.push({ role: "assistant", content: m.content });
    }
  }

  // Validate last message can drive a response
  const lastUseful = openaiMessages[openaiMessages.length - 1];
  if (!lastUseful || (lastUseful.role !== "user" && lastUseful.role !== "tool")) {
    return new Response(
      JSON.stringify({ error: "Last message must be user or tool" }),
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
        const upstream = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: openaiMessages,
            tools: toolsForOpenAI(),
            tool_choice: "auto",
            stream: true,
            temperature: 0.6,
            max_tokens: 2048,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const errText = await upstream.text();
          send("error", { error: `Groq API ${upstream.status}: ${errText.slice(0, 300)}` });
          controller.close();
          return;
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Tool call accumulator (Groq streams tool_calls progressively)
        const toolCallsAcc: Map<number, { id: string; name: string; argsBuffer: string }> = new Map();
        let finishReason: string | null = null;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            let chunk: {
              choices?: Array<{
                delta?: {
                  content?: string;
                  tool_calls?: Array<{
                    index: number;
                    id?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
                finish_reason?: string;
              }>;
            };
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }

            const choice = chunk.choices?.[0];
            if (!choice) continue;
            const delta = choice.delta;

            if (delta?.content) {
              send("delta", { text: delta.content });
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                const cur = toolCallsAcc.get(idx) ?? { id: "", name: "", argsBuffer: "" };
                if (tc.id) cur.id = tc.id;
                if (tc.function?.name) cur.name = tc.function.name;
                if (tc.function?.arguments) cur.argsBuffer += tc.function.arguments;
                toolCallsAcc.set(idx, cur);
              }
            }

            if (choice.finish_reason) {
              finishReason = choice.finish_reason;
            }
          }
        }

        // Emit accumulated tool calls if any
        if (toolCallsAcc.size > 0) {
          const tool_calls = Array.from(toolCallsAcc.values()).map((tc) => {
            let input: Record<string, unknown> = {};
            try {
              input = tc.argsBuffer ? JSON.parse(tc.argsBuffer) : {};
            } catch {
              input = { _rawArguments: tc.argsBuffer };
            }
            const def = getTool(tc.name);
            return {
              id: tc.id,
              name: tc.name,
              input,
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
