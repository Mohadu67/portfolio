import Anthropic from "@anthropic-ai/sdk";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
  /** If true, requires user confirmation in the UI before execution. */
  requiresConfirmation: boolean;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "schedule_relance",
    description:
      "Programme une relance pour une candidature à une date donnée. À utiliser quand l'utilisateur demande de programmer/planifier/relancer.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: {
          type: "string",
          description: "ID MongoDB de la candidature concernée (visible dans le contexte sous _id)",
        },
        scheduled_for: {
          type: "string",
          description: "Date d'envoi ISO 8601 (ex: 2026-05-02T10:00:00Z)",
        },
        title: {
          type: "string",
          description: "Titre/sujet de la relance (ex: 'Relance polie J+7')",
        },
        message: {
          type: "string",
          description:
            "Corps du message. Tu peux utiliser les variables {entreprise} {poste} {type} {prenom} qui seront substituées à l'envoi.",
        },
      },
      required: ["candidature_id", "scheduled_for", "message"],
    },
  },
  {
    name: "cancel_relance",
    description: "Annule une relance programmée (ne supprime pas, marque comme annulée).",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string", description: "ID de la candidature" },
        relance_index: { type: "number", description: "Index de la relance dans relanceHistory[]" },
      },
      required: ["candidature_id", "relance_index"],
    },
  },
  {
    name: "update_candidature_status",
    description:
      "Met à jour le statut d'une candidature (identifiée, lettre générée, postulée, réponse reçue, entretien, refus, acceptée).",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string" },
        statut: {
          type: "string",
          enum: ["identifiée", "lettre générée", "postulée", "réponse reçue", "entretien", "refus", "acceptée"],
        },
      },
      required: ["candidature_id", "statut"],
    },
  },
  {
    name: "update_candidature_notes",
    description: "Met à jour les notes (texte libre) d'une candidature.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string" },
        notes: { type: "string", description: "Nouvelles notes (remplace les existantes)" },
      },
      required: ["candidature_id", "notes"],
    },
  },
  {
    name: "send_relance_now",
    description: "Envoie immédiatement une relance par email (si l'email destinataire est connu).",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string" },
        title: { type: "string" },
        message: { type: "string" },
      },
      required: ["candidature_id", "message"],
    },
  },
];

export function toolsForAnthropic(): Anthropic.Tool[] {
  return TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
}

export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
