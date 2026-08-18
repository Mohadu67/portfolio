// Filtres pour décider à quel email envoyer une candidature spontanée auto.
// Objectif : éviter d'écrire à un standard générique (info@, contact@) qui n'a aucune
// chance d'aboutir, et favoriser les emails RH ou nominatifs.

// Le local-part est découpé en tokens sur tout non-lettre (rh-recrutement → [rh, recrutement])
// et comparé aux ensembles ci-dessous. Le découpage évite les deux pièges du matching par
// préfixe : "service.recrutement@" (préfixe blacklisté mais token RH → vrai contact) et
// "mentions-legales@" (aucun préfixe ne matche mais chaque token est légal).

const HIGH_VALUE_LOCAL_TOKENS: ReadonlySet<string> = new Set([
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
]);

// Blacklist DURE : jamais destinataire, même combinée à un token RH (noreply-jobs@ reste un
// émetteur automatique ; dpo-recrutement@ n'existe pas). Contacts légaux/conformité inclus :
// le scraper les ramasse sur les pages RGPD/mentions légales, jamais des destinataires.
const HARD_BLACKLIST_TOKENS: ReadonlySet<string> = new Set([
  "noreply",
  "donotreply",
  "postmaster",
  "abuse",
  "webmaster",
  "dpo",
  "rgpd",
  "gdpr",
  "privacy",
  "dataprotection",
  "protection",
  "donnees",
  "personnelles",
  "confidentialite",
  "legal",
  "legale",
  "legales",
  "mentions",
  "juridique",
  "compliance",
  "conformite",
  "cnil",
]);

// Formes concaténées sans séparateur (privacyofficer@, noreply2@) : match par préfixe sur le
// local compacté (lettres seules). Restreint aux mots qui ne peuvent pas démarrer un
// nominatif initiale+nom — "dpo" en est exclu exprès (dpont@ = D. Pont, nom réel).
const HARD_BLACKLIST_COMPACT_PREFIXES = [
  "noreply",
  "donotreply",
  "mailerdaemon",
  "postmaster",
  "abuse",
  "webmaster",
  "privacy",
  "rgpd",
  "gdpr",
  "dataprotection",
] as const;

// Blacklist DOUCE : boîtes génériques d'exploitation. Un token RH la neutralise (traité en
// amont) ; sinon rejet, y compris les formes composées (service.client@, sav-paris@).
const SOFT_BLACKLIST_TOKENS: ReadonlySet<string> = new Set([
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
]);

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

// TLD final considérés comme plausibles pour une entreprise. Évite de sélectionner des
// artefacts de scraping du type "00contact@boite.frsuivez" où le TLD est en réalité du
// texte adjacent ramassé par le regex.
const COMMON_TLDS = new Set([
  "ac", "ad", "ae", "af", "ag", "ai", "al", "am", "ao", "ar", "as", "at", "au", "aw", "ax", "az",
  "ba", "bb", "bd", "be", "bf", "bg", "bh", "bi", "bj", "bm", "bn", "bo", "br", "bs", "bt", "bw",
  "by", "bz", "ca", "cc", "cd", "cf", "cg", "ch", "ci", "ck", "cl", "cm", "cn", "co", "cr", "cu",
  "cv", "cw", "cx", "cy", "cz", "de", "dj", "dk", "dm", "do", "dz", "ec", "ee", "eg", "er", "es",
  "et", "eu", "fi", "fj", "fk", "fm", "fo", "fr", "ga", "gd", "ge", "gf", "gg", "gh", "gi", "gl",
  "gm", "gn", "gp", "gq", "gr", "gs", "gt", "gu", "gw", "gy", "hk", "hm", "hn", "hr", "ht", "hu",
  "id", "ie", "il", "im", "in", "io", "iq", "ir", "is", "it", "je", "jm", "jo", "jp", "ke", "kg",
  "kh", "ki", "km", "kn", "kp", "kr", "kw", "ky", "kz", "la", "lb", "lc", "li", "lk", "lr", "ls",
  "lt", "lu", "lv", "ly", "ma", "mc", "md", "me", "mg", "mh", "mk", "ml", "mm", "mn", "mo", "mp",
  "mq", "mr", "ms", "mt", "mu", "mv", "mw", "mx", "my", "mz", "na", "nc", "ne", "nf", "ng", "ni",
  "nl", "no", "np", "nr", "nu", "nz", "om", "pa", "pe", "pf", "pg", "ph", "pk", "pl", "pm", "pn",
  "pr", "ps", "pt", "pw", "py", "qa", "re", "ro", "rs", "ru", "rw", "sa", "sb", "sc", "sd", "se",
  "sg", "sh", "si", "sk", "sl", "sm", "sn", "so", "sr", "ss", "st", "sv", "sx", "sy", "sz", "tc",
  "td", "tf", "tg", "th", "tj", "tk", "tl", "tm", "tn", "to", "tr", "tt", "tv", "tw", "tz", "ua",
  "ug", "uk", "us", "uy", "uz", "va", "vc", "ve", "vg", "vi", "vn", "vu", "wf", "ws", "ye", "yt",
  "za", "zm", "zw",
  "com", "org", "net", "int", "edu", "gov", "mil", "info", "biz", "name", "pro", "aero", "asia",
  "cat", "coop", "jobs", "mobi", "museum", "travel", "xxx", "post", "tel", "arpa",
  // TLD composés courants
  "co.uk", "com.au", "co.nz", "co.za", "com.br", "com.mx", "com.ar", "com.tr", "co.jp", "com.sg",
  "co.in", "com.cn", "com.hk", "co.kr", "com.tw", "co.id", "com.my", "co.th", "com.vn", "co.il",
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

// Vérifie que le domaine termine par un TLD reconnu. On teste d'abord les TLD composés
// (ex: co.uk), puis le label final seul.
function hasValidTld(domain: string): boolean {
  const lower = domain.toLowerCase();
  const parts = lower.split(".").filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.length >= 3) {
    const compound = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (COMMON_TLDS.has(compound)) return true;
  }
  return COMMON_TLDS.has(parts[parts.length - 1]);
}

// Détecte les artefacts de scraping : local-part commençant par un ou plusieurs chiffres
// avant des lettres (ex: "00contact", "123rh"). Un vrai nominatif peut commencer par une
// initiale mais pas par une suite de chiffres.
function hasLeadingDigitArtifact(local: string): boolean {
  return /^\d+[a-z]/.test(local);
}

// Suffixes corporatifs/juridiques NON ambigus : une boîte héberge souvent son site sur
// "extia-group.com" tout en envoyant ses mails depuis "extia.fr". On retire ces tokens
// pour comparer la RACINE de marque. Volontairement restreint aux formes juridiques et à
// "group/holding" : on EXCLUT les noms communs (tech, digital, services, conseil, france…)
// qui collisionneraient deux marques distinctes ("data-services" ≠ "cloud-services").
const CORPORATE_DOMAIN_TOKENS: ReadonlySet<string> = new Set([
  "group", "groupe", "holding", "sa", "sas", "sasu", "sarl", "inc", "corp", "llc", "gmbh", "ltd",
]);

// Labels de suffixe public de 2e niveau : pour ne pas confondre le suffixe avec la marque
// sur les TLD composés (ex. ".co.uk", ".com.fr", ".asso.fr").
const SECOND_LEVEL_SUFFIX_LABELS: ReadonlySet<string> = new Set([
  "co", "com", "org", "net", "gouv", "gov", "asso", "edu", "ac", "tm", "nom", "gob",
]);

// Racine de marque d'un domaine : label enregistrable (2e niveau, en sautant un éventuel
// suffixe public composé), découpé sur séparateurs (- _), privé de ses tokens corporatifs.
//   "extia-group.com" → "extia"   |   "extia.fr" → "extia"   |   "boite.co.uk" → "boite"
// IMPORTANT : on ne découpe QUE sur séparateurs explicites. Un label non délimité reste
// intact → "etudeplusstrasbourg.fr" reste "etudeplusstrasbourg" (≠ "etudeplus"), pour ne
// PAS rapprocher à tort deux entités distinctes.
function domainBrandKey(domain: string): string {
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return (parts[0] ?? "").replace(/[-_]/g, "");
  let idx = parts.length - 2;
  if (idx >= 1 && SECOND_LEVEL_SUFFIX_LABELS.has(parts[idx])) idx -= 1; // saute .co.uk, .com.fr…
  const sld = parts[idx] ?? "";
  const tokens = sld.split(/[-_]/).filter((t) => t && !CORPORATE_DOMAIN_TOKENS.has(t));
  // Si tout a été retiré (domaine = "group.com"), on retombe sur le label brut.
  return tokens.length ? tokens.join("") : sld.replace(/[-_]/g, "");
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

  // Artefacts de scraping : local-part commençant par des chiffres ou TLD inventé.
  if (hasLeadingDigitArtifact(local) || !hasValidTld(domain)) {
    return {
      email: trimmed,
      score: 0,
      accept: false,
      reasons: ["invalid_format"],
      local,
      domain,
    };
  }

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
    // Match si base identique (extia.fr == extia.fr) OU même racine de marque après
    // retrait des suffixes corporatifs (extia.fr ~ extia-group.com). Couvre aussi les
    // variantes de TLD d'une même marque (extia.fr ~ extia.com). Garde-fou : on exige une
    // racine ≥ 3 caractères pour éviter qu'un résidu trop court (ex. "go") collisionne.
    const companyBrand = domainBrandKey(companyDomain);
    const emailBrand = domainBrandKey(domain);
    const sameBrand =
      !!baseCompany &&
      !!baseEmail &&
      (baseCompany === baseEmail ||
        (companyBrand.length >= 3 && companyBrand === emailBrand));
    if (sameBrand) {
      reasons.push("domain_match");
      score += 0.25;
    } else if (baseCompany && baseEmail) {
      reasons.push("domain_mismatch");
      score -= 0.2;
      // Domain mismatch : email sur un autre domaine que le site de l'entreprise.
      // Même un local-part nominatif (marie.dupont@) ne doit pas suffire à valider :
      // on n'a aucune preuve que cette personne est liée à la boîte ciblée.
      hardCap = hardCap === null ? 0.4 : Math.min(hardCap, 0.4);
    }
  }

  // Local-part checks (la partie avant le @ est le signal le plus fort)
  const tokens = local.split(/[^a-z]+/).filter(Boolean);
  const compact = local.replace(/[^a-z]/g, "");
  const hardBlacklisted =
    tokens.some((t) => HARD_BLACKLIST_TOKENS.has(t)) ||
    HARD_BLACKLIST_COMPACT_PREFIXES.some((p) => compact.startsWith(p));

  if (hardBlacklisted) {
    reasons.push("blacklist_prefix");
    score = 0;
    hardCap = 0;
  } else if (tokens.some((t) => HIGH_VALUE_LOCAL_TOKENS.has(t))) {
    reasons.push("high_value_prefix");
    score += 0.5;
  } else if (tokens.some((t) => SOFT_BLACKLIST_TOKENS.has(t))) {
    reasons.push("blacklist_prefix");
    score = 0;
    hardCap = 0;
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
