import { describe, it, expect } from "vitest";
import {
  DEFAULT_LETTER_TEMPLATES,
  RYTHME_PLACEHOLDER,
  DEFAULT_RYTHME,
  extractRythmeFromInstruction,
  applyTemplateVariables,
  splitTemplate,
  fillTemplate,
} from "@/lib/letter-template";

describe("extractRythmeFromInstruction", () => {
  it("retourne le rythme par défaut sans instruction", () => {
    expect(extractRythmeFromInstruction()).toBe(DEFAULT_RYTHME);
    expect(extractRythmeFromInstruction("")).toBe(DEFAULT_RYTHME);
  });

  it("détecte 2 semaines en entreprise / 1 semaine à l'école", () => {
    expect(extractRythmeFromInstruction("C'est 2 semaines en entreprise et une semaine à l'école")).toBe(
      "2 semaines en entreprise / 1 semaine à l'école"
    );
    expect(extractRythmeFromInstruction("rythme : 2semaines entreprise / 1 semaine école")).toBe(
      "2 semaines en entreprise / 1 semaine à l'école"
    );
    // sans séparateur explicite (transcription vocale)
    expect(extractRythmeFromInstruction("C'est 2semaine en entreprise une semaine à l'école")).toBe(
      "2 semaines en entreprise / 1 semaine à l'école"
    );
    // variante "boîte"
    expect(extractRythmeFromInstruction("2 semaines en boîte / 1 semaine à l'école")).toBe(
      "2 semaines en entreprise / 1 semaine à l'école"
    );
    // variante "cours"
    expect(extractRythmeFromInstruction("2 semaines en entreprise et une semaine en cours")).toBe(
      "2 semaines en entreprise / 1 semaine à l'école"
    );
  });

  it("détecte 2 jours / 1 jour de cours", () => {
    expect(extractRythmeFromInstruction("Tu peux mettre rythme 2 jours en entreprise / 1 jour de cours")).toBe(
      "2 jours en entreprise / 1 jour de cours"
    );
  });

  it("détecte 3 jours / 2 jours", () => {
    expect(extractRythmeFromInstruction("3 jours entreprise / 2 jours école")).toBe(
      "3 jours en entreprise / 2 jours de cours"
    );
  });

  it("ignore les instructions sans rythme explicite", () => {
    expect(extractRythmeFromInstruction("insiste sur React")).toBe(DEFAULT_RYTHME);
  });
});

describe("applyTemplateVariables", () => {
  it("substitue {rythme}", () => {
    const template = `Intro (${RYTHME_PLACEHOLDER}).`;
    expect(applyTemplateVariables(template, { rythme: "2 semaines en entreprise / 1 semaine à l'école" })).toBe(
      "Intro (2 semaines en entreprise / 1 semaine à l'école)."
    );
  });

  it("garde les variables inconnues telles quelles", () => {
    expect(applyTemplateVariables("{rythme} {inconnu}", { rythme: "X" })).toBe("X {inconnu}");
  });
});

describe("DEFAULT_LETTER_TEMPLATES", () => {
  it("contient le placeholder {rythme} dans stage et alternance", () => {
    expect(DEFAULT_LETTER_TEMPLATES.stage).toContain(RYTHME_PLACEHOLDER);
    expect(DEFAULT_LETTER_TEMPLATES.alternance).toContain(RYTHME_PLACEHOLDER);
  });

  it("ne contient pas de rythme en dur", () => {
    expect(DEFAULT_LETTER_TEMPLATES.stage).not.toContain("2 jours en entreprise");
    expect(DEFAULT_LETTER_TEMPLATES.alternance).not.toContain("2 jours en entreprise");
  });
});

describe("splitTemplate / fillTemplate", () => {
  it("découpe et remplit autour du placeholder", () => {
    const template = DEFAULT_LETTER_TEMPLATES.alternance;
    const { intro, outro } = splitTemplate(template);
    expect(intro).not.toContain("{{paragraphe_genere}}");
    expect(outro).not.toContain("{{paragraphe_genere}}");

    const filled = fillTemplate(template, "Paragraphe généré.");
    expect(filled).toContain("Paragraphe généré.");
    expect(filled).toContain(intro);
    expect(filled).toContain(outro);
  });
});
