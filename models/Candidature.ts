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

export type RelanceStatus = "programmée" | "envoyée" | "annulée" | "échouée";

export type EmailLogType = "candidature" | "relance";

export type EmailLogStatus = "sent" | "failed";

export type LetterModel = "grok" | "claude" | "manual";

export interface IRelance {
  date: string;
  template: "initial" | "second" | "final";
  message: string;
  status: RelanceStatus;
}

export interface IRelanceLog {
  scheduledFor: Date;
  template: "initial" | "second" | "final" | "custom";
  templateTitle?: string;
  message: string;
  status: RelanceStatus;
  sentAt?: Date | null;
  error?: string | null;
  created_at?: Date;
}

export interface ILetterVersion {
  version: number;
  model: LetterModel;
  content: string;
  generatedAt: Date;
  type?: CandidatureType;
}

export interface IEmailLog {
  date: Date;
  to: string;
  subject: string;
  type: EmailLogType;
  status: EmailLogStatus;
  error?: string | null;
}

export interface IEmailReceived {
  date: Date;
  from: string;
  fromName?: string;
  subject: string;
  snippet: string;
  messageId?: string;
  uid?: number;
  archived: boolean;
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
  letters: ILetterVersion[];
  emailsSent: IEmailLog[];
  emailsReceived: IEmailReceived[];
  relanceHistory: IRelanceLog[];
  date: string;
  created_at: Date;
  updated_at: Date;
}

const relanceLogSchema = new Schema<IRelanceLog>(
  {
    scheduledFor: { type: Date, required: true },
    template: { type: String, enum: ["initial", "second", "final", "custom"], default: "initial" },
    templateTitle: { type: String },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["programmée", "envoyée", "annulée", "échouée"],
      default: "programmée",
      index: true,
    },
    sentAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

const letterVersionSchema = new Schema<ILetterVersion>(
  {
    version: { type: Number, required: true },
    model: { type: String, enum: ["grok", "claude", "manual"], default: "grok" },
    content: { type: String, required: true },
    generatedAt: { type: Date, default: () => new Date() },
    type: { type: String, enum: ["stage", "alternance", "cdi"] },
  },
  { _id: false }
);

const emailLogSchema = new Schema<IEmailLog>(
  {
    date: { type: Date, default: () => new Date() },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    type: { type: String, enum: ["candidature", "relance"], required: true },
    status: { type: String, enum: ["sent", "failed"], required: true },
    error: { type: String, default: null },
  },
  { _id: false }
);

const emailReceivedSchema = new Schema<IEmailReceived>(
  {
    date: { type: Date, required: true },
    from: { type: String, required: true },
    fromName: { type: String },
    subject: { type: String, required: true },
    snippet: { type: String, default: "" },
    messageId: { type: String },
    uid: { type: Number },
    archived: { type: Boolean, default: false },
  },
  { _id: false }
);

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
        status: { type: String, enum: ["programmée", "envoyée", "annulée", "échouée"], default: "programmée" },
      },
      default: null,
    },
    letters: { type: [letterVersionSchema], default: [] },
    emailsSent: { type: [emailLogSchema], default: [] },
    emailsReceived: { type: [emailReceivedSchema], default: [] },
    relanceHistory: { type: [relanceLogSchema], default: [] },
    date: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

candidatureSchema.index({ statut: 1, created_at: -1 });
candidatureSchema.index({ entreprise: 1 });
candidatureSchema.index({ email: 1 });
candidatureSchema.index({ "relanceHistory.scheduledFor": 1, "relanceHistory.status": 1 });
candidatureSchema.index({ "emailsReceived.messageId": 1 });

export const Candidature = models.Candidature || model<ICandidature>("Candidature", candidatureSchema);
