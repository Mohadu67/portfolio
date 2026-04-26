import { Schema, model, models } from "mongoose";

export type NoteColor = "default" | "orange" | "blue" | "green" | "violet" | "danger";

export interface INote {
  _id?: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  color: NoteColor;
  created_at: Date;
  updated_at: Date;
}

const noteSchema = new Schema<INote>(
  {
    title: { type: String, required: true, default: "Sans titre" },
    content: { type: String, default: "" },
    tags: { type: [String], default: [], index: true },
    isPinned: { type: Boolean, default: false, index: true },
    color: {
      type: String,
      enum: ["default", "orange", "blue", "green", "violet", "danger"],
      default: "default",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

noteSchema.index({ updated_at: -1 });
noteSchema.index({ title: "text", content: "text", tags: "text" });

export const Note = models.Note || model<INote>("Note", noteSchema);
