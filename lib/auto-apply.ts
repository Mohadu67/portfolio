// Orchestrateur de prospection automatique hebdomadaire.
// Workflow : SerpAPI → scrape entreprise → score qualité → page recrutement → match annonce
// → extraction email RH → génération lettre → envoi candidature (avec rate-limit).

import type { HydratedDocument } from "mongoose";
import { connectDB } from "./mongodb";
import { Candidature, ICandidature, CandidatureType } from "@/models/Candidature";
import { getSettingsDoc } from "@/models/Settings";
import { isProspectSkipFresh, recordProspectSkip, ProspectSkipReason } from "@/models/ProspectedDomain";
import { scrapeCompanyWebsite, findCareersPage, scrapeCareersPage, fetchJobDescription, ScrapedJobOffer } from "./web-scraper";
import { scoreCompanyFit, matchJobOffer, generateLetterProposal } from "./gemini";
import { pickBestContactEmail, pickBestContactEmailLoose, EmailScore } from "./auto-apply-filters";
import { sendCandidature } from "./email";
import { generateLettrePDF } from "./pdf-generator";
import { resolveCVForSend } from "./cvFile";
import { scheduleAutoRelance } from "./auto-relance";
import { sendNotification } from "./notifications";

interface SerpCompanyResult {
  name: string;
  url: string;
  snippet: string;
}

interface CandidateDecision {
  url: string;
  domain: string;
  entreprise: string;
  companyScore?: number;
  companyReason?: string;
  bestOffer?: { title: string; url: string; score: number; reason: string; jobType?: string };
  email?: EmailScore;
  // Emails scrappés sur le site qui n'ont pas passé le filtre (whitelist strict OU loose).
  // Sert à l'IA pour proposer une saisie manuelle à l'utilisateur quand le picker échoue.
  scrapedEmails?: string[];
  decision: "skipped" | "applied" | "would_apply";
  skipReason?: string;
  candidatureId?: string;
  error?: string;
}

export interface AutoApplyRunResult {
  ok: boolean;
  dryRun: boolean;
  scanned: number;
  applied: number;
  wouldApply: number;
  skipped: number;
  errors: string[];
  decisions: CandidateDecision[];
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function searchTechCompanies(keywords: string, location: string): Promise<SerpCompanyResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY non configurée");

  const query = location ? `${keywords} ${location}` : keywords;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&gl=fr&hl=fr&num=20&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SerpAPI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as { organic_results?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic_results ?? [])
    .map((r) => ({ name: r.title ?? "", url: r.link ?? "", snippet: r.snippet ?? "" }))
    .filter((r) => r.url.startsWith("http"));
}

// Parse le champ weeklyProspectKeywords en liste de queries (1 par ligne, ou séparé par |).
// Retourne au moins 1 entrée (fallback sur valeur par défaut si vide).
function parseKeywordList(raw: string): string[] {
  if (!raw || !raw.trim()) return ["entreprise tech Strasbourg"];
  const lines = raw
    .split(/[\n|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [raw.trim()];
}

export async function countAutoAppliedSince(sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs);
  // On compte les docs qui ont AU MOINS UN envoi candidature "sent" dans la fenêtre,
  // peu importe leur source (auto-apply, scraper, manuel). C'est l'envoi qui doit être
  // rate-limité côté Gmail, pas l'origine du doc — F2/F3 sont des envois automatiques aussi.
  return Candidature.countDocuments({
    emailsSent: { $elemMatch: { type: "candidature", status: "sent", date: { $gte: since } } },
  });
}

async function alreadyContactedDomain(domain: string): Promise<boolean> {
  if (!domain) return true;
  // Fix : on matche sur le domaine eTLD+1 normalisé, et on cherche dans email ET url.
  // L'ancienne version sur substring `url` ratait les URL JSearch (linkedin.com/jobs/...) et matchait
  // des préfixes accidentels (`acme` ⊂ `acme-corp.fr`).
  const base = domain.split(".").slice(-2).join(".");
  if (!base) return true;
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await Candidature.findOne({
    $or: [
      // email RH du domaine (ou sous-domaine)
      { email: { $regex: `@(?:[^@]*\\.)?${escapedBase}$`, $options: "i" } },
      // URL de l'offre/site sur le domaine (ou sous-domaine)
      { url: { $regex: `://(?:[^/]*\\.)?${escapedBase}(?:[/:?#]|$)`, $options: "i" } },
    ],
  });
  return !!existing;
}

interface RunOptions {
  dryRun?: boolean;
  // Override settings keywords for ad-hoc runs (UI test)
  keywords?: string;
  location?: string;
  // Hard cap on companies to evaluate this run (defaults to 10)
  maxCompanies?: number;
}

// ---------- Envoi pur (réutilisé F1/F2/F3) ----------
// Construit le PDF, envoie le mail, push l'emailLog "sent" ou "failed", programme la relance
// et notifie. NE gère pas le dryRun : le caller doit le filtrer en amont.
// Retourne le statut d'envoi pour que le caller mette à jour son résumé.

export interface DispatchResult {
  ok: boolean;
  error?: string;
}

export async function dispatchCandidature(
  candDoc: HydratedDocument<ICandidature>,
  lettre: string,
  candidatureType: CandidatureType,
  notificationSubjectPrefix: string = "[AUTO-APPLY]"
): Promise<DispatchResult> {
  const entrepriseName = candDoc.entreprise;
  const poste = candDoc.poste;
  const toEmail = candDoc.email;
  if (!toEmail) return { ok: false, error: "email destinataire vide" };

  try {
    const letterPdfBuffer = await generateLettrePDF(lettre, entrepriseName, poste);
    const resolvedCV = await resolveCVForSend({ cvFileId: null, type: candidatureType });
    await sendCandidature(
      entrepriseName,
      poste,
      toEmail,
      letterPdfBuffer,
      process.env.PROFIL_NOM || "Mohammed Hamiani",
      candidatureType,
      { buffer: resolvedCV.buffer, filename: resolvedCV.filename }
    );

    candDoc.emailsSent = [
      ...(candDoc.emailsSent ?? []),
      {
        date: new Date(),
        to: toEmail,
        subject: `Candidature - ${poste} - ${process.env.PROFIL_NOM || "Mohammed Hamiani"}`,
        type: "candidature",
        status: "sent",
        error: null,
      },
    ];
    candDoc.statut = "postulée";
    await scheduleAutoRelance(candDoc);
    await candDoc.save();

    sendNotification({
      type: "candidature",
      candidature: {
        _id: String(candDoc._id),
        entreprise: entrepriseName,
        poste,
        email: toEmail,
        statut: "postulée",
      },
      emailSubject: `${notificationSubjectPrefix} ${entrepriseName} - ${poste}`,
    }).catch((e) => console.error("[dispatch] notification failed:", e));

    return { ok: true };
  } catch (sendErr) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    candDoc.emailsSent = [
      ...(candDoc.emailsSent ?? []),
      {
        date: new Date(),
        to: toEmail,
        subject: `Candidature - ${poste}`,
        type: "candidature",
        status: "failed",
        error: msg,
      },
    ];
    await candDoc.save();
    return { ok: false, error: msg };
  }
}

// ---------- Pipeline post-doc (réutilisé F1/F2/F3) ----------
// Reçoit un Candidature doc déjà créé/persisté et déroule scrape best-effort → score qualité (opt)
// → pick email (opt) → génération lettre → envoi. Toutes les étapes sont skip-ables via opts
// pour servir les 3 flux. Mute le doc et le sauve à chaque étape importante.

export interface ApplyToExistingOptions {
  dryRun?: boolean;
  // Bypass le scoring Gemini (F2/F3 : on a déjà décidé en amont)
  skipQualityScore?: boolean;
  // Re-score Gemini quand l'offre vient d'un scraper externe et qu'on veut la double-check
  strictQualityScore?: boolean;
  // Si true, autorise les emails génériques (contact@/hello@) en fallback du picker strict
  allowGenericEmail?: boolean;
  // Données déjà scrapées (évite un double scrape quand le caller a déjà fait le boulot)
  preScraped?: {
    aboutText: string;
    description: string;
    emails: string[];
    companyName?: string;
  };
  // URL alternative à scraper si la candidature n'a pas encore d'aboutText (ex: site officiel résolu)
  scrapeUrl?: string;
  // Default letter instruction injectée dans la génération (sauf si la candidature en a une)
  defaultLetterInstruction?: string;
  // Préfixe sujet email de notification (pour distinguer F1/F2/F3 dans Gmail)
  notificationSubjectPrefix?: string;
}

export interface ApplyToExistingResult {
  ok: boolean;
  decision: "skipped" | "applied" | "would_apply";
  skipReason?: string;
  error?: string;
  email?: EmailScore;
  companyScore?: number;
  companyReason?: string;
  bestOffer?: { title: string; url: string; score: number; reason: string; jobType?: string };
  scrapedEmails?: string[];
}

export async function applyToExistingCandidature(
  candDoc: HydratedDocument<ICandidature>,
  opts: ApplyToExistingOptions = {}
): Promise<ApplyToExistingResult> {
  const candidatureType: CandidatureType = candDoc.type ?? "alternance";
  const entrepriseName = candDoc.entreprise;
  const result: ApplyToExistingResult = { ok: false, decision: "skipped" };

  // 1. Scrape best-effort si pas de preScraped fourni.
  let aboutText = candDoc.aboutText ?? "";
  let description = candDoc.description ?? "";
  let emails: string[] = [];
  let companyName: string | undefined;

  if (opts.preScraped) {
    aboutText = opts.preScraped.aboutText || aboutText;
    description = opts.preScraped.description || description;
    emails = opts.preScraped.emails;
    companyName = opts.preScraped.companyName;
  } else {
    const targetUrl = opts.scrapeUrl || candDoc.url;
    if (targetUrl) {
      try {
        const scraped = await scrapeCompanyWebsite(targetUrl);
        aboutText = scraped.aboutText || aboutText;
        description = scraped.description || description;
        emails = scraped.emails;
        companyName = scraped.companyName;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.skipReason = `scrape failed: ${msg}`;
        candDoc.notes = `${candDoc.notes ?? ""}\n[${new Date().toISOString().slice(0, 10)}] skip auto: ${result.skipReason}`.trim();
        await candDoc.save();
        return result;
      }
    }
  }

  if (companyName && !candDoc.entreprise) candDoc.entreprise = companyName;
  if (aboutText) candDoc.aboutText = aboutText;

  // 2. Score qualité (bypass si skipQualityScore, ou si l'aboutText est trop court hors mode strict)
  if (!opts.skipQualityScore && (opts.strictQualityScore || aboutText.length >= 100)) {
    try {
      const fit = await scoreCompanyFit(entrepriseName, aboutText || description);
      result.companyScore = fit.score;
      result.companyReason = fit.reason;
      const threshold = 0.3;
      if (fit.score < threshold) {
        result.skipReason = `score qualité trop bas (${fit.score.toFixed(2)} < ${threshold}) — ${fit.reason}`;
        candDoc.notes = `${candDoc.notes ?? ""}\n[${new Date().toISOString().slice(0, 10)}] skip auto: ${result.skipReason}`.trim();
        await candDoc.save();
        return result;
      }
    } catch (geminiErr) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      result.companyReason = `(scoring Gemini échoué : ${msg})`;
    }
  }

  // 3. Pick email si pas déjà rempli (F3-A a un email, F2 et F3-B doivent picker).
  // Note : on score les emails contre le SITE de la boîte (opts.scrapeUrl), pas l'URL de la
  // candidature (qui peut être un agrégateur Indeed/JSearch → tout serait rejeté par domain_mismatch).
  if (!candDoc.email) {
    const pickerUrl = opts.scrapeUrl || candDoc.url;
    let bestEmail = pickBestContactEmail(emails, pickerUrl);
    if (!bestEmail && opts.allowGenericEmail) {
      bestEmail = pickBestContactEmailLoose(emails, pickerUrl);
    }
    if (!bestEmail) {
      result.scrapedEmails = emails;
      result.skipReason = opts.allowGenericEmail
        ? `aucun email RH valable même avec allow_generic_email. Candidats : ${emails.join(", ") || "(aucun)"}`
        : `aucun email RH valable. Candidats : ${emails.join(", ") || "(aucun)"}`;
      candDoc.notes = `${candDoc.notes ?? ""}\n[${new Date().toISOString().slice(0, 10)}] skip auto: ${result.skipReason}`.trim();
      await candDoc.save();
      return result;
    }
    candDoc.email = bestEmail.email;
    result.email = bestEmail;
  }

  // 4. Génération de lettre (sauf si déjà présente).
  let lettre = candDoc.lettre || "";
  if (!lettre) {
    const instruction = (candDoc.letterInstruction && candDoc.letterInstruction.trim())
      ? candDoc.letterInstruction
      : (opts.defaultLetterInstruction ?? "");
    try {
      lettre = await generateLetterProposal(entrepriseName, aboutText || description, candDoc.poste, candidatureType, instruction);
    } catch (geminiErr) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      result.error = `Génération lettre échouée : ${msg}`;
      candDoc.notes = `${candDoc.notes ?? ""}\n[${new Date().toISOString().slice(0, 10)}] erreur génération: ${msg}`.trim();
      await candDoc.save();
      return result;
    }
    candDoc.lettre = lettre;
    candDoc.statut = "lettre générée";
    candDoc.letters = [
      ...(candDoc.letters ?? []),
      {
        version: (candDoc.letters?.length ?? 0) + 1,
        model: "gemini",
        content: lettre,
        generatedAt: new Date(),
        type: candidatureType,
      },
    ];
    await candDoc.save();
  }

  // 5. Dry-run
  if (opts.dryRun) {
    result.ok = true;
    result.decision = "would_apply";
    return result;
  }

  // 6. Envoi via dispatch
  const dispatch = await dispatchCandidature(candDoc, lettre, candidatureType, opts.notificationSubjectPrefix ?? "[AUTO-APPLY]");
  if (!dispatch.ok) {
    result.error = dispatch.error;
    return result;
  }
  result.ok = true;
  result.decision = "applied";
  return result;
}

export async function runWeeklyProspection(opts: RunOptions = {}): Promise<AutoApplyRunResult> {
  const result: AutoApplyRunResult = {
    ok: false,
    dryRun: !!opts.dryRun,
    scanned: 0,
    applied: 0,
    wouldApply: 0,
    skipped: 0,
    errors: [],
    decisions: [],
  };

  await connectDB();
  const settingsDoc = await getSettingsDoc();
  const auto = settingsDoc.automation;
  const rawKeywords = opts.keywords ?? auto.weeklyProspectKeywords ?? "entreprise tech Strasbourg";
  const location = opts.location ?? auto.weeklyProspectLocation ?? "";
  const minScore = typeof auto.autoApplyMinCompanyScore === "number" ? auto.autoApplyMinCompanyScore : 0.6;
  const maxPerDay = typeof auto.autoApplyMaxPerDay === "number" ? auto.autoApplyMaxPerDay : 5;
  // Fix : 10 entreprises × (scrape + 5 appels Gemini + envoi SMTP) peut dépasser maxDuration=300s sur Vercel/cron.
  // On réduit le default à 5 pour rester confortablement sous la limite.
  const maxCompanies = opts.maxCompanies ?? 5;
  // Consignes par défaut injectées dans la génération de lettre pour toutes les candidatures auto.
  // Une instruction au niveau d'une candidature (jamais le cas en auto, mais utile en re-génération manuelle)
  // override ce défaut.
  const defaultLetterInstruction = typeof auto.defaultLetterInstruction === "string" ? auto.defaultLetterInstruction : "";

  // Multi-query rotation : si l'utilisateur a configuré plusieurs queries (1 par ligne),
  // on en pioche une différente à chaque run via weeklyProspectQueryIndex (modulo).
  // Si une seule query est définie, le comportement reste identique à avant.
  const queries = opts.keywords ? [opts.keywords] : parseKeywordList(rawKeywords);
  const currentIndex = typeof auto.weeklyProspectQueryIndex === "number" ? auto.weeklyProspectQueryIndex : 0;
  const queryIdx = queries.length > 0 ? ((currentIndex % queries.length) + queries.length) % queries.length : 0;
  const keywords = queries[queryIdx];

  // Rate-limit : compter les envois auto des dernières 24h
  let remainingBudget = maxPerDay;
  if (!opts.dryRun) {
    const recentlySent = await countAutoAppliedSince(24 * 60 * 60 * 1000);
    remainingBudget = Math.max(0, maxPerDay - recentlySent);
    if (remainingBudget === 0) {
      result.ok = true;
      result.errors.push(`Budget journalier atteint (${maxPerDay}/jour)`);
      return result;
    }
  }

  // 1. SerpAPI search
  let companies: SerpCompanyResult[] = [];
  try {
    companies = await searchTechCompanies(keywords, location);
  } catch (err) {
    result.errors.push(`SerpAPI: ${err instanceof Error ? err.message : err}`);
    return result;
  }

  // Compteur d'erreurs Gemini consécutives : si Gemini quota saturé, on évite de bouffer
  // le reste de la boucle (chaque entreprise = 1-3 appels Gemini, autant abandonner tôt).
  let geminiErrorsInRow = 0;

  for (const company of companies.slice(0, maxCompanies)) {
    if (remainingBudget === 0 && !opts.dryRun) break;
    if (geminiErrorsInRow >= 3) {
      result.errors.push("Quota Gemini probable, abort");
      break;
    }
    result.scanned++;
    const decision: CandidateDecision = {
      url: company.url,
      domain: domainOf(company.url),
      entreprise: company.name,
      decision: "skipped",
    };
    result.decisions.push(decision);

    try {
      // 2a. Dedup par domaine (candidature déjà en DB) — skip silencieux
      if (await alreadyContactedDomain(decision.domain)) {
        decision.skipReason = "déjà contactée (URL/domaine en DB)";
        result.skipped++;
        continue;
      }

      // 2b. Cache des skip précédents (économise scrape + Gemini)
      // Si le domaine a été évalué récemment et skippé, on évite de re-bouffer du quota.
      const cachedSkip = await isProspectSkipFresh(decision.domain);
      if (cachedSkip) {
        decision.skipReason = `cache: ${cachedSkip.skipReason}${cachedSkip.skipDetail ? ` (${cachedSkip.skipDetail})` : ""} — réévaluable après ${new Date(cachedSkip.nextEvaluateAt).toLocaleDateString("fr-FR")}`;
        if (cachedSkip.entreprise) decision.entreprise = cachedSkip.entreprise;
        if (typeof cachedSkip.companyScore === "number") decision.companyScore = cachedSkip.companyScore;
        result.skipped++;
        continue;
      }

      // 3. Scrape company website
      const scraped = await scrapeCompanyWebsite(company.url);
      if (!scraped.aboutText && scraped.emails.length === 0) {
        decision.skipReason = "scrape vide (site inaccessible ou JS-only)";
        await recordProspectSkip({
          domain: decision.domain,
          entreprise: company.name || decision.domain,
          reason: "scrape_empty",
          detail: decision.skipReason,
        });
        result.skipped++;
        continue;
      }
      const entrepriseName = scraped.companyName || company.name || decision.domain;
      decision.entreprise = entrepriseName;

      // 4. Score company fit (seuil hebdo plus strict que applyToExistingCandidature → on garde la logique ici)
      let fit: Awaited<ReturnType<typeof scoreCompanyFit>>;
      try {
        fit = await scoreCompanyFit(entrepriseName, scraped.aboutText || scraped.description);
        geminiErrorsInRow = 0;
      } catch (geminiErr) {
        geminiErrorsInRow++;
        const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        decision.error = `Gemini scoreCompanyFit failed: ${msg}`;
        result.errors.push(`${entrepriseName}: Gemini scoreCompanyFit failed: ${msg}`);
        continue;
      }
      decision.companyScore = fit.score;
      decision.companyReason = fit.reason;
      if (!fit.isTechRelevant || fit.score < minScore) {
        decision.skipReason = `score qualité trop bas (${fit.score.toFixed(2)} < ${minScore}) — ${fit.reason}`;
        const reason: ProspectSkipReason = fit.isTechRelevant ? "low_score" : "not_tech";
        await recordProspectSkip({
          domain: decision.domain,
          entreprise: entrepriseName,
          reason,
          detail: fit.reason,
          companyScore: fit.score,
        });
        result.skipped++;
        continue;
      }

      // 5. Find best email
      const bestEmail = pickBestContactEmail(scraped.emails, company.url);
      if (!bestEmail) {
        decision.skipReason = `aucun email valable (candidats: ${scraped.emails.join(", ") || "aucun"})`;
        await recordProspectSkip({
          domain: decision.domain,
          entreprise: entrepriseName,
          reason: "no_email",
          detail: decision.skipReason,
          companyScore: fit.score,
        });
        result.skipped++;
        continue;
      }
      decision.email = bestEmail;

      // 6. Look for careers page + best matching offer (optional)
      let chosenOffer: ScrapedJobOffer | null = null;
      let offerScore: { score: number; reason: string; jobType?: string } | null = null;
      try {
        const homeHtml = await (async () => {
          // Re-fetch homepage HTML — scrapeCompanyWebsite ne le retourne pas, on accepte le double fetch
          const res = await fetch(company.url, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
          return res?.ok ? await res.text() : "";
        })();
        const careersUrl = homeHtml ? findCareersPage(company.url, homeHtml) : null;
        if (careersUrl) {
          const careers = await scrapeCareersPage(careersUrl, 10);
          for (const offer of careers.offers) {
            const desc = await fetchJobDescription(offer.url);
            let m: Awaited<ReturnType<typeof matchJobOffer>>;
            try {
              m = await matchJobOffer(offer.title, desc || offer.snippet);
              geminiErrorsInRow = 0;
            } catch {
              geminiErrorsInRow++;
              // Si quota Gemini, on abandonne la boucle careers : pas la peine de bouffer plus
              if (geminiErrorsInRow >= 3) break;
              continue;
            }
            if (m.match && (!offerScore || m.score > offerScore.score)) {
              chosenOffer = offer;
              offerScore = { score: m.score, reason: m.reason, jobType: m.jobType };
            }
            // Safety: stop after first solid match to limit Gemini calls
            if (m.match && m.score >= 0.8) break;
          }
        }
      } catch (offerErr) {
        // Non-bloquant : on continue en candidature spontanée
        result.errors.push(`Careers parse failed for ${entrepriseName}: ${offerErr instanceof Error ? offerErr.message : offerErr}`);
      }

      const poste = chosenOffer ? chosenOffer.title : "Candidature spontanée — Développeur fullstack";
      const candidatureType: CandidatureType = (offerScore?.jobType === "alternance" || offerScore?.jobType === "cdi")
        ? offerScore.jobType
        : "alternance";
      if (chosenOffer && offerScore) {
        decision.bestOffer = { title: chosenOffer.title, url: chosenOffer.url, score: offerScore.score, reason: offerScore.reason, jobType: offerScore.jobType };
      }

      // 7. Create Candidature in DB (sans lettre — applyToExistingCandidature s'en charge)
      const candDoc = await Candidature.create({
        entreprise: entrepriseName,
        poste,
        plateforme: "Web",
        localisation: location || "",
        url: chosenOffer?.url || company.url,
        description: (chosenOffer?.snippet || scraped.description || "").slice(0, 500),
        email: bestEmail.email,
        aboutText: scraped.aboutText,
        statut: "identifiée",
        type: candidatureType,
        lettre: null,
        letterInstruction: defaultLetterInstruction,
        notes: `Auto-apply ${new Date().toISOString().slice(0, 10)} — fit ${fit.score.toFixed(2)}${chosenOffer ? `, offer ${offerScore?.score.toFixed(2)}` : " (spontanée)"}`,
        source: "auto-apply",
        date: new Date().toISOString().slice(0, 10),
        letters: [],
      });
      decision.candidatureId = String(candDoc._id);

      // 8. Délègue à la pipeline partagée : génère lettre + envoie.
      // On passe preScraped pour éviter le re-scrape (déjà fait à l'étape 3).
      const applied = await applyToExistingCandidature(candDoc, {
        dryRun: opts.dryRun,
        skipQualityScore: true,
        allowGenericEmail: false,
        preScraped: {
          aboutText: scraped.aboutText,
          description: scraped.description,
          emails: scraped.emails,
          companyName: scraped.companyName,
        },
        defaultLetterInstruction,
        notificationSubjectPrefix: "[AUTO-APPLY]",
      });

      if (applied.decision === "applied") {
        decision.decision = "applied";
        result.applied++;
        remainingBudget--;
      } else if (applied.decision === "would_apply") {
        decision.decision = "would_apply";
        result.wouldApply++;
      } else {
        decision.skipReason = applied.skipReason ?? "skip via applyToExistingCandidature";
        if (applied.error) {
          decision.error = applied.error;
          result.errors.push(`${entrepriseName}: ${applied.error}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      decision.error = msg;
      result.errors.push(`${decision.entreprise || decision.domain}: ${msg}`);
    }
  }

  // Persist summary + avance l'index de query pour le prochain run (rotation).
  settingsDoc.automation.lastProspectRunAt = new Date();
  const queryLabel = queries.length > 1 ? ` · query "${keywords.slice(0, 40)}" (${queryIdx + 1}/${queries.length})` : "";
  settingsDoc.automation.lastProspectSummary = `${result.scanned} scannées · ${result.applied} envoyée(s)${result.wouldApply > 0 ? ` · ${result.wouldApply} dry-run` : ""} · ${result.skipped} skip · ${result.errors.length} erreur(s)${queryLabel}`;
  if (!opts.keywords && queries.length > 1) {
    settingsDoc.automation.weeklyProspectQueryIndex = (queryIdx + 1) % queries.length;
  }
  await settingsDoc.save();

  result.ok = true;
  return result;
}

// ---------- Mode "URL unique" déclenché depuis le chat dashboard ----------
// Variante : pas de SerpAPI, pas de rate-limit 24h (l'utilisateur déclenche manuellement),
// score qualité plus permissif (la cible a été choisie consciemment).
// Garde-fous conservés : email whitelist + dédup par domaine (sauf override).

export interface ProcessSingleOptions {
  dryRun?: boolean;
  // Force l'envoi même si le domaine a déjà été contacté (rare, à utiliser avec parcimonie)
  allowDuplicate?: boolean;
  // Bypass complet du score qualité Gemini (l'user a déjà jugé que ça l'intéressait)
  skipQualityScore?: boolean;
  // Type de candidature (défaut: alternance)
  candidatureType?: "stage" | "alternance" | "cdi";
  // Override utilisateur explicite : accepte les emails génériques (contact@, info@) si pas d'email RH trouvé.
  // Le filtre blacklist (noreply@, abuse@…) reste actif.
  allowGenericEmail?: boolean;
  // Email saisi explicitement par l'utilisateur — bypass complet du picker (whitelist + loose).
  // Validé uniquement sur le format (regex basique). Utiliser quand l'auto-pick est trop strict
  // (typiquement : email valide mais sur un domaine "frère" que pickBestContactEmail refuse).
  emailOverride?: string;
}

export async function processSingleCompany(
  inputUrl: string,
  opts: ProcessSingleOptions = {},
): Promise<CandidateDecision> {
  await connectDB();
  const candidatureType: CandidatureType = opts.candidatureType ?? "alternance";

  const decision: CandidateDecision = {
    url: inputUrl,
    domain: domainOf(inputUrl),
    entreprise: "",
    decision: "skipped",
  };

  // Validation URL
  let cleanUrl: string;
  try {
    const u = new URL(inputUrl);
    if (!u.hostname) throw new Error("hostname vide");
    cleanUrl = u.toString();
  } catch {
    decision.error = `URL invalide : ${inputUrl}`;
    return decision;
  }

  try {
    // 1. Dedup par domaine (sauf override)
    if (!opts.allowDuplicate && (await alreadyContactedDomain(decision.domain))) {
      decision.skipReason = "déjà contactée (domaine présent en DB)";
      return decision;
    }

    // 2. Scrape entreprise
    const scraped = await scrapeCompanyWebsite(cleanUrl);
    if (!scraped.aboutText && scraped.emails.length === 0) {
      decision.skipReason = "scrape vide (site inaccessible, JS-only ou pas d'email exposé)";
      return decision;
    }
    const entrepriseName = scraped.companyName || decision.domain;
    decision.entreprise = entrepriseName;

    // 3. Sélection d'email (override / strict / loose) — gardée ici parce que la logique override
    // est spécifique au flow chat (saisie utilisateur explicite).
    let bestEmail: EmailScore | null = null;
    if (opts.emailOverride && opts.emailOverride.trim()) {
      const override = opts.emailOverride.trim().toLowerCase();
      const match = override.match(/^([^@\s]+)@([^@\s]+\.[a-z]{2,})$/);
      if (!match) {
        decision.scrapedEmails = scraped.emails;
        decision.skipReason = `email_override invalide : "${opts.emailOverride}" — format attendu local@domaine.tld`;
        return decision;
      }
      bestEmail = {
        email: override,
        score: 1,
        accept: true,
        reasons: ["manual_override"],
        local: match[1],
        domain: match[2],
      };
    } else {
      bestEmail = pickBestContactEmail(scraped.emails, cleanUrl);
      if (!bestEmail && opts.allowGenericEmail === true) {
        bestEmail = pickBestContactEmailLoose(scraped.emails, cleanUrl);
      }
    }
    if (!bestEmail) {
      decision.scrapedEmails = scraped.emails;
      decision.skipReason = opts.allowGenericEmail === true
        ? `aucun email RH valable même avec allow_generic_email. Candidats scrappés : ${scraped.emails.join(", ") || "(aucun)"}`
        : `aucun email RH valable trouvé. Candidats scrappés : ${scraped.emails.join(", ") || "(aucun)"}`;
      return decision;
    }
    decision.email = bestEmail;

    // 4. Score qualité optionnel (gardé local — seuil 0.3 vs 0.6 du hebdo).
    if (!opts.skipQualityScore) {
      try {
        const fit = await scoreCompanyFit(entrepriseName, scraped.aboutText || scraped.description);
        decision.companyScore = fit.score;
        decision.companyReason = fit.reason;
        if (fit.score < 0.3) {
          decision.skipReason = `score qualité très bas (${fit.score.toFixed(2)}) — ${fit.reason}. Override possible avec skipQualityScore.`;
          return decision;
        }
      } catch (geminiErr) {
        const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        decision.companyReason = `(scoring Gemini échoué : ${msg})`;
      }
    }

    // 5. Création Candidature en DB (statut "identifiée", lettre nulle — applyToExistingCandidature comble).
    const poste = "Candidature spontanée — Développeur fullstack";
    const candDoc = await Candidature.create({
      entreprise: entrepriseName,
      poste,
      plateforme: "Web",
      localisation: "",
      url: cleanUrl,
      description: (scraped.description || "").slice(0, 500),
      email: bestEmail.email,
      aboutText: scraped.aboutText,
      statut: "identifiée",
      type: candidatureType,
      lettre: null,
      notes: `Chat manual ${new Date().toISOString().slice(0, 10)}${decision.companyScore !== undefined ? ` — fit ${decision.companyScore.toFixed(2)}` : ""}`,
      source: "auto-apply",
      date: new Date().toISOString().slice(0, 10),
      letters: [],
    });
    decision.candidatureId = String(candDoc._id);

    // 6. Délègue à la pipeline partagée (lettre + envoi). preScraped évite un double scrape.
    const applied = await applyToExistingCandidature(candDoc, {
      dryRun: opts.dryRun,
      skipQualityScore: true,
      allowGenericEmail: opts.allowGenericEmail,
      preScraped: {
        aboutText: scraped.aboutText,
        description: scraped.description,
        emails: scraped.emails,
        companyName: scraped.companyName,
      },
      notificationSubjectPrefix: "[CHAT]",
    });

    if (applied.decision === "applied") {
      decision.decision = "applied";
    } else if (applied.decision === "would_apply") {
      decision.decision = "would_apply";
    } else {
      if (applied.skipReason) decision.skipReason = applied.skipReason;
      if (applied.error) decision.error = applied.error;
      if (applied.scrapedEmails) decision.scrapedEmails = applied.scrapedEmails;
    }
  } catch (err) {
    decision.error = err instanceof Error ? err.message : String(err);
  }

  return decision;
}
