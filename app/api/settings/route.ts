import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Settings, getSettings } from "@/models/Settings";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    await connectDB();
    let s = await Settings.findOne({});
    if (!s) s = await Settings.create({});

    if (body.notifications && typeof body.notifications === "object") {
      s.notifications = { ...s.notifications, ...body.notifications };
    }
    if (body.gmail && typeof body.gmail === "object") {
      // Only allow updating these fields, not lastSyncAt/Summary
      if (typeof body.gmail.inboxSyncEnabled === "boolean") {
        s.gmail.inboxSyncEnabled = body.gmail.inboxSyncEnabled;
      }
      if (typeof body.gmail.autoArchiveResponses === "boolean") {
        s.gmail.autoArchiveResponses = body.gmail.autoArchiveResponses;
      }
    }
    if (body.automation && typeof body.automation === "object") {
      if (typeof body.automation.autoRelanceJ7Enabled === "boolean") {
        s.automation.autoRelanceJ7Enabled = body.automation.autoRelanceJ7Enabled;
      }
      if (typeof body.automation.autoRelanceDays === "number" && body.automation.autoRelanceDays > 0) {
        s.automation.autoRelanceDays = body.automation.autoRelanceDays;
      }
    }
    if (body.search && typeof body.search === "object") {
      if (typeof body.search.defaultLocation === "string") {
        s.search.defaultLocation = body.search.defaultLocation.trim();
      }
      if (typeof body.search.defaultKeywords === "string") {
        s.search.defaultKeywords = body.search.defaultKeywords.trim();
      }
    }

    await s.save();
    return NextResponse.json(s);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
