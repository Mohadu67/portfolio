import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { runWeeklyProspection } from "@/lib/auto-apply";
import { connectDB } from "@/lib/mongodb";
import { getSettings } from "@/models/Settings";

export const runtime = "nodejs";
export const maxDuration = 300;

// Manual trigger from the dashboard (x-api-key auth).
// Usage: POST /api/auto-apply/run?dryRun=1&max=5&force=1
export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const force = url.searchParams.get("force") === "1";

  // Gate : même en manuel, on respecte le toggle autoApplyEnabled sauf si ?force=1.
  // Evite qu'un clic accidentel envoie 5 mails alors que l'utilisateur a désactivé la feature.
  await connectDB();
  const settings = await getSettings();
  if (!settings.automation.autoApplyEnabled && !dryRun && !force) {
    return NextResponse.json(
      { error: "autoApplyEnabled is false. Pass ?force=1 to override (manuel uniquement)." },
      { status: 403 }
    );
  }

  const max = parseInt(url.searchParams.get("max") ?? "", 10);
  const result = await runWeeklyProspection({
    dryRun,
    maxCompanies: Number.isFinite(max) && max > 0 ? max : undefined,
  });
  return NextResponse.json(result);
}
