import { Schema, model, models } from "mongoose";

export type CandidatureStatut =
  | "identifiée"
  | "lettre générée"
  | "postulée"
  | "réponse reçue"
  | "entretien"
  | "refus"
  | "acceptée";

export type CandidatureType = "stage" | "alternance" | "cdi";

export type RelanceStatus = "programmée" | "envoyée" | "annulée";

export interface IRelance {
  date: string; // YYYY-MM-DD
  template: "initial" | "second" | "final";
  message: string;
  status: RelanceStatus;
}

export interface ICandidature {
  _id?: string;
  entreprise: string;
  poste: string;
  plateforme: "JSearch" | "Adzuna" | "France Travail" | "Indeed" | "Web" | "Autre";
  localisation: string;
  url: string;
  description: string;
  email: string;
  aboutText?: string;
  statut: CandidatureStatut;
  type: CandidatureType;
  lettre: string | null;
  cv: string | null;
  notes: string;
  relance: IRelance | null;
  date: string;
  created_at: Date;
  updated_at: Date;
}

const candidatureSchema = new Schema<ICandidature>(
  {
    entreprise: { type: String, required: true },
    poste: { type: String, required: true },
    plateforme: { type: String, enum: ["JSearch", "Adzuna", "France Travail", "Indeed", "Web", "Autre"], required: true },
    localisation: { type: String, default: "" },
    url: { type: String, required: true, unique: true },
    description: { type: String, maxlength: 500 },
    email: { type: String },
    aboutText: { type: String, default: "" },
    statut: {
      type: String,
      enum: ["identifiée", "lettre générée", "postulée", "réponse reçue", "entretien", "refus", "acceptée"],
      default: "identifiée",
    },
    type: {
      type: String,
      enum: ["stage", "alternance", "cdi"],
      default: "stage",
    },
    lettre: { type: String, default: null },
    cv: { type: String, default: null },
    notes: { type: String, default: "" },
    relance: {
      type: {
        date: { type: String, required: true },
        template: { type: String, enum: ["initial", "second", "final"], required: true },
        message: { type: String, required: true },
        status: { type: String, enum: ["programmée", "envoyée", "annulée"], default: "programmée" },
      },
      default: null,
    },
    date: { type: String }, // YYYY-MM-DD
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Candidature = models.Candidature || model<ICandidature>("Candidature", candidatureSchema);
