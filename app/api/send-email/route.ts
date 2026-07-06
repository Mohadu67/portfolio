import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { sendCandidature } from "@/lib/email";
import { generateLettrePDF } from "@/lib/pdf-generator";
import { verifyAuth } from "@/lib/auth";
import { resolveCVForSend } from "@/lib/cvFile";
import { sendNotification } from "@/lib/notifications";
import { scheduleAutoRelance } from "@/lib/auto-relance";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidature_id, email_destinataire, type, cv_file_id } = body;

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

    // Resolve which CV to attach: explicit cv_file_id > scope match > default in DB > FS fallback
    const resolvedCV = await resolveCVForSend({ cvFileId: cv_file_id ?? null, type: type || candidature.type || "alternance" });

    // Send email with PDF attachments
    const emailSubject = `Candidature - ${candidature.poste} - ${process.env.PROFIL_NOM || "Mohammed Hamiani"}`;
    let sendError: string | null = null;
    try {
      await sendCandidature(
        candidature.entreprise,
        candidature.poste,
        email_destinataire,
        letterPdfBuffer,
        process.env.PROFIL_NOM || "Mohammed Hamiani",
        type || "alternance",
        { buffer: resolvedCV.buffer, filename: resolvedCV.filename },
        candidature.emailBody
      );
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    }

    candidature.emailsSent = [
      ...(candidature.emailsSent ?? []),
      {
        date: new Date(),
        to: email_destinataire,
        subject: emailSubject,
        type: "candidature",
        status: sendError ? "failed" : "sent",
        error: sendError,
      },
    ];

    if (sendError) {
      await candidature.save();
      throw new Error(sendError);
    }

    // Update status to "postulée" and save type
    const wasAlreadyPostulee = candidature.statut === "postulée";
    candidature.statut = "postulée";
    candidature.email = email_destinataire;
    candidature.type = type || "alternance";
    if (!wasAlreadyPostulee) {
      await scheduleAutoRelance(candidature);
    }
    await candidature.save();

    // Fire-and-forget notification
    sendNotification({
      type: "candidature",
      candidature: {
        _id: String(candidature._id),
        entreprise: candidature.entreprise,
        poste: candidature.poste,
        email: email_destinataire,
        statut: "postulée",
      },
      emailSubject,
    }).catch(() => {});

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
