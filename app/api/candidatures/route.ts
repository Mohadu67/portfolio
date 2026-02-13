import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const candidatures = await Candidature.find().sort({ created_at: -1 });

    const stats = candidatures.reduce(
      (acc, c) => {
        acc[c.statut] = (acc[c.statut] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      candidatures,
      stats,
      total: candidatures.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching candidatures:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch candidatures", details: errorMessage },
      { status: 500 }
    );
  }
}
