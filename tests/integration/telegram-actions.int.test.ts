// Tests d'intégration du flux de confirmation Telegram (✅/❌) : claim atomique,
// double-tap, et sémantique du ❌ selon l'origine (offre de job board conservée en
// « refus » vs cible de prospection supprimée + blacklistée). MongoDB en mémoire,
// aucun appel réseau (confirmTelegramAction ne parle pas à l'API Telegram).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer;
let confirmTelegramAction: typeof import("@/lib/telegram-agent").confirmTelegramAction;
let Candidature: typeof import("@/models/Candidature").Candidature;
let TelegramState: typeof import("@/models/TelegramState").TelegramState;
let ProspectedDomain: typeof import("@/models/ProspectedDomain").ProspectedDomain;

const CHAT_ID = "424242";

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri("stage_agent_test");
  process.env.TELEGRAM_CHAT_ID = CHAT_ID;
  ({ confirmTelegramAction } = await import("@/lib/telegram-agent"));
  ({ Candidature } = await import("@/models/Candidature"));
  ({ TelegramState } = await import("@/models/TelegramState"));
  ({ ProspectedDomain } = await import("@/models/ProspectedDomain"));
  // Connexion explicite : les seeds utilisent les modèles AVANT le premier appel métier
  // (qui est celui qui déclenche connectDB) — sans ça ils bufferisent dans le vide.
  await (await import("@/lib/mongodb")).connectDB();
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db!.collections();
    for (const c of collections) await c.deleteMany({});
  }
});

async function seedCandidature(over: Record<string, unknown> = {}) {
  return Candidature.create({
    entreprise: "Acme",
    poste: "Dev",
    plateforme: "Web",
    localisation: "",
    url: `https://acme-${Math.random().toString(36).slice(2, 8)}.fr`,
    description: "",
    email: "rh@acme.fr",
    statut: "identifiée",
    type: "alternance",
    lettre: null,
    source: "manual",
    date: "2026-07-06",
    ...over,
  });
}

async function seedAction(action: Record<string, unknown>) {
  await TelegramState.create({
    chatId: CHAT_ID,
    conversation: [],
    pendingActions: [
      {
        token: "tok123",
        tool: "update_candidature_notes",
        input: {},
        label: "Test action",
        status: "pending",
        origin: "agent",
        candidatureId: null,
        domain: null,
        createdAt: new Date(),
        decidedAt: null,
        ...action,
      },
    ],
  });
}

describe("confirmTelegramAction — ✅", () => {
  it("exécute le tool, retourne l'origine, journalise en conversation", async () => {
    const cand = await seedCandidature();
    await seedAction({
      tool: "update_candidature_notes",
      input: { candidature_id: String(cand._id), notes: "vu avec le patron" },
    });
    const res = await confirmTelegramAction("tok123", true);
    expect(res.outcome).toBe("executed");
    expect(res.origin).toBe("agent");
    const after = await Candidature.findById(cand._id).lean<{ notes: string }>();
    expect(after!.notes).toBe("vu avec le patron");
    const state = await TelegramState.findOne({ chatId: CHAT_ID }).lean<{ conversation: Array<{ text: string }> }>();
    expect(state!.conversation.some((m) => m.text.includes("Action exécutée"))).toBe(true);
  });

  it("double-tap CONCURRENT → un seul exécute, l'autre already_done (claim atomique)", async () => {
    const cand = await seedCandidature();
    await seedAction({ input: { candidature_id: String(cand._id), notes: "x" } });
    const [a, b] = await Promise.all([
      confirmTelegramAction("tok123", true),
      confirmTelegramAction("tok123", true),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(["already_done", "executed"]);
  });

  it("échec du tool → outcome failed, et l'action repasse en pending (retry possible)", async () => {
    await seedAction({ tool: "update_candidature_notes", input: { candidature_id: "000000000000000000000000", notes: "x" } });
    const res = await confirmTelegramAction("tok123", true);
    expect(res.outcome).toBe("failed");
    expect(res.resultText).toContain("réessayer");
    const state = await TelegramState.findOne({ chatId: CHAT_ID }).lean<{ pendingActions: Array<{ status: string }> }>();
    expect(state!.pendingActions[0].status).toBe("pending");
  });
});

describe("confirmTelegramAction — ❌", () => {
  it("origine agent : simple annulation, rien n'est détruit", async () => {
    const cand = await seedCandidature();
    await seedAction({ input: { candidature_id: String(cand._id), notes: "x" } });
    const res = await confirmTelegramAction("tok123", false);
    expect(res.outcome).toBe("cancelled");
    expect(await Candidature.findById(cand._id)).not.toBeNull();
  });

  it("prospection + offre de job board (source scraper) : conservée en « refus », pas de blacklist", async () => {
    const cand = await seedCandidature({ source: "scraper", url: "https://fr.indeed.com/job/abc123" });
    await seedAction({ origin: "prospection", candidatureId: String(cand._id), domain: null });
    const res = await confirmTelegramAction("tok123", false);
    expect(res.outcome).toBe("cancelled");
    const after = await Candidature.findById(cand._id).lean<{ statut: string }>();
    expect(after).not.toBeNull();
    expect(after!.statut).toBe("refus");
    expect(await ProspectedDomain.countDocuments()).toBe(0);
  });

  it("prospection entreprise : supprimée + domaine blacklisté (user_ignored)", async () => {
    const cand = await seedCandidature({ source: "auto-apply", url: "https://acme-cible.fr", entreprise: "Acme Cible" });
    await seedAction({ origin: "prospection", candidatureId: String(cand._id), domain: "acme-cible.fr" });
    const res = await confirmTelegramAction("tok123", false);
    expect(res.outcome).toBe("cancelled");
    expect(await Candidature.findById(cand._id)).toBeNull();
    const bl = await ProspectedDomain.findOne({ domain: "acme-cible.fr" }).lean<{ skipReason: string }>();
    expect(bl?.skipReason).toBe("user_ignored");
  });

  it("prospection dont la candidature a évolué entre-temps : conservée", async () => {
    const cand = await seedCandidature({ source: "auto-apply", statut: "postulée" });
    await seedAction({ origin: "prospection", candidatureId: String(cand._id), domain: "acme.fr" });
    const res = await confirmTelegramAction("tok123", false);
    expect(res.outcome).toBe("cancelled");
    expect(res.resultText).toContain("évolué");
    expect(await Candidature.findById(cand._id)).not.toBeNull();
  });
});
