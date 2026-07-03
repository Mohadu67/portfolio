import { Schema, model, models } from "mongoose";

export type CronJobName =
  | "run-relances"
  | "check-inbox"
  | "run-saved-queries"
  | "weekly-prospect"
  | "run-offer-search"
  | "process-pending"
  | "telegram-pulse";

export type CronStatus = "success" | "failed" | "skipped";

export interface ICronLog {
  _id?: string;
  name: CronJobName;
  ranAt: Date;
  durationMs: number;
  status: CronStatus;
  processed: number;
  succeeded: number;
  failed: number;
  error?: string | null;
  summary?: string | null;
}

const cronLogSchema = new Schema<ICronLog>(
  {
    name: {
      type: String,
      enum: [
        "run-relances",
        "check-inbox",
        "run-saved-queries",
        "weekly-prospect",
        "run-offer-search",
        "process-pending",
        "telegram-pulse",
      ],
      required: true,
      index: true,
    },
    ranAt: { type: Date, required: true, index: true },
    durationMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["success", "failed", "skipped"],
      required: true,
      index: true,
    },
    processed: { type: Number, default: 0 },
    succeeded: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    error: { type: String, default: null },
    summary: { type: String, default: null },
  },
  { versionKey: false }
);

cronLogSchema.index({ name: 1, ranAt: -1 });

export const CronLog =
  models.CronLog || model<ICronLog>("CronLog", cronLogSchema);
