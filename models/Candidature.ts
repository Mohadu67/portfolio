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

export type LetterModel = "gemini" | "grok" | "claude" | "manual";

export type CandidatureSource = "manual" | "auto-apply" | "scraper";

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
  bodyText?: string;
  messageId?: string;
  references?: string;
  uid?: number;
  archived: boolean;
}

export type AutoReplyCategory =
  | "refus"
  | "entretien"
  | "demande_infos"
  | "smalltalk"
  | "autre"
  | "uncategorized";

// Validation humaine via Telegram : "auto" = envoi direct sans validation (mode historique),
// "pending" = message Telegram envoyé, en attente de décision, "approved"/"rejected" = décision prise.
export type AutoReplyApprovalStatus = "auto" | "pending" | "approved" | "rejected";

export interface IAutoReply {
  date: Date;
  inboundMessageId?: string;
  category: AutoReplyCategory;
  confidence: number;
  reply: string;
  sent: boolean;
  sentMessageId?: string;
  error?: string | null;
  model: string;
  dryRun?: boolean;
  approvalStatus?: AutoReplyApprovalStatus;
  // Token opaque porté par les boutons Telegram (callback_data) pour retrouver cette entrée.
  approvalToken?: string | null;
  telegramMessageId?: number | null;
  approvalDecidedAt?: Date | null;
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
  // Consignes libres pour orienter la prochaine génération IA (ex: « mentionne mon expérience React »,
  // « ne parle pas du fast-food »). Vide = comportement par défaut.
  letterInstruction: string;
  cv: string | null;
  notes: string;
  relance: IRelance | null;
  letters: ILetterVersion[];
  emailsSent: IEmailLog[];
  emailsReceived: IEmailReceived[];
  autoReplies: IAutoReply[];
  relanceHistory: IRelanceLog[];
  source: CandidatureSource;
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
    model: { type: String, enum: ["gemini", "grok", "claude", "manual"], default: "gemini" },
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
    bodyText: { type: String, default: "" },
    messageId: { type: String },
    references: { type: String },
    uid: { type: Number },
    archived: { type: Boolean, default: false },
  },
  { _id: false }
);

const autoReplySchema = new Schema<IAutoReply>(
  {
    date: { type: Date, default: () => new Date() },
    inboundMessageId: { type: String },
    category: {
      type: String,
      enum: ["refus", "entretien", "demande_infos", "smalltalk", "autre", "uncategorized"],
      default: "uncategorized",
    },
    confidence: { type: Number, default: 0 },
    reply: { type: String, required: true },
    sent: { type: Boolean, default: false },
    sentMessageId: { type: String },
    error: { type: String, default: null },
    model: { type: String, required: true },
    dryRun: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ["auto", "pending", "approved", "rejected"], default: "auto" },
    approvalToken: { type: String, default: null },
    telegramMessageId: { type: Number, default: null },
    approvalDecidedAt: { type: Date, default: null },
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
      // Aligné sur le pivot alternance (cf. settings defaultCandidatureType et POST /api/candidatures).
      default: "alternance",
    },
    lettre: { type: String, default: null },
    letterInstruction: { type: String, default: "" },
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
    autoReplies: { type: [autoReplySchema], default: [] },
    relanceHistory: { type: [relanceLogSchema], default: [] },
    source: { type: String, enum: ["manual", "auto-apply", "scraper"], default: "manual", index: true },
    date: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

candidatureSchema.index({ statut: 1, created_at: -1 });
candidatureSchema.index({ entreprise: 1 });
candidatureSchema.index({ email: 1 });
candidatureSchema.index({ "relanceHistory.scheduledFor": 1, "relanceHistory.status": 1 });
candidatureSchema.index({ "emailsReceived.messageId": 1 });
candidatureSchema.index({ "autoReplies.approvalToken": 1 });

export const Candidature = models.Candidature || model<ICandidature>("Candidature", candidatureSchema);
