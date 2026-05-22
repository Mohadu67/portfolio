import { describe, it, expect } from "vitest";
import {
  buildCandidatureEmailIndex,
  findCandidatureForSender,
  normalizeEmail,
  type MatchableCandidature,
} from "@/lib/gmail-imap-matching";

// Helper : construit une "fake" candidature minimale typée comme MatchableCandidature.
// Les autres champs Mongo (statut, lettre…) ne servent pas au matching.
const c = (email: string, tag = email): MatchableCandidature & { tag: string } => ({
  email,
  tag,
});

describe("normalizeEmail", () => {
  it("lowercase + trim", () => {
    expect(normalizeEmail("  RH@Abby.COM  ")).toBe("rh@abby.com");
  });
  it("retourne '' pour null/undefined/empty", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("")).toBe("");
    expect(normalizeEmail("   ")).toBe("");
  });
});

describe("buildCandidatureEmailIndex", () => {
  it("indexe les candidatures par email et par domaine non free", () => {
    const cands = [c("rh@abby.com", "abby"), c("contact@etudeplusstrasbourg.fr", "etudeplus")];
    const idx = buildCandidatureEmailIndex(cands);

    expect(idx.emailToCandidature.size).toBe(2);
    expect(idx.emailToCandidature.get("rh@abby.com")).toMatchObject({ tag: "abby" });
    expect(idx.domainToCandidatures.get("abby.com")).toHaveLength(1);
    expect(idx.domainToCandidatures.get("etudeplusstrasbourg.fr")).toHaveLength(1);
  });

  it("ignore les candidatures sans email", () => {
    const cands = [c(""), c("rh@abby.com")];
    const idx = buildCandidatureEmailIndex(cands);
    expect(idx.emailToCandidature.size).toBe(1);
  });

  it("n'indexe PAS les domaines free dans domainToCandidatures (mais email exact OK)", () => {
    const cands = [c("recruteur@gmail.com")];
    const idx = buildCandidatureEmailIndex(cands);
    expect(idx.emailToCandidature.get("recruteur@gmail.com")).toBeDefined();
    expect(idx.domainToCandidatures.has("gmail.com")).toBe(false);
  });

  it("regroupe plusieurs candidatures sur le même domaine", () => {
    const cands = [c("rh@abby.com", "a1"), c("careers@abby.com", "a2")];
    const idx = buildCandidatureEmailIndex(cands);
    expect(idx.domainToCandidatures.get("abby.com")).toHaveLength(2);
  });

  it("garde la première candidature en cas de doublon d'email exact", () => {
    const cands = [c("rh@abby.com", "a1"), c("rh@abby.com", "a2")];
    const idx = buildCandidatureEmailIndex(cands);
    expect(idx.emailToCandidature.get("rh@abby.com")).toMatchObject({ tag: "a1" });
  });

  it("normalise emails à la construction (case-insensitive)", () => {
    const cands = [c("RH@Abby.COM", "abby")];
    const idx = buildCandidatureEmailIndex(cands);
    expect(idx.emailToCandidature.get("rh@abby.com")).toBeDefined();
    expect(idx.domainToCandidatures.has("abby.com")).toBe(true);
  });
});

describe("findCandidatureForSender", () => {
  const cands = [
    c("rh@abby.com", "abby"),
    c("contact@etudeplus.com", "etudeplus"),
    c("careers@bigcorp.com", "bigcorp-1"),
    c("hr@bigcorp.com", "bigcorp-2"),
  ];
  const idx = buildCandidatureEmailIndex(cands);

  it("matche par email exact (cas nominal)", () => {
    const result = findCandidatureForSender("rh@abby.com", idx);
    expect(result).toMatchObject({ tag: "abby" });
  });

  it("case-insensitive sur l'expéditeur", () => {
    const result = findCandidatureForSender("RH@ABBY.COM", idx);
    expect(result).toMatchObject({ tag: "abby" });
  });

  it("fallback domaine si 1 seule candidature sur ce domaine (cas Stan/Abby)", () => {
    // Stan@abby.com → pas dans email index, mais 1 seule candidature sur abby.com
    const result = findCandidatureForSender("stan@abby.com", idx);
    expect(result).toMatchObject({ tag: "abby" });
  });

  it("PAS de fallback si plusieurs candidatures sur le même domaine (ambigu)", () => {
    // bigcorp.com a 2 candidatures (careers@ et hr@) → john@bigcorp.com ne doit pas matcher
    const result = findCandidatureForSender("john@bigcorp.com", idx);
    expect(result).toBeUndefined();
  });

  it("PAS de fallback si domaine free (gmail.com)", () => {
    const withFree = buildCandidatureEmailIndex([c("recruteur@gmail.com", "free")]);
    // Pierre@gmail.com ≠ recruteur@gmail.com → ne doit PAS matcher la candidature free
    const result = findCandidatureForSender("pierre@gmail.com", withFree);
    expect(result).toBeUndefined();
  });

  it("match exact prime sur fallback (le primary email gagne)", () => {
    const withDup = buildCandidatureEmailIndex([
      c("primary@x.com", "primary"),
      c("other@x.com", "other"),
    ]);
    // primary@x.com → match exact
    expect(findCandidatureForSender("primary@x.com", withDup)).toMatchObject({ tag: "primary" });
    // stranger@x.com → ambigu (2 cand sur x.com) → undefined
    expect(findCandidatureForSender("stranger@x.com", withDup)).toBeUndefined();
  });

  it("undefined si email vide / null", () => {
    expect(findCandidatureForSender("", idx)).toBeUndefined();
    expect(findCandidatureForSender(null, idx)).toBeUndefined();
    expect(findCandidatureForSender(undefined, idx)).toBeUndefined();
  });

  it("undefined si domaine totalement inconnu", () => {
    const result = findCandidatureForSender("random@nowhere.test", idx);
    expect(result).toBeUndefined();
  });

  it("undefined si email malformé sans @", () => {
    const result = findCandidatureForSender("notanemail", idx);
    expect(result).toBeUndefined();
  });
});
