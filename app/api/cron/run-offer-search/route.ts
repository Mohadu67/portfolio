import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getSettings } from "@/models/Settings";
import { recordCronRun } from "@/lib/cron-log";
import { runOfferSearch } from "@/lib/offer-search";

// F2 — Recherche d'offres + auto-apply.
// Auth : Authorization: Bearer $CRON_SECRET
// Schedule VPS (lundi 9h05) :
//   5 9 * * 1 curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/run-offer-search >/dev/null

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
    if (!settings.automation.autoApplyEnabled || !settings.automation.enableOfferSearch) {
      const reason = !settings.automation.autoApplyEnabled
        ? "autoApplyEnabled is false"
        : "enableOfferSearch is false";
      await recordCronRun({
        name: "run-offer-search",
        startedAt,
        status: "skipped",
        summary: reason,
      });
      return NextResponse.json({ ok: true, skipped: reason });
    }

    const result = await runOfferSearch({ dryRun });
    await recordCronRun({
      name: "run-offer-search",
      startedAt,
      status: result.errors.length > 0 ? "failed" : "success",
      processed: result.queriesProcessed,
      succeeded: result.applied,
      failed: result.errors.length,
      summary: `${result.queriesProcessed} query · ${result.offresInserted} offres · ${result.applied} envoyée(s) · ${result.skipped} skip`,
      error: result.errors[0] ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cron run-offer-search]", msg);
    await recordCronRun({
      name: "run-offer-search",
      startedAt,
      status: "failed",
      error: msg,
    });
    return NextResponse.json({ error: "Cron failed", details: msg }, { status: 500 });
  }
}
