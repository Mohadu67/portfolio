import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SavedSearch } from "@/models/SavedSearch";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const searches = await SavedSearch.find().sort({ created_at: -1 });
    return NextResponse.json({ searches });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch saved searches", details: errorMessage },
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
    const { url, companyName, type } = body;

    if (!url || !companyName) {
      return NextResponse.json(
        { error: "url and companyName are required" },
        { status: 400 }
      );
    }

    await connectDB();
    const search = await SavedSearch.findOneAndUpdate(
      { url },
      { url, companyName, type: type || "url" },
      { upsert: true, new: true }
    );

    return NextResponse.json({ search });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to save search", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query param is required" },
        { status: 400 }
      );
    }

    await connectDB();
    await SavedSearch.findByIdAndDelete(id);

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to delete search", details: errorMessage },
      { status: 500 }
    );
  }
}
