import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const tag = url.searchParams.get("tag")?.trim();

    await connectDB();
    const filter: Record<string, unknown> = {};
    if (tag) filter.tags = tag;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { content: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ];
    }

    const [notes, allTagsAgg] = await Promise.all([
      Note.find(filter).sort({ isPinned: -1, updated_at: -1 }),
      Note.aggregate<{ _id: string; count: number }>([
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return NextResponse.json({
      notes,
      tags: allTagsAgg.map((t) => ({ name: t._id, count: t.count })),
      total: notes.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to list notes", details: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    await connectDB();
    const note = await Note.create({
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Sans titre",
      content: typeof body.content === "string" ? body.content : "",
      tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string" && t.trim()) : [],
      isPinned: Boolean(body.isPinned),
      color: ["default", "orange", "blue", "green", "violet", "danger"].includes(body.color) ? body.color : "default",
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create note", details: msg }, { status: 500 });
  }
}
