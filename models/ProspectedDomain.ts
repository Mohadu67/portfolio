import { Schema, model, models } from "mongoose";

// Cache des domaines déjà évalués par le pipeline auto-apply.
// Évite de re-scraper + re-scorer (waste Gemini quota) les sites qui n'ont
// pas passé un check au run précédent. TTL différencié selon la raison :
// - scrape_empty / no_email : 14j (le site peut redevenir accessible / ajouter un mail)
// - low_score / not_tech    : 90j (très peu de chances que ça change)
// - other                   : 30j

export type ProspectSkipReason =
  | "scrape_empty"
  | "low_score"
  | "not_tech"
  | "no_email"
  | "send_failed"
  // Cible refusée explicitement via le bouton « Ignorer » Telegram (prospection interactive).
  | "user_ignored"
  | "other";

export interface IProspectedDomain {
  domain: string;
  entreprise?: string;
  lastEvaluatedAt: Date;
  nextEvaluateAt: Date;
  skipReason: ProspectSkipReason;
  skipDetail?: string;
  companyScore?: number;
  evaluationCount: number;
}

const prospectedDomainSchema = new Schema<IProspectedDomain>(
  {
    domain: { type: String, required: true, unique: true, index: true },
    entreprise: { type: String, default: null },
    lastEvaluatedAt: { type: Date, required: true },
    nextEvaluateAt: { type: Date, required: true, index: true },
    skipReason: {
      type: String,
      enum: ["scrape_empty", "low_score", "not_tech", "no_email", "send_failed", "user_ignored", "other"],
      required: true,
    },
    skipDetail: { type: String, default: null },
    companyScore: { type: Number, default: null },
    evaluationCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const ProspectedDomain =
  models.ProspectedDomain ||
  model<IProspectedDomain>("ProspectedDomain", prospectedDomainSchema);

const TTL_DAYS_BY_REASON: Record<ProspectSkipReason, number> = {
  scrape_empty: 14,
  no_email: 30,
  send_failed: 7,
  low_score: 90,
  not_tech: 90,
  user_ignored: 365,
  other: 30,
};

export function computeNextEvaluateAt(reason: ProspectSkipReason): Date {
  const days = TTL_DAYS_BY_REASON[reason] ?? 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// Upsert un domaine évalué. Bump le compteur si déjà présent.
export async function recordProspectSkip(input: {
  domain: string;
  entreprise?: string;
  reason: ProspectSkipReason;
  detail?: string;
  companyScore?: number;
}): Promise<void> {
  if (!input.domain) return;
  const now = new Date();
  await ProspectedDomain.findOneAndUpdate(
    { domain: input.domain },
    {
      $set: {
        entreprise: input.entreprise ?? null,
        lastEvaluatedAt: now,
        nextEvaluateAt: computeNextEvaluateAt(input.reason),
        skipReason: input.reason,
        skipDetail: input.detail ?? null,
        companyScore: input.companyScore ?? null,
      },
      $inc: { evaluationCount: 1 },
      $setOnInsert: { domain: input.domain },
    },
    { upsert: true, new: true }
  );
}

// Retourne le doc cache si le domaine est encore "frais" (nextEvaluateAt > now).
// null sinon (= autoriser une nouvelle évaluation).
export async function isProspectSkipFresh(domain: string): Promise<IProspectedDomain | null> {
  if (!domain) return null;
  const doc = await ProspectedDomain.findOne({
    domain,
    nextEvaluateAt: { $gt: new Date() },
  });
  return doc ? (doc.toObject ? doc.toObject() : doc) : null;
}
