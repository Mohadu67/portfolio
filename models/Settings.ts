import { Schema, model, models } from "mongoose";

export interface ISettings {
  _id?: string;
  notifications: {
    onCandidatureSent: boolean;
    onRelanceSent: boolean;
    onInboxResponse: boolean;
  };
  gmail: {
    inboxSyncEnabled: boolean;
    autoArchiveResponses: boolean;
    autoReplyEnabled: boolean;
    autoReplyMinConfidence: number;
    // Validation humaine avant envoi : chaque réponse préparée par l'IA part sur Telegram
    // (boutons ✅/❌) au lieu d'être envoyée directement. Ne s'active que si TELEGRAM_BOT_TOKEN
    // + TELEGRAM_CHAT_ID sont configurés — sinon fallback envoi direct.
    telegramApprovalEnabled: boolean;
    lastSyncAt?: Date | null;
    lastSyncSummary?: string | null;
  };
  automation: {
    autoRelanceJ7Enabled: boolean;
    autoRelanceDays: number;
    autoApplyEnabled: boolean;
    autoApplyMaxPerDay: number;
    autoApplyMinCompanyScore: number;
    // Multi-query : une query par ligne. Le pipeline rotate avec weeklyProspectQueryIndex.
    weeklyProspectKeywords: string;
    weeklyProspectLocation: string;
    weeklyProspectQueryIndex: number;
    lastProspectRunAt?: Date | null;
    lastProspectSummary?: string | null;
    // Consignes par défaut injectées dans le prompt de génération de lettre quand l'auto-apply tourne.
    // Une instruction au niveau d'une candidature override ce défaut. Vide = comportement actuel.
    defaultLetterInstruction: string;
    // F2 — recherche d'offres + auto-apply : cron lundi 9h05 sur SavedQueries.
    enableOfferSearch: boolean;
    // F3 — process pending (candidatures "identifiée") : cron quotidien + bouton dashboard + chat.
    enablePendingProcess: boolean;
    // Si true, re-score Gemini sur F2/F3 (sinon on fait confiance au filtre amont).
    strictQualityScore: boolean;
    // Fallback contact@/hello@ quand pickBestContactEmail strict refuse.
    allowGenericEmails: boolean;
    // Type de candidature utilisé par défaut pour F2/F3 quand l'offre n'en porte pas.
    defaultCandidatureType: "stage" | "alternance" | "cdi";
    lastOfferSearchRunAt?: Date | null;
    lastOfferSearchSummary?: string | null;
    lastPendingProcessRunAt?: Date | null;
    lastPendingProcessSummary?: string | null;
  };
  search: {
    defaultLocation: string;
    defaultKeywords: string;
  };
  letterTemplate: {
    stage: string;
    alternance: string;
    cdi: string;
  };
  profile: {
    // Texte libre multi-lignes injecté dans le prompt auto-reply quand un RH demande un créneau.
    // L'IA reprend cette phrase EXACTEMENT. Le lien Calendly est lu auto depuis la CVSection "contact".
    availability: string;
  };
  created_at: Date;
  updated_at: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    notifications: {
      onCandidatureSent: { type: Boolean, default: true },
      onRelanceSent: { type: Boolean, default: true },
      onInboxResponse: { type: Boolean, default: true },
    },
    gmail: {
      inboxSyncEnabled: { type: Boolean, default: false },
      autoArchiveResponses: { type: Boolean, default: false },
      autoReplyEnabled: { type: Boolean, default: false },
      autoReplyMinConfidence: { type: Number, default: 0.7 },
      telegramApprovalEnabled: { type: Boolean, default: true },
      lastSyncAt: { type: Date, default: null },
      lastSyncSummary: { type: String, default: null },
    },
    automation: {
      autoRelanceJ7Enabled: { type: Boolean, default: true },
      autoRelanceDays: { type: Number, default: 7 },
      autoApplyEnabled: { type: Boolean, default: false },
      // Cap Gmail warmup : 15/jour pour comptes neufs SMTP sans pénalité de spam.
      // Mohammed peut monter à 30 quand sa réputation domain est établie (~1 mois).
      autoApplyMaxPerDay: { type: Number, default: 15 },
      autoApplyMinCompanyScore: { type: Number, default: 0.6 },
      weeklyProspectKeywords: {
        type: String,
        // Multi-query par défaut (1 ligne = 1 query). Le pipeline rotate à chaque run.
        // Mix volontaire tech pur + adjacents (assoc digital, PME e-commerce, industrie 4.0...)
        // pour couvrir toutes les structures susceptibles d'avoir besoin d'un dev junior.
        default: [
          "startup tech Strasbourg",
          "ESN Strasbourg",
          "agence web Strasbourg",
          "scale-up Alsace",
          "PME e-commerce Strasbourg",
          "industrie 4.0 Alsace",
          "association numérique Strasbourg",
          "plateforme SaaS Alsace",
          "cabinet conseil digital Strasbourg",
          "organisme formation digital Alsace",
        ].join("\n"),
      },
      weeklyProspectLocation: { type: String, default: "Strasbourg" },
      weeklyProspectQueryIndex: { type: Number, default: 0 },
      lastProspectRunAt: { type: Date, default: null },
      lastProspectSummary: { type: String, default: null },
      defaultLetterInstruction: { type: String, default: "" },
      enableOfferSearch: { type: Boolean, default: false },
      enablePendingProcess: { type: Boolean, default: false },
      strictQualityScore: { type: Boolean, default: true },
      allowGenericEmails: { type: Boolean, default: false },
      defaultCandidatureType: {
        type: String,
        enum: ["stage", "alternance", "cdi"],
        default: "alternance",
      },
      lastOfferSearchRunAt: { type: Date, default: null },
      lastOfferSearchSummary: { type: String, default: null },
      lastPendingProcessRunAt: { type: Date, default: null },
      lastPendingProcessSummary: { type: String, default: null },
    },
    search: {
      defaultLocation: { type: String, default: "" },
      defaultKeywords: { type: String, default: "" },
    },
    letterTemplate: {
      stage: { type: String, default: "" },
      alternance: { type: String, default: "" },
      cdi: { type: String, default: "" },
    },
    profile: {
      availability: {
        type: String,
        default: "Mardi 11h-13h, jeudi 14h-17h.\nFlexible le soir après 18h si besoin.\nFormat préféré : visio (Meet/Zoom).",
      },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Settings = models.Settings || model<ISettings>("Settings", settingsSchema);

const SETTINGS_SINGLETON_ID = "settings-singleton";

export async function getSettings(): Promise<ISettings> {
  let s = await Settings.findOne({});
  if (!s) {
    s = await Settings.create({});
  }
  return s.toObject ? s.toObject() : s;
}

export async function getSettingsDoc() {
  let s = await Settings.findOne({});
  if (!s) {
    s = await Settings.create({});
  }
  return s;
}
