import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CVFile, CVFileScope } from "@/models/CVFile";
import { verifyAuth } from "@/lib/auth";

const ALLOWED_SCOPES: readonly CVFileScope[] = ["default", "stage", "alternance", "cdi"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    await connectDB();
    const cv = await CVFile.findById(id);
    if (!cv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (typeof body.name === "string" && body.name.trim()) cv.name = body.name.trim();
    if (typeof body.scope === "string" && ALLOWED_SCOPES.includes(body.scope as CVFileScope)) {
      cv.scope = body.scope as CVFileScope;
    }
    if (body.isDefault === true) {
      await CVFile.updateMany({ _id: { $ne: cv._id }, isDefault: true }, { $set: { isDefault: false } });
      cv.isDefault = true;
    } else if (body.isDefault === false) {
      cv.isDefault = false;
    }

    await cv.save();
    const obj = cv.toObject();
    delete obj.data;
    return NextResponse.json(obj);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update CV", details: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();
    const cv = await CVFile.findByIdAndDelete(id);
    if (!cv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to delete CV", details: msg }, { status: 500 });
  }
}
