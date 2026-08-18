// F2 — Recherche d'offres + auto-apply.
// Boucle sur SavedQuery (frequency != "manual" & nextRunAt <= now) :
//   - appelle searchJSearch/Adzuna/FranceTravail/Indeed
//   - dédup URL normalisée
//   - insère les nouvelles offres en Candidature (statut "identifiée", source "scraper")
//   - pour chaque insertion fraîche : résout site officiel (SerpAPI), scrape, génère lettre, envoie
//   - met à jour Settings.automation.lastOfferSearchRunAt/Summary + SavedQuery.nextRunAt
//
// Rate-limit Gmail partagé via countAutoAppliedSince(24h) + autoApplyMaxPerDay (Settings).

import type { HydratedDocument } from "mongoose";
import { connectDB } from "./mongodb";
import { Candidature, ICandidature } from "@/models/Candidature";
import { SavedQuery, computeNextRunAt } from "@/models/SavedQuery";
import { getSettingsDoc } from "@/models/Settings";
import { searchJSearch, searchAdzuna, searchFranceTravail, searchIndeed } from "./scraper";
import { normalizeUrl } from "./url-normalize";
import { resolveCompanyWebsite } from "./serpapi-resolve";
import { applyToExistingCandidature, countAutoAppliedSince, proposeCandidatureTelegram } from "./auto-apply";
import { isTelegramConfigured } from "./telegram";

export interface OfferSearchSummary {
  ok: boolean;
  queriesProcessed: number;
  offresInserted: number;
  applied: number;
  proposed: number;
  skipped: number;
  errors: string[];
  perQuery: Array<{ keywords: string; location: string; inserted: number; applied: number; proposed: number; skipped: number; errors: number }>;
}

interface RunOfferSearchOptions {
  dryRun?: boolean;
}

// Cap de propositions Telegram par run (voir commentaire dans la boucle).
// 3 suffisent pour ne pas noyer l'utilisateur ; le reste reste en base et sera proposé
// par le cron process-pending ou une prochaine recherche.
const MAX_PROPOSALS_PER_RUN = 3;

export async function runOfferSearch(opts: RunOfferSearchOptions = {}): Promise<OfferSearchSummary> {
  await connectDB();

  const settingsDoc = await getSettingsDoc();
  const auto = settingsDoc.automation;
  const maxPerDay = typeof auto.autoApplyMaxPerDay === "number" ? auto.autoApplyMaxPerDay : 15;
  const defaultLocationFallback = auto.weeklyProspectLocation ?? "";
  const defaultLetterInstruction = typeof auto.defaultLetterInstruction === "string" ? auto.defaultLetterInstruction : "";
  const allowGenericEmail = !!auto.allowGenericEmails;
  const strictQualityScore = !!auto.strictQualityScore;
  const defaultType = (auto.defaultCandidatureType === "stage" || auto.defaultCandidatureType === "cdi")
    ? auto.defaultCandidatureType
    : "alternance";

  // Human-in-the-loop : même interrupteur que la prospection hebdo. Quand il est actif,
  // AUCUN envoi automatique — chaque offre insérée est proposée sur Telegram (✅/❌).
  const interactive = auto.prospectInteractive !== false && isTelegramConfigured() && !opts.dryRun;

  const summary: OfferSearchSummary = {
    ok: false,
    queriesProcessed: 0,
    offresInserted: 0,
    applied: 0,
    proposed: 0,
    skipped: 0,
    errors: [],
    perQuery: [],
  };

  // Rate-limit Gmail partagé. Ignoré en mode interactif : les propositions Telegram ne
  // consomment pas le budget (l'envoi réel du ✅ le re-vérifiera via process-pending).
  let remainingBudget = maxPerDay;
  if (!opts.dryRun && !interactive) {
    const recentlySent = await countAutoAppliedSince(24 * 60 * 60 * 1000);
    remainingBudget = Math.max(0, maxPerDay - recentlySent);
    if (remainingBudget === 0) {
      summary.ok = true;
      summary.errors.push(`Budget journalier atteint (${maxPerDay}/jour)`);
      const persistedAt = new Date();
      settingsDoc.automation.lastOfferSearchRunAt = persistedAt;
      settingsDoc.automation.lastOfferSearchSummary = `0 query · budget journalier saturé (${maxPerDay}/jour)`;
      await settingsDoc.save();
      return summary;
    }
  }

  const now = new Date();
  const due = await SavedQuery.find({
    frequency: { $ne: "manual" },
    nextRunAt: { $lte: now },
  });

  for (const query of due) {
    summary.queriesProcessed++;
    const perQ = { keywords: query.keywords, location: query.location, inserted: 0, applied: 0, proposed: 0, skipped: 0, errors: 0 };
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
          localisation: r.localisation || query.location || defaultLocationFallback,
          url: r.url,
          description: r.description,
          email: r.email || "",
          statut: "identifiée",
          lettre: null,
          notes: "",
          source: "scraper",
          type: defaultType,
          date: today,
        }));

      const insertedDocs: HydratedDocument<ICandidature>[] = [];
      if (toInsert.length > 0) {
        try {
          // insertMany sans `lean` pour récupérer des HydratedDocument utilisables par applyToExistingCandidature.
          const ins = (await Candidature.insertMany(toInsert, { ordered: false })) as unknown as HydratedDocument<ICandidature>[];
          insertedDocs.push(...ins);
        } catch (err) {
          // En cas d'erreur partielle (clé dupliquée par exemple), on récupère les docs effectivement insérés.
          const e = err as { insertedDocs?: HydratedDocument<ICandidature>[] };
          if (Array.isArray(e?.insertedDocs)) insertedDocs.push(...e.insertedDocs);
        }
      }
      perQ.inserted = insertedDocs.length;
      summary.offresInserted += insertedDocs.length;

      // Pour chaque doc inséré : résout le site officiel, scrape, génère lettre, envoie.
      // En mode interactif : proposition Telegram à la place — l'utilisateur décide (✅/❌),
      // le ✅ déclenche process_pending_candidatures ciblé qui fait le vrai pipeline.
      for (const doc of insertedDocs) {
        if (interactive) {
          // Cap anti-spam partagé entre toutes les queries du run : chaque proposition pousse
          // dans pendingActions ($slice -30) — au-delà, les plus anciennes encore actives
          // seraient évincées (boutons morts). L'excédent reste « identifiée » et sera proposé
          // par le cron process-pending (10/run).
          if (summary.proposed >= MAX_PROPOSALS_PER_RUN) {
            summary.skipped++;
            perQ.skipped++;
            continue;
          }
          try {
            await proposeCandidatureTelegram({
              candidatureId: String(doc._id),
              label: `Candidater chez ${doc.entreprise} — ${doc.poste}`,
              // L'url d'une offre pointe souvent le job board, pas la boîte : on laisse le
              // ❌ dériver le domaine au moment du clic plutôt que de blacklister l'agrégateur.
              domain: null,
              recap: [
                `📋 Nouvelle offre, patron : ${doc.entreprise}`,
                `Poste : ${doc.poste}`,
                `Source : ${doc.plateforme}${doc.localisation ? ` — ${doc.localisation}` : ""}`,
                doc.email
                  ? `Email cible : ${doc.email}`
                  : "Email : à résoudre automatiquement (site officiel + scrape)",
                `Annonce : ${doc.url}`,
                ``,
                `Je candidate ?`,
              ].join("\n"),
            });
            summary.proposed++;
            perQ.proposed++;
          } catch (tgErr) {
            const msg = tgErr instanceof Error ? tgErr.message : String(tgErr);
            perQ.errors++;
            summary.errors.push(`${doc.entreprise}: proposition Telegram échouée — ${msg}`);
          }
          continue;
        }
        if (!opts.dryRun && remainingBudget <= 0) {
          summary.skipped++;
          perQ.skipped++;
          continue;
        }
        try {
          const resolvedSite = await resolveCompanyWebsite(
            doc.entreprise,
            doc.localisation || defaultLocationFallback,
            queryCountry
          );
          if (!resolvedSite) {
            doc.notes = `${doc.notes ?? ""}\n[${new Date().toISOString().slice(0, 10)}] skip auto-apply: site officiel non résolu via SerpAPI`.trim();
            await doc.save();
            summary.skipped++;
            perQ.skipped++;
            continue;
          }

          const applied = await applyToExistingCandidature(doc, {
            dryRun: opts.dryRun,
            skipQualityScore: !strictQualityScore,
            allowGenericEmail,
            scrapeUrl: resolvedSite,
            defaultLetterInstruction,
            notificationSubjectPrefix: "[OFFER-SEARCH]",
          });

          if (applied.decision === "applied") {
            summary.applied++;
            perQ.applied++;
            remainingBudget--;
          } else if (applied.decision === "would_apply") {
            summary.applied++;
            perQ.applied++;
          } else {
            summary.skipped++;
            perQ.skipped++;
            if (applied.error) {
              perQ.errors++;
              summary.errors.push(`${doc.entreprise}: ${applied.error}`);
            }
          }
        } catch (innerErr) {
          const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
          perQ.errors++;
          summary.errors.push(`${doc.entreprise}: ${msg}`);
        }
      }

      query.lastRunAt = now;
      query.lastRunNewCount = insertedDocs.length;
      query.nextRunAt = computeNextRunAt(query.frequency, now);
      await query.save();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      perQ.errors++;
      summary.errors.push(`query "${query.keywords}": ${msg}`);
      // Reschedule +1h pour retry léger
      query.nextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
      await query.save().catch(() => {});
    }
    summary.perQuery.push(perQ);
  }

  settingsDoc.automation.lastOfferSearchRunAt = new Date();
  settingsDoc.automation.lastOfferSearchSummary = `${summary.queriesProcessed} query · ${summary.offresInserted} offres · ${summary.proposed} proposée(s) · ${summary.applied} envoyée(s) · ${summary.skipped} skip · ${summary.errors.length} erreur(s)`;
  await settingsDoc.save();

  summary.ok = true;
  return summary;
}
