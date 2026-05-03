import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { searchJSearch, searchAdzuna, searchFranceTravail, searchIndeed } from "@/lib/scraper";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { keywords, location, nb_results = 10, preview = false } = body;

    if (!keywords || !location) {
      return NextResponse.json(
        { error: "keywords and location are required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Search all 4 sources in parallel: JSearch, Adzuna, France Travail, Indeed
    const [jsearchResults, adzunaResults, franceTravailResults, indeedResults] =
      await Promise.all([
        searchJSearch(keywords, location, nb_results),
        searchAdzuna(keywords, location, nb_results),
        searchFranceTravail(keywords, location, nb_results),
        searchIndeed(keywords, location, nb_results),
      ]);

    const allResults = [
      ...jsearchResults,
      ...adzunaResults,
      ...franceTravailResults,
      ...indeedResults,
    ].filter((r) => r.url && r.url.trim() !== "");

    // Preview mode: return results with already_saved flag, don't insert
    if (preview) {
      const urls = allResults.map((r) => r.url);
      const existing = await Candidature.find({ url: { $in: urls } }, { url: 1 }).lean<{ url: string }[]>();
      const existingUrls = new Set(existing.map((e) => e.url));
      return NextResponse.json({
        results: allResults.map((r) => ({ ...r, already_saved: existingUrls.has(r.url) })),
      });
    }

    // Save mode: batch check existing URLs, then insertMany the new ones
    const urls = allResults.map((r) => r.url);
    const existing = await Candidature.find({ url: { $in: urls } }, { url: 1 }).lean<{ url: string }[]>();
    const existingUrls = new Set(existing.map((e) => e.url));
    const today = new Date().toISOString().split("T")[0];
    const toInsert = allResults
      .filter((r) => !existingUrls.has(r.url))
      .map((r) => ({
        entreprise: r.entreprise,
        poste: r.poste,
        plateforme: r.plateforme,
        localisation: r.localisation,
        url: r.url,
        description: r.description,
        email: r.email || "",
        statut: "identifiée",
        lettre: null,
        notes: "",
        date: today,
      }));

    let newCount = 0;
    if (toInsert.length > 0) {
      const inserted = await Candidature.insertMany(toInsert, { ordered: false }).catch((err) => {
        console.warn("insertMany partial error:", err?.message);
        return err?.insertedDocs ?? [];
      });
      newCount = Array.isArray(inserted) ? inserted.length : 0;
    }

    return NextResponse.json({
      message: `${newCount} nouvelles offres sauvegardées`,
      total_trouvees: allResults.length,
      nouvelles: newCount,
      duplicates: existingUrls.size,
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
