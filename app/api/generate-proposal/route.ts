import { NextRequest, NextResponse } from "next/server";
import { generateLetterProposal } from "@/lib/gemini";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { entreprise, aboutText, poste, type, instruction } = body;

    if (!entreprise) {
      return NextResponse.json(
        { error: "entreprise is required" },
        { status: 400 }
      );
    }

    const candidatureType = ["stage", "alternance", "cdi"].includes(type) ? type : undefined;
    const userInstruction = typeof instruction === "string" ? instruction : undefined;

    const lettre = await generateLetterProposal(
      entreprise,
      aboutText || "",
      poste,
      candidatureType,
      userInstruction,
    );

    return NextResponse.json({
      lettre,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Letter proposal generation error:", errorMessage);
    return NextResponse.json(
      {
        error: "Failed to generate proposal",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
