import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getSettings } from "@/models/Settings";
import { recordCronRun } from "@/lib/cron-log";
import { runWeeklyProspection } from "@/lib/auto-apply";

// Cron endpoint: orchestrate weekly auto-apply prospection.
//
// Auth: Authorization: Bearer $CRON_SECRET
// Schedule on VPS via crontab (weekly, Mondays 09:00):
//   0 9 * * 1 curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/weekly-prospect >/dev/null

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — scraping + IA + envoi multiples

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
    if (!settings.automation.autoApplyEnabled && !dryRun) {
      await recordCronRun({
        name: "weekly-prospect",
        startedAt,
        status: "skipped",
        summary: "autoApplyEnabled is false",
      });
      return NextResponse.json({ ok: true, skipped: "autoApplyEnabled is false" });
    }

    const result = await runWeeklyProspection({ dryRun });
    await recordCronRun({
      name: "weekly-prospect",
      startedAt,
      status: result.errors.length > 0 ? "failed" : "success",
      processed: result.scanned,
      succeeded: result.applied,
      failed: result.errors.length,
      summary: `${result.applied} envoyée(s), ${result.proposed} proposée(s) Telegram, ${result.wouldApply} dry-run, ${result.skipped} skip sur ${result.scanned} scannées`,
      error: result.errors[0] ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cron weekly-prospect]", msg);
    await recordCronRun({ name: "weekly-prospect", startedAt, status: "failed", error: msg });
    return NextResponse.json({ error: "Cron failed", details: msg }, { status: 500 });
  }
}
