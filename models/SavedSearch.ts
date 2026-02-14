import { Schema, model, models } from "mongoose";

export interface ISavedSearch {
  _id?: string;
  url: string;
  companyName: string;
  type: "url" | "google";
  created_at: Date;
}

const savedSearchSchema = new Schema<ISavedSearch>(
  {
    url: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    type: { type: String, enum: ["url", "google"], default: "url" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const SavedSearch =
  models.SavedSearch || model<ISavedSearch>("SavedSearch", savedSearchSchema);
