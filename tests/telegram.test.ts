import { describe, it, expect } from "vitest";
import {
  buildApprovalMessage,
  parseApprovalCallback,
  escapeTelegramHtml,
  type ApprovalRequestInput,
} from "@/lib/telegram";

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
});

describe("escapeTelegramHtml", () => {
  it("échappe &, <, >", () => {
    expect(escapeTelegramHtml("a&b<c>d")).toBe("a&amp;b&lt;c&gt;d");
  });
});
