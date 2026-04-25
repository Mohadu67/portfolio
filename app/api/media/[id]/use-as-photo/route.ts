import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { MediaAsset } from "@/models/MediaAsset";
import { CVSection } from "@/models/CVSection";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    await connectDB();

    const asset = await MediaAsset.findById(id);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (asset.kind !== "photo") {
      return NextResponse.json({ error: "Only photos can be used as portfolio photo" }, { status: 400 });
    }

    // Mark this photo as active (others inactive)
    await MediaAsset.updateMany(
      { kind: "photo", _id: { $ne: asset._id }, isActive: true },
      { $set: { isActive: false } }
    );
    asset.isActive = true;
    await asset.save();

    // Update CVSection profile.photo to point to this asset
    const profileSection = await CVSection.findOne({ type: "profile" });
    if (profileSection) {
      const content = (profileSection.content as Record<string, unknown>) ?? {};
      profileSection.content = { ...content, photo: `/api/media/${id}` };
      profileSection.markModified("content");
      await profileSection.save();
    }

    return NextResponse.json({ ok: true, photoUrl: `/api/media/${id}` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[use-as-photo]", msg);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
