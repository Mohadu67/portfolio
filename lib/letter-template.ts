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
// Le séparateur entre les deux parties peut être "/", "-", "\", "ou", "et".
const SEP = "(?:[/\\-]|\\s+et\\s+|\\s+ou\\s+)";
const NUMBER = "(?:\\d+|une?|deux|trois|quatre|cinq)";

const RYTHME_PATTERNS = [
  // 2 semaines / 1 semaine
  {
    re: new RegExp(`(${NUMBER})\\s*semaines?\\s*(?:en\\s+)?entreprise\\s*${SEP}\\s*(${NUMBER})\\s*semaines?\\s*(?:[àa]\\s+)?(?:(?:l[''\\s])?[ée]cole|cours?)`, "i"),
    fmt: (m: RegExpMatchArray) => {
      const a = normalizeNumberToken(m[1]);
      const b = normalizeNumberToken(m[2]);
      return `${a} semaines en entreprise / ${b} semaine${b === "1" ? "" : "s"} à l'école`;
    },
  },
  // 2 jours / 1 jour
  {
    re: new RegExp(`(${NUMBER})\\s*jours?\\s*(?:en\\s+)?entreprise\\s*${SEP}\\s*(${NUMBER})\\s*jours?\\s*(?:[àa]\\s+)?(?:(?:l[''\\s])?[ée]cole|cours?)`, "i"),
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
 */
export async function getLetterTemplate(type: LetterType): Promise<string> {
  try {
    const settings = await getSettings();
    const custom = settings.letterTemplate?.[type];
    if (custom && custom.trim() && custom.includes(TEMPLATE_PLACEHOLDER)) {
      return custom;
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
