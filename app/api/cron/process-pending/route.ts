import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getSettings } from "@/models/Settings";
import { recordCronRun } from "@/lib/cron-log";
import { runProcessPending } from "@/lib/pending-processor";

// F3 — Process pending : reprend les candidatures "identifiée" et tente l'envoi auto en mode safe
// (force=false → skip si aboutText < 100 chars).
//
// Auth : Authorization: Bearer $CRON_SECRET
// Schedule VPS (quotidien, ex. 8h30) :
//   30 8 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/process-pending >/dev/null

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const startedAt = new Date();

  try {
    await connectDB();
    const settings = await getSettings();
    if (!settings.automation.autoApplyEnabled || !settings.automation.enablePendingProcess) {
      const reason = !settings.automation.autoApplyEnabled
        ? "autoApplyEnabled is false"
        : "enablePendingProcess is false";
      await recordCronRun({
        name: "process-pending",
        startedAt,
        status: "skipped",
        summary: reason,
      });
      return NextResponse.json({ ok: true, skipped: reason });
    }

    const result = await runProcessPending({ force: false, dryRun });
    await recordCronRun({
      name: "process-pending",
      startedAt,
      status: result.errors.length > 0 ? "failed" : "success",
      processed: result.processed,
      succeeded: result.applied,
      failed: result.errors.length,
      summary: `${result.processed} traité(s) · ${result.applied} envoyée(s) · ${result.skipped} skip`,
      error: result.errors[0] ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cron process-pending]", msg);
    await recordCronRun({
      name: "process-pending",
      startedAt,
      status: "failed",
      error: msg,
    });
    return NextResponse.json({ error: "Cron failed", details: msg }, { status: 500 });
  }
}
