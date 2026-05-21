import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { improveLetter } from "@/lib/gemini";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidature_id, letterText, type } = body;

    if (!candidature_id) {
      return NextResponse.json(
        { error: "candidature_id is required" },
        { status: 400 }
      );
    }

    if (!letterText || !letterText.trim()) {
      return NextResponse.json(
        { error: "letterText is required" },
        { status: 400 }
      );
    }

    if (!type || !["stage", "alternance", "cdi"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'stage', 'alternance', or 'cdi'" },
        { status: 400 }
      );
    }

    await connectDB();
    const candidature = await Candidature.findById(candidature_id);

    if (!candidature) {
      return NextResponse.json({ error: "Candidature not found" }, { status: 404 });
    }

    // Improve the letter with Gemini
    const improvedLetter = await improveLetter(letterText, type);

    // Update candidature with letter and status
    candidature.lettre = improvedLetter;
    candidature.statut = "lettre générée";
    const nextVersion = (candidature.letters?.length ?? 0) + 1;
    candidature.letters = [
      ...(candidature.letters ?? []),
      {
        version: nextVersion,
        model: "gemini",
        content: improvedLetter,
        generatedAt: new Date(),
        type,
      },
    ];
    await candidature.save();

    return NextResponse.json({
      lettre: improvedLetter,
      candidature_id,
      statut: "lettre générée",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("Letter improvement error:", errorMessage);
    console.error("Error stack:", errorStack);
    return NextResponse.json(
      {
        error: "Failed to improve letter",
        details: errorMessage,
        ...(process.env.NODE_ENV === "development" && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
