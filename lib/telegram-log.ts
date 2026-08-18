import { appendFile, mkdir } from "fs/promises";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");

export type TelegramLogEvent =
  | "webhook_message"
  | "webhook_callback"
  | "webhook_error"
  | "agent_turn_start"
  | "agent_tool_executed"
  | "agent_action_proposed"
  | "agent_action_confirmed"
  | "agent_action_cancelled"
  | "agent_turn_error"
  | "agent_reply_sent"
  | "agent_silent_turn";

interface TelegramLogEntry {
  t: string;
  event: TelegramLogEvent;
  chatId?: string;
  payload: Record<string, unknown>;
}

const FORBIDDEN_KEYS = ["token", "callback_data", "secret", "password", "api_key", "apikey", "key"];

function sanitizeValue(key: string, value: unknown): unknown {
  if (typeof key === "string" && FORBIDDEN_KEYS.some((f) => key.toLowerCase().includes(f))) {
    return "[redacted]";
  }
  if (typeof value === "string") {
    return value.length > 800 ? `${value.slice(0, 800)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v, i) => sanitizeValue(String(i), v));
  }
  if (value && typeof value === "object") {
    return sanitizePayload(value as Record<string, unknown>);
  }
  return value;
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    out[k] = sanitizeValue(k, v);
  }
  return out;
}

export function logTelegramEvent(
  event: TelegramLogEvent,
  payload: Record<string, unknown> = {},
  chatId?: string
): void {
  const entry: TelegramLogEntry = {
    t: new Date().toISOString(),
    event,
    ...(chatId ? { chatId } : {}),
    payload: sanitizePayload(payload),
  };
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `telegram-${date}.log`);
  mkdir(LOG_DIR, { recursive: true })
    .then(() => appendFile(file, `${JSON.stringify(entry)}\n`))
    .catch(() => {
      /* logger best-effort : ne pas throw dans le webhook */
    });
}
