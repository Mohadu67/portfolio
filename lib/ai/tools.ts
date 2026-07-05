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
    name: "schedule_telegram_reminder",
    description:
      "Programme un rappel Telegram one-shot (message envoyé à l'heure dite, à ±30 min près). Pour « rappelle-moi de préparer l'entretien lundi », le suivi d'un événement, une échéance. Ce n'est PAS une relance email (pour ça : schedule_relance).",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        when: { type: "string", description: "Date/heure ISO 8601 du rappel (ex: 2026-07-06T18:00:00+02:00)" },
        message: { type: "string", description: "Texte du rappel (contextualisé : entreprise, quoi préparer…)" },
      },
      required: ["when", "message"],
    },
  },
  {
    name: "remember_fact",
    description:
      "Mémorise durablement un fait sur l'utilisateur (identité, parcours, école, personnalité, préférences, objectifs). À appeler PROACTIVEMENT dès que l'utilisateur révèle une info personnelle durable (« je rentre à l'école X », « je préfère les petites boîtes », « j'ai eu mon titre CDA »). Ne pas mémoriser l'éphémère (humeur du jour, question ponctuelle). Le fait doit être une phrase autonome et factuelle.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["identite", "parcours", "ecole", "personnalite", "preferences", "objectifs", "autre"],
          description: "Catégorie du fait",
        },
        fact: { type: "string", description: "Le fait, formulé en une phrase autonome (ex: « Intègre l'école Epitech Strasbourg en septembre 2026, rythme 3 semaines entreprise / 1 semaine école »)" },
      },
      required: ["category", "fact"],
    },
  },
  {
    name: "forget_fact",
    description: "Supprime un fait mémorisé devenu faux ou indésirable. Utiliser l'_id retourné par list_memory.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        fact_id: { type: "string", description: "_id du fait à supprimer (via list_memory)" },
      },
      required: ["fact_id"],
    },
  },
  {
    name: "list_memory",
    description: "Liste tout ce que l'agent sait de l'utilisateur (mémoire persistante, avec _id et catégorie). Utiliser quand l'utilisateur demande « qu'est-ce que tu sais sur moi ? » ou avant de corriger/supprimer un fait.",
    requiresConfirmation: false,
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "research_company",
    description:
      "Enquête sur une entreprise : résout son site officiel (SerpAPI), scrape sa présentation et sa page carrières (offres d'emploi publiées), score son adéquation avec le profil (Gemini), et vérifie si elle a déjà été contactée. À utiliser quand l'utilisateur parle d'une boîte : « c'est quoi X ? », « est-ce que X a des postes ? », « tu penses quoi de X ? ». Lecture seule — propose ensuite apply_to_company si pertinent.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        entreprise: { type: "string", description: "Nom de l'entreprise (utilisé pour résoudre le site officiel si url absent)" },
        url: { type: "string", description: "URL du site officiel si connue (https://…) — évite la résolution SerpAPI" },
        localisation: { type: "string", description: "Ville pour aider la résolution (défaut : Strasbourg)" },
      },
    },
  },
  {
    name: "list_pending_approvals",
    description:
      "Liste les auto-réponses IA en attente de validation Telegram (human-in-the-loop) : entreprise, catégorie détectée, confiance, expéditeur, extrait de la réponse préparée. Utiliser quand l'utilisateur demande ce qui est en attente de validation/approbation.",
    requiresConfirmation: false,
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "resend_pending_approval",
    description:
      "Renvoie sur Telegram le message d'approbation (avec boutons ✅ Envoyer / ❌ Rejeter) d'une auto-réponse en attente pour une candidature donnée. Utiliser quand l'utilisateur veut revoir/décider une validation en attente.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string", description: "ID MongoDB de la candidature concernée" },
      },
      required: ["candidature_id"],
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
  {
    name: "search_offers",
    description:
      "Recherche d'offres d'emploi EN DIRECT sur les job boards (JSearch, Adzuna, France Travail, Indeed) par mots-clés + localisation. Dédoublonne les résultats et indique si l'offre est déjà dans le pipeline. Lecture seule — ne crée rien en base. À utiliser quand l'utilisateur demande « cherche des offres », « il y a quoi comme alternances dev en ce moment ? ». Pour suivre une offre trouvée : create_candidature.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "Mots-clés de recherche (ex: 'développeur fullstack alternance')" },
        location: { type: "string", description: "Ville/région (défaut : Strasbourg)" },
        limit: { type: "number", description: "Nombre max de résultats après dédoublonnage (défaut 10, max 20)" },
      },
      required: ["keywords"],
    },
  },
  {
    name: "get_lettre",
    description:
      "Récupère le texte complet de la lettre de motivation générée pour une candidature, plus le dernier email envoyé (destinataire, sujet, statut). À utiliser quand l'utilisateur veut voir/relire la lettre ou vérifier ce qui est parti (« montre-moi la lettre », « qu'est-ce que tu as envoyé à X ? »).",
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
    name: "get_stats",
    description:
      "Statistiques du pipeline de candidatures : total et répartition par statut, envois sur 7 et 30 jours, réponses reçues, relances programmées, auto-réponses en attente de validation, rappels à venir. À utiliser pour « où j'en suis ? », « bilan de la semaine », « ça avance ? ».",
    requiresConfirmation: false,
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_reminders",
    description:
      "Liste les rappels Telegram programmés non encore envoyés (message + date). À utiliser quand l'utilisateur demande ses rappels ou avant d'en annuler un (cancel_reminder).",
    requiresConfirmation: false,
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancel_reminder",
    description:
      "Annule (supprime) un rappel Telegram programmé non envoyé. Utiliser le due_at EXACT retourné par list_reminders.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        due_at: { type: "string", description: "Date ISO exacte du rappel (champ dueAt de list_reminders)" },
        message_contains: { type: "string", description: "Filtre optionnel : sous-chaîne du message, si plusieurs rappels à la même heure" },
      },
      required: ["due_at"],
    },
  },
  {
    name: "list_blacklist",
    description:
      "Liste les domaines écartés par la prospection automatique (raison du skip, score, date de réévaluation). À utiliser pour « pourquoi tu ne proposes plus X ? », « quels domaines sont bloqués ? ». Pour en réactiver un : unblacklist_domain.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Filtre sur le domaine ou le nom d'entreprise (optionnel)" },
        limit: { type: "number", description: "Nombre max de résultats (défaut 20, max 50)" },
      },
    },
  },
  {
    name: "unblacklist_domain",
    description:
      "Retire un domaine de la blacklist de prospection : il redevient éligible à l'évaluation automatique et à apply_to_company. Utiliser le domaine exact retourné par list_blacklist.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domaine racine sans www (ex: 'divalto.fr')" },
      },
      required: ["domain"],
    },
  },
  {
    name: "create_candidature",
    description:
      "Crée manuellement une candidature dans le pipeline SANS rien envoyer. Pour suivre une offre trouvée via search_offers, une entreprise repérée ailleurs (LinkedIn, bouche-à-oreille, salon) ou préparer une cible à travailler. L'envoi se fait ensuite via apply_to_company (site corporate) ou process_pending_candidatures.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        entreprise: { type: "string", description: "Nom de l'entreprise" },
        poste: { type: "string", description: "Intitulé du poste (défaut : 'Candidature spontanée')" },
        type: { type: "string", enum: ["stage", "alternance", "cdi"], description: "Type visé (défaut : alternance)" },
        url: { type: "string", description: "URL de l'offre ou du site entreprise (optionnel — un placeholder unique est généré sinon)" },
        email: { type: "string", description: "Email de contact si connu (optionnel)" },
        localisation: { type: "string", description: "Ville (optionnel)" },
        description: { type: "string", description: "Description de l'offre/l'entreprise (optionnel)" },
        notes: { type: "string", description: "Notes libres (optionnel)" },
      },
      required: ["entreprise"],
    },
  },
  {
    name: "delete_candidature",
    description:
      "Supprime DÉFINITIVEMENT une candidature (test, doublon, entrée erronée). Irréversible : lettre, historique de relances et d'emails perdus. Typiquement pour nettoyer après un test apply_to_company (le dry-run persiste la candidature en base). Ne blackliste PAS le domaine : la prospection automatique pourra re-proposer l'entreprise.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string", description: "ID MongoDB de la candidature à supprimer" },
      },
      required: ["candidature_id"],
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
