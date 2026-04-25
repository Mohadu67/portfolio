import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { syncGmailInbox } from "@/lib/gmail-imap";
import { getSettings } from "@/models/Settings";

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

  await connectDB();
  const settings = await getSettings();
  if (!settings.gmail.inboxSyncEnabled) {
    return NextResponse.json({ ok: true, skipped: "inboxSyncEnabled is false" });
  }

  const result = await syncGmailInbox();
  return NextResponse.json(result);
}
