import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { sendCandidature } from "@/lib/email";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidature_id, email_destinataire } = body;

    if (!candidature_id || !email_destinataire) {
      return NextResponse.json(
        { error: "candidature_id and email_destinataire are required" },
        { status: 400 }
      );
    }

    await connectDB();
    const candidature = await Candidature.findById(candidature_id);

    if (!candidature) {
      return NextResponse.json({ error: "Candidature not found" }, { status: 404 });
    }

    if (!candidature.lettre) {
      return NextResponse.json(
        { error: "Lettre not generated" },
        { status: 400 }
      );
    }

    // Send email
    await sendCandidature(
      candidature.entreprise,
      candidature.poste,
      email_destinataire,
      candidature.lettre,
      process.env.PROFIL_NOM || "Mohammed Hamiani"
    );

    // Update status to "postulée"
    candidature.statut = "postulée";
    candidature.email = email_destinataire;
    await candidature.save();

    return NextResponse.json({
      message: "Email sent successfully",
      candidature_id,
      statut: "postulée",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Email sending error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to send email", details: errorMessage },
      { status: 500 }
    );
  }
}
