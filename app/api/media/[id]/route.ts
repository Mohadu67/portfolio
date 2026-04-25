import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { MediaAsset } from "@/models/MediaAsset";
import { verifyAuth } from "@/lib/auth";

// GET is public — used by the portfolio to display photos
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectDB();
    const asset = await MediaAsset.findById(id);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(asset.data), {
      status: 200,
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(asset.size),
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.filename)}"`,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    await connectDB();
    const asset = await MediaAsset.findById(id);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (typeof body.name === "string" && body.name.trim()) asset.name = body.name.trim();
    if (body.isActive === true && asset.kind === "photo") {
      await MediaAsset.updateMany(
        { kind: "photo", _id: { $ne: asset._id }, isActive: true },
        { $set: { isActive: false } }
      );
      asset.isActive = true;
    } else if (body.isActive === false) {
      asset.isActive = false;
    }
    await asset.save();
    const obj = asset.toObject();
    delete obj.data;
    return NextResponse.json(obj);
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
    const asset = await MediaAsset.findByIdAndDelete(id);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
