import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CVSection } from "@/models/CVSection";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { order } = body as { order?: Array<{ id: string; order: number }> };

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "order array required" }, { status: 400 });
    }

    await connectDB();
    await Promise.all(
      order.map(({ id, order: o }) => CVSection.findByIdAndUpdate(id, { order: o }))
    );

    const sections = await CVSection.find({}).sort({ order: 1 });
    return NextResponse.json({ sections });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/cv-sections/reorder]", msg);
    return NextResponse.json({ error: "Failed to reorder", details: msg }, { status: 500 });
  }
}
