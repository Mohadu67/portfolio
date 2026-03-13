const apiKey = process.env.GROK_API_KEY;
if (!apiKey) {
  throw new Error("GROK_API_KEY environment variable is not set");
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
      "Authorization": `Bearer ${apiKey}`,
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
  const systemPrompt = `Tu es un expert en lettres de motivation naturelles et humaines pour le secteur tech.
Ton style: direct, concis, honnête. Pas de blabla, pas de formules creuses.
La lettre doit ressembler à quelqu'un qui parle vraiment, pas à un robot marketing.`;

  const posteInfo = poste && !poste.toLowerCase().includes("spontanée")
    ? `pour le poste de ${poste}`
    : "pour une alternance";

  const prompt = `Génère une lettre de motivation naturelle et humaine ${posteInfo} chez ${entreprise}.

PROFIL DU CANDIDAT:
- Admissible au CNAM pour un titre d'ingénieur informatique sur 3 ans
- Recherche alternance à partir de septembre 2026 (2j entreprise + 1j cours)
- Bachelor concepteur développeur informatique en cours
- Compétences: Figma, Adobe XD, UML, Merise, Node.js, Express, PHP, Prisma, PostgreSQL, MariaDB, MongoDB, React, Vite, Next.js, TypeScript, Docker, Linux, Ubuntu, SSH, VPS, CI/CD, Lynis, Fail2ban
- Capable de gérer des projets de A à Z, autonome, adaptatif

À PROPOS DE L'ENTREPRISE:
${aboutText.substring(0, 1000)}

INSTRUCTIONS:
- Rédige une lettre qui parle directement, sans phrases creuses
- Mentionne 2-3 détails concrets de l'entreprise (si l'about text le permet)
- Montre les compétences techniques pertinentes naturellement, pas sous forme de liste
- Ton: direct, honnête, confiant. Comme quelqu'un qui parle vraiment
- Longueur: 4-5 paragraphes, pas plus
- Ne mets PAS "Madame, Monsieur," au début ni de signature à la fin

Exemple de style souhaité:
"Je recherche une alternance à partir de septembre 2026 dans une équipe qui travaille sur des projets modernes.
Actuellement en bachelor concepteur développeur, j'ai acquis des compétences solides en full-stack:
React/Next.js côté frontend, Node.js/Express ou PHP côté backend, avec PostgreSQL ou MongoDB.
Je travaille aussi avec Docker, Linux et j'ai configuré des déploiements CI/CD sur VPS..."

Génère UNIQUEMENT la lettre, sans introduction.`;

  try {
    return await callGrok(prompt, systemPrompt);
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
