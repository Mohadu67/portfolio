import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, CandidatureStatut } from "@/models/Candidature";
import { verifyAuth } from "@/lib/auth";
import { scheduleAutoRelance } from "@/lib/auto-relance";

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
    const candidature = await Candidature.findById(id);

    if (!candidature) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const previousStatut = candidature.statut;

    if (body.statut) candidature.statut = body.statut as CandidatureStatut;
    if (body.notes !== undefined) candidature.notes = body.notes;
    if (body.type) candidature.type = body.type;
    if (body.relance !== undefined) candidature.relance = body.relance;
    if (typeof body.lettre === "string") candidature.lettre = body.lettre;
    if (typeof body.email === "string") candidature.email = body.email;

    if (
      body.statut === "postulée" &&
      previousStatut !== "postulée" &&
      body.skipAutoRelance !== true
    ) {
      await scheduleAutoRelance(candidature);
    }

    await candidature.save();
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
