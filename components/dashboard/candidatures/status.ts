import type { CandidatureStatut } from "@/models/Candidature";

// Source unique pour l'ordre pipeline, les libellés et les couleurs de statut côté
// page candidatures. Les couleurs pointent sur les tokens --status-* de globals.css
// (mêmes teintes que le mini-pipeline du War Room).

export const PIPELINE_ORDER: CandidatureStatut[] = [
  "identifiée",
  "lettre générée",
  "postulée",
  "réponse reçue",
  "entretien",
  "refus",
  "acceptée",
];

// Libellés courts (chips) — alignés sur le War Room.
export const STATUS_LABEL: Record<CandidatureStatut, string> = {
  identifiée: "À traiter",
  "lettre générée": "Prêtes",
  postulée: "Postulées",
  "réponse reçue": "Réponses",
  entretien: "Entretiens",
  refus: "Refus",
  acceptée: "Acceptées",
};

// Libellés longs (en-têtes de section).
export const SECTION_LABEL: Record<CandidatureStatut, string> = {
  identifiée: "Offres à traiter",
  "lettre générée": "Prêtes à envoyer",
  postulée: "Candidatures envoyées",
  "réponse reçue": "Réponses reçues",
  entretien: "Entretiens en cours",
  refus: "Refus",
  acceptée: "Offres acceptées",
};

export const STATUS_CSS_VAR: Record<CandidatureStatut, string> = {
  identifiée: "var(--status-identifiee)",
  "lettre générée": "var(--status-lettre)",
  postulée: "var(--status-postule)",
  "réponse reçue": "var(--status-reponse)",
  entretien: "var(--status-entretien)",
  refus: "var(--status-refus)",
  acceptée: "var(--status-acceptee)",
};

// Classes Tailwind statiques par statut pour l'état actif des chips (les classes
// arbitraires avec var() + opacité doivent être des littéraux pour être compilées).
export const STATUS_CHIP_ACTIVE: Record<CandidatureStatut, string> = {
  identifiée: "border-[var(--status-identifiee)] text-[var(--status-identifiee)] bg-[var(--status-identifiee)]/10",
  "lettre générée": "border-[var(--status-lettre)] text-[var(--status-lettre)] bg-[var(--status-lettre)]/10",
  postulée: "border-[var(--status-postule)] text-[var(--status-postule)] bg-[var(--status-postule)]/10",
  "réponse reçue": "border-[var(--status-reponse)] text-[var(--status-reponse)] bg-[var(--status-reponse)]/10",
  entretien: "border-[var(--status-entretien)] text-[var(--status-entretien)] bg-[var(--status-entretien)]/10",
  refus: "border-[var(--status-refus)] text-[var(--status-refus)] bg-[var(--status-refus)]/10",
  acceptée: "border-[var(--status-acceptee)] text-[var(--status-acceptee)] bg-[var(--status-acceptee)]/10",
};
