// Filtres pour décider à quel email envoyer une candidature spontanée auto.
// Objectif : éviter d'écrire à un standard générique (info@, contact@) qui n'a aucune
// chance d'aboutir, et favoriser les emails RH ou nominatifs.

const HIGH_VALUE_LOCAL_PREFIXES = [
  "rh",
  "recrutement",
  "recrutements",
  "recruiting",
  "careers",
  "career",
  "jobs",
  "job",
  "talent",
  "talents",
  "hiring",
  "candidature",
  "candidatures",
  "drh",
  "hr",
  "people",
  "rrh",
];

const BLACKLIST_LOCAL_PREFIXES = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "abuse",
  "webmaster",
  "support",
  "help",
  "service",
  "services",
  "sav",
  "facturation",
  "billing",
  "comptabilite",
  "compta",
  "accounting",
  "marketing",
  "sales",
  "commercial",
  "ventes",
  "presse",
  "press",
  "media",
  "newsletter",
  "info",
  "infos",
  "bonjour",
  "hello",
  "hi",
];

export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.fr",
  "hotmail.com",
  "hotmail.fr",
  "outlook.com",
  "outlook.fr",
  "live.com",
  "live.fr",
  "icloud.com",
  "free.fr",
  "orange.fr",
  "wanadoo.fr",
  "laposte.net",
  "sfr.fr",
]);

export type EmailScoreReason =
  | "high_value_prefix"
  | "nominative"
  | "domain_match"
  | "free_email_domain"
  | "domain_mismatch"
  | "generic_prefix"
  | "blacklist_prefix"
  | "invalid_format"
  // L'utilisateur a saisi l'email à la main via email_override — bypass complet du picker.
  | "manual_override";

export interface EmailScore {
  email: string;
  score: number;          // 0 = ne jamais utiliser, 1 = idéal
  accept: boolean;        // true si score >= 0.5
  reasons: EmailScoreReason[];
  local: string;
  domain: string;
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function isLikelyNominative(local: string): boolean {
  // prenom.nom, prenom-nom, p.nom, prenomnom (rare)
  if (/^[a-z]{2,}\.[a-z]{2,}$/.test(local)) return true;
  if (/^[a-z]{1,2}\.[a-z]{2,}$/.test(local)) return true;
  if (/^[a-z]{2,}-[a-z]{2,}$/.test(local)) return true;
  return false;
}

const GENERIC_LOCAL_PREFIXES = ["contact", "info", "infos", "hello", "bonjour"];

export function scoreContactEmail(email: string, companyUrlOrDomain?: string): EmailScore {
  const trimmed = email.trim().toLowerCase();
  const match = trimmed.match(/^([^@\s]+)@([^@\s]+\.[a-z]{2,})$/);
  if (!match) {
    return {
      email: trimmed,
      score: 0,
      accept: false,
      reasons: ["invalid_format"],
      local: "",
      domain: "",
    };
  }
  const [, local, domain] = match;
  const reasons: EmailScoreReason[] = [];
  let score = 0.4; // baseline
  let hardCap: number | null = null; // plafond strict pour disqualifier

  // Domain checks
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    reasons.push("free_email_domain");
    score -= 0.4;
    // Un email RH / recrutement sur Gmail/Hotmail = suspect par construction.
    // On plafonne sous le seuil d'acceptation peu importe le prefix.
    hardCap = 0.3;
  } else if (companyUrlOrDomain) {
    const companyDomain = normalizeDomain(companyUrlOrDomain);
    const baseCompany = companyDomain.split(".").slice(-2).join(".");
    const baseEmail = domain.split(".").slice(-2).join(".");
    if (baseCompany && baseEmail && baseCompany === baseEmail) {
      reasons.push("domain_match");
      score += 0.25;
    } else if (baseCompany && baseEmail && baseCompany !== baseEmail) {
      reasons.push("domain_mismatch");
      score -= 0.2;
      // Domain mismatch : email sur un autre domaine que le site de l'entreprise.
      // Même un local-part nominatif (marie.dupont@) ne doit pas suffire à valider :
      // on n'a aucune preuve que cette personne est liée à la boîte ciblée.
      hardCap = hardCap === null ? 0.4 : Math.min(hardCap, 0.4);
    }
  }

  // Local-part checks (la partie avant le @ est le signal le plus fort)
  if (BLACKLIST_LOCAL_PREFIXES.includes(local)) {
    reasons.push("blacklist_prefix");
    score = 0;
    hardCap = 0;
  } else if (HIGH_VALUE_LOCAL_PREFIXES.some((p) => local === p || local.startsWith(`${p}.`) || local.startsWith(`${p}-`) || local.startsWith(`${p}_`))) {
    reasons.push("high_value_prefix");
    score += 0.5;
  } else if (isLikelyNominative(local)) {
    reasons.push("nominative");
    score += 0.4;
  } else if (GENERIC_LOCAL_PREFIXES.includes(local)) {
    reasons.push("generic_prefix");
    // contact@/info@/hello@ : boîte mail générique qui ne mène nulle part.
    // Ne jamais accepter même si le domaine match — le coût d'un envoi raté est trop élevé.
    hardCap = hardCap === null ? 0.4 : Math.min(hardCap, 0.4);
  }

  score = Math.max(0, Math.min(1, score));
  if (hardCap !== null) score = Math.min(score, hardCap);
  return {
    email: trimmed,
    score,
    accept: score >= 0.5,
    reasons,
    local,
    domain,
  };
}

// Trie une liste d'emails par score décroissant, garde ceux acceptés.
export function pickBestContactEmail(emails: string[], companyUrlOrDomain?: string): EmailScore | null {
  if (!emails.length) return null;
  const scored = emails
    .map((e) => scoreContactEmail(e, companyUrlOrDomain))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best.accept ? best : null;
}

/**
 * Variante permissive de pickBestContactEmail — utilisée UNIQUEMENT en override
 * explicite utilisateur (allowGenericEmail=true côté apply_to_company).
 *
 * Différences avec la version stricte :
 *  - Accepte les "generic_prefix" (contact@, info@…) tant que le domaine match l'entreprise
 *  - Refuse toujours blacklist_prefix (noreply, abuse, support…), invalid_format, free_email_domain,
 *    domain_mismatch (email sur un autre domaine que l'entreprise — la promesse faite à l'IA dans la
 *    description du tool est "domaine doit match l'entreprise")
 *  - Pas de seuil 0.5 — retourne le meilleur restant après filtre dur
 *  - Préfère domain_match > generic_prefix neutre
 */
export function pickBestContactEmailLoose(
  emails: string[],
  companyUrlOrDomain?: string,
): EmailScore | null {
  if (!emails.length) return null;
  const scored = emails.map((e) => scoreContactEmail(e, companyUrlOrDomain));
  const eligible = scored.filter((s) =>
    !s.reasons.includes("blacklist_prefix") &&
    !s.reasons.includes("invalid_format") &&
    !s.reasons.includes("free_email_domain") &&
    !s.reasons.includes("domain_mismatch"),
  );
  if (eligible.length === 0) return null;
  // Sort par : domain_match d'abord, puis score décroissant
  eligible.sort((a, b) => {
    const aMatch = a.reasons.includes("domain_match") ? 1 : 0;
    const bMatch = b.reasons.includes("domain_match") ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return b.score - a.score;
  });
  return eligible[0];
}
