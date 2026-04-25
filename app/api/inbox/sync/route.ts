import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { syncGmailInbox } from "@/lib/gmail-imap";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const result = await syncGmailInbox({ dryRun });
  return NextResponse.json(result);
}
