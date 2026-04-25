import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RelanceTemplate } from "@/models/RelanceTemplate";
import { verifyAuth } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    await connectDB();
    const t = await RelanceTemplate.findById(id);
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (typeof body.name === "string") t.name = body.name;
    if (typeof body.message === "string") t.message = body.message;
    if (typeof body.defaultOffsetDays === "number") t.defaultOffsetDays = body.defaultOffsetDays;
    await t.save();
    return NextResponse.json(t);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    await connectDB();
    const t = await RelanceTemplate.findById(id);
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (t.isBuiltin) {
      return NextResponse.json({ error: "Cannot delete built-in template" }, { status: 403 });
    }
    await t.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
