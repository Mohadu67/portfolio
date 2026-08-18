import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { logTelegramEvent } from "@/lib/telegram-log";
import fs from "fs/promises";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");

async function clearTelegramLogs(): Promise<void> {
  const files = await fs.readdir(LOG_DIR).catch(() => [] as string[]);
  for (const f of files) {
    if (f.startsWith("telegram-")) {
      await fs.unlink(path.join(LOG_DIR, f)).catch(() => {});
    }
  }
}

describe("telegram-log", () => {
  beforeEach(async () => {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await clearTelegramLogs();
  });
  afterEach(async () => {
    await clearTelegramLogs();
  });

  it("écrit un événement JSON sans secrets", async () => {
    logTelegramEvent(
      "webhook_message",
      { text: "hello", token: "super-secret", api_key: "abc" },
      "123"
    );
    // Laisser le temps à l'écriture asynchrone de se faire.
    await new Promise((r) => setTimeout(r, 150));
    const date = new Date().toISOString().slice(0, 10);
    const file = path.join(LOG_DIR, `telegram-${date}.log`);
    const content = await fs.readFile(file, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.event).toBe("webhook_message");
    expect(entry.chatId).toBe("123");
    expect(entry.payload.text).toBe("hello");
    expect(entry.payload.token).toBe("[redacted]");
    expect(entry.payload.api_key).toBe("[redacted]");
  });

  it("tronque les longues chaînes", async () => {
    const longText = "a".repeat(2000);
    logTelegramEvent("agent_reply_sent", { reply: longText }, "123");
    await new Promise((r) => setTimeout(r, 150));
    const date = new Date().toISOString().slice(0, 10);
    const file = path.join(LOG_DIR, `telegram-${date}.log`);
    const content = await fs.readFile(file, "utf-8");
    const entry = JSON.parse(content.trim().split("\n").filter(Boolean)[0]);
    expect(entry.payload.reply).toContain("…");
    expect((entry.payload.reply as string).length).toBeLessThan(900);
  });
});
