// Résout le site officiel d'une entreprise via SerpAPI.
// Query : "<entreprise>" site officiel <location>. Filtre les hôtes "annuaires/réseaux sociaux"
// (societe.com, linkedin.com, etc.) qui pollueraient le scrape downstream.
// SerpAPI cache déjà côté Google (15 min) → pas de cache local.

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

export async function resolveCompanyWebsite(
  entreprise: string,
  location: string = ""
): Promise<string | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY non configurée");
  const name = entreprise.trim();
  if (!name) return null;

  const q = location.trim()
    ? `"${name}" site officiel ${location.trim()}`
    : `"${name}" site officiel`;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&gl=fr&hl=fr&num=10&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SerpAPI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    organic_results?: Array<{ link?: string }>;
  };
  const results = data.organic_results ?? [];
  for (const r of results) {
    const link = r.link;
    if (!link || !link.startsWith("http")) continue;
    const host = hostOf(link);
    if (!host) continue;
    if (isBlocked(host)) continue;
    return link;
  }
  return null;
}
