import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { verifyAuth } from "@/lib/auth";

const ALLOWED_COLORS = ["default", "orange", "blue", "green", "violet", "danger"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();

    await connectDB();
    const note = await Note.findById(id);
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (typeof body.title === "string") note.title = body.title.trim() || "Sans titre";
    if (typeof body.content === "string") note.content = body.content;
    if (Array.isArray(body.tags)) {
      note.tags = body.tags.filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim());
    }
    if (typeof body.isPinned === "boolean") note.isPinned = body.isPinned;
    if (typeof body.color === "string" && ALLOWED_COLORS.includes(body.color as (typeof ALLOWED_COLORS)[number])) {
      note.color = body.color;
    }

    await note.save();
    return NextResponse.json(note);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update note", details: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    await connectDB();
    const deleted = await Note.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to delete note", details: msg }, { status: 500 });
  }
}
