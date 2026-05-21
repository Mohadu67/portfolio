import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { syncGmailInbox } from "@/lib/gmail-imap";
import { getSettings } from "@/models/Settings";
import { recordCronRun } from "@/lib/cron-log";

// Cron endpoint: scan Gmail inbox for replies to candidatures.
//
// Auth: Authorization: Bearer $CRON_SECRET
// Schedule on VPS via crontab (every 30 min):
//   30 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/check-inbox >/dev/null

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    await connectDB();
    const settings = await getSettings();
    if (!settings.gmail.inboxSyncEnabled) {
      await recordCronRun({
        name: "check-inbox",
        startedAt,
        status: "skipped",
        summary: "inboxSyncEnabled is false",
      });
      return NextResponse.json({ ok: true, skipped: "inboxSyncEnabled is false" });
    }

    const result = await syncGmailInbox();
    await recordCronRun({
      name: "check-inbox",
      startedAt,
      status: result.errors.length > 0 ? "failed" : "success",
      processed: result.scanned,
      succeeded: result.matched,
      failed: result.errors.length,
      summary: `${result.matched} matchs, ${result.archived} archivés sur ${result.scanned} mails`,
      error: result.errors[0] ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cron check-inbox]", msg);
    await recordCronRun({ name: "check-inbox", startedAt, status: "failed", error: msg });
    return NextResponse.json({ error: "Cron failed", details: msg }, { status: 500 });
  }
}
