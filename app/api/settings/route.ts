import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Settings, getSettings } from "@/models/Settings";
import { verifyAuth } from "@/lib/auth";
import { DEFAULT_LETTER_TEMPLATES, TEMPLATE_PLACEHOLDER } from "@/lib/letter-template";

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const settings = await getSettings();
  return NextResponse.json({
    ...settings,
    _defaults: {
      letterTemplate: DEFAULT_LETTER_TEMPLATES,
      letterTemplatePlaceholder: TEMPLATE_PLACEHOLDER,
    },
  });
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
      if (typeof body.gmail.autoReplyEnabled === "boolean") {
        s.gmail.autoReplyEnabled = body.gmail.autoReplyEnabled;
      }
      if (typeof body.gmail.telegramApprovalEnabled === "boolean") {
        s.gmail.telegramApprovalEnabled = body.gmail.telegramApprovalEnabled;
      }
      if (typeof body.gmail.autoReplyMinConfidence === "number" && body.gmail.autoReplyMinConfidence >= 0 && body.gmail.autoReplyMinConfidence <= 1) {
        s.gmail.autoReplyMinConfidence = body.gmail.autoReplyMinConfidence;
      }
    }
    if (body.automation && typeof body.automation === "object") {
      if (typeof body.automation.autoRelanceJ7Enabled === "boolean") {
        s.automation.autoRelanceJ7Enabled = body.automation.autoRelanceJ7Enabled;
      }
      if (typeof body.automation.autoRelanceDays === "number" && body.automation.autoRelanceDays > 0) {
        s.automation.autoRelanceDays = body.automation.autoRelanceDays;
      }
      if (typeof body.automation.autoApplyEnabled === "boolean") {
        s.automation.autoApplyEnabled = body.automation.autoApplyEnabled;
      }
      if (typeof body.automation.autoApplyMaxPerDay === "number" && body.automation.autoApplyMaxPerDay >= 0) {
        s.automation.autoApplyMaxPerDay = Math.floor(body.automation.autoApplyMaxPerDay);
      }
      if (typeof body.automation.autoApplyMinCompanyScore === "number" && body.automation.autoApplyMinCompanyScore >= 0 && body.automation.autoApplyMinCompanyScore <= 1) {
        s.automation.autoApplyMinCompanyScore = body.automation.autoApplyMinCompanyScore;
      }
      if (typeof body.automation.weeklyProspectKeywords === "string") {
        s.automation.weeklyProspectKeywords = body.automation.weeklyProspectKeywords.trim();
      }
      if (typeof body.automation.weeklyProspectLocation === "string") {
        s.automation.weeklyProspectLocation = body.automation.weeklyProspectLocation.trim();
      }
      if (typeof body.automation.defaultLetterInstruction === "string") {
        s.automation.defaultLetterInstruction = body.automation.defaultLetterInstruction.replace(/^\s+|\s+$/g, "");
      }
      if (typeof body.automation.enableOfferSearch === "boolean") {
        s.automation.enableOfferSearch = body.automation.enableOfferSearch;
      }
      if (typeof body.automation.enablePendingProcess === "boolean") {
        s.automation.enablePendingProcess = body.automation.enablePendingProcess;
      }
      if (typeof body.automation.strictQualityScore === "boolean") {
        s.automation.strictQualityScore = body.automation.strictQualityScore;
      }
      if (typeof body.automation.allowGenericEmails === "boolean") {
        s.automation.allowGenericEmails = body.automation.allowGenericEmails;
      }
      if (
        body.automation.defaultCandidatureType === "stage" ||
        body.automation.defaultCandidatureType === "alternance" ||
        body.automation.defaultCandidatureType === "cdi"
      ) {
        s.automation.defaultCandidatureType = body.automation.defaultCandidatureType;
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
    if (body.letterTemplate && typeof body.letterTemplate === "object") {
      for (const k of ["stage", "alternance", "cdi"] as const) {
        const v = body.letterTemplate[k];
        if (typeof v === "string") {
          s.letterTemplate[k] = v;
        }
      }
    }
    if (body.profile && typeof body.profile === "object") {
      if (typeof body.profile.availability === "string") {
        // On garde les newlines mais on trim leading/trailing whitespace
        s.profile.availability = body.profile.availability.replace(/^\s+|\s+$/g, "");
      }
    }

    await s.save();
    return NextResponse.json(s);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
