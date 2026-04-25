import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyAuth } from "@/lib/auth";
import { buildAIContext, contextSummary } from "@/lib/ai/context";
import { toolsForAnthropic } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.CHAT_MODEL ?? "claude-opus-4-5-20251101";

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  tool_results?: Array<{
    tool_use_id: string;
    content: string;
    is_error?: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500 });
  }

  let messages: ClientMessage[] = [];
  try {
    const body = await request.json();
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return new Response(JSON.stringify({ error: "Last message must be user" }), { status: 400 });
  }

  const ctx = await buildAIContext();

  const profileName =
    (ctx.profile?.name as string | undefined) ?? process.env.PROFIL_NOM ?? "Mohammed Hamiani";

  // Anthropic SDK v0.30 doesn't expose cache_control in TextBlockParam types yet,
  // so we cast through unknown when adding ephemeral caching.
  const systemBlocks = [
    {
      type: "text" as const,
      text: `Tu es l'assistant personnel de ${profileName}, un développeur fullstack en recherche de stage/alternance/CDI. Tu communiques en français, tu es direct, factuel, et opinionated. Tu donnes des conseils pratiques et exécutables. Quand tu fais des recommandations, tu cites les candidatures concernées par leur entreprise + poste.

Quand on te demande "quoi faire aujourd'hui", priorise les relances en retard et les candidatures stagnantes. Sois concis : phrases courtes, listes à puces, pas de blabla.

Date du jour : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Résumé : ${contextSummary(ctx)}.`,
    },
    {
      type: "text" as const,
      text: `<context>
${JSON.stringify(ctx, null, 2)}
</context>

Utilise ce JSON pour répondre. Ne le re-cite pas en entier dans ta réponse.`,
      cache_control: { type: "ephemeral" as const },
    },
  ] as unknown as Anthropic.TextBlockParam[];

  const client = new Anthropic({ apiKey });

  // Convert frontend messages to Anthropic content blocks (handles tool_use/tool_result)
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => {
    if (m.role === "user" && m.tool_results && m.tool_results.length > 0) {
      return {
        role: "user",
        content: m.tool_results.map((tr) => ({
          type: "tool_result" as const,
          tool_use_id: tr.tool_use_id,
          content: tr.content,
          is_error: tr.is_error,
        })),
      };
    }
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const blocks: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
      if (m.content) {
        blocks.push({ type: "text", text: m.content });
      }
      for (const tc of m.tool_calls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      return { role: "assistant", content: blocks };
    }
    return { role: m.role, content: m.content };
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const response = await client.messages.stream({
          model: MODEL,
          max_tokens: 2048,
          system: systemBlocks,
          tools: toolsForAnthropic(),
          messages: anthropicMessages,
        });

        response.on("text", (textDelta: string) => {
          send("delta", { text: textDelta });
        });

        const final = await response.finalMessage();

        // Detect tool calls
        const toolCalls = final.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
          .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

        if (toolCalls.length > 0) {
          send("tool_calls", { tool_calls: toolCalls });
        }

        send("done", {
          model: final.model,
          usage: final.usage,
          stop_reason: final.stop_reason,
        });
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
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
