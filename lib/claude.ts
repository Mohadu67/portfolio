import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY environment variable is not set");
}

const client = new Anthropic({ apiKey });

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

  const prompt = `
Tu es un expert en rédaction de lettres de motivation. Génère une lettre personnalisée basée sur ces informations:

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
- Pas de formule de politesse finale (pas de "Cordialement")

**Instructions:**
La lettre DOIT mentionner:
1. Le besoin d'un stage de 3 mois pour valider l'année de bachelier CDA
2. C'est une opportunité pour montrer son potentiel et ses capacités
3. L'intérêt pour une alternance en septembre 2026
4. La perspective d'intégrer le programme d'ingénieur au CNAM
5. Pourquoi cette entreprise et ce poste correspondent à son projet professionnel

Rends la lettre personnelle, ambitieuse et motivée, tout en gardant un ton professionnel.
`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textContent = message.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in response");
  }

  return textContent.text;
}
