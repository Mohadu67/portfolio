import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { sendCandidature } from "@/lib/email";
import { generateLettrePDF } from "@/lib/pdf-generator";
import { verifyAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

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

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error("Missing GMAIL_USER or GMAIL_APP_PASSWORD env variables");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
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

    // Generate letter PDF
    const letterPdfBuffer = await generateLettrePDF(
      candidature.lettre,
      candidature.entreprise,
      candidature.poste
    );

    // Save LM PDF locally (non-critical, archival only)
    try {
      const lmFileName = `LM_${candidature.entreprise.replace(/[^a-zA-Z0-9À-ÿ]/g, "_")}.pdf`;
      const lmDir = path.join(process.cwd(), "candidatureModel");
      if (!fs.existsSync(lmDir)) {
        fs.mkdirSync(lmDir, { recursive: true });
      }
      fs.writeFileSync(path.join(lmDir, lmFileName), letterPdfBuffer);
    } catch (writeError) {
      console.warn("Could not save LM PDF locally:", writeError);
    }

    // Send email with PDF attachments
    await sendCandidature(
      candidature.entreprise,
      candidature.poste,
      email_destinataire,
      letterPdfBuffer,
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
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("Email sending error:", errorMessage, errorStack);
    return NextResponse.json(
      { error: "Failed to send email", details: errorMessage },
      { status: 500 }
    );
  }
}
