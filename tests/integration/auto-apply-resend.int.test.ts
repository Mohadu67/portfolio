// Test d'intégration : resend d'une candidature déjà postulée vers un autre email
// via email_override. MongoDB en mémoire + mocks Gemini/scraping/email offline.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer;
let processSingleCompany: typeof import("@/lib/auto-apply").processSingleCompany;
let Candidature: typeof import("@/models/Candidature").Candidature;

vi.mock("@/lib/gemini", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/gemini")>();
  return {
    ...original,
    generateLetterProposal: vi.fn(
      async (_entreprise: string, _aboutText: string, _poste: string | undefined, _type: string, userInstruction?: string) => {
        return `Lettre générée${userInstruction ? ` — ${userInstruction.slice(0, 100)}` : ""}`;
      }
    ),
    generateEmailBody: vi.fn(async () => "Corps de mail de test."),
    scoreCompanyFit: vi.fn(async () => ({ score: 0.8, reason: "match" })),
  };
});

vi.mock("@/lib/web-scraper", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/web-scraper")>();
  return {
    ...original,
    scrapeCompanyWebsite: vi.fn(async () => ({
      companyName: "Wolf Lingerie",
      aboutText: "Marque de lingerie.",
      description: "Description.",
      emails: ["contact@wolflingerie.fr", "00contact@wolflingerie.frsuivez"],
    })),
  };
});

vi.mock("@/lib/email", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...original,
    sendCandidature: vi.fn(async () => undefined),
  };
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri("stage_agent_test");
  ({ processSingleCompany } = await import("@/lib/auto-apply"));
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

describe("processSingleCompany — resend avec email_override", () => {
  it("renvoie vers un nouvel email quand la candidature est déjà postulée", async () => {
    const url = "https://www.wolflingerie.com/";
    const first = await processSingleCompany(url, {
      dryRun: false,
      allowGenericEmail: true,
      candidatureType: "alternance",
    });
    expect(first.decision).toBe("applied");
    expect(first.email?.email).toBe("contact@wolflingerie.fr");

    const doc = await Candidature.findOne({ url });
    expect(doc).not.toBeNull();
    expect(doc!.statut).toBe("postulée");
    expect(doc!.emailsSent).toHaveLength(1);

    const second = await processSingleCompany(url, {
      dryRun: false,
      emailOverride: "contact@wolflingerie.fr",
      candidatureType: "alternance",
    });
    expect(second.decision).toBe("applied");
    expect(second.email?.email).toBe("contact@wolflingerie.fr");

    const updated = await Candidature.findOne({ url });
    expect(updated!.statut).toBe("postulée");
    expect(updated!.emailsSent).toHaveLength(2);
  });

  it("refuse le renvoi sans email_override quand la candidature est déjà postulée", async () => {
    const url = "https://www.wolflingerie.com/";
    await processSingleCompany(url, { dryRun: false, allowGenericEmail: true, candidatureType: "alternance" });

    const second = await processSingleCompany(url, { dryRun: false, candidatureType: "alternance" });
    expect(second.decision).toBe("skipped");
    expect(second.skipReason).toContain("déjà contactée");
  });
});
