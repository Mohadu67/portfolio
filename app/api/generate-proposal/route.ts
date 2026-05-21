import { NextRequest, NextResponse } from "next/server";
import { generateLetterProposal } from "@/lib/gemini";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { entreprise, aboutText, poste } = body;

    if (!entreprise) {
      return NextResponse.json(
        { error: "entreprise is required" },
        { status: 400 }
      );
    }

    const lettre = await generateLetterProposal(
      entreprise,
      aboutText || "",
      poste
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
