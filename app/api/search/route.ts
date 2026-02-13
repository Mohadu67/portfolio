import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { searchJSearch, searchAdzuna, searchFranceTravail } from "@/lib/scraper";
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

    // Search all 3 sources in parallel: JSearch, Adzuna, France Travail
    const [jsearchResults, adzunaResults, franceTravailResults] =
      await Promise.all([
        searchJSearch(keywords, location, nb_results),
        searchAdzuna(keywords, location, nb_results),
        searchFranceTravail(keywords, location, nb_results),
      ]);

    const allResults = [
      ...jsearchResults,
      ...adzunaResults,
      ...franceTravailResults,
    ];

    let newCount = 0;
    let duplicateCount = 0;

    // Insert new candidatures (avoid duplicates by URL)
    for (const result of allResults) {
      // Skip empty URLs
      if (!result.url || result.url.trim() === "") {
        continue;
      }

      const existing = await Candidature.findOne({ url: result.url });
      if (!existing) {
        try {
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
        } catch (error) {
          // Skip duplicates or validation errors
          console.warn("Error creating candidature:", error);
        }
      } else {
        duplicateCount++;
      }
    }

    return NextResponse.json({
      message: `${newCount} nouvelles offres sauvegardées`,
      total_trouvees: allResults.length,
      nouvelles: newCount,
      duplicates: duplicateCount,
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
