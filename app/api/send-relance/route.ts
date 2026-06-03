import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { sendRelance } from "@/lib/email";
import { verifyAuth } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidature_id, message, templateTitle } = body;

    if (!candidature_id || !message) {
      return NextResponse.json(
        { error: "candidature_id and message are required" },
        { status: 400 }
      );
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
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

    if (!candidature.email) {
      return NextResponse.json(
        { error: "No email address for this candidature" },
        { status: 400 }
      );
    }

    let sendError: string | null = null;
    try {
      await sendRelance(
        candidature.entreprise,
        candidature.poste,
        candidature.email,
        message,
        templateTitle || "Relance",
        candidature.type || "alternance",
        process.env.PROFIL_NOM || "Mohammed Hamiani"
      );
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    }

    const now = new Date();
    candidature.emailsSent = [
      ...(candidature.emailsSent ?? []),
      {
        date: now,
        to: candidature.email,
        subject: `${templateTitle || "Relance"} - ${candidature.poste}`,
        type: "relance",
        status: sendError ? "failed" : "sent",
        error: sendError,
      },
    ];

    candidature.relanceHistory = [
      ...(candidature.relanceHistory ?? []),
      {
        scheduledFor: now,
        template: "custom",
        templateTitle: templateTitle || "Relance",
        message,
        status: sendError ? "échouée" : "envoyée",
        sentAt: sendError ? null : now,
        error: sendError,
      },
    ];

    if (candidature.relance) {
      candidature.relance.status = sendError ? "échouée" : "envoyée";
    } else if (!sendError) {
      candidature.relance = {
        date: now.toISOString().split("T")[0],
        template: "initial",
        message,
        status: "envoyée",
      };
    }

    await candidature.save();

    if (sendError) {
      throw new Error(sendError);
    }

    sendNotification({
      type: "relance",
      candidature: {
        _id: String(candidature._id),
        entreprise: candidature.entreprise,
        poste: candidature.poste,
        email: candidature.email,
      },
      emailSubject: `${templateTitle || "Relance"} - ${candidature.poste}`,
    }).catch(() => {});

    return NextResponse.json({
      message: "Relance sent successfully",
      candidature_id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Relance sending error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to send relance", details: errorMessage },
      { status: 500 }
    );
  }
}
