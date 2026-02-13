const apiKey = process.env.GROK_API_KEY;
if (!apiKey) {
  throw new Error("GROK_API_KEY environment variable is not set");
}

// Use OpenAI-compatible API for Grok via xAI
const GROK_API_URL = "https://api.x.ai/v1";

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
      model: "grok-2",
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

export async function generateLettre(
  entreprise: string,
  poste: string,
  description: string
): Promise<string> {
  const profil = {
    nom: process.env.PROFIL_NOM || "Mohammed Hamiani",
    formation: process.env.PROFIL_FORMATION || "Concepteur Développeur Fullstack",
    competences: process.env.PROFIL_COMPETENCES || "JavaScript, React, Node.js, Python, SQL, Git, Docker",
    experience: process.env.PROFIL_EXPERIENCE || "Projets fullstack, UI/UX design, développement web moderne",
    recherche: process.env.PROFIL_RECHERCHE || "Stage développeur fullstack / web",
    dispo: process.env.PROFIL_DISPO || "Dès que possible",
  };

  const systemPrompt = `Tu es un expert en rédaction de lettres de motivation hautement personnalisées et convaincantes.
Tu dois générer des lettres professionnelles qui mettent en avant les compétences et la motivation du candidat.
Sois créatif mais professionnel, enthousiaste mais crédible.`;

  const prompt = `Génère une lettre de motivation personnalisée pour cette candidature:

**Candidat:**
- Nom: ${profil.nom}
- Formation: ${profil.formation} (Bachelier CDA - Concepteur Développeur d'Application)
- Compétences: ${profil.competences}
- Expérience: ${profil.experience}
- Objectifs: Stage de 3 mois pour valider l'année de bachelier CDA + Alternance à partir de septembre 2026
- Statut: Admissible au CNAM pour titre d'ingénieur

**Offre:**
- Entreprise: ${entreprise}
- Poste: ${poste}
- Description: ${description}

**Contraintes:**
- Langue: Français
- Format: 3 paragraphes
- Max 320 mots
- Ton: Professionnel, enthousiaste et déterminé

**La lettre DOIT couvrir:**
1. Le besoin d'un stage de 3 mois pour valider l'année de bachelier CDA
2. Une opportunité pour montrer son potentiel et ses capacités
3. L'intérêt pour une alternance en septembre 2026
4. La perspective d'intégrer le programme d'ingénieur au CNAM
5. Pourquoi cette entreprise et ce poste correspondent au projet professionnel

Génère UNIQUEMENT la lettre, sans introduction ni explication.`;

  try {
    return await callGrok(prompt, systemPrompt);
  } catch (error) {
    console.error("Error generating letter with Grok:", error);
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
