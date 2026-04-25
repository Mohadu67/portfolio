import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CVFile, CVFileScope } from "@/models/CVFile";
import { verifyAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_SCOPES: readonly CVFileScope[] = ["default", "stage", "alternance", "cdi"];

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const files = await CVFile.find({}).select("-data").sort({ created_at: -1 });
    return NextResponse.json({ files });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to list CVs", details: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const name = (form.get("name") as string | null)?.trim();
    const scopeRaw = (form.get("scope") as string | null) ?? "default";
    const setDefault = form.get("isDefault") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required (multipart/form-data)" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Le fichier doit être un PDF" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Fichier trop volumineux (max ${MAX_BYTES / 1024 / 1024} Mo)` }, { status: 413 });
    }

    const scope = ALLOWED_SCOPES.includes(scopeRaw as CVFileScope) ? (scopeRaw as CVFileScope) : "default";
    const buffer = Buffer.from(await file.arrayBuffer());

    await connectDB();

    if (setDefault) {
      await CVFile.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    }

    const cv = await CVFile.create({
      name: name || file.name.replace(/\.pdf$/i, ""),
      filename: file.name,
      mime: file.type,
      size: file.size,
      scope,
      isDefault: setDefault,
      data: buffer,
    });

    const { data: _, ...meta } = cv.toObject();
    return NextResponse.json(meta, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/cv-files]", msg);
    return NextResponse.json({ error: "Failed to upload CV", details: msg }, { status: 500 });
  }
}
