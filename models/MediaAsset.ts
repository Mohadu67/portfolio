import { Schema, model, models } from "mongoose";

export type MediaKind = "photo" | "project" | "asset";

export interface IMediaAsset {
  _id?: string;
  name: string;
  filename: string;
  mime: string;
  size: number;
  kind: MediaKind;
  isActive: boolean;
  data: Buffer;
  created_at: Date;
  updated_at: Date;
}

const mediaSchema = new Schema<IMediaAsset>(
  {
    name: { type: String, required: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ["photo", "project", "asset"], default: "photo", index: true },
    isActive: { type: Boolean, default: false, index: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const MediaAsset = models.MediaAsset || model<IMediaAsset>("MediaAsset", mediaSchema);
