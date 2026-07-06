// Tests d'intégration des tools de l'agent : executeTool de bout en bout sur un MongoDB
// en mémoire (mongodb-memory-server). Aucun réseau externe — les tools qui scrapent ou
// appellent Gemini (research_company, search_offers, write_letter, apply_to_company…)
// ne sont pas couverts ici.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer;
// Imports dynamiques après mise en place de l'env (MONGO_URI lu à la connexion).
let executeTool: typeof import("@/lib/ai/tool-runner").executeTool;
let Candidature: typeof import("@/models/Candidature").Candidature;
let TelegramState: typeof import("@/models/TelegramState").TelegramState;
let recordProspectSkip: typeof import("@/models/ProspectedDomain").recordProspectSkip;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri("stage_agent_test");
  process.env.TELEGRAM_CHAT_ID = "424242";
  ({ executeTool } = await import("@/lib/ai/tool-runner"));
  ({ Candidature } = await import("@/models/Candidature"));
  ({ TelegramState } = await import("@/models/TelegramState"));
  ({ recordProspectSkip } = await import("@/models/ProspectedDomain"));
  // Connexion explicite : certains tests seedent via les modèles avant tout executeTool.
  await (await import("@/lib/mongodb")).connectDB();
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Vide toutes les collections entre les tests (la connexion est établie au 1er executeTool).
  if (mongoose.connection.readyState === 1) {
    const collections = await mongoose.connection.db!.collections();
    for (const c of collections) await c.deleteMany({});
  }
});

function parse(summary: string | undefined): Record<string, unknown> {
  return JSON.parse(summary ?? "{}");
}

describe("create_candidature", () => {
  it("crée avec les défauts (identifiée, alternance, url manual://)", async () => {
    const r = await executeTool("create_candidature", { entreprise: "Acme Corp" });
    expect(r.body.error).toBeUndefined();
    expect(r.body.summary).toContain("Acme Corp");
    const doc = await Candidature.findOne({ entreprise: "Acme Corp" }).lean<{ url: string } | null>();
    expect(doc).toMatchObject({ statut: "identifiée", type: "alternance", source: "manual" });
    expect(doc!.url).toMatch(/^manual:\/\/acme-corp-\d+$/);
  });

  it("ignore un email invalide (« Equipe RH ») et le signale", async () => {
    const r = await executeTool("create_candidature", { entreprise: "Acme", email: "Equipe RH" });
    expect(r.body.summary).toContain("n'est pas une adresse valide");
    const doc = await Candidature.findOne({ entreprise: "Acme" }).lean<{ email: string } | null>();
    expect(doc!.email).toBe("");
  });

  it("refuse un doublon d'URL (409)", async () => {
    await executeTool("create_candidature", { entreprise: "Acme", url: "https://acme.fr" });
    const r = await executeTool("create_candidature", { entreprise: "Acme 2", url: "https://acme.fr" });
    expect(r.status).toBe(409);
    expect(r.body.error).toContain("existe déjà");
  });
});

describe("list_candidatures / get_candidature", () => {
  it("recherche insensible aux accents et à la casse", async () => {
    await executeTool("create_candidature", { entreprise: "Générale Électrique", poste: "Dev" });
    const r = await executeTool("list_candidatures", { search: "generale electrique" });
    const data = parse(r.body.summary);
    expect(data.count).toBe(1);
  });

  it("get_candidature retourne le détail avec _id", async () => {
    await executeTool("create_candidature", { entreprise: "Acme", poste: "Dev fullstack" });
    const doc = await Candidature.findOne({ entreprise: "Acme" }).lean();
    const r = await executeTool("get_candidature", { candidature_id: String((doc as { _id: unknown })._id) });
    const data = parse(r.body.summary);
    expect(data.entreprise).toBe("Acme");
    expect(data.poste).toBe("Dev fullstack");
  });
});

describe("set_lettre / get_lettre", () => {
  const LETTRE = [
    "Madame, Monsieur,",
    "",
    "Votre entreprise construit des ponts en aluminium recyclé et je veux participer à ça. " +
      "Mon expérience en calcul de structures et mes projets web me donnent une double compétence rare. " +
      "Je propose de commencer par vos outils internes de suivi de chantier.",
    "",
    "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    "Bien cordialement,",
    "Mohammed Hamiani",
  ].join("\n");

  it("strippe salutation + politesse + signature, versionne, avance le statut", async () => {
    await executeTool("create_candidature", { entreprise: "Ponts SA" });
    const doc = await Candidature.findOne({ entreprise: "Ponts SA" });
    const r = await executeTool("set_lettre", { candidature_id: String(doc!._id), lettre: LETTRE });
    expect(r.body.error).toBeUndefined();
    const after = await Candidature.findById(doc!._id).lean<{ lettre: string; statut: string; letters: unknown[] }>();
    expect(after!.lettre).not.toContain("Madame, Monsieur");
    expect(after!.lettre).not.toContain("agréer");
    expect(after!.lettre).not.toContain("Hamiani");
    expect(after!.lettre).toContain("ponts en aluminium");
    expect(after!.statut).toBe("lettre générée");
    expect(after!.letters).toHaveLength(1);
  });

  it("refuse une lettre trop courte", async () => {
    await executeTool("create_candidature", { entreprise: "Ponts SA" });
    const doc = await Candidature.findOne({ entreprise: "Ponts SA" });
    const r = await executeTool("set_lettre", { candidature_id: String(doc!._id), lettre: "Trop court." });
    expect(r.status).toBe(400);
  });

  it("get_lettre expose lettre et corps de mail par défaut", async () => {
    await executeTool("create_candidature", { entreprise: "Ponts SA" });
    const doc = await Candidature.findOne({ entreprise: "Ponts SA" });
    await executeTool("set_lettre", { candidature_id: String(doc!._id), lettre: LETTRE });
    const r = await executeTool("get_lettre", { candidature_id: String(doc!._id) });
    const data = parse(r.body.summary);
    expect(String(data.lettre)).toContain("ponts en aluminium");
    expect(String(data.corpsMail)).toContain("modèle par défaut");
  });
});

describe("set_email_body", () => {
  const BODY =
    "Je vous écris car votre équipe SAP à Molsheim cherche un profil hybride support/dev. " +
    "C'est exactement mon projet d'alternance : consolider l'existant et automatiser les flux.";

  it("enregistre le corps sur mesure et get_lettre le montre", async () => {
    await executeTool("create_candidature", { entreprise: "Molsheim SAS" });
    const doc = await Candidature.findOne({ entreprise: "Molsheim SAS" });
    const r = await executeTool("set_email_body", { candidature_id: String(doc!._id), texte: BODY });
    expect(r.body.summary).toContain("accompagnera le CV");
    const g = parse((await executeTool("get_lettre", { candidature_id: String(doc!._id) })).body.summary);
    expect(String(g.corpsMail)).toContain("Molsheim");
  });

  it("reset revient au modèle par défaut", async () => {
    await executeTool("create_candidature", { entreprise: "Molsheim SAS" });
    const doc = await Candidature.findOne({ entreprise: "Molsheim SAS" });
    await executeTool("set_email_body", { candidature_id: String(doc!._id), texte: BODY });
    await executeTool("set_email_body", { candidature_id: String(doc!._id), reset: true });
    const after = await Candidature.findById(doc!._id).lean<{ emailBody: string | null }>();
    expect(after!.emailBody).toBeNull();
  });

  it("previent quand la candidature est déjà partie", async () => {
    await executeTool("create_candidature", { entreprise: "Molsheim SAS" });
    const doc = await Candidature.findOne({ entreprise: "Molsheim SAS" });
    doc!.emailsSent = [{ date: new Date(), to: "rh@x.fr", subject: "s", type: "candidature", status: "sent", error: null }];
    await doc!.save();
    const r = await executeTool("set_email_body", { candidature_id: String(doc!._id), texte: BODY });
    expect(r.body.summary).toContain("déjà partie");
  });

  it("refuse un corps trop court", async () => {
    await executeTool("create_candidature", { entreprise: "Molsheim SAS" });
    const doc = await Candidature.findOne({ entreprise: "Molsheim SAS" });
    const r = await executeTool("set_email_body", { candidature_id: String(doc!._id), texte: "Bonjour,\n\nCordialement" });
    expect(r.status).toBe(400);
  });
});

describe("delete_candidature", () => {
  it("supprime définitivement puis 404", async () => {
    await executeTool("create_candidature", { entreprise: "Test Corp" });
    const doc = await Candidature.findOne({ entreprise: "Test Corp" });
    const r = await executeTool("delete_candidature", { candidature_id: String(doc!._id) });
    expect(r.body.summary).toContain("supprimée");
    const again = await executeTool("delete_candidature", { candidature_id: String(doc!._id) });
    expect(again.status).toBe(404);
  });
});

describe("rappels Telegram", () => {
  const FUTURE = new Date(Date.now() + 7 * 86_400_000);

  it("programme, liste, annule (ISO exact)", async () => {
    const iso = FUTURE.toISOString();
    await executeTool("schedule_telegram_reminder", { when: iso, message: "Préparer entretien Extia" });
    let list = parse((await executeTool("list_reminders", {})).body.summary);
    expect(list.count).toBe(1);
    const r = await executeTool("cancel_reminder", { due_at: iso });
    expect(r.body.summary).toContain("annulé");
    list = parse((await executeTool("list_reminders", {})).body.summary);
    expect(list.count).toBe(0);
  });

  it("annule avec une tolérance ±60 s (ISO reformulé par le modèle)", async () => {
    const withMs = new Date(FUTURE.getTime() + 500);
    await executeTool("schedule_telegram_reminder", { when: withMs.toISOString(), message: "RDV" });
    // Le modèle relaie souvent l'heure arrondie à la seconde → l'exact rate, la fenêtre matche.
    const rounded = new Date(Math.floor(withMs.getTime() / 1000) * 1000).toISOString();
    const r = await executeTool("cancel_reminder", { due_at: rounded });
    expect(r.body.error).toBeUndefined();
  });

  it("404 quand aucun rappel ne matche", async () => {
    const r = await executeTool("cancel_reminder", { due_at: FUTURE.toISOString() });
    expect(r.status).toBe(404);
  });

  it("refuse un rappel dans le passé", async () => {
    const r = await executeTool("schedule_telegram_reminder", {
      when: new Date(Date.now() - 3_600_000).toISOString(),
      message: "trop tard",
    });
    expect(r.status).toBe(400);
  });
});

describe("update_candidature_status", () => {
  it("annule les relances programmées en sortant de « postulée »", async () => {
    const doc = await Candidature.create({
      entreprise: "Acme",
      poste: "Dev",
      plateforme: "Web",
      localisation: "",
      url: "https://acme-status.fr",
      description: "",
      email: "rh@acme.fr",
      statut: "postulée",
      type: "alternance",
      lettre: null,
      source: "manual",
      date: "2026-07-06",
      relanceHistory: [
        { scheduledFor: new Date(Date.now() + 86_400_000), template: "custom", message: "relance", status: "programmée" },
      ],
    });
    await executeTool("update_candidature_status", { candidature_id: String(doc._id), statut: "refus" });
    const after = await Candidature.findById(doc._id).lean<{ statut: string; relanceHistory: Array<{ status: string }> }>();
    expect(after!.statut).toBe("refus");
    expect(after!.relanceHistory[0].status).toBe("annulée");
  });

  it("ne plante pas sur un vieux doc sans relanceHistory", async () => {
    // Insertion brute pour simuler un document legacy sans le champ.
    const res = await mongoose.connection.db!.collection("candidatures").insertOne({
      entreprise: "Legacy",
      poste: "Dev",
      url: "https://legacy.fr",
      statut: "postulée",
      type: "alternance",
    });
    const r = await executeTool("update_candidature_status", { candidature_id: String(res.insertedId), statut: "refus" });
    expect(r.body.error).toBeUndefined();
  });
});

describe("blacklist prospection", () => {
  it("liste puis réactive un domaine", async () => {
    await recordProspectSkip({ domain: "acme.fr", entreprise: "Acme", reason: "low_score", detail: "score 0.1" });
    const list = parse((await executeTool("list_blacklist", {})).body.summary);
    expect(list.count).toBe(1);
    const r = await executeTool("unblacklist_domain", { domain: "www.ACME.fr" });
    expect(r.body.summary).toContain("retiré de la blacklist");
    const after = parse((await executeTool("list_blacklist", {})).body.summary);
    expect(after.count).toBe(0);
  });

  it("404 pour un domaine inconnu", async () => {
    const r = await executeTool("unblacklist_domain", { domain: "inconnu.fr" });
    expect(r.status).toBe(404);
  });
});

describe("get_stats", () => {
  it("compte par statut et ne compte que les envois réussis", async () => {
    await Candidature.create({
      entreprise: "A", poste: "p", plateforme: "Web", localisation: "", url: "https://a.fr",
      description: "", email: "", statut: "postulée", type: "alternance", lettre: null,
      source: "manual", date: "2026-07-06",
      emailsSent: [{ date: new Date(), to: "x@a.fr", subject: "s", type: "candidature", status: "sent", error: null }],
    });
    await Candidature.create({
      entreprise: "B", poste: "p", plateforme: "Web", localisation: "", url: "https://b.fr",
      description: "", email: "", statut: "identifiée", type: "alternance", lettre: null,
      source: "manual", date: "2026-07-06",
      emailsSent: [{ date: new Date(), to: "x@b.fr", subject: "s", type: "candidature", status: "failed", error: "boom" }],
    });
    const data = parse((await executeTool("get_stats", {})).body.summary);
    expect(data.total).toBe(2);
    expect((data.parStatut as Record<string, number>)["postulée"]).toBe(1);
    expect(data.candidaturesEnvoyees7j).toBe(1); // le failed ne compte pas
  });
});

describe("mémoire agent", () => {
  it("mémorise, dédoublonne, liste et oublie", async () => {
    const r1 = await executeTool("remember_fact", { category: "ecole", fact: "Intègre le CNAM en septembre 2026" });
    expect(r1.body.summary).toContain("Mémorisé");
    const r2 = await executeTool("remember_fact", { category: "ecole", fact: "intègre le cnam en septembre 2026" });
    expect(r2.body.summary).toContain("Déjà mémorisé");
    const list = parse((await executeTool("list_memory", {})).body.summary);
    expect(list.count).toBe(1);
    const id = (list.facts as Array<{ _id: string }>)[0]._id;
    const r3 = await executeTool("forget_fact", { fact_id: id });
    expect(r3.body.summary).toContain("Oublié");
  });
});
