import { FREE_EMAIL_DOMAINS } from "./auto-apply-filters";

// Logique de matching email reçu → candidature, extraite pour pouvoir être testée
// indépendamment de la stack IMAP / Mongo.

export function normalizeEmail(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

export interface MatchableCandidature {
  email?: string;
}

export interface CandidatureEmailIndex<C extends MatchableCandidature> {
  emailToCandidature: Map<string, C>;
  // Une candidature par bucket de domaine. Plusieurs candidatures même domaine = ambigu.
  domainToCandidatures: Map<string, C[]>;
}

/**
 * Construit les deux index utilisés pour matcher un mail entrant à une candidature.
 * - emailToCandidature : match exact sur l'email destinataire stocké
 * - domainToCandidatures : fallback domaine quand l'expéditeur change d'adresse au sein
 *   de la même boîte. Les domaines free (gmail.com, outlook.fr, …) sont exclus du
 *   bucket domaine pour éviter les faux positifs.
 */
export function buildCandidatureEmailIndex<C extends MatchableCandidature>(
  candidatures: readonly C[],
): CandidatureEmailIndex<C> {
  const emailToCandidature = new Map<string, C>();
  const domainToCandidatures = new Map<string, C[]>();
  for (const c of candidatures) {
    const e = normalizeEmail(c.email);
    if (!e) continue;
    if (!emailToCandidature.has(e)) emailToCandidature.set(e, c);
    const dom = e.split("@")[1];
    if (dom && !FREE_EMAIL_DOMAINS.has(dom)) {
      const arr = domainToCandidatures.get(dom) ?? [];
      arr.push(c);
      domainToCandidatures.set(dom, arr);
    }
  }
  return { emailToCandidature, domainToCandidatures };
}

/**
 * Cherche la candidature qui correspond à un expéditeur donné.
 * 1. Match exact email d'abord (cas nominal — Stan a répondu sur l'email RH initial).
 * 2. Sinon fallback domaine si exactement 1 candidature sur ce domaine non free
 *    (ex : candidature envoyée à rh@abby.com, suivi reçu de stan@abby.com → match).
 * 3. Sinon undefined.
 */
export function findCandidatureForSender<C extends MatchableCandidature>(
  fromEmailRaw: string | undefined | null,
  index: CandidatureEmailIndex<C>,
): C | undefined {
  const fromEmail = normalizeEmail(fromEmailRaw);
  if (!fromEmail) return undefined;
  const exact = index.emailToCandidature.get(fromEmail);
  if (exact) return exact;
  const dom = fromEmail.split("@")[1];
  if (!dom || FREE_EMAIL_DOMAINS.has(dom)) return undefined;
  const candidates = index.domainToCandidatures.get(dom);
  if (candidates && candidates.length === 1) return candidates[0];
  return undefined;
}
