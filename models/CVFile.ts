import { Schema, model, models } from "mongoose";
import type { CandidatureType } from "./Candidature";

export type CVFileScope = CandidatureType | "default";

export interface ICVFile {
  _id?: string;
  name: string;
  filename: string;
  mime: string;
  size: number;
  scope: CVFileScope;
  isDefault: boolean;
  data: Buffer;
  created_at: Date;
  updated_at: Date;
}

const cvFileSchema = new Schema<ICVFile>(
  {
    name: { type: String, required: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true, default: "application/pdf" },
    size: { type: Number, required: true },
    scope: {
      type: String,
      enum: ["stage", "alternance", "cdi", "default"],
      default: "default",
      index: true,
    },
    isDefault: { type: Boolean, default: false },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

cvFileSchema.index({ isDefault: 1 });

export const CVFile = models.CVFile || model<ICVFile>("CVFile", cvFileSchema);
