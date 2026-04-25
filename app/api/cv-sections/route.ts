import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CVSection } from "@/models/CVSection";
import { verifyAuth } from "@/lib/auth";
import { requireString, requireOneOf, ValidationError } from "@/lib/validate";

const SECTION_TYPES = ["profile", "socials", "skills", "projects", "education", "experience", "contact", "custom"] as const;

export async function GET() {
  try {
    await connectDB();
    const sections = await CVSection.find({}).sort({ order: 1 });
    return NextResponse.json({ sections });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/cv-sections]", msg);
    return NextResponse.json({ error: "Failed to fetch sections", details: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content, order, isVisible } = body;

    const keyV = requireString(body.key, "key", { max: 80 });
    if (!keyV.ok) return NextResponse.json({ error: keyV.error }, { status: 400 });
    const titleV = requireString(body.title, "title", { max: 120 });
    if (!titleV.ok) return NextResponse.json({ error: titleV.error }, { status: 400 });
    const typeV = requireOneOf(body.type, "type", SECTION_TYPES);
    if (!typeV.ok) return NextResponse.json({ error: typeV.error }, { status: 400 });

    const key = keyV.value;
    const title = titleV.value;
    const type = typeV.value;

    await connectDB();

    const existing = await CVSection.findOne({ key });
    if (existing) {
      return NextResponse.json({ error: "Section with this key already exists" }, { status: 409 });
    }

    const last = await CVSection.findOne({}).sort({ order: -1 });
    const nextOrder = typeof order === "number" ? order : (last?.order ?? -1) + 1;

    const section = await CVSection.create({
      key,
      type,
      title,
      order: nextOrder,
      isVisible: isVisible ?? true,
      content: content ?? (type === "custom" ? { body: "" } : { items: [] }),
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/cv-sections]", msg);
    return NextResponse.json({ error: "Failed to create section", details: msg }, { status: 500 });
  }
}
