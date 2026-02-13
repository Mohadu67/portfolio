import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateLettre(
  entreprise: string,
  poste: string,
  description: string
): Promise<string> {
  const profil = {
    nom: process.env.PROFIL_NOM,
    formation: process.env.PROFIL_FORMATION,
    competences: process.env.PROFIL_COMPETENCES,
    experience: process.env.PROFIL_EXPERIENCE,
    recherche: process.env.PROFIL_RECHERCHE,
    dispo: process.env.PROFIL_DISPO,
  };

  const prompt = `
Tu es un expert en rédaction de lettres de motivation. Génère une lettre personnalisée basée sur ces informations:

**Candidat:**
- Nom: ${profil.nom}
- Formation: ${profil.formation}
- Compétences: ${profil.competences}
- Expérience: ${profil.experience}

**Offre:**
- Entreprise: ${entreprise}
- Poste: ${poste}
- Description: ${description}

**Contraintes:**
- Langue: Français
- Format: 3 paragraphes
- Max 320 mots
- Ton: Professionnel et enthousiaste
- Pas de formule de politesse finale (pas de "Cordialement")

La lettre doit montrer pourquoi le candidat est intéressé par cette entreprise et ce poste spécifiquement.
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
