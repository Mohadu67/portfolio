import { describe, it, expect } from "vitest";
import {
  pickBestContactEmail,
  pickBestContactEmailLoose,
  scoreContactEmail,
} from "@/lib/auto-apply-filters";

describe("scoreContactEmail (filtre strict)", () => {
  it("high_value_prefix (rh@) + domain_match → score élevé, accepté", () => {
    const r = scoreContactEmail("rh@boite.com", "https://boite.com");
    expect(r.accept).toBe(true);
    expect(r.reasons).toContain("high_value_prefix");
    expect(r.reasons).toContain("domain_match");
  });

  it("email nominatif (prenom.nom@) + domain_match → accepté", () => {
    const r = scoreContactEmail("marie.dupont@boite.com", "https://boite.com");
    expect(r.accept).toBe(true);
    expect(r.reasons).toContain("nominative");
  });

  it("contact@ + domain_match → rejeté en strict (hardCap 0.4)", () => {
    const r = scoreContactEmail("contact@boite.com", "https://boite.com");
    expect(r.accept).toBe(false);
    expect(r.reasons).toContain("generic_prefix");
  });

  it("noreply@ → blacklist, score 0, refusé peu importe le domaine", () => {
    const r = scoreContactEmail("noreply@boite.com", "https://boite.com");
    expect(r.accept).toBe(false);
    expect(r.score).toBe(0);
    expect(r.reasons).toContain("blacklist_prefix");
  });

  it("dpo@ → blacklist, refusé même avec domain_match", () => {
    const r = scoreContactEmail("dpo@boite.com", "https://boite.com");
    expect(r.accept).toBe(false);
    expect(r.score).toBe(0);
    expect(r.reasons).toContain("blacklist_prefix");
  });

  it("rgpd@ / privacy@ / juridique@ → blacklist", () => {
    for (const local of ["rgpd", "privacy", "juridique", "legal", "compliance"]) {
      const r = scoreContactEmail(`${local}@boite.com`, "https://boite.com");
      expect(r.accept).toBe(false);
      expect(r.reasons).toContain("blacklist_prefix");
    }
  });

  it("dpo.externe@ / dpo-contact@ → blacklist par préfixe, pas confondu avec nominatif", () => {
    for (const local of ["dpo.externe", "dpo-contact", "legal_notice"]) {
      const r = scoreContactEmail(`${local}@boite.com`, "https://boite.com");
      expect(r.accept).toBe(false);
      expect(r.reasons).toContain("blacklist_prefix");
    }
  });

  it("mentions-legales@ → blacklist (pas nominatif malgré le tiret)", () => {
    const r = scoreContactEmail("mentions-legales@boite.com", "https://boite.com");
    expect(r.accept).toBe(false);
    expect(r.reasons).toContain("blacklist_prefix");
    expect(r.reasons).not.toContain("nominative");
  });

  it("formes concaténées privacyofficer@ / noreply2@ → blacklist par compact", () => {
    for (const local of ["privacyofficer", "noreply2", "rgpdcontact"]) {
      const r = scoreContactEmail(`${local}@boite.com`, "https://boite.com");
      expect(r.accept).toBe(false);
      expect(r.reasons).toContain("blacklist_prefix");
    }
  });

  it("service.recrutement@ / info-recrutement@ → le token RH neutralise la blacklist douce", () => {
    for (const local of ["service.recrutement", "info-recrutement", "service-rh"]) {
      const r = scoreContactEmail(`${local}@boite.com`, "https://boite.com");
      expect(r.accept).toBe(true);
      expect(r.reasons).toContain("high_value_prefix");
    }
  });

  it("noreply-jobs@ → la blacklist dure prime sur le token RH (émetteur automatique)", () => {
    const r = scoreContactEmail("noreply-jobs@boite.com", "https://boite.com");
    expect(r.accept).toBe(false);
    expect(r.reasons).toContain("blacklist_prefix");
  });

  it("service.client@ → blacklist douce en forme composée", () => {
    const r = scoreContactEmail("service.client@boite.com", "https://boite.com");
    expect(r.accept).toBe(false);
    expect(r.reasons).toContain("blacklist_prefix");
  });

  it("email RH sur domaine free (gmail.com) → hardCap 0.3, refusé", () => {
    const r = scoreContactEmail("rh@gmail.com", "https://boite.com");
    expect(r.accept).toBe(false);
    expect(r.reasons).toContain("free_email_domain");
  });

  it("nominatif sur domaine différent du site → domain_mismatch", () => {
    const r = scoreContactEmail("marie.dupont@autre.com", "https://boite.com");
    expect(r.reasons).toContain("domain_mismatch");
    expect(r.accept).toBe(false);
  });

  it("racine de marque commune malgré suffixe corporatif → domain_match (extia.fr ~ extia-group.com)", () => {
    const r = scoreContactEmail("jobs@extia.fr", "https://www.extia-group.com");
    expect(r.reasons).toContain("domain_match");
    expect(r.reasons).not.toContain("domain_mismatch");
    expect(r.accept).toBe(true);
  });

  it("variante de TLD d'une même marque → domain_match (extia.fr ~ extia.com)", () => {
    const r = scoreContactEmail("rh@extia.fr", "https://extia.com");
    expect(r.reasons).toContain("domain_match");
  });

  it("label non délimité distinct → reste domain_mismatch (etudeplus ≠ etudeplusstrasbourg)", () => {
    const r = scoreContactEmail("contact@etudeplus.org", "https://etudeplusstrasbourg.fr");
    expect(r.reasons).toContain("domain_mismatch");
  });

  it("TLD composé : pas de collision sur le suffixe (bar.co.fr ≠ acme.co.uk)", () => {
    const r = scoreContactEmail("foo@bar.co.fr", "https://acme.co.uk");
    expect(r.reasons).toContain("domain_mismatch");
    expect(r.reasons).not.toContain("domain_match");
  });

  it("résidu de marque trop court (<3) → pas de match (go-group ≠ go-holding)", () => {
    const r = scoreContactEmail("x@go-group.com", "https://go-holding.fr");
    expect(r.reasons).toContain("domain_mismatch");
  });

  it("token nom-commun NON retiré → marques distinctes restent mismatch (data-services ≠ cloud-services)", () => {
    const r = scoreContactEmail("contact@data-services.com", "https://cloud-services.fr");
    expect(r.reasons).toContain("domain_mismatch");
  });

  it("invalid_format pour string sans @", () => {
    const r = scoreContactEmail("pasunmail", "https://boite.com");
    expect(r.accept).toBe(false);
    expect(r.reasons).toContain("invalid_format");
  });
});

describe("pickBestContactEmail (strict)", () => {
  it("retourne l'email accepté avec le plus haut score", () => {
    const r = pickBestContactEmail(
      ["contact@boite.com", "rh@boite.com", "noreply@boite.com"],
      "https://boite.com",
    );
    expect(r).not.toBeNull();
    expect(r?.email).toBe("rh@boite.com");
  });

  it("retourne null si aucun email accepté", () => {
    const r = pickBestContactEmail(
      ["contact@boite.com", "noreply@boite.com"],
      "https://boite.com",
    );
    expect(r).toBeNull();
  });

  it("retourne null sur liste vide", () => {
    expect(pickBestContactEmail([], "https://boite.com")).toBeNull();
  });
});

describe("pickBestContactEmailLoose (override allow_generic_email)", () => {
  it("accepte contact@ avec domain_match (cas TPE)", () => {
    const r = pickBestContactEmailLoose(
      ["contact@boite.com"],
      "https://boite.com",
    );
    expect(r).not.toBeNull();
    expect(r?.email).toBe("contact@boite.com");
    expect(r?.reasons).toContain("generic_prefix");
  });

  it("refuse noreply@ même en mode loose (blacklist non bypassable)", () => {
    const r = pickBestContactEmailLoose(
      ["noreply@boite.com"],
      "https://boite.com",
    );
    expect(r).toBeNull();
  });

  it("accepte jobs@extia.fr quand le site résolu est extia-group.com (bug F3 backlog)", () => {
    const r = pickBestContactEmailLoose(
      ["dpo@extia.fr", "jobs@extia.fr", "contact@extia.fr"],
      "https://www.extia-group.com",
    );
    expect(r?.email).toBe("jobs@extia.fr");
    expect(r?.reasons).toContain("domain_match");
  });

  it("refuse les emails sur domain_mismatch (promesse alignée à la description tool)", () => {
    // Cas etudeplus : email candidat sur etudeplus.org alors que le site est etudeplusstrasbourg.fr
    const r = pickBestContactEmailLoose(
      ["strasbourg@etudeplus.org"],
      "https://etudeplusstrasbourg.fr",
    );
    expect(r).toBeNull();
  });

  it("refuse les domaines free même en loose", () => {
    const r = pickBestContactEmailLoose(
      ["recruteur@gmail.com"],
      "https://boite.com",
    );
    expect(r).toBeNull();
  });

  it("préfère domain_match au reste si plusieurs candidats", () => {
    // contact@boite.com (domain match) vs contact@autre.com (domain mismatch)
    const r = pickBestContactEmailLoose(
      ["contact@autre.com", "contact@boite.com"],
      "https://boite.com",
    );
    expect(r?.email).toBe("contact@boite.com");
  });

  it("accepte un email nominatif valide en loose aussi", () => {
    const r = pickBestContactEmailLoose(
      ["marie.dupont@boite.com"],
      "https://boite.com",
    );
    expect(r?.email).toBe("marie.dupont@boite.com");
  });

  it("retourne null sur liste vide", () => {
    expect(pickBestContactEmailLoose([], "https://boite.com")).toBeNull();
  });

  it("refuse les blacklist & free même avec d'autres candidats valides ailleurs", () => {
    // Que des candidats invalides → null
    const r = pickBestContactEmailLoose(
      ["noreply@boite.com", "support@boite.com", "rh@gmail.com"],
      "https://boite.com",
    );
    expect(r).toBeNull();
  });
});
