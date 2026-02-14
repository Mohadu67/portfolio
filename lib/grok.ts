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

export async function generateLettre(
  entreprise: string,
  poste: string,
  description: string
): Promise<string> {
  const prompt = `Rédige le corps d'une lettre de motivation pour cette candidature :

${PROFIL_CONTEXT}

**Offre ciblée :**
- Entreprise : ${entreprise}
- Poste : ${poste}
- Description : ${description}

**Structure attendue (4 paragraphes, 350 mots max) :**
1. Accroche directe : pourquoi ce poste chez cette entreprise spécifiquement (utiliser des éléments de la description)
2. Ce que Mohammed apporte concrètement : compétences techniques + projets réalisés qui prouvent sa capacité à livrer
3. La valeur ajoutée de son parcours atypique : 5 ans de management = rigueur, autonomie, gestion de projets, travail en équipe. C'est rare chez un dev junior.
4. Projection : le stage comme point de départ d'une collaboration durable (mention naturelle de l'alternance possible en sept 2026)

Écris UNIQUEMENT le corps de la lettre. Pas de "Madame, Monsieur," ni de signature.`;

  try {
    return await callGrok(prompt, SYSTEM_PROMPT);
  } catch (error) {
    console.error("Error generating letter with Grok:", error);
    throw error;
  }
}

export async function generateLettreFromAbout(
  entreprise: string,
  aboutText: string,
  poste?: string
): Promise<string> {
  const posteInfo = poste
    ? `- Poste visé : ${poste}`
    : `- Type : Candidature spontanée pour un stage développeur`;

  const prompt = `Rédige le corps d'une lettre de motivation pour cette candidature :

${PROFIL_CONTEXT}

**Entreprise ciblée :**
- Nom : ${entreprise}
${posteInfo}
- Informations sur l'entreprise (page "À propos") :
${aboutText.substring(0, 1500)}

**Structure attendue (4 paragraphes, 350 mots max) :**
1. Accroche qui montre une vraie connaissance de l'entreprise (citer des éléments concrets du "à propos" : secteur, produits, valeurs, clients)
2. Ce que Mohammed apporte techniquement : stack maîtrisée, projets concrets livrés, capacité à être opérationnel rapidement
3. Son parcours atypique comme avantage compétitif : manager pendant 5 ans = il sait gérer les priorités, communiquer en équipe, tenir des deadlines. Un dev qui comprend le business, c'est rare.
4. Vision : le stage comme début d'une collaboration, avec la perspective naturelle d'une alternance en sept 2026 et d'une montée en compétences continue (CNAM ingénieur)

Personnalise au maximum avec les infos de l'entreprise. Sois spécifique, pas générique.
Écris UNIQUEMENT le corps de la lettre. Pas de "Madame, Monsieur," ni de signature.`;

  try {
    return await callGrok(prompt, SYSTEM_PROMPT);
  } catch (error) {
    console.error("Error generating letter from about with Grok:", error);
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
