// Résout le site officiel d'une entreprise via SerpAPI.
// Query : "<entreprise>" site officiel <location>. Filtre les hôtes "annuaires/réseaux sociaux"
// (societe.com, linkedin.com, etc.) qui pollueraient le scrape downstream.
// SerpAPI cache déjà côté Google (15 min) → pas de cache local.

import { serpLanguage, type SupportedCountry } from "./scraper";

const BLOCKED_HOSTS: ReadonlySet<string> = new Set([
  "societe.com",
  "pappers.fr",
  "infogreffe.fr",
  "bodacc.fr",
  "pagesjaunes.fr",
  "fr.wikipedia.org",
  "en.wikipedia.org",
  "wikipedia.org",
  "linkedin.com",
  "indeed.com",
  "glassdoor.fr",
  "glassdoor.com",
  "welcometothejungle.com",
  "hellowork.com",
  "jobteaser.com",
  "fr.trustpilot.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "apec.fr",
  "francetravail.fr",
  "pole-emploi.fr",
  "monster.fr",
  "regionsjob.com",
  "jobijoba.com",
  "meteojob.com",
  "leboncoin.fr",
  // Sites d'articles / presse / annuaires qui polluent la résolution du site officiel.
  "affiches-moniteur.com",
  "moniteur.fr",
  "ebra.fr",
  "estrepublicain.fr",
  "dna.fr",
  "francebleu.fr",
  "france3-regions.francetvinfo.fr",
  "strategies.fr",
  "lesechos.fr",
  "latribune.fr",
  "bfmtv.com",
  "actu.fr",
  "20minutes.fr",
  "journaldunet.com",
  "usine-digitale.fr",
  "usinenouvelle.com",
  "lesaffaires.com",
  "entreprises.lefigaro.fr",
  "blogdumoderateur.com",
  "maddyness.com",
  "frenchweb.fr",
  "presse-citron.net",
]);

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function isBlocked(host: string): boolean {
  if (BLOCKED_HOSTS.has(host)) return true;
  // Match sous-domaines : ex. `fr.linkedin.com` ⊂ `linkedin.com`.
  for (const blocked of BLOCKED_HOSTS) {
    if (host.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function domainTokens(host: string): string[] {
  return host
    .replace(/^www\./i, "")
    .split(".")
    .filter((p) => p.length >= 3 && !["com", "fr", "net", "org", "io", "co", "eu", "ch", "be", "lu", "de", "at", "nl"].includes(p));
}

export function isLikelyOfficialSite(site: string, companyName: string): boolean {
  return scoreCompanyLink(site, companyName) >= 80;
}

function scoreCompanyLink(link: string, companyName: string): number {
  const host = hostOf(link);
  if (!host) return -Infinity;
  if (isBlocked(host)) return -Infinity;

  const hostNorm = normalizeForMatch(host);
  const nameNorm = normalizeForMatch(companyName);
  const tokens = domainTokens(host);

  let score = 0;

  // Nom complet de l'entreprise dans le domaine = très fort signal.
  if (nameNorm.length >= 4 && hostNorm.includes(nameNorm)) {
    score += 100;
  }

  // Mots significatifs du nom présents dans le domaine.
  const nameWords = companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  for (const word of nameWords) {
    if (hostNorm.includes(word)) score += 25;
  }

  // Tokens du domaine qui ressemblent à des mots du nom (tolérance partielle).
  for (const token of tokens) {
    const tokenNorm = normalizeForMatch(token);
    for (const word of nameWords) {
      if (tokenNorm.length >= 4 && (tokenNorm.includes(word) || word.includes(tokenNorm))) {
        score += 15;
      }
    }
  }

  // Pénalités fortes pour les sites qui ne sont clairement pas le site corporate.
  const suspicious = ["blog", "news", "article", "journal", "media", "magazine", "presse", "annuaire", "avis"];
  for (const bad of suspicious) {
    if (hostNorm.includes(bad)) score -= 60;
  }

  // Légère préférence pour les TLD d'entreprise classiques.
  if (/\.(com|fr|net|org)$/.test(host)) score += 5;

  return score;
}

// Disjoncteur quota : quand SerpAPI répond 429 « run out of searches », TOUS les appels
// suivants échoueraient pareil jusqu'au renouvellement du plan — inutile de marteler l'API
// à chaque run de cron (bruit de logs + latence). In-memory : reset au redémarrage, et
// réessai automatique après le délai.
const QUOTA_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 h
let quotaExhaustedUntil = 0;

export async function resolveCompanyWebsite(
  entreprise: string,
  location: string = "",
  country: string = "fr"
): Promise<string | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY non configurée");
  const name = entreprise.trim();
  if (!name) return null;

  if (Date.now() < quotaExhaustedUntil) {
    throw new Error(
      `SerpAPI quota épuisé (réessai automatique après ${new Date(quotaExhaustedUntil).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })})`
    );
  }

  const c = country.trim().toLowerCase() as SupportedCountry;
  const gl = c;
  const hl = serpLanguage(c);
  // Requête sans "site officiel" parfois plus efficace pour capter le domaine racine,
  // surtout quand Google privilégie des articles. On garde la formulation explicite
  // comme fallback en testant les deux.
  const queries = location.trim()
    ? [`"${name}" ${location.trim()}`, `"${name}" site officiel ${location.trim()}`]
    : [`"${name}"`, `"${name}" site officiel`];

  let bestLink: string | null = null;
  let bestScore = -Infinity;

  for (const q of queries) {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&gl=${gl}&hl=${hl}&num=20&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) {
        quotaExhaustedUntil = Date.now() + QUOTA_COOLDOWN_MS;
      }
      throw new Error(`SerpAPI ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      organic_results?: Array<{ link?: string }>;
    };
    const results = data.organic_results ?? [];
    for (const r of results) {
      const link = r.link;
      if (!link || !link.startsWith("http")) continue;
      const score = scoreCompanyLink(link, name);
      if (score > bestScore) {
        bestScore = score;
        bestLink = link;
      }
    }
    // Si on a déjà un très bon match, pas la peine de gaspiller une 2ᵉ requête.
    if (bestScore >= 80) break;
  }

  // Seuil minimal : un score ≤ 0 signifie qu'aucun résultat ne ressemble vraiment au nom.
  return bestScore > 0 ? bestLink : null;
}
