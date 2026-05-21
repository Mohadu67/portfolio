import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SavedQuery, computeNextRunAt, type QueryFrequency } from "@/models/SavedQuery";
import { verifyAuth } from "@/lib/auth";

const VALID_FREQUENCIES: QueryFrequency[] = ["manual", "daily", "weekly", "biweekly"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Partial<{
      keywords: string;
      location: string;
      frequency: QueryFrequency;
      nextRunAt: Date | null;
    }> = {};

    if (typeof body.keywords === "string") updates.keywords = body.keywords.trim();
    if (typeof body.location === "string") updates.location = body.location.trim();
    if (VALID_FREQUENCIES.includes(body.frequency)) {
      updates.frequency = body.frequency;
      updates.nextRunAt = computeNextRunAt(body.frequency);
    }

    await connectDB();
    const query = await SavedQuery.findByIdAndUpdate(id, updates, { new: true });
    if (!query) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ query });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to update saved query", details: msg },
      { status: 500 }
    );
  }
}
