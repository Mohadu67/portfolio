import { Schema, model, models } from "mongoose";

export type QueryFrequency = "manual" | "daily" | "weekly" | "biweekly";

export interface ISavedQuery {
  _id?: string;
  keywords: string;
  location: string;
  country: string;
  frequency: QueryFrequency;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastRunNewCount: number;
  created_at: Date;
  updated_at: Date;
}

const savedQuerySchema = new Schema<ISavedQuery>(
  {
    keywords: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    country: { type: String, default: "fr", trim: true },
    frequency: {
      type: String,
      enum: ["manual", "daily", "weekly", "biweekly"],
      default: "manual",
      index: true,
    },
    nextRunAt: { type: Date, default: null, index: true },
    lastRunAt: { type: Date, default: null },
    lastRunNewCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Unicité sur (keywords, location, country) pour permettre la même query dans plusieurs pays
savedQuerySchema.index({ keywords: 1, location: 1, country: 1 }, { unique: true });

export const SavedQuery =
  models.SavedQuery || model<ISavedQuery>("SavedQuery", savedQuerySchema);

const FREQUENCY_INTERVAL_MS: Record<QueryFrequency, number | null> = {
  manual: null,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
};

export function computeNextRunAt(
  frequency: QueryFrequency,
  from: Date = new Date()
): Date | null {
  const interval = FREQUENCY_INTERVAL_MS[frequency];
  if (!interval) return null;
  return new Date(from.getTime() + interval);
}
