import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CVFile } from "@/models/CVFile";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();
    const cv = await CVFile.findById(id);
    if (!cv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(cv.data), {
      status: 200,
      headers: {
        "Content-Type": cv.mime || "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(cv.filename)}"`,
        "Content-Length": String(cv.size),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
