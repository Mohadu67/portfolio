import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CVSection } from "@/models/CVSection";
import { verifyAuth } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const allowed: Record<string, unknown> = {};
    if (typeof body.title === "string") allowed.title = body.title;
    if (typeof body.isVisible === "boolean") allowed.isVisible = body.isVisible;
    if (typeof body.order === "number") allowed.order = body.order;
    if (body.content !== undefined) allowed.content = body.content;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await connectDB();
    const section = await CVSection.findByIdAndUpdate(id, allowed, { new: true });
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json(section);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PATCH /api/cv-sections/:id]", msg);
    return NextResponse.json({ error: "Failed to update section", details: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();
    const section = await CVSection.findById(id);
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    if (section.type !== "custom" && section.type !== "quiz" && section.type !== "story") {
      return NextResponse.json(
        { error: "Only custom/quiz/story sections can be deleted. Use isVisible=false to hide built-in sections." },
        { status: 403 }
      );
    }
    await section.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DELETE /api/cv-sections/:id]", msg);
    return NextResponse.json({ error: "Failed to delete section", details: msg }, { status: 500 });
  }
}
