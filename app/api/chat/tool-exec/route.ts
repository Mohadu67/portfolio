import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getTool } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/tool-runner";

// Wrapper HTTP autour de lib/ai/tool-runner (exécution partagée avec le bot Telegram).

interface ExecBody {
  tool: string;
  input: Record<string, unknown>;
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

  try {
    const result = await executeTool(body.tool, body.input ?? {});
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[tool-exec ${body.tool}]`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
