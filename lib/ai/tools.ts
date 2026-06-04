type JSONSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JSONSchema;
  /** If true, requires user confirmation in the UI before execution. */
  requiresConfirmation: boolean;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "list_candidatures",
    description:
      "Liste les candidatures (résumé léger : _id, entreprise, poste, statut, type, date). Utiliser pour trouver des candidatures avant d'utiliser get_candidature ou les tools d'action. Filtrer par statut ou par recherche textuelle (entreprise/poste).",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        statut: {
          type: "string",
          description: "Filtrer par statut exact (optionnel)",
          enum: ["identifiée", "lettre générée", "postulée", "réponse reçue", "entretien", "refus", "acceptée"],
        },
        search: {
          type: "string",
          description: "Recherche insensible à la casse sur entreprise et poste (optionnel)",
        },
        limit: {
          type: "number",
          description: "Nombre max de résultats (défaut 15, max 50). Utilise un filtre statut ou search pour cibler.",
        },
      },
    },
  },
  {
    name: "get_candidature",
    description:
      "Détail complet d'une candidature : description offre, notes, lettre, historique des relances, emails envoyés. À appeler quand l'utilisateur pose une question précise sur UNE candidature identifiée.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string", description: "ID MongoDB de la candidature" },
      },
      required: ["candidature_id"],
    },
  },
  {
    name: "list_relances_due",
    description:
      "Liste les relances programmées (status='programmée'), triées par date. Utile pour répondre 'que dois-je faire aujourd'hui' ou 'quelles relances cette semaine'.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        before_date: {
          type: "string",
          description: "Filtrer relances dont scheduledFor <= cette date ISO (optionnel, défaut +30 jours)",
        },
      },
    },
  },
  {
    name: "list_cv_sections",
    description: "Liste les sections du CV (key, type, title) sans le contenu. Pour découvrir ce qui est disponible.",
    requiresConfirmation: false,
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_cv_section",
    description: "Récupère le contenu complet d'une section du CV par sa key.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key de la section (ex: 'profile', 'experiences', 'skills')" },
      },
      required: ["key"],
    },
  },
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
    name: "apply_to_company",
    description:
      "Lance le pipeline de candidature spontanée pour une entreprise : scrape la home + page about, score qualité via IA, extrait l'email RH (filtre whitelist), génère la lettre de motivation, crée la candidature en DB et envoie le mail avec CV + LM. Requiert l'URL du site de l'entreprise. À utiliser UNIQUEMENT quand l'utilisateur demande explicitement d'envoyer une candidature à une URL précise.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL complète du site de l'entreprise cible (https://...). Pas l'URL d'une offre, le site corporate.",
        },
        type: {
          type: "string",
          enum: ["stage", "alternance", "cdi"],
          description: "Type de candidature visé (défaut: stage). Adapte le 1er paragraphe de la lettre.",
        },
        dry_run: {
          type: "boolean",
          description: "Si true : génère tout (scrape, lettre, choix email) mais N'ENVOIE PAS le mail. Utile pour vérifier avant de valider.",
        },
        skip_quality_score: {
          type: "boolean",
          description: "Bypass le scoring qualité Gemini (sinon refuse les boîtes notées < 0.3). À utiliser si l'utilisateur insiste explicitement.",
        },
        allow_duplicate: {
          type: "boolean",
          description: "Forcer même si le domaine a déjà été contacté (rare).",
        },
        allow_generic_email: {
          type: "boolean",
          description: "Si true, autorise l'envoi à un email générique (contact@, info@, hello@, bonjour@) quand aucun email RH nominatif n'est trouvé, à condition que le domaine de l'email match celui de l'entreprise. Ne bypass JAMAIS les emails blacklist (noreply@, abuse@, support@…). À utiliser uniquement après un premier échec, sur insistance explicite de l'utilisateur.",
        },
        email_override: {
          type: "string",
          description: "Email destinataire saisi explicitement par l'utilisateur — bypass total du picker auto (whitelist + loose). À utiliser quand un email valable a été trouvé mais que le filtre auto le rejette (ex: domaine 'frère' comme strasbourg@etudeplus.org pour le site etudeplusstrasbourg.fr). Ignoré si vide. Validation basique sur le format. Toujours demander confirmation explicite de l'utilisateur avant d'utiliser ce flag.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "process_pending_candidatures",
    description:
      "Lance le pipeline F3 (process pending) sur les candidatures statut 'identifiée' : pour chacune, scrape best-effort + résolution SerpAPI si besoin, génère lettre, envoie. Utiliser quand l'utilisateur demande de relancer/traiter les candidatures en attente ou veut vider le backlog. Respecte le rate-limit Gmail global.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Liste optionnelle d'IDs de candidatures à traiter. Si vide → toutes les candidatures statut 'identifiée'.",
        },
        force: {
          type: "boolean",
          description: "Si true, bypass le seuil aboutText < 100 chars (cas A). Utiliser quand l'utilisateur insiste explicitement.",
        },
        dry_run: {
          type: "boolean",
          description: "Si true, génère la lettre et choisit l'email mais N'ENVOIE PAS le mail. Utile pour vérifier avant validation.",
        },
      },
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

import type { Tool } from "@google/generative-ai";

/**
 * Convert tool definitions to Gemini-native format (functionDeclarations).
 * Tools without parameters must omit `parameters` entirely — Gemini rejects empty `properties: {}`.
 * Cast at boundary: SDK types use `SchemaType` enum but accept the equivalent string literals at runtime.
 */
export function toolsForGemini(): Tool[] {
  const functionDeclarations = TOOLS.map(({ name, description, input_schema }) => {
    const hasProps = input_schema.properties && Object.keys(input_schema.properties).length > 0;
    return {
      name,
      description,
      ...(hasProps ? { parameters: input_schema } : {}),
    };
  });
  return [{ functionDeclarations }] as unknown as Tool[];
}

export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
