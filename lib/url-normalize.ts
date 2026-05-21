/**
 * Normalise une URL pour comparaison (dédup cross-source).
 * Idempotent. Si l'URL est invalide, retourne la string trimmée en lowercase.
 *
 * Règles :
 *   - lowercase du host
 *   - drop "www."
 *   - retire les query params marketing (utm_*, gclid, fbclid, mc_*, ref, source)
 *   - retire le fragment (#…)
 *   - strip trailing slash sur le path
 *   - tri des query params restants pour stabilité
 */
const MARKETING_PARAM_PREFIXES = ["utm_", "mc_"];
const MARKETING_PARAM_NAMES = new Set([
  "gclid",
  "fbclid",
  "ref",
  "source",
  "trk",
  "trkCampaign",
  "spReferer",
  "refId",
]);

export function normalizeUrl(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const u = new URL(trimmed);
    u.hash = "";
    u.host = u.host.toLowerCase().replace(/^www\./, "");

    const params = [...u.searchParams.entries()].filter(([key]) => {
      const lower = key.toLowerCase();
      if (MARKETING_PARAM_NAMES.has(lower)) return false;
      return !MARKETING_PARAM_PREFIXES.some((p) => lower.startsWith(p));
    });
    params.sort(([a], [b]) => a.localeCompare(b));

    // Reconstruire les search params
    u.search = "";
    for (const [k, v] of params) u.searchParams.append(k, v);

    let result = u.toString();
    // Strip trailing slash sur le path (mais pas si seul "/" à la racine sans query)
    if (result.endsWith("/") && !result.endsWith("//") && u.pathname !== "/") {
      result = result.slice(0, -1);
    } else if (u.pathname === "/" && !u.search) {
      // garder ".../" pour les racines (rare cas pour des offres)
    }
    return result;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function areSameUrl(a: string, b: string): boolean {
  return normalizeUrl(a) === normalizeUrl(b);
}
