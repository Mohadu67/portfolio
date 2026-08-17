import { getSettings } from "@/models/Settings";

export type LetterType = "stage" | "alternance" | "cdi";

export const TEMPLATE_PLACEHOLDER = "{{paragraphe_genere}}";

const COMMON_BODY = `Je conçois et développe des applications web complètes, de la modélisation à la mise en production. J'ai l'habitude de travailler avec des méthodes structurées et de livrer des solutions fonctionnelles, maintenables et sécurisées.

Je maîtrise des environnements full-stack (Node.js, React, PHP) et le déploiement en conditions réelles avec des pratiques de CI/CD.

${TEMPLATE_PLACEHOLDER}

Je cherche aujourd'hui un environnement exigeant où je pourrai être rapidement confronté à des problématiques concrètes et apporter une contribution technique utile.

Je reste disponible pour un échange.`;

export const DEFAULT_LETTER_TEMPLATES: Record<LetterType, string> = {
  stage: `Titulaire d'un Bachelor Concepteur Développeur d'Applications et admis en Master Manager en Ingénierie Informatique, je recherche une alternance dès la rentrée 2026 (2 jours en entreprise / 1 jour de cours).

${COMMON_BODY}`,
  alternance: `Titulaire d'un Bachelor Concepteur Développeur d'Applications et admis en Master Manager en Ingénierie Informatique, je recherche une alternance dès la rentrée 2026 (2 jours en entreprise / 1 jour de cours).

${COMMON_BODY}`,
  cdi: `Titulaire d'un Bachelor Concepteur Développeur d'Applications et admis en Master Manager en Ingénierie Informatique, je recherche un CDI développeur web pour intégrer une équipe technique dès maintenant.

${COMMON_BODY}`,
};

/**
 * Récupère le template actif depuis Settings, ou le default si pas configuré.
 * Garantit la présence du placeholder — si l'utilisateur l'a retiré par erreur,
 * fallback sur le default pour éviter une lettre incomplète.
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
