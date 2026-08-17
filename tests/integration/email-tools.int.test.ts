// Tests d'intégration des nouveaux tools email (parse_email, apply_from_email, draft_email_reply).
// MongoDB en mémoire + mocks des appels Gemini/scraping pour rester offline.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer;
let executeTool: typeof import("@/lib/ai/tool-runner").executeTool;
let Candidature: typeof import("@/models/Candidature").Candidature;

// Mocks définis avant les imports dynamiques
vi.mock("@/lib/gemini", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/gemini")>();
  return {
    ...original,
    parseEmailWithAI: vi.fn(async (rawText: string, userInstruction?: string) => {
      const text = (rawText + " " + (userInstruction ?? "")).toLowerCase();
      return {
        type: text.includes("reponse") || text.includes("réponse") ? "reponse_recruteur" : "offre",
        entreprise: text.match(/entreprise\s*:\s*([^\n]+)/)?.[1]?.trim() || "TestCorp",
        poste: text.match(/poste\s*:\s*([^\n]+)/)?.[1]?.trim() || "Développeur fullstack",
        email: text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/)?.[1]?.trim() || "",
        url: text.match(/(https?:\/\/[^\s]+)/)?.[1]?.trim() || "",
        localisation: "Strasbourg",
        snippet: rawText.slice(0, 200),
        instructions: userInstruction || "",
        context_urls: [],
        confidence: 0.9,
        suggested_action: "Préparer une candidature",
      };
    }),
    draftReplyWithInstruction: vi.fn(async () => ({
      reply: "Bonjour,\n\nMerci pour votre retour. Mohammed reviendra vers vous rapidement.\n\nÀ bientôt,",
      confidence: 0.95,
    })),
    generateLetterProposal: vi.fn(async () => "Lettre générée pour le test."),
  };
});

vi.mock("@/lib/web-scraper", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/web-scraper")>();
  return {
    ...original,
    scrapeCompanyWebsite: vi.fn(async () => ({
      companyName: "TestCorp",
      aboutText: "TestCorp est une entreprise tech.",
      description: "Description test.",
      emails: ["rh@testcorp.com"],
    })),
  };
});

vi.mock("@/lib/email", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...original,
    replyInThread: vi.fn(async () => ({ messageId: "reply-123" })),
    sendCandidature: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/auto-apply", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auto-apply")>();
  return {
    ...original,
    dispatchCandidature: vi.fn(async (candDoc: unknown) => {
      const c = candDoc as { statut: string; emailsSent: unknown[]; save: () => Promise<void> };
      c.statut = "postulée";
      c.emailsSent = [...(c.emailsSent ?? []), { date: new Date(), to: "recruteur@testcorp.com", subject: "Candidature - test", type: "candidature", status: "sent", error: null }];
      await c.save();
      return { ok: true };
    }),
  };
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri("stage_agent_test");
  process.env.TELEGRAM_CHAT_ID = "424242";
  ({ executeTool } = await import("@/lib/ai/tool-runner"));
  ({ Candidature } = await import("@/models/Candidature"));
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

function parse(summary: string | undefined): Record<string, unknown> {
  return JSON.parse(summary ?? "{}");
}

describe("parse_email", () => {
  it("extrait les métadonnées d'un message", async () => {
    const r = await executeTool("parse_email", {
      raw_text: "De : recruteur@testcorp.com\nSujet : Offre développeur\n\nNous recherchons un développeur fullstack.",
      user_instruction: "postule en insistant sur React",
    });
    expect(r.body.error).toBeUndefined();
    const data = parse(r.body.summary);
    expect(data.entreprise).toBe("TestCorp");
    expect(data.poste).toBe("Développeur fullstack");
    expect(data.type).toBe("offre");
  });
});

describe("apply_from_email", () => {
  it("crée une candidature manuelle et génère un aperçu (dry_run)", async () => {
    const r = await executeTool("apply_from_email", {
      email_content: "postule chez TestCorp à recruteur@testcorp.com",
      email_override: "recruteur@testcorp.com",
      letter_instruction: "insiste sur React",
      dry_run: true,
    });
    expect(r.body.error).toBeUndefined();
    const data = parse(r.body.summary);
    expect(data.dryRun).toBe(true);
    expect(data.email).toBe("recruteur@testcorp.com");
    expect(data.lettre).toBe("Lettre générée pour le test.");

    const docs = await Candidature.find({}).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].statut).toBe("lettre générée");
    expect(docs[0].email).toBe("recruteur@testcorp.com");
  });

  it("envoie la candidature manuelle quand dry_run=false", async () => {
    const create = await executeTool("apply_from_email", {
      email_content: "postule chez TestCorp à recruteur@testcorp.com",
      email_override: "recruteur@testcorp.com",
      dry_run: true,
    });
    const created = parse(create.body.summary);

    const r = await executeTool("apply_from_email", {
      email_content: "postule chez TestCorp à recruteur@testcorp.com",
      email_override: "recruteur@testcorp.com",
      candidature_id: created.candidatureId,
      dry_run: false,
    });
    expect(r.body.error).toBeUndefined();
    expect(r.body.summary).toContain("envoyée");

    const doc = await Candidature.findById(created.candidatureId).lean<{ statut: string; emailsSent: unknown[] }>();
    expect(doc!.statut).toBe("postulée");
    expect(doc!.emailsSent).toHaveLength(1);
  });

  it("par défaut dry_run=true même si dry_run n'est pas précisé", async () => {
    const r = await executeTool("apply_from_email", {
      email_content: "postule chez TestCorp",
      email_override: "recruteur@testcorp.com",
    });
    const data = parse(r.body.summary);
    expect(data.dryRun).toBe(true);
  });

  it("refuse un email invalide", async () => {
    const r = await executeTool("apply_from_email", {
      email_content: "postule chez TestCorp",
      email_override: "pas-un-email",
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("Email");
  });

  it("ne prend pas l'email extrait par l'IA comme destinataire sans email_override explicite", async () => {
    const r = await executeTool("apply_from_email", {
      email_content: "postule chez TestCorp à recruteur@testcorp.com",
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("Ni URL entreprise ni email");
  });
});

describe("draft_email_reply", () => {
  it("retourne un brouillon de réponse", async () => {
    const r = await executeTool("draft_email_reply", {
      email_content: "Merci pour votre candidature, pouvez-vous nous envoyer vos disponibilités ?",
      reply_instruction: "dis que je suis dispo mardi et jeudi",
    });
    expect(r.body.error).toBeUndefined();
    const data = parse(r.body.summary);
    expect(data.reply).toContain("Mohammed reviendra");
  });

  it("envoie la réponse quand candidature_id et dry_run=false", async () => {
    const doc = await Candidature.create({
      entreprise: "TestCorp",
      poste: "Dev",
      plateforme: "Web",
      localisation: "",
      url: "https://testcorp.fr",
      description: "",
      email: "rh@testcorp.fr",
      statut: "postulée",
      type: "alternance",
      lettre: null,
      source: "manual",
      date: "2026-08-17",
      emailsReceived: [
        {
          date: new Date(),
          from: "rh@testcorp.fr",
          fromName: "RH TestCorp",
          subject: "Suite candidature",
          snippet: "Disponibilités ?",
          bodyText: "Pouvez-vous nous donner vos disponibilités ?",
          messageId: "inbound-123",
          references: "",
          archived: false,
        },
      ],
    });

    const r = await executeTool("draft_email_reply", {
      candidature_id: String(doc._id),
      reply_instruction: "dis que je suis dispo mardi et jeudi",
      dry_run: false,
    });
    expect(r.body.error).toBeUndefined();
    expect(r.body.summary).toContain("Réponse envoyée");
  });
});
