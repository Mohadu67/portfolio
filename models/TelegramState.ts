import { Schema, model, models } from "mongoose";

// État du bot Telegram (mono-utilisateur → document singleton par chat).
// - conversation : mémoire glissante des échanges texte (user/model) pour la continuité.
// - pendingActions : tools d'action proposés par l'IA, en attente d'un tap ✅/❌.
// - processedUpdateIds : dédup des updates Telegram (relivraisons webhook).

export type TelegramActionStatus = "pending" | "confirmed" | "cancelled";

export interface ITelegramPendingAction {
  token: string;
  tool: string;
  input: Record<string, unknown>;
  label: string;
  status: TelegramActionStatus;
  createdAt: Date;
  decidedAt?: Date | null;
}

export interface ITelegramMessage {
  role: "user" | "model";
  text: string;
  at: Date;
}

// Rappel one-shot programmé par l'agent (« rappelle-moi de préparer l'entretien lundi »).
// Livré par le cron telegram-pulse (toutes les 30 min).
export interface ITelegramReminder {
  message: string;
  dueAt: Date;
  sent: boolean;
  createdAt: Date;
}

export interface ITelegramState {
  _id?: string;
  chatId: string;
  conversation: ITelegramMessage[];
  pendingActions: ITelegramPendingAction[];
  processedUpdateIds: number[];
  reminders: ITelegramReminder[];
  // Date (YYYY-MM-DD, Europe/Paris) du dernier briefing quotidien envoyé — dédup du cron.
  lastBriefingDate?: string | null;
  created_at: Date;
  updated_at: Date;
}

const pendingActionSchema = new Schema<ITelegramPendingAction>(
  {
    token: { type: String, required: true },
    tool: { type: String, required: true },
    input: { type: Schema.Types.Mixed, default: {} },
    label: { type: String, default: "" },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
    createdAt: { type: Date, default: () => new Date() },
    decidedAt: { type: Date, default: null },
  },
  { _id: false }
);

const messageSchema = new Schema<ITelegramMessage>(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    text: { type: String, required: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const reminderSchema = new Schema<ITelegramReminder>(
  {
    message: { type: String, required: true },
    dueAt: { type: Date, required: true },
    sent: { type: Boolean, default: false },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const telegramStateSchema = new Schema<ITelegramState>(
  {
    chatId: { type: String, required: true, unique: true },
    conversation: { type: [messageSchema], default: [] },
    pendingActions: { type: [pendingActionSchema], default: [] },
    processedUpdateIds: { type: [Number], default: [] },
    reminders: { type: [reminderSchema], default: [] },
    lastBriefingDate: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

telegramStateSchema.index({ "pendingActions.token": 1 });

export const TelegramState =
  models.TelegramState || model<ITelegramState>("TelegramState", telegramStateSchema);

export async function getTelegramState(chatId: string) {
  let s = await TelegramState.findOne({ chatId });
  if (!s) s = await TelegramState.create({ chatId });
  return s;
}
