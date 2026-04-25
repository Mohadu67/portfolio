import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RelanceTemplate, BUILTIN_TEMPLATES } from "@/models/RelanceTemplate";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();

  // Seed built-in templates once if none exist
  const count = await RelanceTemplate.countDocuments();
  if (count === 0) {
    await RelanceTemplate.insertMany(BUILTIN_TEMPLATES.map((t) => ({ ...t, isBuiltin: true })));
  }

  const templates = await RelanceTemplate.find({}).sort({ isBuiltin: -1, name: 1 });
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { name, message, defaultOffsetDays } = await request.json();
    if (!name?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "name and message are required" }, { status: 400 });
    }
    await connectDB();
    const t = await RelanceTemplate.create({
      name: name.trim(),
      message: message.trim(),
      defaultOffsetDays: defaultOffsetDays ?? 7,
      isBuiltin: false,
    });
    return NextResponse.json(t, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
