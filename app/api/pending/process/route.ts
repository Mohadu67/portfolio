import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { verifyAuth } from "@/lib/auth";
import { runProcessPending } from "@/lib/pending-processor";

// Endpoint dashboard : déclenche F3 (process-pending) en mode "force" possible.
// Auth : header x-api-key = $API_SECRET.
// Body : { candidatureIds?: string[]; force?: boolean; dryRun?: boolean }
// - Si candidatureIds vide/absent : traite toutes les candidatures statut "identifiée".

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { candidatureIds?: unknown; force?: unknown; dryRun?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // body vide accepté → traite toutes les "identifiée".
  }

  const ids = Array.isArray(body.candidatureIds)
    ? body.candidatureIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : undefined;
  const force = body.force === true;
  const dryRun = body.dryRun === true;

  try {
    await connectDB();
    const result = await runProcessPending({ ids, force, dryRun });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[pending/process]", msg);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
