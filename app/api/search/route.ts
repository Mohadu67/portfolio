import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { searchJSearch, searchAdzuna, searchFranceTravail, searchIndeed, type SearchResult } from "@/lib/scraper";
import { verifyAuth } from "@/lib/auth";
import { normalizeUrl } from "@/lib/url-normalize";

/**
 * Collapse les doublons cross-source : si la même offre revient depuis 2 sources
 * (URL normalisée identique), on garde la 1ère occurrence et on accumule les
 * plateformes dans un champ `sources`.
 */
function collapseBySources(results: SearchResult[]): Array<SearchResult & { sources: SearchResult["plateforme"][] }> {
  const byNorm = new Map<string, SearchResult & { sources: SearchResult["plateforme"][] }>();
  for (const r of results) {
    const norm = normalizeUrl(r.url);
    if (!norm) continue;
    const existing = byNorm.get(norm);
    if (existing) {
      if (!existing.sources.includes(r.plateforme)) existing.sources.push(r.plateforme);
    } else {
      byNorm.set(norm, { ...r, sources: [r.plateforme] });
    }
  }
  return [...byNorm.values()];
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { keywords, location, country = "fr", nb_results = 10, preview = false } = body;

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
        searchJSearch(keywords, location, country, nb_results),
        searchAdzuna(keywords, location, country, nb_results),
        searchFranceTravail(keywords, location, country, nb_results),
        searchIndeed(keywords, location, country, nb_results),
      ]);

    const rawResults = [
      ...jsearchResults,
      ...adzunaResults,
      ...franceTravailResults,
      ...indeedResults,
    ].filter((r) => r.url && r.url.trim() !== "");

    const allResults = collapseBySources(rawResults);

    // Preview mode: return results with already_saved flag + joined candidature, don't insert
    if (preview) {
      const urls = allResults.map((r) => r.url);
      const existing = await Candidature.find({ url: { $in: urls } }).lean();
      const existingByUrl = new Map(existing.map((e) => [e.url, e]));
      return NextResponse.json({
        results: allResults.map((r) => {
          const candidature = existingByUrl.get(r.url);
          return {
            ...r,
            already_saved: !!candidature,
            candidature: candidature ?? undefined,
          };
        }),
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
      try {
        const inserted = await Candidature.insertMany(toInsert, { ordered: false });
        newCount = inserted.length;
      } catch (err) {
        const e = err as { message?: string; insertedDocs?: unknown[]; writeErrors?: unknown[]; result?: { result?: { nInserted?: number } } };
        console.warn("insertMany partial error:", e?.message);
        if (Array.isArray(e?.insertedDocs)) {
          newCount = e.insertedDocs.length;
        } else if (e?.result?.result?.nInserted) {
          newCount = e.result.result.nInserted;
        } else {
          // Fallback : recompter en DB pour ne pas mentir au client
          const stillExisting = await Candidature.find({ url: { $in: toInsert.map((d) => d.url) } }, { _id: 1 }).lean();
          newCount = stillExisting.length;
        }
      }
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
