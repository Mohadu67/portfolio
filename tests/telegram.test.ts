import { describe, it, expect } from "vitest";
import {
  buildApprovalMessage,
  parseApprovalCallback,
  parseActionCallback,
  escapeTelegramHtml,
  type ApprovalRequestInput,
} from "@/lib/telegram";
import { formatToolResult } from "@/lib/telegram-agent";

const baseInput: ApprovalRequestInput = {
  approvalToken: "a1b2c3d4e5f6a1b2c3d4e5f6",
  entreprise: "Extia",
  poste: "Dev fullstack alternance",
  from: "marie.dupont@extia.fr",
  fromName: "Marie Dupont",
  subject: "Re: Candidature alternance",
  inboundExcerpt: "Bonjour, merci pour votre candidature. Êtes-vous disponible mardi ?",
  category: "entretien",
  confidence: 0.9,
  minConfidence: 0.7,
  reply: "Bonjour Marie, oui je suis disponible mardi à 11h.",
};

describe("parseApprovalCallback", () => {
  it("parse ar:ok:<token> → approve", () => {
    expect(parseApprovalCallback("ar:ok:a1b2c3d4e5f6a1b2c3d4e5f6")).toEqual({
      action: "approve",
      token: "a1b2c3d4e5f6a1b2c3d4e5f6",
    });
  });

  it("parse ar:no:<token> → reject", () => {
    expect(parseApprovalCallback("ar:no:a1b2c3d4e5f6a1b2c3d4e5f6")).toEqual({
      action: "reject",
      token: "a1b2c3d4e5f6a1b2c3d4e5f6",
    });
  });

  it("refuse les data inconnues / malformées", () => {
    expect(parseApprovalCallback("ar:yes:a1b2c3d4")).toBeNull();
    expect(parseApprovalCallback("autre:ok:a1b2c3d4")).toBeNull();
    expect(parseApprovalCallback("ar:ok:PAS-HEX!")).toBeNull();
    expect(parseApprovalCallback("")).toBeNull();
  });
});

describe("buildApprovalMessage", () => {
  it("contient entreprise, expéditeur, extrait, réponse et boutons implicites", () => {
    const msg = buildApprovalMessage(baseInput);
    expect(msg).toContain("Extia");
    expect(msg).toContain("Marie Dupont — marie.dupont@extia.fr");
    expect(msg).toContain("confiance 90%");
    expect(msg).toContain("disponible mardi à 11h");
    expect(msg).toContain("J'envoie ?");
    expect(msg).not.toContain("sous le seuil");
  });

  it("marque ⚠️ quand la confiance est sous le seuil", () => {
    const msg = buildApprovalMessage({ ...baseInput, confidence: 0.4 });
    expect(msg).toContain("confiance 40%");
    expect(msg).toContain("sous le seuil");
  });

  it("échappe le HTML dans les champs libres", () => {
    const msg = buildApprovalMessage({
      ...baseInput,
      subject: "<script>alert(1)</script>",
      reply: "a < b & c > d",
    });
    expect(msg).toContain("&lt;script&gt;");
    expect(msg).toContain("a &lt; b &amp; c &gt; d");
    expect(msg).not.toContain("<script>");
  });

  it("tronque les extraits/réponses très longs sous la limite Telegram (4096)", () => {
    const msg = buildApprovalMessage({
      ...baseInput,
      inboundExcerpt: "x".repeat(10_000),
      reply: "y".repeat(10_000),
    });
    expect(msg.length).toBeLessThan(4096);
    expect(msg).toContain("…");
  });

  it("borne aussi l'en-tête : sujet/expéditeur/entreprise/poste très longs → < 4096", () => {
    const msg = buildApprovalMessage({
      ...baseInput,
      entreprise: "E".repeat(2_000),
      poste: "P".repeat(2_000),
      fromName: "N".repeat(2_000),
      subject: `TR: RE: ${"TR: ".repeat(500)}candidature`,
      inboundExcerpt: "x".repeat(10_000),
      reply: "y".repeat(10_000),
    });
    expect(msg.length).toBeLessThan(4096);
  });
});

describe("escapeTelegramHtml", () => {
  it("échappe &, <, >", () => {
    expect(escapeTelegramHtml("a&b<c>d")).toBe("a&amp;b&lt;c&gt;d");
  });
});

describe("parseActionCallback", () => {
  it("parse act:ok / act:no", () => {
    expect(parseActionCallback("act:ok:a1b2c3d4e5f6a1b2c3d4e5f6")).toEqual({
      approve: true,
      token: "a1b2c3d4e5f6a1b2c3d4e5f6",
    });
    expect(parseActionCallback("act:no:a1b2c3d4e5f6a1b2c3d4e5f6")).toEqual({
      approve: false,
      token: "a1b2c3d4e5f6a1b2c3d4e5f6",
    });
  });

  it("ne matche pas les callbacks d'approbation ar: ni les data malformées", () => {
    expect(parseActionCallback("ar:ok:a1b2c3d4e5f6a1b2c3d4e5f6")).toBeNull();
    expect(parseActionCallback("act:yes:a1b2c3d4")).toBeNull();
    expect(parseActionCallback("")).toBeNull();
  });
});

describe("formatToolResult", () => {
  it("apply_to_company appliquée → message de succès avec email", () => {
    const txt = formatToolResult("apply_to_company", {
      status: 200,
      body: {
        ok: true,
        summary: JSON.stringify({ decision: "applied", entreprise: "Extia", email: { address: "rh@extia.fr" } }),
      },
    });
    expect(txt).toContain("✅");
    expect(txt).toContain("Extia");
    expect(txt).toContain("rh@extia.fr");
  });

  it("apply_to_company skip → motif + emails scrapés", () => {
    const txt = formatToolResult("apply_to_company", {
      status: 200,
      body: {
        ok: true,
        summary: JSON.stringify({
          decision: "skipped",
          entreprise: "Boite",
          skipReason: "aucun email RH",
          scrapedEmails: ["contact@boite.fr"],
        }),
      },
    });
    expect(txt).toContain("aucun email RH");
    expect(txt).toContain("contact@boite.fr");
  });

  it("process_pending_candidatures → compteurs lisibles", () => {
    const txt = formatToolResult("process_pending_candidatures", {
      status: 200,
      body: { ok: true, summary: JSON.stringify({ processed: 3, applied: 2, skipped: 1, errors: [] }) },
    });
    expect(txt).toContain("2 envoyée(s)");
    expect(txt).toContain("3 traitée(s)");
  });

  it("erreur → ⚠️ avec le message", () => {
    const txt = formatToolResult("send_relance_now", { status: 400, body: { error: "Aucun email destinataire" } });
    expect(txt).toContain("⚠️");
    expect(txt).toContain("Aucun email destinataire");
  });

  it("summary humain passé tel quel", () => {
    const txt = formatToolResult("schedule_relance", {
      status: 200,
      body: { ok: true, summary: "Relance programmée chez Extia pour le 06/07/2026 09:00" },
    });
    expect(txt).toBe("✅ Relance programmée chez Extia pour le 06/07/2026 09:00");
  });
});
