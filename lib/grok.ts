function getGrokApiKey(): string {
  const key = process.env.GROK_API_KEY;
  if (!key) {
    throw new Error("GROK_API_KEY environment variable is not set");
  }
  return key;
}

// Use OpenAI-compatible API for Groq
const GROK_API_URL = "https://api.groq.com/openai/v1";

interface GrokMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function callGrok(prompt: string, systemPrompt?: string): Promise<string> {
  const messages: GrokMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${GROK_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getGrokApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
}

const PROFIL_CONTEXT = `
**Profil du candidat — Mohammed Hamiani:**
- Formation actuelle : Bachelier CDA (Concepteur Développeur d'Application) — formation intensive fullstack
- Admissible au CNAM pour le titre d'ingénieur informatique (poursuite d'études visée)
- Stack technique : JavaScript/TypeScript, React, Next.js, Node.js, Express, Python, SQL/MariaDB, MongoDB, Git, Docker, Linux, Figma
- Projets concrets : Portfolio interactif avec dashboard de candidatures automatisé (scraping web, génération IA, envoi emails), applications fullstack complètes déployées
- Expérience pro non-tech valorisante : 5 ans de management en restauration rapide (KFC, Pizza Hut) dont 2 ans comme Responsable Général de Magasin — pilotage d'ouverture de restaurant, formation d'équipes, gestion de P&L, optimisation des coûts, actions marketing
- Soft skills prouvés : leadership, autonomie, gestion du stress, capacité à monter en compétence rapidement, esprit d'initiative
- Recherche : Stage de 3 mois (validation bachelier CDA), avec possibilité d'alternance dès septembre 2026
- Localisation : Strasbourg, mobile

**IMPORTANT — Ton et positionnement :**
- NE PAS demander de la charité ni supplier. Mohammed est un candidat qui APPORTE de la valeur.
- Mettre en avant ce qu'il peut apporter à l'entreprise : autonomie, rigueur, capacité à livrer, expérience terrain du management
- Son parcours atypique (management → dev) est une FORCE : il sait gérer des projets, des deadlines, des équipes
- Le stage est une opportunité MUTUELLE : l'entreprise gagne un profil opérationnel, Mohammed valide sa formation
- Mentionner naturellement la possibilité d'alternance en septembre 2026 comme une continuité logique, pas comme une demande
`;

const SYSTEM_PROMPT = `Tu es un rédacteur expert en lettres de motivation percutantes pour le secteur tech.
Tu rédiges des lettres qui positionnent le candidat comme un atout, pas comme un demandeur.
Le ton est professionnel, confiant et direct. Pas de formules creuses ni de flatterie excessive.
Tu ne commences JAMAIS par "Madame, Monsieur," (c'est ajouté automatiquement dans le PDF).
Tu ne termines JAMAIS par "Bien cordialement" ou une signature (c'est ajouté automatiquement dans le PDF).
Tu écris directement le corps de la lettre, rien d'autre.`;

export async function generateLetterProposal(
  entreprise: string,
  aboutText: string,
  poste?: string
): Promise<string> {
  const systemPrompt = `Tu es un expert en lettres de motivation. Tu génères UNIQUEMENT un court paragraphe de transition qui fait le lien entre le profil du candidat et l'entreprise ciblée. Rien d'autre.
Ton style: direct, concis, professionnel. Pas de blabla, pas de formules creuses.`;

  const prompt = `Je rédige une lettre de motivation pour ${entreprise}.

Voici la structure FIXE de ma lettre (ne la modifie PAS, ne la répète PAS) :

---
Admissible au CNAM pour un titre d'ingénieur informatique sur 3 ans et également admis en Master Manager en Ingénierie Informatique, je recherche une alternance dès la rentrée 2026 (2 jours en entreprise / 1 jour en cours).

Actuellement en fin de bachelor concepteur développeur d'applications, je conçois et développe des applications web complètes, de la modélisation à la mise en production. J'ai l'habitude de travailler avec des méthodes structurées et de livrer des solutions fonctionnelles, maintenables et sécurisées.

Je maîtrise des environnements full-stack (Node.js, React, PHP) et le déploiement en conditions réelles avec des pratiques de CI/CD.

[PARAGRAPHE À GÉNÉRER ICI]

Je cherche aujourd'hui un environnement exigeant où je pourrai être rapidement confronté à des problématiques concrètes et apporter une contribution technique utile.

Je reste disponible pour un échange.
---

À PROPOS DE L'ENTREPRISE:
${aboutText.substring(0, 1000)}

INSTRUCTIONS:
- Génère UNIQUEMENT le paragraphe manquant [PARAGRAPHE À GÉNÉRER ICI]
- Ce paragraphe doit faire le lien entre mes compétences et ce que fait ${entreprise}
- Mentionne 1-2 éléments concrets de l'entreprise (activité, techno, produit) tirés du texte "à propos"
- Explique pourquoi ${entreprise} m'intéresse et ce que je peux apporter
- 2-3 phrases max, ton direct et professionnel
- Ne mets PAS de guillemets autour du paragraphe
- Ne répète PAS le reste de la lettre, JUSTE le paragraphe de transition`;

  try {
    const paragraph = await callGrok(prompt, systemPrompt);

    // Assemble the full letter with the generated paragraph
    return `Admissible au CNAM pour un titre d'ingénieur informatique sur 3 ans et également admis en Master Manager en Ingénierie Informatique, je recherche une alternance dès la rentrée 2026 (2 jours en entreprise / 1 jour en cours).

Actuellement en fin de bachelor concepteur développeur d'applications, je conçois et développe des applications web complètes, de la modélisation à la mise en production. J'ai l'habitude de travailler avec des méthodes structurées et de livrer des solutions fonctionnelles, maintenables et sécurisées.

Je maîtrise des environnements full-stack (Node.js, React, PHP) et le déploiement en conditions réelles avec des pratiques de CI/CD.

${paragraph.trim()}

Je cherche aujourd'hui un environnement exigeant où je pourrai être rapidement confronté à des problématiques concrètes et apporter une contribution technique utile.

Je reste disponible pour un échange.`;
  } catch (error) {
    console.error("Error generating letter proposal with Grok:", error);
    throw error;
  }
}

export async function improveLetter(
  letterText: string,
  type: "stage" | "alternance" | "cdi"
): Promise<string> {
  const systemPrompt = `Tu es un correcteur de lettres de motivation. Tu es MINIMALISTE et DIRECT.

Ton rôle UNIQUE:
- Corriger l'orthographe et la grammaire
- Améliorer très légèrement la fluidité si vraiment nécessaire
- Garder EXACTEMENT le ton et le style de l'auteur

NE PAS:
- Ajouter des phrases marketing ou creuses
- Changer la structure
- "Améliorer" le contenu
- Rendre plus "poli" ou "formel"
- Ajouter de la blabla

La lettre doit rester directe, concrète, humaine. Comme si une personne parle.`;

  const prompt = `Corrige juste l'orthographe, la grammaire et la fluidité. Garde le ton exactement pareil.
Pas d'embellissements, pas de changements de structure. Juste les corrections nécessaires.

---
${letterText}
---

Retourne UNIQUEMENT la lettre corrigée, sans introduction.`;

  try {
    return await callGrok(prompt, systemPrompt);
  } catch (error) {
    console.error("Error improving letter with Grok:", error);
    throw error;
  }
}


export async function generateCV(): Promise<string> {
  const profil = {
    nom: process.env.PROFIL_NOM || "Mohammed Hamiani",
    formation: process.env.PROFIL_FORMATION || "Concepteur Développeur Fullstack",
    competences: process.env.PROFIL_COMPETENCES || "JavaScript, React, Node.js, Python, SQL, Git, Docker",
    experience: process.env.PROFIL_EXPERIENCE || "Projets fullstack, UI/UX design, développement web moderne",
    email: process.env.PROFIL_EMAIL || "hamiani.mohammed@hotmail.com",
    phone: process.env.PROFIL_PHONE || "+33 7 83 33 06 94",
  };

  const systemPrompt = `Tu es un expert en rédaction de CV. Génère un CV professionnel et bien structuré en format texte.`;

  const prompt = `Génère un CV professionnel pour:

- Nom: ${profil.nom}
- Email: ${profil.email}
- Téléphone: ${profil.phone}
- Formation: ${profil.formation}
- Compétences principales: ${profil.competences}
- Expérience: ${profil.experience}
- Objectif: Stage 2026 + Alternance Septembre 2026
- Statut: Admissible CNAM Ingénieur

Format: CV structuré avec sections (Formation, Compétences, Expérience, Objectifs).
Génère UNIQUEMENT le contenu du CV, sans introduction.`;

  try {
    return await callGrok(prompt, systemPrompt);
  } catch (error) {
    console.error("Error generating CV with Grok:", error);
    throw error;
  }
}
