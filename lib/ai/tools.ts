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
      "Lance le pipeline de candidature spontanée pour une entreprise : scrape la home + page about, score qualité via IA, extrait l'email RH (filtre whitelist), génère la lettre de motivation, crée la candidature en DB et envoie le mail avec CV + LM. Requiert l'URL du site de l'entreprise. À utiliser quand l'utilisateur demande explicitement d'envoyer/préparer une candidature à une URL précise.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL complète du site de l'entreprise cible (https://...). Pas l'URL d'une offre, le site corporate.",
        },
        country: {
          type: "string",
          enum: ["fr", "de", "ch", "be", "lu", "at", "nl"],
          description: "Pays de l'entreprise (défaut: fr). Peut orienter le scoring et la langue de la lettre quand c'est pertinent.",
        },
        type: {
          type: "string",
          enum: ["stage", "alternance", "cdi"],
          description: "Type de candidature visé (défaut: alternance). Adapte le 1er paragraphe de la lettre.",
        },
        letter_instruction: {
          type: "string",
          description:
            "OBLIGATOIRE dès que l'utilisateur exprime un angle, une envie ou des éléments à inclure. Contient INTEGRALEMENT sa consigne (ex: 'insiste sur mon profil chef de projet, mentionne mon master manager en ingénierie informatique, dis que j'ai obtenu mon Bachelor, parle de leur site que je trouve super, dis que j'aimerais rejoindre leur aventure'). Ne résume pas — reprends ses mots-clés.",
        },
        dry_run: {
          type: "boolean",
          description: "OBLIGATOIREMENT true en premier pour montrer l'aperçu. Seul l'envoi réel (validation utilisateur) se fait avec dry_run=false.",
        },
        skip_quality_score: {
          type: "boolean",
          description: "Bypass le scoring qualité Gemini. En mode dry_run, mettre true dès que l'utilisateur a explicitement demandé de postuler à cette URL — cela évite de lui demander une confirmation inutile. Pour l'envoi réel, respecter son choix.",
        },
        allow_duplicate: {
          type: "boolean",
          description: "Forcer même si le domaine a déjà été contacté (rare).",
        },
        allow_generic_email: {
          type: "boolean",
          description: "Autorise l'envoi à un email générique (contact@, info@...) du domaine. En mode dry_run, mettre true dès que l'utilisateur demande de postuler et qu'aucun email nominatif n'est trouvé — cela évite un blocage inutile. Ne bypass jamais les emails blacklist (noreply@, abuse@, support@...).",
        },
        email_override: {
          type: "string",
          description: "Email destinataire saisi explicitement par l'utilisateur — bypass total du picker auto. À utiliser quand un email valable a été trouvé mais que le filtre auto le rejette.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "parse_email",
    description:
      "Analyse un message collé ou forwardé par l'utilisateur pour en extraire les métadonnées : type (offre / réponse recruteur / forward / inconnu), entreprise, poste, email de contact, URL, localisation, instructions libres et URLs de contexte. À utiliser DÈS QUE l'utilisateur colle un bloc ressemblant à un email, ou qu'il fournit un email + instructions + URLs.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        raw_text: {
          type: "string",
          description: "Texte brut envoyé par l'utilisateur (peut mélanger email, instructions et URLs).",
        },
        user_instruction: {
          type: "string",
          description: "Instruction libre explicite de l'utilisateur (optionnel — parse_email essaie aussi de l'extraire du texte).",
        },
      },
      required: ["raw_text"],
    },
  },
  {
    name: "apply_from_email",
    description:
      "Prépare et envoie une candidature à partir d'un email ou d'instructions textuelles. Scrape l'entreprise et les pages de contexte (ex: master), génère la lettre avec les consignes, puis propose l'envoi (validation Telegram obligatoire). Par défaut : dry_run=true pour montrer la lettre AVANT d'envoyer. À utiliser quand l'utilisateur dit 'postule à cette adresse', 'envoie une candidature à cet email', ou après parse_email quand le type est 'offre'.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        email_content: {
          type: "string",
          description: "Contenu brut du message/email de l'utilisateur.",
        },
        country: {
          type: "string",
          enum: ["fr", "de", "ch", "be", "lu", "at", "nl"],
          description: "Pays où se situe l'entreprise ou l'offre (défaut: fr).",
        },
        letter_instruction: {
          type: "string",
          description: "OBLIGATOIRE dès que l'utilisateur exprime un angle. Contient INTEGRALEMENT sa consigne (ne pas résumer).",
        },
        type: {
          type: "string",
          enum: ["stage", "alternance", "cdi"],
          description: "Type de candidature visé (défaut: alternance).",
        },
        email_override: {
          type: "string",
          description: "Email destinataire fourni explicitement par l'utilisateur. Si vide, l'IA tente de le résoudre depuis le site.",
        },
        company_url: {
          type: "string",
          description: "URL du site de l'entreprise ou de l'offre si connue.",
        },
        context_urls: {
          type: "array",
          items: { type: "string" },
          description: "URLs de contexte à scraper pour enrichir la lettre (ex: page de la formation/master).",
        },
        dry_run: {
          type: "boolean",
          description: "OBLIGATOIREMENT true en premier pour montrer l'aperçu. Seul l'envoi réel se fait avec dry_run=false.",
        },
        skip_quality_score: {
          type: "boolean",
          description: "Bypass le scoring qualité Gemini. Mettre true en dry_run dès que l'utilisateur a explicitement demandé de postuler.",
        },
        allow_duplicate: {
          type: "boolean",
          description: "Forcer même si le domaine a déjà été contacté (rare).",
        },
        allow_generic_email: {
          type: "boolean",
          description: "Autorise l'envoi à un email générique du domaine. Mettre true en dry_run si aucun email nominatif n'est trouvé.",
        },
      },
      required: ["email_content"],
    },
  },
  {
    name: "draft_email_reply",
    description:
      "Rédige une réponse à un recruteur à partir d'un email reçu et d'instructions. Si candidature_id est fourni, la réponse sera envoyée dans le thread existant. Sinon, prépare un brouillon à envoyer manuellement. À utiliser quand l'utilisateur colle une réponse de RH et demande de répondre.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: {
          type: "string",
          description: "ID MongoDB de la candidature liée (permet d'envoyer dans le thread).",
        },
        email_content: {
          type: "string",
          description: "Contenu du mail reçu (obligatoire si candidature_id non fourni).",
        },
        reply_instruction: {
          type: "string",
          description: "Consigne pour la réponse (ex: 'dis que je suis dispo mardi et jeudi après-midi', 'demande plus de détails sur le poste').",
        },
      },
    },
  },
  {
    name: "read_email_response",
    description:
      "Lit et résume les emails reçus d'un recruteur pour une candidature donnée. À utiliser quand l'utilisateur demande 'Ils disent quoi ?', 'Cela dit quoi ?', 'quelle est la réponse de X ?'. Retourne le contenu résumé, la catégorie (refus, entretien, demande d'infos...) et une proposition de réponse si pertinent.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: {
          type: "string",
          description: "ID MongoDB de la candidature concernée",
        },
        mark_read: {
          type: "boolean",
          description: "Si true, marque les emails résumés comme lus/archivés (défaut: true)",
        },
      },
      required: ["candidature_id"],
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
      "Recherche d'offres d'emploi EN DIRECT sur les job boards (JSearch, Adzuna, France Travail, Indeed) par mots-clés + localisation + pays. Dédoublonne les résultats et indique si l'offre est déjà dans le pipeline. Lecture seule — ne crée rien en base. À utiliser quand l'utilisateur demande « cherche des offres », « il y a quoi comme alternances dev en Suisse ? ». Pour suivre une offre trouvée : create_candidature.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "Mots-clés de recherche (ex: 'développeur fullstack alternance')" },
        location: { type: "string", description: "Ville/région (défaut : Strasbourg)" },
        country: { type: "string", enum: ["fr", "de", "ch", "be", "lu", "at", "nl"], description: "Pays de recherche (défaut : fr)" },
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
        country: { type: "string", enum: ["fr", "de", "ch", "be", "lu", "at", "nl"], description: "Pays de l'entreprise (défaut : fr)" },
        url: { type: "string", description: "URL de l'offre ou du site entreprise (optionnel — un placeholder unique est généré sinon)" },
        email: { type: "string", description: "Email de contact si connu (optionnel)" },
        localisation: { type: "string", description: "Ville (optionnel)" },
        description: { type: "string", description: "Description de l'offre/l'entreprise (optionnel)" },
        notes: { type: "string", description: "Notes libres (optionnel)" },
        letter_instruction: {
          type: "string",
          description: "Consigne pour orienter la future lettre de motivation de cette candidature (optionnel)",
        },
      },
      required: ["entreprise"],
    },
  },
  {
    name: "write_letter",
    description:
      "(Ré)génère la lettre de motivation d'une candidature avec une consigne libre (« insiste sur le management », « plus court », « mentionne le produit X ») et retourne le texte complet. La lettre reste basée sur le template (accroche + conclusion fixes, paragraphe central généré). Chaque version est archivée — on peut itérer sans rien perdre. Montre TOUJOURS le résultat à l'utilisateur. Rien n'est envoyé.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string", description: "ID MongoDB de la candidature" },
        instruction: {
          type: "string",
          description:
            "Consigne de rédaction (remplace la précédente et est persistée). Vide = régénère avec la consigne déjà enregistrée.",
        },
      },
      required: ["candidature_id"],
    },
  },
  {
    name: "set_lettre",
    description:
      "Enregistre une lettre de motivation COMPLÈTE rédigée sur mesure (hors template) comme lettre de la candidature — c'est elle qui partira à l'envoi. À utiliser quand tu as rédigé une lettre en conversation avec l'utilisateur et qu'il l'a validée EXPLICITEMENT. Ne jamais appeler sans avoir montré la lettre. La version précédente est archivée (récupérable).",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string", description: "ID MongoDB de la candidature" },
        lettre: { type: "string", description: "Texte complet de la lettre (corps uniquement, sans objet ni signature ajoutés par le mail)" },
      },
      required: ["candidature_id", "lettre"],
    },
  },
  {
    name: "set_email_body",
    description:
      "Enregistre un CORPS DE MAIL sur mesure pour une candidature : c'est ce texte (au lieu du modèle générique) qui accompagnera le CV + la lettre à l'envoi. À utiliser quand tu as rédigé le mail en conversation et que l'utilisateur l'a validé EXPLICITEMENT — ne jamais appeler sans avoir montré le texte. Texte brut, SANS « Bonjour » ni signature (ajoutés automatiquement à l'envoi). reset=true pour revenir au modèle par défaut.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string", description: "ID MongoDB de la candidature" },
        texte: { type: "string", description: "Corps du mail (2-5 phrases), sans salutation ni signature" },
        reset: { type: "boolean", description: "true → supprime le corps sur mesure, retour au modèle par défaut" },
      },
      required: ["candidature_id"],
    },
  },
  {
    name: "send_letter_to_me",
    description:
      "Envoie une lettre de motivation sur la boîte mail PERSO de l'utilisateur (PDF officiel joint + texte copiable dans le corps, CV joint par défaut) — pour postuler MANUELLEMENT sur une plateforme (LinkedIn, Indeed, formulaire ATS…). Deux modes : candidature_id → lettre de la candidature (générée si absente) ; OU lettre = texte complet fourni/rédigé en conversation, avec entreprise (+ poste) pour l'en-tête du PDF. N'envoie RIEN à l'entreprise — destinataire fixe : l'adresse perso configurée côté serveur.",
    requiresConfirmation: false,
    input_schema: {
      type: "object",
      properties: {
        candidature_id: { type: "string", description: "ID de la candidature dont utiliser la lettre (optionnel si `lettre` fourni)" },
        lettre: { type: "string", description: "Texte complet de la lettre (corps uniquement) — mode texte libre" },
        entreprise: { type: "string", description: "Nom de l'entreprise pour l'en-tête du PDF (requis en mode texte libre)" },
        poste: { type: "string", description: "Poste visé (défaut : Candidature spontanée)" },
        type: {
          type: "string",
          enum: ["stage", "alternance", "cdi"],
          description: "Type visé — choisit le CV joint (défaut : type de la candidature, sinon alternance)",
        },
        include_cv: { type: "boolean", description: "Joindre le CV (défaut : true)" },
      },
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
  {
    name: "dismiss_pending_proposals",
    description:
      "Ignore d'un coup plusieurs propositions d'action en attente de validation Telegram. Utile quand l'utilisateur veut vider son backlog (ex: 'tout ignorer', 'ignore les propositions de prospection'). Par défaut n'ignore que les propositions d'origine prospection et blackliste leurs domaines pour ne pas les reproposer.",
    requiresConfirmation: true,
    input_schema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          enum: ["prospection", "agent", "all"],
          description: "Quelles propositions ignorer (défaut: prospection)",
        },
        blacklist_domains: {
          type: "boolean",
          description: "Si true, blackliste les domaines des propositions prospection ignorées (défaut: true)",
        },
        max_count: {
          type: "number",
          description: "Nombre max à ignorer (défaut: 100, pour éviter les accidents)",
        },
      },
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
