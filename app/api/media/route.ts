import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { MediaAsset, MediaKind } from "@/models/MediaAsset";
import { verifyAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const ALLOWED_KINDS: readonly MediaKind[] = ["photo", "project", "asset"];

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as MediaKind | null;
  const filter = kind && ALLOWED_KINDS.includes(kind) ? { kind } : {};
  const items = await MediaAsset.find(filter).select("-data").sort({ created_at: -1 });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    const name = (form.get("name") as string | null)?.trim();
    const kindRaw = (form.get("kind") as string | null) ?? "photo";
    const setActive = form.get("isActive") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json({ error: `Type non autorisé (${ALLOWED_MIMES.join(", ")})` }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo)` }, { status: 413 });
    }

    const kind = ALLOWED_KINDS.includes(kindRaw as MediaKind) ? (kindRaw as MediaKind) : "photo";
    const buffer = Buffer.from(await file.arrayBuffer());

    await connectDB();

    if (setActive && kind === "photo") {
      await MediaAsset.updateMany({ kind: "photo", isActive: true }, { $set: { isActive: false } });
    }

    const asset = await MediaAsset.create({
      name: name || file.name.replace(/\.[^.]+$/, ""),
      filename: file.name,
      mime: file.type,
      size: file.size,
      kind,
      isActive: setActive,
      data: buffer,
    });

    const obj = asset.toObject();
    delete obj.data;
    return NextResponse.json(obj, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/media]", msg);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
