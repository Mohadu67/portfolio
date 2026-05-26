// Orchestrateur de prospection automatique hebdomadaire.
// Workflow : SerpAPI → scrape entreprise → score qualité → page recrutement → match annonce
// → extraction email RH → génération lettre → envoi candidature (avec rate-limit).

import { connectDB } from "./mongodb";
import { Candidature } from "@/models/Candidature";
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

async function countAutoAppliedSince(sinceMs: number): Promise<number> {
  const since = new Date(Date.now() - sinceMs);
  // Fix : on compte les docs qui ont AU MOINS UN envoi candidature "sent" dans la fenêtre.
  // L'ancien filtre `created_at >= since` ratait les envois récents sur des docs anciens
  // (ex: réessai sur une candidature créée il y a 25h), ce qui faisait sauter le rate-limit.
  return Candidature.countDocuments({
    source: "auto-apply",
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

      // 4. Score company fit
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
      const candidatureType = (offerScore?.jobType === "alternance" || offerScore?.jobType === "cdi")
        ? offerScore.jobType
        : "stage";
      if (chosenOffer && offerScore) {
        decision.bestOffer = { title: chosenOffer.title, url: chosenOffer.url, score: offerScore.score, reason: offerScore.reason, jobType: offerScore.jobType };
      }

      // 7. Generate letter (passe le type pour que le 1er paragraphe match stage/alternance/cdi)
      let lettre: string;
      try {
        lettre = await generateLetterProposal(entrepriseName, scraped.aboutText, poste, candidatureType, defaultLetterInstruction);
        geminiErrorsInRow = 0;
      } catch (geminiErr) {
        geminiErrorsInRow++;
        const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        decision.error = `Gemini generateLetterProposal failed: ${msg}`;
        result.errors.push(`${entrepriseName}: Gemini generateLetterProposal failed: ${msg}`);
        continue;
      }

      // 8. Create or update Candidature in DB
      const candDoc = await Candidature.create({
        entreprise: entrepriseName,
        poste,
        plateforme: "Web",
        localisation: location || "",
        url: chosenOffer?.url || company.url,
        description: (chosenOffer?.snippet || scraped.description || "").slice(0, 500),
        email: bestEmail.email,
        aboutText: scraped.aboutText,
        statut: "lettre générée",
        type: candidatureType,
        lettre,
        letterInstruction: defaultLetterInstruction,
        notes: `Auto-apply ${new Date().toISOString().slice(0, 10)} — fit ${fit.score.toFixed(2)}${chosenOffer ? `, offer ${offerScore?.score.toFixed(2)}` : " (spontanée)"}`,
        source: "auto-apply",
        date: new Date().toISOString().slice(0, 10),
        letters: [{
          version: 1,
          model: "gemini",
          content: lettre,
          generatedAt: new Date(),
          type: candidatureType,
        }],
      });
      decision.candidatureId = String(candDoc._id);

      // 9. Send (or simulate)
      if (opts.dryRun) {
        decision.decision = "would_apply";
        result.wouldApply++;
        continue;
      }

      try {
        const letterPdfBuffer = await generateLettrePDF(lettre, entrepriseName, poste);
        const resolvedCV = await resolveCVForSend({ cvFileId: null, type: candidatureType });
        await sendCandidature(
          entrepriseName,
          poste,
          bestEmail.email,
          letterPdfBuffer,
          process.env.PROFIL_NOM || "Mohammed Hamiani",
          candidatureType,
          { buffer: resolvedCV.buffer, filename: resolvedCV.filename }
        );

        candDoc.emailsSent = [
          ...(candDoc.emailsSent ?? []),
          {
            date: new Date(),
            to: bestEmail.email,
            subject: `Candidature - ${poste} - ${process.env.PROFIL_NOM || "Mohammed Hamiani"}`,
            type: "candidature",
            status: "sent",
            error: null,
          },
        ];
        candDoc.statut = "postulée";
        await scheduleAutoRelance(candDoc);
        await candDoc.save();

        decision.decision = "applied";
        result.applied++;
        remainingBudget--;

        sendNotification({
          type: "candidature",
          candidature: {
            _id: String(candDoc._id),
            entreprise: entrepriseName,
            poste,
            email: bestEmail.email,
            statut: "postulée",
          },
          emailSubject: `[AUTO-APPLY] ${entrepriseName} - ${poste}`,
        }).catch((e) => console.error("[auto-apply] notification failed:", e));
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        decision.error = msg;
        candDoc.emailsSent = [
          ...(candDoc.emailsSent ?? []),
          {
            date: new Date(),
            to: bestEmail.email,
            subject: `Candidature - ${poste}`,
            type: "candidature",
            status: "failed",
            error: msg,
          },
        ];
        await candDoc.save();
        result.errors.push(`Send failed for ${entrepriseName}: ${msg}`);
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
  // Type de candidature (défaut: stage)
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
  const candidatureType = opts.candidatureType ?? "stage";

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

    // 3. Score qualité (optionnel — l'user a déjà choisi la cible)
    if (!opts.skipQualityScore) {
      try {
        const fit = await scoreCompanyFit(entrepriseName, scraped.aboutText || scraped.description);
        decision.companyScore = fit.score;
        decision.companyReason = fit.reason;
        // Seuil plus permissif que le hebdo (0.3 au lieu de 0.6) — l'user a explicitement ciblé
        if (fit.score < 0.3) {
          decision.skipReason = `score qualité très bas (${fit.score.toFixed(2)}) — ${fit.reason}. Override possible avec skipQualityScore.`;
          return decision;
        }
      } catch (geminiErr) {
        // Non-bloquant : on continue sans score
        const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        decision.companyReason = `(scoring Gemini échoué : ${msg})`;
      }
    }

    // 4. Sélection de l'email destinataire
    // Ordre : 4a. emailOverride utilisateur (bypass total) > 4b. picker strict > 4c. picker loose si allowGenericEmail.
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

    // 5. Génération lettre via Gemini
    const poste = "Candidature spontanée — Développeur fullstack";
    let lettre: string;
    try {
      lettre = await generateLetterProposal(entrepriseName, scraped.aboutText, poste, candidatureType);
    } catch (geminiErr) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      decision.error = `Génération lettre échouée : ${msg}`;
      return decision;
    }

    // 6. Création Candidature en DB
    const candDoc = await Candidature.create({
      entreprise: entrepriseName,
      poste,
      plateforme: "Web",
      localisation: "",
      url: cleanUrl,
      description: (scraped.description || "").slice(0, 500),
      email: bestEmail.email,
      aboutText: scraped.aboutText,
      statut: "lettre générée",
      type: candidatureType,
      lettre,
      notes: `Chat manual ${new Date().toISOString().slice(0, 10)}${decision.companyScore !== undefined ? ` — fit ${decision.companyScore.toFixed(2)}` : ""}`,
      source: "auto-apply",
      date: new Date().toISOString().slice(0, 10),
      letters: [{
        version: 1,
        model: "gemini",
        content: lettre,
        generatedAt: new Date(),
        type: candidatureType,
      }],
    });
    decision.candidatureId = String(candDoc._id);

    // 7. Dry-run ou envoi réel
    if (opts.dryRun) {
      decision.decision = "would_apply";
      return decision;
    }

    try {
      const letterPdfBuffer = await generateLettrePDF(lettre, entrepriseName, poste);
      const resolvedCV = await resolveCVForSend({ cvFileId: null, type: candidatureType });
      await sendCandidature(
        entrepriseName,
        poste,
        bestEmail.email,
        letterPdfBuffer,
        process.env.PROFIL_NOM || "Mohammed Hamiani",
        candidatureType,
        { buffer: resolvedCV.buffer, filename: resolvedCV.filename },
      );

      candDoc.emailsSent = [
        ...(candDoc.emailsSent ?? []),
        {
          date: new Date(),
          to: bestEmail.email,
          subject: `Candidature - ${poste} - ${process.env.PROFIL_NOM || "Mohammed Hamiani"}`,
          type: "candidature",
          status: "sent",
          error: null,
        },
      ];
      candDoc.statut = "postulée";
      await scheduleAutoRelance(candDoc);
      await candDoc.save();

      decision.decision = "applied";

      sendNotification({
        type: "candidature",
        candidature: {
          _id: String(candDoc._id),
          entreprise: entrepriseName,
          poste,
          email: bestEmail.email,
          statut: "postulée",
        },
        emailSubject: `[CHAT] ${entrepriseName} - ${poste}`,
      }).catch((e) => console.error("[chat-apply] notification failed:", e));
    } catch (sendErr) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      decision.error = `Envoi échoué : ${msg}`;
      candDoc.emailsSent = [
        ...(candDoc.emailsSent ?? []),
        {
          date: new Date(),
          to: bestEmail.email,
          subject: `Candidature - ${poste}`,
          type: "candidature",
          status: "failed",
          error: msg,
        },
      ];
      await candDoc.save();
    }
  } catch (err) {
    decision.error = err instanceof Error ? err.message : String(err);
  }

  return decision;
}
