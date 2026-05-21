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
    lastSyncAt?: Date | null;
    lastSyncSummary?: string | null;
  };
  automation: {
    autoRelanceJ7Enabled: boolean;
    autoRelanceDays: number;
    autoApplyEnabled: boolean;
    autoApplyMaxPerDay: number;
    autoApplyMinCompanyScore: number;
    weeklyProspectKeywords: string;
    weeklyProspectLocation: string;
    lastProspectRunAt?: Date | null;
    lastProspectSummary?: string | null;
  };
  search: {
    defaultLocation: string;
    defaultKeywords: string;
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
      lastSyncAt: { type: Date, default: null },
      lastSyncSummary: { type: String, default: null },
    },
    automation: {
      autoRelanceJ7Enabled: { type: Boolean, default: true },
      autoRelanceDays: { type: Number, default: 7 },
      autoApplyEnabled: { type: Boolean, default: false },
      autoApplyMaxPerDay: { type: Number, default: 5 },
      autoApplyMinCompanyScore: { type: Number, default: 0.6 },
      weeklyProspectKeywords: { type: String, default: "entreprise tech Strasbourg" },
      weeklyProspectLocation: { type: String, default: "Strasbourg" },
      lastProspectRunAt: { type: Date, default: null },
      lastProspectSummary: { type: String, default: null },
    },
    search: {
      defaultLocation: { type: String, default: "" },
      defaultKeywords: { type: String, default: "" },
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
