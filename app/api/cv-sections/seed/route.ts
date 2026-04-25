import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CVSection } from "@/models/CVSection";
import { verifyAuth } from "@/lib/auth";
import { SEED_SECTIONS } from "@/lib/cv";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";

    await connectDB();

    if (!force) {
      const existing = await CVSection.countDocuments();
      if (existing > 0) {
        return NextResponse.json(
          { error: "Sections already exist. Use ?force=1 to overwrite (this deletes all and re-seeds).", count: existing },
          { status: 409 }
        );
      }
    } else {
      await CVSection.deleteMany({});
    }

    const inserted = await CVSection.insertMany(SEED_SECTIONS);
    return NextResponse.json({ ok: true, inserted: inserted.length, sections: inserted });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/cv-sections/seed]", msg);
    return NextResponse.json({ error: "Failed to seed", details: msg }, { status: 500 });
  }
}
