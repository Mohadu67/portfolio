import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature } from "@/models/Candidature";
import { SavedQuery, computeNextRunAt } from "@/models/SavedQuery";
import { searchJSearch, searchAdzuna, searchFranceTravail, searchIndeed } from "@/lib/scraper";
import { recordCronRun } from "@/lib/cron-log";
import { normalizeUrl } from "@/lib/url-normalize";

export const runtime = "nodejs";
export const maxDuration = 120;

// Cron endpoint : exécute les SavedQuery dont nextRunAt <= now.
//
// Auth : Authorization: Bearer $CRON_SECRET
// Schedule VPS (toutes les heures suffit, le filter nextRunAt fait le travail) :
//   0 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/run-saved-queries >/dev/null
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    await connectDB();
    const now = startedAt;

    const due = await SavedQuery.find({
      frequency: { $ne: "manual" },
      nextRunAt: { $lte: now },
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let totalNew = 0;
    const errors: Array<{ query: string; error: string }> = [];

    for (const query of due) {
      processed++;
      try {
        const queryCountry = (query.country || "fr").trim().toLowerCase();
        const [j, a, f, i] = await Promise.all([
          searchJSearch(query.keywords, query.location, queryCountry, 10),
          searchAdzuna(query.keywords, query.location, queryCountry, 10),
          searchFranceTravail(query.keywords, query.location, queryCountry, 10),
          searchIndeed(query.keywords, query.location, queryCountry, 10),
        ]);
        const raw = [...j, ...a, ...f, ...i].filter((r) => r.url && r.url.trim() !== "");

        // Dédup intra-results par URL normalisée (collapse cross-source).
        const seenNorm = new Set<string>();
        const all = raw.filter((r) => {
          const norm = normalizeUrl(r.url);
          if (!norm || seenNorm.has(norm)) return false;
          seenNorm.add(norm);
          return true;
        });

        const urls = all.map((r) => r.url);
        const existing = await Candidature.find(
          { url: { $in: urls } },
          { url: 1 }
        ).lean<{ url: string }[]>();
        const existingUrls = new Set(existing.map((e) => e.url));

        const today = new Date().toISOString().split("T")[0];
        const toInsert = all
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
            const e = err as { insertedDocs?: unknown[] };
            newCount = Array.isArray(e?.insertedDocs) ? e.insertedDocs.length : 0;
          }
        }

        totalNew += newCount;
        query.lastRunAt = now;
        query.lastRunNewCount = newCount;
        query.nextRunAt = computeNextRunAt(query.frequency, now);
        await query.save();
        succeeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ query: String(query._id), error: msg });
        failed++;
        // Recule nextRunAt d'1h pour retry léger
        query.nextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
        await query.save().catch(() => {});
      }
    }

    await recordCronRun({
      name: "run-saved-queries",
      startedAt,
      status: failed > 0 ? "failed" : "success",
      processed,
      succeeded,
      failed,
      summary: `${succeeded}/${processed} queries — ${totalNew} nouvelles offres`,
      error: errors[0]?.error ?? null,
    });

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      processed,
      succeeded,
      failed,
      newOffres: totalNew,
      errors,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cron run-saved-queries]", msg);
    await recordCronRun({
      name: "run-saved-queries",
      startedAt,
      status: "failed",
      error: msg,
    });
    return NextResponse.json({ error: "Cron failed", details: msg }, { status: 500 });
  }
}

// GET dry-run : liste les queries dues sans les exécuter.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const now = new Date();
  const due = await SavedQuery.find({
    frequency: { $ne: "manual" },
    nextRunAt: { $lte: now },
  }).lean();

  return NextResponse.json({
    ranAt: now.toISOString(),
    dueCount: due.length,
    items: due.map((q) => ({
      _id: String(q._id),
      keywords: q.keywords,
      location: q.location,
      frequency: q.frequency,
      nextRunAt: q.nextRunAt,
    })),
  });
}
