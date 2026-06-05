// F3 — Process pending : reprend les candidatures statut "identifiée" et tente de les envoyer
// automatiquement. Trois déclencheurs : cron quotidien (mode safe), bouton dashboard (mode force
// possible), chat tool (mode flexible).
//
// Deux cas :
//   Cas A — email rempli : skip résolution SerpAPI. Scrape best-effort 5s (site officiel résolu
//           ou URL de la candidature) pour récupérer aboutText. Si aboutText.length < 100 ET pas
//           `force` → skip silencieux (sauf bouton dashboard qui force=true).
//   Cas B — email vide : full pipeline résolution SerpAPI + scrape + pickBestEmail.
//
// Lock atomique : findOneAndUpdate({_id, statut:"identifiée"}, {$set:{statut:"lettre générée"}})
// — si null retourné, un autre worker est passé, skip.

import { connectDB } from "./mongodb";
import { Candidature } from "@/models/Candidature";
import { getSettingsDoc } from "@/models/Settings";
import { scrapeCompanyWebsite } from "./web-scraper";
import { resolveCompanyWebsite } from "./serpapi-resolve";
import { applyToExistingCandidature, countAutoAppliedSince } from "./auto-apply";

export interface ProcessPendingResult {
  ok: boolean;
  processed: number;
  applied: number;
  skipped: number;
  errors: string[];
  items: Array<{
    candidatureId: string;
    entreprise: string;
    decision: "applied" | "would_apply" | "skipped" | "errored";
    skipReason?: string;
    error?: string;
  }>;
}

export interface RunProcessPendingOptions {
  // Si true, le cas A accepte un aboutText court (< 100 chars) et envoie quand même.
  force?: boolean;
  // Si true, simule la pipeline (lettre générée mais pas d'envoi mail).
  dryRun?: boolean;
  // Sous-ensemble d'IDs à traiter. Si vide → toutes les candidatures "identifiée".
  ids?: string[];
}

// Best-effort scrape avec timeout court (5s) pour cas A : on a déjà un email, on veut juste
// enrichir aboutText pour la génération de lettre. Si ça timeout, on continue sans.
async function scrapeWithTimeout(url: string, timeoutMs: number) {
  return new Promise<Awaited<ReturnType<typeof scrapeCompanyWebsite>> | null>((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, timeoutMs);
    scrapeCompanyWebsite(url)
      .then((data) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(data);
      })
      .catch(() => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(null);
      });
  });
}

export async function runProcessPending(opts: RunProcessPendingOptions = {}): Promise<ProcessPendingResult> {
  await connectDB();
  const force = !!opts.force;
  const dryRun = !!opts.dryRun;

  const settingsDoc = await getSettingsDoc();
  const auto = settingsDoc.automation;
  const maxPerDay = typeof auto.autoApplyMaxPerDay === "number" ? auto.autoApplyMaxPerDay : 15;
  const defaultLocation = auto.weeklyProspectLocation ?? "";
  const defaultLetterInstruction = typeof auto.defaultLetterInstruction === "string" ? auto.defaultLetterInstruction : "";
  const allowGenericEmail = !!auto.allowGenericEmails;
  const strictQualityScore = !!auto.strictQualityScore;

  const result: ProcessPendingResult = {
    ok: false,
    processed: 0,
    applied: 0,
    skipped: 0,
    errors: [],
    items: [],
  };

  let remainingBudget = maxPerDay;
  if (!dryRun) {
    const recentlySent = await countAutoAppliedSince(24 * 60 * 60 * 1000);
    remainingBudget = Math.max(0, maxPerDay - recentlySent);
    if (remainingBudget === 0) {
      result.ok = true;
      result.errors.push(`Budget journalier atteint (${maxPerDay}/jour)`);
      settingsDoc.automation.lastPendingProcessRunAt = new Date();
      settingsDoc.automation.lastPendingProcessSummary = `0 traité · budget journalier saturé (${maxPerDay}/jour)`;
      await settingsDoc.save();
      return result;
    }
  }

  const filter: Record<string, unknown> = { statut: "identifiée" };
  if (opts.ids && opts.ids.length > 0) {
    filter._id = { $in: opts.ids };
  }
  const docs = await Candidature.find(filter, { _id: 1 }).lean<{ _id: unknown }[]>();
  const candidateIds = docs.map((d) => String(d._id));

  for (const id of candidateIds) {
    if (!dryRun && remainingBudget <= 0) {
      result.skipped++;
      result.items.push({ candidatureId: id, entreprise: "", decision: "skipped", skipReason: "budget journalier atteint" });
      continue;
    }
    result.processed++;

    // Lock atomique : on bascule "identifiée" → "lettre générée" en une seule opération.
    // Si null (un autre worker a déjà pris la main), skip silencieux.
    const locked = await Candidature.findOneAndUpdate(
      { _id: id, statut: "identifiée" },
      { $set: { statut: "lettre générée" } },
      { new: true }
    );
    if (!locked) {
      result.skipped++;
      result.items.push({ candidatureId: id, entreprise: "", decision: "skipped", skipReason: "lock failed (déjà traitée par un autre worker)" });
      continue;
    }

    const rollback = async (reason: string) => {
      // Revert statut → "identifiée" pour permettre une re-tentative future.
      locked.statut = "identifiée";
      const stamp = new Date().toISOString().slice(0, 10);
      locked.notes = `${locked.notes ?? ""}\n[${stamp}] pending-skip: ${reason}`.trim();
      await locked.save();
    };

    try {
      const hasEmail = !!locked.email && locked.email.trim().length > 0;

      if (hasEmail) {
        // Cas A : scrape best-effort 5s sur le site (résolu si pas d'URL exploitable, ou via locked.url).
        let scrapeTarget: string | null = null;
        // Si locked.url pointe vers le site de l'entreprise (pas un agrégateur), on l'utilise.
        // Heuristique : si l'URL contient linkedin.com / indeed.com / etc., on résout via SerpAPI.
        const url = locked.url || "";
        const looksLikeAggregator = /linkedin\.com|indeed\.com|welcometothejungle|hellowork|jobteaser|francetravail|pole-emploi|adzuna|monster\.fr|apec\.fr/i.test(url);
        if (url && !looksLikeAggregator) {
          scrapeTarget = url;
        } else {
          try {
            scrapeTarget = await resolveCompanyWebsite(locked.entreprise, locked.localisation || defaultLocation);
          } catch (resolveErr) {
            console.error("[pending] resolve failed:", resolveErr instanceof Error ? resolveErr.message : resolveErr);
            scrapeTarget = null;
          }
        }

        let aboutText = locked.aboutText ?? "";
        let description = locked.description ?? "";
        let emails: string[] = [];
        if (scrapeTarget) {
          const scraped = await scrapeWithTimeout(scrapeTarget, 5000);
          if (scraped) {
            aboutText = scraped.aboutText || aboutText;
            description = scraped.description || description;
            emails = scraped.emails;
          }
        }

        if ((aboutText?.length ?? 0) < 100 && !force) {
          await rollback(`aboutText court (${aboutText.length} chars) et force=false`);
          result.skipped++;
          result.items.push({
            candidatureId: id,
            entreprise: locked.entreprise,
            decision: "skipped",
            skipReason: `aboutText insuffisant (${aboutText.length} chars). Utiliser force=true pour bypasser.`,
          });
          continue;
        }

        const applied = await applyToExistingCandidature(locked, {
          dryRun,
          skipQualityScore: !strictQualityScore,
          allowGenericEmail,
          preScraped: { aboutText, description, emails, companyName: undefined },
          // scrapeUrl = site officiel pour scorer le picker (locked.url peut être un agrégateur).
          scrapeUrl: scrapeTarget ?? undefined,
          defaultLetterInstruction,
          notificationSubjectPrefix: "[PENDING]",
        });

        if (applied.decision === "applied") {
          result.applied++;
          remainingBudget--;
          result.items.push({ candidatureId: id, entreprise: locked.entreprise, decision: "applied" });
        } else if (applied.decision === "would_apply") {
          result.applied++;
          result.items.push({ candidatureId: id, entreprise: locked.entreprise, decision: "would_apply" });
        } else {
          // applyToExistingCandidature a déjà persisté les notes — on rollback juste le statut.
          locked.statut = "identifiée";
          await locked.save();
          result.skipped++;
          result.items.push({
            candidatureId: id,
            entreprise: locked.entreprise,
            decision: applied.error ? "errored" : "skipped",
            skipReason: applied.skipReason,
            error: applied.error,
          });
          if (applied.error) result.errors.push(`${locked.entreprise}: ${applied.error}`);
        }
      } else {
        // Cas B : email vide. Résolution SerpAPI + scrape + pickEmail (via applyToExistingCandidature).
        let resolvedSite: string | null = null;
        try {
          resolvedSite = await resolveCompanyWebsite(locked.entreprise, locked.localisation || defaultLocation);
        } catch (resolveErr) {
          const msg = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
          await rollback(`resolveCompanyWebsite failed: ${msg}`);
          result.errors.push(`${locked.entreprise}: ${msg}`);
          result.items.push({ candidatureId: id, entreprise: locked.entreprise, decision: "errored", error: msg });
          continue;
        }

        if (!resolvedSite) {
          await rollback("site officiel non résolu via SerpAPI");
          result.skipped++;
          result.items.push({
            candidatureId: id,
            entreprise: locked.entreprise,
            decision: "skipped",
            skipReason: "site officiel non résolu via SerpAPI",
          });
          continue;
        }

        const applied = await applyToExistingCandidature(locked, {
          dryRun,
          skipQualityScore: !strictQualityScore,
          allowGenericEmail,
          scrapeUrl: resolvedSite,
          defaultLetterInstruction,
          notificationSubjectPrefix: "[PENDING]",
        });

        if (applied.decision === "applied") {
          result.applied++;
          remainingBudget--;
          result.items.push({ candidatureId: id, entreprise: locked.entreprise, decision: "applied" });
        } else if (applied.decision === "would_apply") {
          result.applied++;
          result.items.push({ candidatureId: id, entreprise: locked.entreprise, decision: "would_apply" });
        } else {
          locked.statut = "identifiée";
          await locked.save();
          result.skipped++;
          result.items.push({
            candidatureId: id,
            entreprise: locked.entreprise,
            decision: applied.error ? "errored" : "skipped",
            skipReason: applied.skipReason,
            error: applied.error,
          });
          if (applied.error) result.errors.push(`${locked.entreprise}: ${applied.error}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await rollback(`exception: ${msg}`).catch(() => {});
      result.errors.push(`${locked.entreprise || id}: ${msg}`);
      result.items.push({ candidatureId: id, entreprise: locked.entreprise, decision: "errored", error: msg });
    }
  }

  settingsDoc.automation.lastPendingProcessRunAt = new Date();
  settingsDoc.automation.lastPendingProcessSummary = `${result.processed} traité(s) · ${result.applied} envoyée(s) · ${result.skipped} skip · ${result.errors.length} erreur(s)`;
  await settingsDoc.save();

  result.ok = true;
  return result;
}
