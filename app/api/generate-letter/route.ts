import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { generateLettre } from "@/lib/claude";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidature_id } = body;

    if (!candidature_id) {
      return NextResponse.json(
        { error: "candidature_id is required" },
        { status: 400 }
      );
    }

    await connectDB();
    const candidature = await Candidature.findById(candidature_id);

    if (!candidature) {
      return NextResponse.json({ error: "Candidature not found" }, { status: 404 });
    }

    // Generate letter with Claude
    const lettre = await generateLettre(
      candidature.entreprise,
      candidature.poste,
      candidature.description
    );

    // Update candidature with letter and status
    candidature.lettre = lettre;
    candidature.statut = "lettre générée";
    await candidature.save();

    return NextResponse.json({
      lettre,
      candidature_id,
      statut: "lettre générée",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Letter generation error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to generate letter", details: errorMessage },
      { status: 500 }
    );
  }
}
