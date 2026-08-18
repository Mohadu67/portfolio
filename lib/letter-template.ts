import { getSettings } from "@/models/Settings";

export type LetterType = "stage" | "alternance" | "cdi";

export const TEMPLATE_PLACEHOLDER = "{{paragraphe_genere}}";
export const RYTHME_PLACEHOLDER = "{rythme}";
export const DEFAULT_RYTHME = "2 jours en entreprise / 1 jour de cours";

const COMMON_BODY = `Je conçois et développe des applications web complètes, de la modélisation à la mise en production. J'ai l'habitude de travailler avec des méthodes structurées et de livrer des solutions fonctionnelles, maintenables et sécurisées.

Je maîtrise des environnements full-stack (Node.js, React, PHP) et le déploiement en conditions réelles avec des pratiques de CI/CD.

${TEMPLATE_PLACEHOLDER}

Je cherche aujourd'hui un environnement exigeant où je pourrai être rapidement confronté à des problématiques concrètes et apporter une contribution technique utile.

Je reste disponible pour un échange.`;

export const DEFAULT_LETTER_TEMPLATES: Record<LetterType, string> = {
  stage: `Titulaire d'un Bachelor Concepteur Développeur d'Applications et admis en Master Manager en Ingénierie Informatique, je recherche une alternance dès la rentrée 2026 (${RYTHME_PLACEHOLDER}).

${COMMON_BODY}`,
  alternance: `Titulaire d'un Bachelor Concepteur Développeur d'Applications et admis en Master Manager en Ingénierie Informatique, je recherche une alternance dès la rentrée 2026 (${RYTHME_PLACEHOLDER}).

${COMMON_BODY}`,
  cdi: `Titulaire d'un Bachelor Concepteur Développeur d'Applications et admis en Master Manager en Ingénierie Informatique, je recherche un CDI développeur web pour intégrer une équipe technique dès maintenant.

${COMMON_BODY}`,
};

// Nombres écrits en toutes lettres (jusqu'à 5, suffisant pour les rythmes courants).
const NUMBER_WORDS: Record<string, string> = {
  un: "1", une: "1", deux: "2", trois: "3", quatre: "4", cinq: "5",
};

function normalizeNumberToken(s: string): string {
  const lower = s.toLowerCase().trim();
  return NUMBER_WORDS[lower] ?? lower;
}

// Patterns courants de rythme d'alternance (insensibles à la casse, espaces flexibles).
// Le séparateur entre les deux parties peut être "/", "-", "\", "ou", "et", ou un simple espace
// (ex: vocal transcrit "2 semaines entreprise 1 semaine école").
const SEP = "(?:[/\\-]|\\s+et\\s+|\\s+ou\\s+|\\s+)";
const NUMBER = "(?:\\d+|une?|deux|trois|quatre|cinq)";
// Accepte "entreprise", "boîte"/"boite", "société" (avec ou sans accent).
const PLACE = "(?:en\\s+)?(?:entreprise|bo[îi]te|société)";
// Accepte "école", "cours", avec ou sans préposition (à l'école, en cours, de cours…).
const SCHOOL = "(?:[àa]\\s+|en\\s+|de\\s+)?(?:(?:l[''\\s])?[ée]cole|cours?)";

const RYTHME_PATTERNS = [
  // 2 semaines / 1 semaine
  {
    re: new RegExp(`(${NUMBER})\\s*semaines?\\s*${PLACE}\\s*${SEP}\\s*(${NUMBER})\\s*semaines?\\s*${SCHOOL}`, "i"),
    fmt: (m: RegExpMatchArray) => {
      const a = normalizeNumberToken(m[1]);
      const b = normalizeNumberToken(m[2]);
      return `${a} semaines en entreprise / ${b} semaine${b === "1" ? "" : "s"} à l'école`;
    },
  },
  // 2 jours / 1 jour
  {
    re: new RegExp(`(${NUMBER})\\s*jours?\\s*${PLACE}\\s*${SEP}\\s*(${NUMBER})\\s*jours?\\s*${SCHOOL}`, "i"),
    fmt: (m: RegExpMatchArray) => {
      const a = normalizeNumberToken(m[1]);
      const b = normalizeNumberToken(m[2]);
      return `${a} jours en entreprise / ${b} jour${b === "1" ? "" : "s"} de cours`;
    },
  },
];

/**
 * Extrait le rythme d'alternance depuis une consigne utilisateur.
 * Retourne DEFAULT_RYTHME si aucun rythme explicite n'est détecté.
 */
export function extractRythmeFromInstruction(instruction?: string): string {
  if (!instruction) return DEFAULT_RYTHME;
  for (const { re, fmt } of RYTHME_PATTERNS) {
    const m = instruction.match(re);
    if (m) return fmt(m);
  }
  return DEFAULT_RYTHME;
}

/**
 * Vrai si la consigne contient un rythme d'alternance explicite.
 */
export function hasRythmeInstruction(instruction?: string): boolean {
  return extractRythmeFromInstruction(instruction) !== DEFAULT_RYTHME;
}

/**
 * Remplace les variables de template connues par leurs valeurs.
 * Supporte à la fois les templates custom (Settings) et les templates par défaut.
 */
export function applyTemplateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{([a-z0-9_]+)\}/gi, (match, key) => variables[key] ?? match);
}

/**
 * Récupère le template actif depuis Settings, ou le default si pas configuré.
 * Garantit la présence du placeholder — si l'utilisateur l'a retiré par erreur,
 * fallback sur le default pour éviter une lettre incomplète.
 *
 * Le rythme n'est PAS substitué ici : on retourne le template brut avec {rythme}
 * pour que l'appelant puisse le substituer avec le rythme souhaité.
 *
 * Garde-fou : les premiers templates stockés en base contenaient le rythme par défaut
 * en dur (ex. "2 jours en entreprise / 1 jour de cours"). On les normalise pour utiliser
 * le placeholder {rythme}, sinon extractRythmeFromInstruction() ne peut pas agir.
 */
export async function getLetterTemplate(type: LetterType): Promise<string> {
  try {
    const settings = await getSettings();
    const custom = settings.letterTemplate?.[type];
    if (custom && custom.trim() && custom.includes(TEMPLATE_PLACEHOLDER)) {
      return custom.replace(DEFAULT_RYTHME, RYTHME_PLACEHOLDER);
    }
  } catch (err) {
    console.warn("[letter-template] could not load settings, falling back to default:", err);
  }
  return DEFAULT_LETTER_TEMPLATES[type];
}

/**
 * Découpe un template autour du placeholder : { intro, outro }
 * où intro est ce qui précède et outro ce qui suit.
 */
export function splitTemplate(template: string): { intro: string; outro: string } {
  const idx = template.indexOf(TEMPLATE_PLACEHOLDER);
  if (idx === -1) return { intro: template, outro: "" };
  return {
    intro: template.slice(0, idx).trimEnd(),
    outro: template.slice(idx + TEMPLATE_PLACEHOLDER.length).trimStart(),
  };
}

/**
 * Insère le paragraphe généré dans le template.
 */
export function fillTemplate(template: string, paragraph: string): string {
  const { intro, outro } = splitTemplate(template);
  return `${intro}\n\n${paragraph.trim()}\n\n${outro}`.trim();
}
