import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SavedQuery, computeNextRunAt, type QueryFrequency } from "@/models/SavedQuery";
import { verifyAuth } from "@/lib/auth";

const VALID_FREQUENCIES: QueryFrequency[] = ["manual", "daily", "weekly", "biweekly"];

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const queries = await SavedQuery.find().sort({ created_at: -1 });
    return NextResponse.json({ queries });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch saved queries", details: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const keywords = typeof body.keywords === "string" ? body.keywords.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() : "";
    const frequency: QueryFrequency = VALID_FREQUENCIES.includes(body.frequency)
      ? body.frequency
      : "manual";

    if (!keywords || !location) {
      return NextResponse.json(
        { error: "keywords and location are required" },
        { status: 400 }
      );
    }

    await connectDB();
    const nextRunAt = computeNextRunAt(frequency);
    const query = await SavedQuery.findOneAndUpdate(
      { keywords, location },
      { keywords, location, frequency, nextRunAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ query });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to save query", details: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await connectDB();
    const deleted = await SavedQuery.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to delete query", details: msg },
      { status: 500 }
    );
  }
}
