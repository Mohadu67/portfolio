import { Schema, model, models } from "mongoose";

// Mémoire personnelle persistante de l'agent : faits sur Mohammed (identité, parcours,
// école, personnalité, préférences, objectifs) appris au fil des conversations et injectés
// dans le system prompt à chaque tour. C'est ce qui fait de l'agent un conseiller
// personnalisé plutôt qu'un chatbot amnésique.

export type AgentMemoryCategory =
  | "identite"
  | "parcours"
  | "ecole"
  | "personnalite"
  | "preferences"
  | "objectifs"
  | "autre";

export const AGENT_MEMORY_CATEGORIES: AgentMemoryCategory[] = [
  "identite",
  "parcours",
  "ecole",
  "personnalite",
  "preferences",
  "objectifs",
  "autre",
];

export interface IAgentMemory {
  _id?: string;
  category: AgentMemoryCategory;
  fact: string;
  // "user" = dit explicitement par Mohammed ; "deduit" = inféré par l'agent.
  source: "user" | "deduit" | "seed";
  created_at: Date;
  updated_at: Date;
}

const agentMemorySchema = new Schema<IAgentMemory>(
  {
    category: {
      type: String,
      enum: AGENT_MEMORY_CATEGORIES,
      default: "autre",
      index: true,
    },
    fact: { type: String, required: true },
    source: { type: String, enum: ["user", "deduit", "seed"], default: "user" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const AgentMemory = models.AgentMemory || model<IAgentMemory>("AgentMemory", agentMemorySchema);

// Normalisation pour la dédup : casse, accents et ponctuation neutralisés.
export function normalizeFact(fact: string): string {
  return fact
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
