import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, CandidatureStatut } from "@/models/Candidature";
import { verifyAuth } from "@/lib/auth";

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

    await connectDB();
    const candidature = await Candidature.findByIdAndUpdate(
      id,
      {
        ...(body.statut && { statut: body.statut as CandidatureStatut }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      { new: true }
    );

    if (!candidature) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(candidature);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error updating candidature:", errorMessage);
    return NextResponse.json(
      { error: "Failed to update candidature", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    await connectDB();
    const candidature = await Candidature.findByIdAndDelete(id);

    if (!candidature) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error deleting candidature:", errorMessage);
    return NextResponse.json(
      { error: "Failed to delete candidature", details: errorMessage },
      { status: 500 }
    );
  }
}
