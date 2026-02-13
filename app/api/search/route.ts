import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { searchIndeed, searchLinkedIn } from "@/lib/scraper";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { keywords, location, nb_results = 10 } = body;

    if (!keywords || !location) {
      return NextResponse.json(
        { error: "keywords and location are required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Search Indeed and LinkedIn in parallel
    const [indeedResults, linkedinResults] = await Promise.all([
      searchIndeed(keywords, location, nb_results),
      searchLinkedIn(keywords, location, nb_results),
    ]);

    const allResults = [...indeedResults, ...linkedinResults];
    let newCount = 0;

    // Insert new candidatures (avoid duplicates by URL)
    for (const result of allResults) {
      const existing = await Candidature.findOne({ url: result.url });
      if (!existing) {
        await Candidature.create({
          entreprise: result.entreprise,
          poste: result.poste,
          plateforme: result.plateforme,
          localisation: result.localisation,
          url: result.url,
          description: result.description,
          email: result.email || "",
          statut: "identifiée",
          lettre: null,
          notes: "",
          date: new Date().toISOString().split("T")[0],
        });
        newCount++;
      }
    }

    return NextResponse.json({
      message: `${newCount} nouvelles offres sauvegardées`,
      total_trouvees: allResults.length,
      nouvelles: newCount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Search error:", errorMessage);
    return NextResponse.json(
      { error: "Search failed", details: errorMessage },
      { status: 500 }
    );
  }
}
