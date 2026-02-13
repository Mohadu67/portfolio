import { Schema, model, models } from "mongoose";

export type CandidatureStatut =
  | "identifiée"
  | "lettre générée"
  | "postulée"
  | "réponse reçue"
  | "entretien"
  | "refus"
  | "acceptée";

export interface ICandidature {
  _id?: string;
  entreprise: string;
  poste: string;
  plateforme: "JSearch" | "Adzuna" | "France Travail" | "Autre";
  localisation: string;
  url: string;
  description: string;
  email: string;
  statut: CandidatureStatut;
  lettre: string | null;
  cv: string | null;
  notes: string;
  date: string;
  created_at: Date;
  updated_at: Date;
}

const candidatureSchema = new Schema<ICandidature>(
  {
    entreprise: { type: String, required: true },
    poste: { type: String, required: true },
    plateforme: { type: String, enum: ["JSearch", "Adzuna", "France Travail", "Autre"], required: true },
    localisation: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    description: { type: String, maxlength: 500 },
    email: { type: String },
    statut: {
      type: String,
      enum: ["identifiée", "lettre générée", "postulée", "réponse reçue", "entretien", "refus", "acceptée"],
      default: "identifiée",
    },
    lettre: { type: String, default: null },
    cv: { type: String, default: null },
    notes: { type: String, default: "" },
    date: { type: String }, // YYYY-MM-DD
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Candidature = models.Candidature || model<ICandidature>("Candidature", candidatureSchema);
