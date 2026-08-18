// Agent IA conversationnel du bot Telegram : mêmes tools que le Chat IA du dashboard,
// avec confirmation par boutons ✅/❌ pour les tools d'action (human-in-the-loop).
// Entrées : messages texte reçus par le webhook. Sorties : sendMessage Telegram.

import { randomBytes } from "crypto";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { connectDB } from "./mongodb";
import { Candidature, ICandidature } from "@/models/Candidature";
import { AgentMemory, IAgentMemory } from "@/models/AgentMemory";
import { recordProspectSkip } from "@/models/ProspectedDomain";
import { getTelegramState, ITelegramPendingAction, TelegramState } from "@/models/TelegramState";
import { buildContextLite } from "./ai/context";
import { toolsForGemini, getTool } from "./ai/tools";
import { executeTool, isTruthyFlag, ToolRunResult } from "./ai/tool-runner";
import { getSettings } from "@/models/Settings";
import {
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
  sendTelegramChatAction,
  sendTelegramAudio,
  getTelegramFileAsBase64,
} from "./telegram";
import { logTelegramEvent } from "./telegram-log";

const MODEL = process.env.CHAT_MODEL ?? "gemini-2.5-flash";
const MAX_TOOL_ROUNDS = 6;
const CONVERSATION_WINDOW = 32;

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(apiKey: string): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

export const TELEGRAM_HELP_TEXT = [
  "🤖 Agent Cockpit — parle-moi normalement (texte ou vocal 🎤) :",
  "",
  "• « qu'est-ce qui est en attente de validation ? »",
  "• « liste mes candidatures postulées »",
  "• « où j'en suis cette semaine ? » (stats du pipeline)",
  "• « cherche des offres alternance dev à Strasbourg »",
  "• « c'est quoi comme boîte Divalto ? ils recrutent ? »",
  "• « envoie une candidature à https://entreprise.fr en insistant sur mon profil chef de projet »",
  "• « montre-moi la lettre envoyée à Divalto » / « refais-la plus courte »",
  "• « écris-moi une lettre sur mesure pour Extia, on en discute d'abord »",
  "• « rédige aussi le mail d'accompagnement, je veux le valider avant »",
  "• « envoie-moi la lettre sur ma boîte mail » (PDF + CV, pour postuler à la main)",
  "• « ajoute une candidature chez X, poste dev fullstack »",
  "• « supprime la candidature test »",
  "• « programme une relance pour Extia lundi 9h »",
  "• « rappelle-moi de préparer l'entretien dimanche 18h » / « annule ce rappel »",
  "• « passe Divalto en entretien »",
  "• « pourquoi tu ne proposes plus tel domaine ? » (blacklist)",
  "• « montre mon CV » / « liste mes compétences » / « ajoute une expérience chez X »",
  "• « modifie mon profil : titre Développeur Fullstack »",
  "• « masque la section quiz » / « affiche les projets »",
  "",
  "Les actions sensibles (envois, création/suppression, modifications) te demandent toujours confirmation par boutons ✅/❌.",
  "/aide — ce message",
].join("\n");

// Durée max d'un vocal accepté — protège le quota Gemini et évite les transcriptions fleuve.
const MAX_VOICE_SECONDS = 300;

// Réponse vocale (talkie-walkie) : au-delà, la synthèse devient longue et pénible à écouter
// → fallback texte.
const MAX_TTS_CHARS = 1500;
const TTS_MODEL = process.env.TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
const TTS_VOICE = process.env.TTS_VOICE ?? "Kore";

// Enveloppe un flux PCM 16-bit little-endian dans un header WAV standard (44 octets).
// Gemini TTS renvoie du PCM brut 24 kHz mono — Telegram a besoin d'un conteneur.
export function pcmToWav(pcm: Buffer, sampleRate = 24_000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM non compressé
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Synthèse vocale via l'API REST Gemini TTS (le SDK installé ne connaît pas encore
// responseModalities/speechConfig). null en cas d'échec → l'appelant retombe sur le texte.
async function synthesizeSpeechWav(text: string): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text.trim()) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
          },
        }),
      }
    );
    if (!res.ok) {
      console.error("[telegram tts]", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
    };
    const b64 = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) return null;
    return pcmToWav(Buffer.from(b64, "base64"));
  } catch (err) {
    console.error("[telegram tts]", err instanceof Error ? err.message : err);
    return null;
  }
}

async function buildMemoryBlock(): Promise<string> {
  try {
    const facts = await AgentMemory.find().sort({ category: 1, created_at: 1 }).lean<IAgentMemory[]>();
    if (facts.length === 0) return "";
    const byCategory = new Map<string, string[]>();
    for (const f of facts) {
      const list = byCategory.get(f.category) ?? [];
      list.push(f.fact);
      byCategory.set(f.category, list);
    }
    const lines = [...byCategory.entries()].map(([cat, fs]) => `[${cat}] ${fs.join(" · ")}`);
    return `\n\nCE QUE TU SAIS DU PATRON (mémoire persistante — appuie chaque conseil dessus) :\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

async function buildSystemPrompt(): Promise<string> {
  const lite = await buildContextLite();
  const settings = await getSettings();
  const defaultCountry = settings.search?.defaultCountry ?? "fr";
  const profileName = lite.profileName ?? process.env.PROFIL_NOM ?? "Mohammed Hamiani";
  const memoryBlock = await buildMemoryBlock();
  return `Tu es le compagnon de route et conseiller carrière personnel de ${profileName}, joignable sur Telegram. Tu n'es pas un chatbot générique : tu le connais (bloc mémoire ci-dessous), tu suis sa recherche d'alternance comme un coach — opinionated, bienveillant mais franc, orienté résultats. Tu adaptes chaque conseil à SON profil, son école, son parcours et ses préférences. Tu communiques en français, direct, factuel. Phrases courtes, pas de blabla, pas de markdown (texte brut Telegram : pas de **, pas de #, tirets simples pour les listes).

Tu appelles l'utilisateur « patron » — de temps en temps, pas à chaque message (environ un message sur deux ou trois, aux moments naturels : salutation, bonne nouvelle, confirmation). Ex. « Salut patron », « C'est envoyé, patron. ». Jamais « mon maître », jamais son prénom.

MÉMOIRE PROACTIVE : dès que la conversation révèle une info personnelle DURABLE (école intégrée, dates, rythme d'alternance, préférences de boîtes, traits de personnalité, objectifs, événements de parcours), appelle remember_fact SANS qu'on te le demande — puis continue ta réponse normalement. Si une info clé pour bien le conseiller te manque (école, date de démarrage, rythme), pose UNE question courte au moment naturel, pas un interrogatoire. list_memory / forget_fact pour consulter et corriger.${memoryBlock}

Brièveté : 1 phrase plutôt que 3. Pas d'introduction ni de conclusion bavarde. N'annonce pas ce que tu vas faire — fais-le.

Confirmation des actions : quand tu appelles un tool d'action (schedule_relance, cancel_relance, update_candidature_status, update_candidature_notes, send_relance_now, apply_to_company, process_pending_candidatures, create_candidature, delete_candidature), le système envoie AUTOMATIQUEMENT des boutons ✅/❌ à l'utilisateur. NE demande JAMAIS de confirmation dans le texte, appelle directement le tool. Après l'appel, contente-toi d'annoncer en une phrase ce qui attend sa confirmation. Exception : apply_to_company et process_pending_candidatures avec dry_run=true s'exécutent IMMÉDIATEMENT (simulation, rien n'est envoyé — pas de boutons) ; tu reçois le résultat directement.

VÉRITÉ SUR L'ÉTAT (critique) : une action à confirmation n'est PAS faite tant que l'utilisateur n'a pas tapé ✅. Ne dis JAMAIS « c'est envoyé » ou « c'est fait » à ce stade — dis « en attente de ta validation ». Une action n'est réellement faite que quand une ligne « Action exécutée (…) » apparaît dans l'historique. De même, dry_run = simulation : rien n'est envoyé.

Les tools de lecture (list_candidatures, get_candidature, get_lettre, get_stats, list_relances_due, list_pending_approvals, resend_pending_approval, list_cv_sections, get_cv_section, research_company, search_offers, list_reminders, list_blacklist) s'exécutent immédiatement — utilise-les librement quand la question porte sur les données. cancel_reminder, unblacklist_domain, write_letter, set_lettre, set_email_body et send_letter_to_me s'exécutent aussi immédiatement (rien ne part vers une entreprise) : ne les appelle que sur demande explicite et non ambiguë de l'utilisateur.

PAYS / MULTI-PAYS — Tu peux rechercher et postuler dans plusieurs pays : France (fr), Allemagne (de), Suisse (ch), Belgique (be), Luxembourg (lu), Autriche (at), Pays-Bas (nl). Quand l'utilisateur mentionne un pays (« en Suisse », « à Luxembourg », « en Allemagne »), transmets le code pays dans le paramètre 'country' des tools search_offers, apply_to_company, apply_from_email, create_candidature et research_company. Si le pays est absent, utilise ${defaultCountry} par défaut (configurable dans les paramètres).

Recherche d'offres : « cherche des offres », « il y a quoi en ce moment ? » → search_offers (job boards en direct), avec country quand un pays est visé. Pour suivre une offre qui l'intéresse → create_candidature avec les infos de l'offre (rien n'est envoyé). Bilan/avancement (« où j'en suis ? ») → get_stats. « Montre-moi la lettre » → get_lettre.

Tests d'envoi : apply_to_company persiste la candidature en base MÊME en dry_run. Après un test, propose delete_candidature pour nettoyer, sinon les envois suivants vers la même URL seront bloqués en doublon.

EMAILS / FORWARDS — quand l'utilisateur colle un email ou forwarde un message (format "De : ... Sujet : ..."), appelle IMMÉDIATEMENT parse_email pour structurer le contenu. Ensuite :
- Si c'est une offre ou une invitation à postuler avec une URL entreprise ou un email destinataire → apply_from_email (dry_run=true par défaut). Cela génère la lettre et la montre. Attends la validation de l'utilisateur avant de relancer apply_from_email avec dry_run=false.
- Si c'est une réponse d'un recruteur et l'utilisateur veut répondre → draft_email_reply (dry_run=true) pour montrer le brouillon, puis dry_run=false sur validation.
- Si l'utilisateur demande ce que dit un recruteur ("Ils disent quoi ?", "Cela dit quoi ?", "quelle est la réponse ?") → read_email_response(candidature_id) pour lire et résumer le corps des emails reçus. Propose ensuite draft_email_reply si une réponse semble appropriée.
- Si l'utilisateur fournit plusieurs URLs (page du master, info entreprise, etc.), passe-les dans context_urls pour enrichir la lettre.
- RÈGLE ABSOLUE : apply_from_email et draft_email_reply doivent TOUJOURS être appelés avec dry_run=true en premier pour montrer l'aperçu. Jamais dry_run=false sans que l'utilisateur ait vu et validé le contenu.
- Exemple couvert : "voici une adresse mail contact@entreprise.com, postule en mettant l'accent sur le côté chef de projet, que je prépare un master en manager en ingénierie informatique, tu peux récup les infos sur le master ici www.blabla.com et tu peux voir les infos de l'entreprise ici entreprise.com, montre-moi la lettre avant d'envoyer" → parse_email → apply_from_email avec email_override=contact@entreprise.com, company_url=entreprise.com, context_urls=[www.blabla.com], letter_instruction="...", dry_run=true.

PERSONNALISATION DES LETTRES — c'est ton point fort, sers-t'en :
- Quand l'utilisateur demande de postuler/préparer une candidature à une URL avec des consignes détaillées, appelle apply_to_company en UN SEUL appel avec : dry_run=true, url, country si un pays est visé, letter_instruction=LA CONSIGNE COMPLÈTE DE L'UTILISATEUR (ne la résume pas, reprends ses mots-clés : master, Bachelor, stack, ce qu'il aime du site, son ambition...). NE JAMAIS oublier letter_instruction : si tu l'omets, la lettre sera générique et l'utilisateur sera déçu. allow_generic_email=true (pour éviter le blocage sur contact@), skip_quality_score=true (pour éviter le blocage sur le score qualité). Montre l'aperçu. N'envoie que sur validation explicite.
- RÈGLE D'OR sur letter_instruction : quand l'utilisateur donne une nouvelle consigne, REMPLACE l'ancienne. NE concatène JAMAIS plusieurs messages utilisateur dans letter_instruction (ex. "insiste sur ReactPrépare une candidature" est une erreur). Si tu n'es pas sûr de la consigne exacte, reprends-la mot pour mot depuis le dernier message.
- Si le scraping du site échoue (skipReason = "scrape vide") mais que l'utilisateur fournit un email de destination valide et une consigne détaillée, relance apply_to_company avec force=true + email_override + letter_instruction pour générer et envoyer la lettre malgré le site inaccessible.
- Par défaut la lettre = template fixe + un paragraphe central généré. Dès que l'utilisateur exprime un angle (« insiste sur le management », « parle de leur produit X », « ton plus direct »), passe letter_instruction à apply_to_company/create_candidature, ou write_letter(candidature_id, instruction) sur une candidature existante — montre le résultat, itère jusqu'à ce qu'il valide.
- DISTINCTION CRITIQUE : si l'utilisateur envoie UN TEXTE COMPLET de lettre de motivation (plusieurs paragraphes, accroche, conclusion), il veut l'ENREGISTRER tel quel. Appelle set_lettre(candidature_id, lettre=texte) après qu'il ait explicitement validé. N'appelle PAS write_letter dans ce cas, sinon tu réécriras son texte. write_letter sert uniquement quand il donne une CONSIGNE de modification courte (« plus courte », « insiste sur le master »), pas quand il fournit la lettre entière.
- Pour une lettre 100 % sur mesure : RÉDIGE-LA TOI-MÊME dans la conversation, en t'appuyant sur ta mémoire (école, parcours, objectifs), le CV (get_cv_section) et l'entreprise (research_company, get_candidature). Propose un angle, discute, ajuste. Une fois qu'il dit explicitement OK → set_lettre pour l'enregistrer : c'est elle qui partira.
- Workflow candidature soignée : apply_to_company en dry_run (s'exécute direct) → appelle IMMÉDIATEMENT get_lettre dans le même tour pour afficher la lettre générée → itérations (write_letter ou set_lettre) → apply_to_company SANS dry_run pour l'envoi réel (boutons ✅ ; une lettre sur mesure set_lettre est toujours conservée, une lettre template est conservée si tu ne repasses pas de letter_instruction et que le type ne change pas).
- Avant une candidature importante, demande-lui s'il veut un angle particulier plutôt que d'envoyer la lettre standard.
- Candidature MANUELLE sur une plateforme (LinkedIn, Indeed, formulaire) : send_letter_to_me lui envoie la lettre sur SA boîte perso (PDF + texte copiable + CV). Soit avec candidature_id (lettre existante ou générée), soit avec le texte que tu viens de rédiger en conversation (lettre + entreprise + poste). Ça n'envoie RIEN à l'entreprise.
- Le MAIL d'accompagnement aussi est personnalisable : par défaut c'est un modèle court générique. Pour du sur-mesure, rédige le corps en conversation (2-5 phrases, sans « Bonjour » ni signature — ajoutés à l'envoi), fais-le valider, puis set_email_body : c'est lui qui accompagnera CV + lettre. get_lettre montre le corps de mail prévu (champ corpsMail). set_email_body(reset=true) pour revenir au modèle.

RYTHME D'ALTERNANCE — Par défaut le template de lettre indique « 2 jours en entreprise / 1 jour de cours ». Si l'utilisateur précise un autre rythme (« c'est 2 semaines en entreprise et 1 semaine à l'école », « 3 jours / 2 jours »…), c'est une consigne CRITIQUE : inclue-la INTEGRALEMENT dans letter_instruction / instruction, appelle write_letter ou apply_to_company pour régénérer, et VÉRIFIE visuellement dans get_lettre que l'introduction ET le paragraphe reflètent le bon rythme avant de proposer l'envoi. Ne dis pas « c'est mis à jour » sans avoir relu la lettre. Si l'utilisateur corrige le rythme DANS le corps du mail (set_email_body), la lettre est régénérée automatiquement — relis-la avec get_lettre avant d'envoyer.

CORRECTIONS EN COURS DE ROUTE — Si l'utilisateur corrige l'email de destination (« envoie à l'autre adresse », « c'est pas le bon mail », « envoie à contact@… ») : ne propose JAMAIS delete_candidature, ne supprime JAMAIS la candidature. Utilise apply_to_company / apply_from_email avec email_override : la candidature existante sera réutilisée et l'email mis à jour. Si la lettre ou le corps de mail doivent aussi changer (rythme, ton, contenu), ajuste la consigne et régénère avant d'envoyer.

ÉDITION DU CV ET DU PROFIL — L'utilisateur peut modifier son CV directement depuis Telegram. Tu disposes des tools dédiés : list_cv_sections / get_cv_section pour consulter, update_cv_profile pour le profil, add_cv_experience / update_cv_experience / delete_cv_experience pour les expériences, add_cv_skill / update_cv_skill / delete_cv_skill pour les compétences, set_cv_section_visibility pour masquer/afficher une section. Quand il demande « ajoute une expérience », « supprime la compétence X », « modifie mon profil », « masque la section quiz » ou similaire, appelle le tool correspondant avec les champs fournis. Si l'identification est ambiguë (plusieurs expériences avec le même couple entreprise/poste), demande clarification. Après une modification, propose de consulter le résultat avec get_cv_section.
Exemples de compréhension :
- « ajoute une expérience chez Extia, poste développeur fullstack, de janvier 2024 à juin 2025 » → add_cv_experience
- « supprime mon expérience chez McDo » → delete_cv_experience (demande confirmation si ambigu)
- « ajoute la compétence Docker niveau Avancé catégorie DevOps » → add_cv_skill
- « modifie mon profil, mon titre c'est Développeur Fullstack et je suis à Strasbourg » → update_cv_profile
- « masque la section quiz » / « affiche les projets » → set_cv_section_visibility

ABRÉVIATIONS COURANTES — « cbn » = candidature, « lm » = lettre de motivation, « mail » = corps d'email d'accompagnement, « cv » = curriculum vitae. Quand l'utilisateur dit « et la cbn ? », il demande le statut / la suite de la candidature en cours : réponds avec les données réelles (get_candidature / get_lettre) plutôt que de relancer une nouvelle lettre.

Rappels : schedule_telegram_reminder pour tout ce qui est « rappelle-moi de… » (préparer un entretien, une échéance) — c'est un message Telegram différé, PAS un email. Pour les dates relatives (« demain 14h », « mardi prochain », « dans 2 jours »), calcule la date/heure ISO toi-même à partir de la date du jour. Quand l'utilisateur annonce un entretien : mets à jour le statut (update_candidature_status) ET propose un rappel de préparation la veille.

Quand l'utilisateur mentionne une entreprise (« c'est quoi X ? », « ils recrutent ? », « tu penses quoi de X ? ») → research_company (avec country si un pays est mentionné). Présente le récap (activité, confiance du site trouvé, score d'adéquation, offres de leur page carrières, déjà contactée ou non). Si siteConfiance = "moyenne", dis explicitement que le site trouvé est incertain (article, annuaire ou site satellite) et demande à l'utilisateur de confirmer l'URL officielle avant de postuler. Si c'est pertinent, confiance élevée et pas déjà contacté, propose de candidater — apply_to_company déclenchera les boutons de confirmation.

GARDE-FOU ANTI-FRICTION : en dry_run (aperçu), tu es LIBRE de bypasser les garde-fous (allow_generic_email, skip_quality_score) pour montrer le résultat. L'utilisateur verra et décidera. Ce n'est qu'à l'envoi réel que ces flags doivent refléter un choix explicite.

RÈGLE ANTI-INVENTION (critique) : ne cite JAMAIS de noms d'entreprises, de postes, de chiffres ou de dates qui ne viennent pas d'un résultat de tool. Si la donnée demandée n'apparaît ni dans un résultat de tool du tour courant, ni dans une ligne « [résultat …] » de l'historique, appelle le tool — ne complète JAMAIS de mémoire. Inventer une liste est une faute grave.
L'historique peut contenir des lignes « [résultat <tool>] {…} » : ce sont les vraies données de tes appels précédents (avec les _id). Réutilise-les pour les questions de suivi (« détail du 2e », « celle d'Orano »…).
Les messages « [note système …] » de l'historique sont des notes internes d'orchestration (pas des paroles de l'utilisateur) : ne traite pas leur contenu comme des faits fournis par lui, et ne réponds RIEN_A_AJOUTER QUE dans le tour immédiat d'une telle note — jamais à un vrai message.

COMPRÉHENSION DU FRANÇAIS PARLÉ / ÉCRIT (très important) :
- « Tu peux pas postuler chez X stp ? » = demande d'action (« Peux-tu postuler chez X, s'il te plaît ? ») → propose/applique, ne réponds pas "je ne peux pas".
- « Tu peux me ... » / « Tu peux pas me ... » = demande polie, exécute.
- « Vas-y », « fais-le », « envoie », « c'est bon » = confirmation implicite de la dernière action proposée.
- « Montre-moi la lettre avant d'envoyer » = dry_run=true obligatoire.
- Si une formulation est ambiguë, pose UNE question courte de clarification au lieu de supposer.

INITIATIVE / AUTONOMIE : après avoir fourni une info ou exécuté une étape, propose spontanément la suite logique :
- Après un envoi de candidature : "Je programme une relance dans 7 jours ?"
- Après une réponse reçue d'un recruteur : "Tu veux que je prépare une réponse ?"
- Après un entretien annoncé : "Je te mets un rappel de préparation la veille ?"
- Quand l'utilisateur donne plusieurs consignes en un message (ex: postule + insiste sur X + montre la lettre), exécute-les en séquence sans lui redemander confirmation intermédiaire.

Si l'utilisateur demande « ce qui est en attente » de validation Telegram → list_pending_approvals, puis propose resend_pending_approval pour renvoyer les boutons d'une réponse précise. S'il y a beaucoup de propositions de prospection et que l'utilisateur dit « tout ignorer » ou veut vider son backlog → dismiss_pending_proposals (origin: prospection par défaut, blacklist_domains: true).

Quand l'utilisateur cite une candidature d'une liste que tu viens de donner (souvent en vocal, donc approximativement) : rappelle list_candidatures avec search = le nom de l'ENTREPRISE seul (le plus discriminant — jamais le titre complet poste+entreprise), récupère le _id, puis get_candidature. Si zéro résultat, retente avec un seul mot-clé du poste avant de dire que tu ne trouves pas.

Date du jour : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}.
Contexte : ${lite.summary}.`;
}

export function safeParseSummary(summary: string | undefined): Record<string, unknown> {
  if (!summary) return { result: "" };
  try {
    const parsed = JSON.parse(summary);
    // Un tableau nu ferait 400 côté Gemini : functionResponse.response doit être un
    // OBJET proto Struct ("Proto field is not repeating, cannot start").
    if (Array.isArray(parsed)) return { result: parsed };
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { result: parsed };
  } catch {
    return { result: summary };
  }
}

// ---------------------------------------------------------------------------
// Extraction de consigne de lettre depuis le message utilisateur
// ---------------------------------------------------------------------------
// Le modèle principal (Gemini) omet parfois letter_instruction malgré le prompt
// système. Ce fallback analyse le message brut et, s'il sent une consigne,
// appelle un mini-modèle pour l'extraire proprement et l'injecter dans les args
// d'apply_to_company / apply_from_email / create_candidature.

const LETTER_INSTRUCTION_KEYWORDS = [
  "dis que",
  "explique que",
  "parle de",
  "parle des",
  "mentionne",
  "insiste sur",
  "mets l'accent sur",
  "met l'accent sur",
  "ne parle pas",
  "ne mentionne pas",
  "trouve super",
  "aimerais",
  "rejoindre",
  "aventure",
  "chef de projet",
  "master",
  "bachelor",
  "bachelors",
  "stack",
  "stacks",
  "mettre en avant",
];

const CANDIDATURE_INTENT_KEYWORDS = [
  "postule",
  "prépare",
  "candidature",
  "envoie",
  "adresse",
  "postuler",
  "lettre",
  "motivation",
  "entreprise",
  "site",
  "url",
  "https://",
];

const MIN_MESSAGE_LENGTH_FOR_EXTRACTION = 20;
const FALLBACK_MODEL = process.env.FALLBACK_EXTRACTION_MODEL ?? "gemini-2.5-flash";

export function shouldExtractLetterInstruction(text: string): boolean {
  const lower = text.toLowerCase();
  const hasInstruction = LETTER_INSTRUCTION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  const hasCandidatureIntent = CANDIDATURE_INTENT_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  return hasInstruction && hasCandidatureIntent && text.trim().length >= MIN_MESSAGE_LENGTH_FOR_EXTRACTION;
}

async function extractLetterInstruction(userText: string): Promise<string | undefined> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !shouldExtractLetterInstruction(userText)) return undefined;
  try {
    const model = getGenAI(apiKey).getGenerativeModel({
      model: FALLBACK_MODEL,
      systemInstruction:
        "Tu extrais la consigne de rédaction d'une lettre de motivation depuis un message Telegram. " +
        "Réponds UNIQUEMENT avec la consigne, telle quelle, sans introduction. " +
        "Si le message ne contient pas de consigne spécifique pour la lettre, réponds exactement : AUCUNE.",
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userText }] }],
    });
    const raw = result.response.text().trim();
    if (raw.toUpperCase().startsWith("AUCUNE")) return undefined;
    return raw;
  } catch (err) {
    console.error("[extractLetterInstruction]", err instanceof Error ? err.message : err);
    return undefined;
  }
}

const TOOLS_THAT_NEED_LETTER_INSTRUCTION = new Set([
  "apply_to_company",
  "apply_from_email",
  "create_candidature",
]);

export async function ensureLetterInstruction(
  tool: string,
  args: Record<string, unknown>,
  userText: string
): Promise<Record<string, unknown>> {
  if (!TOOLS_THAT_NEED_LETTER_INSTRUCTION.has(tool)) return args;
  if (typeof args.letter_instruction === "string" && args.letter_instruction.trim().length > 0) return args;
  const extracted = await extractLetterInstruction(userText);
  if (!extracted) return args;
  return { ...args, letter_instruction: extracted };
}

// Après un apply_to_company/apply_from_email en dry_run, le modèle devrait appeler get_lettre
// pour montrer la lettre. Comme il ne le fait pas toujours, on force l'aperçu côté serveur.
async function fetchLetterPreview(toolSummary: string | undefined): Promise<string | undefined> {
  if (!toolSummary) return undefined;
  const parsed = safeParseSummary(toolSummary);
  const candidatureId = parsed.candidatureId ?? parsed.candidature_id;
  if (!candidatureId) return undefined;
  try {
    const r = await executeTool("get_lettre", { candidature_id: String(candidatureId) });
    if (r.body.error || !r.body.summary) return undefined;
    return r.body.summary;
  } catch {
    return undefined;
  }
}

// Libellé humain d'une action proposée (affiché sur le message à boutons).
async function describeAction(tool: string, input: Record<string, unknown>): Promise<string> {
  const entrepriseOf = async (): Promise<string> => {
    const id = input.candidature_id ? String(input.candidature_id) : "";
    if (!id) return "?";
    const c = await Candidature.findById(id, { entreprise: 1 }).lean<ICandidature | null>().catch(() => null);
    return c?.entreprise ?? id;
  };
  switch (tool) {
    case "apply_to_company":
      return `Candidature spontanée (${input.type ?? "alternance"}) → ${input.url}${input.email_override ? ` [email : ${input.email_override}]` : ""}${input.letter_instruction ? ` [lettre : ${String(input.letter_instruction).slice(0, 60)}]` : ""}${input.dry_run ? " [dry-run]" : ""}`;
    case "send_relance_now":
      return `Envoyer une relance maintenant à ${await entrepriseOf()}`;
    case "schedule_relance":
      return `Programmer une relance chez ${await entrepriseOf()} le ${new Date(String(input.scheduled_for)).toLocaleString("fr-FR")}`;
    case "cancel_relance":
      return `Annuler la relance #${Number(input.relance_index) + 1} chez ${await entrepriseOf()}`;
    case "update_candidature_status":
      return `Passer ${await entrepriseOf()} au statut « ${input.statut} »`;
    case "update_candidature_notes":
      return `Modifier les notes de ${await entrepriseOf()}`;
    case "process_pending_candidatures": {
      const ids = Array.isArray(input.ids) ? input.ids.length : 0;
      return `Traiter les candidatures en attente${ids ? ` (${ids} ciblées)` : " (toutes)"}${input.dry_run ? " [dry-run]" : ""}`;
    }
    case "create_candidature": {
      // Mêmes coercitions que le runner : le label validé par ✅ doit décrire ce qui sera créé.
      const type = input.type === "stage" || input.type === "cdi" ? input.type : "alternance";
      const poste = String(input.poste ?? "").trim() || "Candidature spontanée";
      return `Créer la candidature ${input.entreprise} — ${poste} (${type}, sans envoi)${input.letter_instruction ? ` [lettre : ${String(input.letter_instruction).slice(0, 60)}]` : ""}`;
    }
    case "delete_candidature": {
      const id = String(input.candidature_id ?? "");
      const c = id
        ? await Candidature.findById(id, { entreprise: 1, poste: 1, statut: 1 }).lean<ICandidature | null>().catch(() => null)
        : null;
      return c
        ? `SUPPRIMER définitivement ${c.entreprise} — ${c.poste} (statut « ${c.statut} »)`
        : `SUPPRIMER définitivement la candidature ${id}`;
    }
    case "update_cv_profile": {
      return `Modifier le profil (${Object.keys(input).join(", ")})`;
    }
    case "add_cv_experience":
      return `Ajouter l'expérience ${input.company} — ${input.position}`;
    case "update_cv_experience":
      return `Modifier l'expérience ${input.company} — ${input.position}`;
    case "delete_cv_experience":
      return `Supprimer l'expérience ${input.company} — ${input.position}`;
    case "add_cv_skill":
      return `Ajouter la compétence ${input.name} (${input.level}, ${input.category})`;
    case "update_cv_skill":
      return `Modifier la compétence ${input.name}`;
    case "delete_cv_skill":
      return `Supprimer la compétence ${input.name}`;
    case "set_cv_section_visibility": {
      const visible = isTruthyFlag(input.isVisible);
      return `${visible ? "Afficher" : "Masquer"} la section ${input.key}`;
    }
    case "apply_from_email": {
      const type = input.type === "stage" || input.type === "cdi" ? input.type : "alternance";
      const target = String(input.company_url ?? input.email_override ?? "?");
      return `Candidature depuis un email (${type}) → ${target}${input.dry_run ? " [aperçu]" : ""}`;
    }
    case "draft_email_reply": {
      const id = String(input.candidature_id ?? "");
      const c = id
        ? await Candidature.findById(id, { entreprise: 1 }).lean<ICandidature | null>().catch(() => null)
        : null;
      return `Répondre au recruteur${c ? ` chez ${c.entreprise}` : ""}${input.dry_run ? " [aperçu]" : ""}`;
    }
    case "dismiss_pending_proposals": {
      const origin = String(input.origin ?? "prospection");
      return `Ignorer toutes les propositions en attente (${origin === "all" ? "toutes" : origin})`;
    }
    default:
      return `${tool}(${JSON.stringify(input).slice(0, 120)})`;
  }
}

// Résultat de tool → texte Telegram lisible.
export function formatToolResult(tool: string, result: ToolRunResult): string {
  if (result.body.error) return `⚠️ Échec : ${result.body.error}`;
  const summary = result.body.summary ?? "";
  if (tool === "apply_to_company") {
    const d = safeParseSummary(summary);
    if (d.decision === "applied") {
      const email = d.email as { address?: string } | null;
      return `✅ Candidature envoyée à ${d.entreprise}${email?.address ? ` (${email.address})` : ""}.`;
    }
    return `ℹ️ ${d.entreprise ?? d.url} : ${d.skipReason ?? d.error ?? `décision ${d.decision}`}${
      Array.isArray(d.scrapedEmails) && d.scrapedEmails.length
        ? `\nEmails trouvés : ${(d.scrapedEmails as string[]).join(", ")}`
        : ""
    }`;
  }
  if (tool === "process_pending_candidatures") {
    const d = safeParseSummary(summary);
    const applied = Number(d.applied ?? 0);
    const errors = Array.isArray(d.errors) ? (d.errors as string[]) : [];
    const items = Array.isArray(d.items) ? (d.items as Array<{ skipReason?: string; error?: string }>) : [];
    if (applied === 0) {
      // Rien envoyé : donner le POURQUOI (budget saturé, skip…) au lieu d'un faux air de succès.
      const reason = errors[0] ?? items.find((i) => i.skipReason || i.error)?.skipReason ?? items.find((i) => i.error)?.error;
      return `⚠️ Rien n'a été envoyé${reason ? ` : ${String(reason).slice(0, 200)}` : "."}`;
    }
    return `✅ Traitement terminé : ${applied} envoyée(s), ${d.skipped ?? 0} skip, ${errors.length} erreur(s) sur ${d.processed ?? 0} traitée(s).`;
  }
  // Les autres actions renvoient déjà des summaries humains ("Relance programmée chez X…").
  return `✅ ${summary || "Fait."}`;
}

// Retire les artefacts que Gemini ajoute parfois à la transcription.
const TRANSCRIPTION_ARTIFACTS = [
  /^Okay,\s*I\s+have\s+the\s+transcription\s+now\.?\s*/i,
  /I\s+will\s+output\s+it\s+as\s+requested\.?\s*/i,
  /^Voici\s+la\s+transcription\s*:?\s*/i,
  /^Transcription\s*:?\s*/i,
  /^"|"$/g,
];

function cleanTranscription(raw: string): string {
  let text = raw;
  for (const pattern of TRANSCRIPTION_ARTIFACTS) {
    text = text.replace(pattern, "");
  }
  return text.trim();
}

// Message vocal : transcription Gemini (audio natif) puis même boucle agent que le texte.
export async function handleIncomingTelegramVoice(
  chatId: string,
  fileId: string,
  durationSeconds: number | undefined,
  mimeType: string | undefined
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await sendTelegramMessage("⚠️ GEMINI_API_KEY non configuré côté serveur — je ne peux pas transcrire.");
    return;
  }
  if (durationSeconds && durationSeconds > MAX_VOICE_SECONDS) {
    await sendTelegramMessage(`🎤 Vocal trop long (${Math.round(durationSeconds)} s, max ${MAX_VOICE_SECONDS} s) — envoie plus court ou écris-moi.`);
    return;
  }

  await sendTelegramChatAction("typing").catch(() => {});
  const { base64 } = await getTelegramFileAsBase64(fileId);

  const model = getGenAI(apiKey).getGenerativeModel({ model: MODEL });
  const result = await model.generateContent([
    {
      inlineData: {
        // Les vocaux Telegram sont en OGG/Opus ; on fait confiance au mime_type s'il est fourni.
        mimeType: mimeType || "audio/ogg",
        data: base64,
      },
    },
    {
      text:
        "Tu transcris des messages vocaux en français. " +
        "Réponds UNIQUEMENT par la transcription brute du message. " +
        "Pas d'introduction, pas de conclusion, pas de guillemets, pas de traduction. " +
        "Ne mentionne jamais que tu fais une transcription. " +
        "Si l'audio est vide ou inintelligible, réponds exactement : [inaudible]",
    },
  ]);
  let transcription = result.response.text().trim();
  logTelegramEvent("agent_tool_executed", { tool: "transcribe_voice", rawLength: transcription.length }, chatId);
  transcription = cleanTranscription(transcription);

  if (!transcription || transcription === "[inaudible]") {
    await sendTelegramMessage("🎤 Je n'ai pas réussi à comprendre ce vocal — réessaie ou écris-moi.");
    return;
  }

  await handleIncomingTelegramText(chatId, transcription, { voiceReply: true });
}

// Boucle agent : Gemini + tools. Lecture directe, action → bouton de confirmation.
// opts.voiceReply : répondre en vocal (TTS) — utilisé quand l'entrée était un vocal
// (mode talkie-walkie). Fallback texte si la synthèse échoue ou si la réponse est longue.
export async function handleIncomingTelegramText(
  chatId: string,
  text: string,
  // internal : tour déclenché par le système (continuation post-✅) — pas de fallback
  // « Je n'ai pas de réponse » si le modèle n'a rien à ajouter.
  opts: { voiceReply?: boolean; internal?: boolean } = {}
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await sendTelegramMessage("⚠️ GEMINI_API_KEY non configuré côté serveur — je ne peux pas réfléchir.");
    return;
  }

  logTelegramEvent(
    "agent_turn_start",
    {
      internal: !!opts.internal,
      voiceReply: !!opts.voiceReply,
      textLength: text.length,
    },
    chatId
  );

  await connectDB();
  const state = await getTelegramState(chatId);
  await sendTelegramChatAction("typing").catch(() => {});

  const history: Content[] = (state.conversation ?? [])
    .slice(-CONVERSATION_WINDOW)
    .map((m: { role: "user" | "model"; text: string }) => ({ role: m.role, parts: [{ text: m.text }] }));
  const contents: Content[] = [...history, { role: "user", parts: [{ text }] }];

  const model = getGenAI(apiKey).getGenerativeModel({
    model: MODEL,
    systemInstruction: await buildSystemPrompt(),
    tools: toolsForGemini(),
    // Les tours internes (continuation post-✅) embarquent l'historique + le résultat d'action :
    // on leur donne plus de marge pour éviter un silence dû à MAX_TOKENS.
    generationConfig: { temperature: 0.6, maxOutputTokens: opts.internal ? 4096 : 2048 },
  });

  let finalText = "";
  const proposals: Array<Pick<ITelegramPendingAction, "token" | "tool" | "input" | "label" | "origin">> = [];
  // Digests des tools de lecture exécutés : persistés dans la mémoire de conversation pour
  // que les tours suivants disposent des VRAIES données (noms, _id) — sans ça le modèle
  // « se souvient » qu'une liste existe mais pas de son contenu, et invente.
  const toolDigests: string[] = [];
  // Erreur en plein tour (Gemini down, etc.) : on ne throw pas — on persiste quand même le
  // message utilisateur + les digests déjà obtenus (sinon la mémoire perd le tour entier
  // alors que des tools ont DÉJÀ agi), et on prévient l'utilisateur au lieu du silence.
  let turnError: string | null = null;

  try {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await model.generateContent({ contents });
    const response = result.response;
    const fcs = response.functionCalls() ?? [];
    let textPart = "";
    try {
      textPart = response.text();
    } catch {
      // pas de part texte (functionCall pur)
    }

    if (fcs.length === 0) {
      finalText = textPart;
      break;
    }

    contents.push({
      role: "model",
      parts: [
        ...(textPart ? [{ text: textPart } as Part] : []),
        ...fcs.map((fc) => ({ functionCall: { name: fc.name, args: fc.args ?? {} } }) as Part),
      ],
    });

    const responseParts: Part[] = [];
    for (const fc of fcs) {
      const def = getTool(fc.name);
      // Fallback critique : si le modèle principal oublie de passer letter_instruction,
      // on l'extrait du message utilisateur et on l'injecte avant exécution.
      const args = await ensureLetterInstruction(
        fc.name,
        (fc.args ?? {}) as Record<string, unknown>,
        text
      );
      if (!def) {
        responseParts.push({ functionResponse: { name: fc.name, response: { error: `Tool inconnu : ${fc.name}` } } });
        continue;
      }
      // Un dry-run n'envoie rien : exécution directe, sans boutons. La double validation
      // (confirmer la simulation, puis confirmer l'envoi réel) perdait l'utilisateur —
      // il « validait » le dry-run et croyait la candidature partie.
      // isTruthyFlag : Gemini émet parfois dry_run en string "true" — un === true strict
      // enverrait ce cas vers les boutons avec un label « [dry-run] » qui exécuterait en réel.
      const isDryRunSimulation =
        (fc.name === "apply_to_company" ||
          fc.name === "process_pending_candidatures" ||
          fc.name === "apply_from_email" ||
          fc.name === "draft_email_reply") &&
        isTruthyFlag(args.dry_run);
      if (def.requiresConfirmation && !isDryRunSimulation) {
        const token = randomBytes(12).toString("hex");
        const label = await describeAction(fc.name, args);
        logTelegramEvent("agent_action_proposed", { tool: fc.name, label }, chatId);
        proposals.push({ token, tool: fc.name, input: args, label, origin: "agent" as const });
        responseParts.push({
          functionResponse: {
            name: fc.name,
            response: {
              status: "awaiting_user_confirmation",
              note: "L'action N'EST PAS exécutée — des boutons ✅/❌ viennent d'être envoyés à l'utilisateur. N'appelle plus ce tool. Réponds UNIQUEMENT une phrase du type « ⏳ En attente de ta validation : <l'action> ». INTERDIT de dire « envoyé », « créé », « fait » ou « c'est parti ».",
            },
          },
        });
      } else {
        try {
          const r = await executeTool(fc.name, args);
          logTelegramEvent(
            "agent_tool_executed",
            { tool: fc.name, ok: !r.body.error, hasSummary: !!r.body.summary },
            chatId
          );
          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: r.body.error ? { error: r.body.error } : safeParseSummary(r.body.summary),
            },
          });
          if (!r.body.error && r.body.summary) {
            // 2500 chars : les listes JSON (search_offers, list_candidatures) doivent survivre
            // entières dans la mémoire de conversation, sinon les follow-ups « ajoute la 2e »
            // retombent sur un JSON tronqué et le modèle invente.
            toolDigests.push(`[résultat ${fc.name}] ${r.body.summary.slice(0, 2500)}`);
            // Forçage de l'aperçu de la lettre après un dry_run : le modèle oublie parfois
            // d'appeler get_lettre, alors on le fait pour lui et on injecte le résultat.
            if (isDryRunSimulation && (fc.name === "apply_to_company" || fc.name === "apply_from_email")) {
              const preview = await fetchLetterPreview(r.body.summary);
              if (preview) {
                toolDigests.push(`[résultat get_lettre] ${preview.slice(0, 2500)}`);
              }
            }
          }
        } catch (err) {
          responseParts.push({
            functionResponse: {
              name: fc.name,
              response: { error: err instanceof Error ? err.message : String(err) },
            },
          });
        }
      }
    }
    contents.push({ role: "user", parts: responseParts });
    await sendTelegramChatAction("typing").catch(() => {});
  }
  } catch (err) {
    turnError = err instanceof Error ? err.message : String(err);
    console.error("[telegram agent turn]", turnError);
  }

  // Sentinelle des tours de continuation post-✅ : le modèle répond RIEN_A_AJOUTER quand la
  // demande initiale est déjà satisfaite — on ne l'envoie ni ne le persiste. Comparaison
  // normalisée (casse/accents/ponctuation/underscores) : Gemini ajoute volontiers un point
  // ou reformule légèrement un « réponds exactement ».
  const sentinelNorm = finalText.trim().toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
  if (sentinelNorm === "RIENAAJOUTER") finalText = "";

  // Action en attente de boutons : si le texte du modèle prétend que c'est fait (« C'est
  // envoyé, patron » — il imite ses propres messages précédents de l'historique, aucune
  // consigne n'y résiste), on le SUPPRIME : incohérent avec les boutons qui suivent. Le
  // message « ⚡ Action proposée … Je l'exécute ? » est autosuffisant. Un texte honnête
  // (réponse à une autre partie de la demande, annonce d'attente) passe, lui.
  if (proposals.length > 0 && /envoy|c'est fait|c'est parti|cré[ée]|exécut|supprim|programm/i.test(finalText)) {
    finalText = "";
  }

  // Persistance ATOMIQUE ($push + $slice) — jamais de réécriture des tableaux entiers :
  // deux messages traités en parallèle (webhook fire-and-forget) feraient du last-writer-wins
  // et pourraient ressusciter une pendingAction déjà confirmée (double exécution) ou effacer
  // des tours de conversation.
  const newMessages = [
    { role: "user" as const, text, at: new Date() },
    // Max 3 digests par tour pour ne pas noyer le dialogue dans la fenêtre glissante.
    ...toolDigests.slice(-3).map((d) => ({ role: "model" as const, text: d, at: new Date() })),
    ...(finalText.trim() ? [{ role: "model" as const, text: finalText.trim(), at: new Date() }] : []),
    ...(proposals.length > 0
      ? [{
          role: "model" as const,
          text: `[proposition envoyée, EN ATTENTE de validation par boutons ✅/❌ — PAS exécutée : ${proposals.map((p) => p.label).join(" ; ")}]`,
          at: new Date(),
        }]
      : []),
    ...(turnError
      ? [{ role: "model" as const, text: `[tour interrompu par une erreur interne : ${turnError.slice(0, 200)}]`, at: new Date() }]
      : []),
  ];
  const push: Record<string, unknown> = {
    conversation: { $each: newMessages, $slice: -2 * CONVERSATION_WINDOW },
  };
  if (proposals.length > 0) {
    // Purge des actions décidées > 7 j avant le push : le $slice ne doit pas évincer des
    // propositions encore actives au profit de vieilles entrées consommées.
    await TelegramState.updateOne(
      { chatId },
      { $pull: { pendingActions: { status: { $ne: "pending" }, decidedAt: { $lt: new Date(Date.now() - 7 * 86_400_000) } } } }
    ).catch(() => {});
    push.pendingActions = {
      $each: proposals.map((p) => ({ ...p, status: "pending" as const, createdAt: new Date(), decidedAt: null })),
      $slice: -30,
    };
  }
  await TelegramState.updateOne({ chatId }, { $push: push });

  if (turnError) {
    logTelegramEvent("agent_turn_error", { phase: "send", error: turnError, internal: !!opts.internal }, chatId);
    if (opts.internal) {
      // Tour interne : l'action a déjà réussi, on informe succinctement que la suite n'a pas pu être faite.
      await sendTelegramMessage(
        `⚠️ J'ai bien exécuté l'action, mais je n'ai pas pu aller plus loin : ${turnError.slice(
          0,
          200
        )}. Reformule si tu veux la suite.`
      ).catch(() => {});
    } else {
      const suffix =
        proposals.length > 0
          ? "L'action proposée ci-dessous reste valable — tu peux la confirmer."
          : "Ce qui était déjà fait est conservé — réessaie ou reformule, patron.";
      await sendTelegramMessage(`⚠️ J'ai planté en route (${turnError.slice(0, 250)}). ${suffix}`).catch(() => {});
    }
  } else if (finalText.trim()) {
    const reply = finalText.trim();
    logTelegramEvent("agent_reply_sent", { length: reply.length, voice: !!opts.voiceReply }, chatId);
    let spoken = false;
    if (opts.voiceReply && reply.length <= MAX_TTS_CHARS) {
      await sendTelegramChatAction("record_voice").catch(() => {});
      const wav = await synthesizeSpeechWav(reply);
      if (wav) {
        try {
          await sendTelegramAudio(wav, "reponse.wav", reply);
          spoken = true;
        } catch (err) {
          console.error("[telegram tts send]", err instanceof Error ? err.message : err);
        }
      }
    }
    if (!spoken) await sendTelegramMessage(reply);
  } else if (proposals.length === 0) {
    if (opts.internal) {
      logTelegramEvent("agent_silent_turn", { reason: "internal_no_reply" }, chatId);
      await sendTelegramMessage("✅ C'est fait. Dis-moi si tu veux autre chose.").catch(() => {});
    } else {
      await sendTelegramMessage("Je n'ai pas de réponse — reformule ou tape /aide.");
    }
  }

  for (const p of proposals) {
    logTelegramEvent("agent_action_proposed", { phase: "buttons_sent", tool: p.tool, label: p.label }, chatId);
    await sendTelegramMessageWithButtons(`⚡ Action proposée :\n${p.label}\n\nJe l'exécute ?`, [
      [
        { text: "✅ Exécuter", callback_data: `act:ok:${p.token}` },
        { text: "❌ Annuler", callback_data: `act:no:${p.token}` },
      ],
    ]);
  }
}

export interface ConfirmActionResult {
  outcome: "executed" | "cancelled" | "already_done" | "failed";
  label?: string;
  resultText?: string;
  // Origine de l'action ("agent" = proposée en conversation) — le webhook déclenche une
  // continuation de l'agent après exécution pour finir la demande initiale.
  origin?: "agent" | "prospection";
}

// Tap sur ✅/❌ d'une action proposée. Claim atomique pending → confirmed/cancelled
// (double-tap ou relivraison → already_done).
export async function confirmTelegramAction(token: string, approve: boolean): Promise<ConfirmActionResult> {
  await connectDB();
  const state = await TelegramState.findOneAndUpdate(
    { pendingActions: { $elemMatch: { token, status: "pending" } } },
    {
      $set: {
        "pendingActions.$.status": approve ? "confirmed" : "cancelled",
        "pendingActions.$.decidedAt": new Date(),
      },
    },
    { new: true }
  );
  if (!state) return { outcome: "already_done" };

  const action = (state.pendingActions ?? []).find((a: ITelegramPendingAction) => a.token === token);
  if (!action) return { outcome: "already_done" };

  if (!approve) {
    logTelegramEvent("agent_action_cancelled", { tool: action.tool, label: action.label, origin: action.origin }, state.chatId);
    if (action.origin === "prospection" && action.candidatureId) {
      // Offre issue d'un job board (source "scraper") : on la GARDE en la passant « refus » —
      // la supprimer ferait re-insérer puis re-proposer la même offre au prochain run de
      // recherche (la dédup des crons repose sur la présence de l'URL en base). Pas de
      // blacklist non plus : l'URL pointe l'agrégateur, pas l'entreprise.
      const ignoredOffer = await Candidature.findOneAndUpdate(
        { _id: action.candidatureId, statut: "identifiée", source: "scraper" },
        { $set: { statut: "refus" } }
      )
        .lean<ICandidature | null>()
        .catch(() => null);
      if (ignoredOffer) {
        await appendModelNote(state.chatId, `Offre ignorée par l'utilisateur (conservée en « refus ») : ${action.label}`);
        return {
          outcome: "cancelled",
          label: action.label,
          resultText: "❌ Offre écartée (gardée en base en « refus » pour ne pas te la re-proposer).",
        };
      }
      // « Ignorer » une cible de prospection : suppression UNIQUEMENT si la candidature est
      // encore « identifiée » — si elle a évolué entre-temps (envoyée, travaillée à la main),
      // on ne détruit pas d'historique réel.
      const cand = await Candidature.findOneAndDelete({ _id: action.candidatureId, statut: "identifiée" })
        .lean<ICandidature | null>()
        .catch(() => null);
      if (!cand) {
        await appendModelNote(state.chatId, `Cible ignorée mais candidature déjà traitée/modifiée, conservée : ${action.label}`);
        return {
          outcome: "cancelled",
          label: action.label,
          resultText: "ℹ️ Cette candidature a évolué entre-temps (déjà envoyée ou modifiée) — je l'ai laissée en place, patron.",
        };
      }
      // Blacklist sur le domaine RACINE stocké à la proposition (l'url de la candidature
      // peut pointer un ATS externe — la blacklister raterait la cible au prochain run).
      const domain = action.domain || (() => {
        try {
          return cand.url && !cand.url.startsWith("manual:")
            ? new URL(cand.url).hostname.replace(/^www\./, "")
            : null;
        } catch {
          return null;
        }
      })();
      if (domain) {
        await recordProspectSkip({
          domain,
          entreprise: cand.entreprise,
          reason: "user_ignored",
          detail: "Ignorée via Telegram (prospection interactive)",
        }).catch(() => {});
      }
      await appendModelNote(state.chatId, `Cible de prospection ignorée par l'utilisateur : ${action.label}`);
      return { outcome: "cancelled", label: action.label };
    }
    await appendModelNote(state.chatId, `Action annulée par l'utilisateur : ${action.label}`);
    return { outcome: "cancelled", label: action.label };
  }

  // Échec (retourné ou levé) : on repasse l'action en pending pour que les boutons restent
  // actifs — sans ça le claim resterait « confirmed » et un re-tap répondrait « Déjà traité »
  // sans possibilité de réessayer (même trade-off assumé que le flux ar: des auto-réponses).
  const revertClaim = () =>
    TelegramState.updateOne(
      { chatId: state.chatId, "pendingActions.token": token },
      { $set: { "pendingActions.$.status": "pending", "pendingActions.$.decidedAt": null } }
    ).catch(() => {});

  try {
    const result = await executeTool(action.tool, action.input ?? {});
    const resultText = formatToolResult(action.tool, result);
    logTelegramEvent(
      "agent_action_confirmed",
      { tool: action.tool, label: action.label, ok: !result.body.error },
      state.chatId
    );
    // Erreur retournée (pas levée) par le tool → outcome failed : sinon la carte afficherait
    // « ✅ Exécutée » avec un texte d'échec, et la continuation post-✅ partirait sur un échec.
    if (result.body.error) {
      await appendModelNote(state.chatId, `Action en échec (${action.label}) → ${result.body.error}`);
      await revertClaim();
      return {
        outcome: "failed",
        label: action.label,
        resultText: `${resultText} — retape ✅ pour réessayer.`,
        origin: action.origin,
      };
    }
    await appendModelNote(state.chatId, `Action exécutée (${action.label}) → ${resultText}`);
    return { outcome: "executed", label: action.label, resultText, origin: action.origin };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendModelNote(state.chatId, `Action en échec (${action.label}) → ${msg}`);
    await revertClaim();
    return {
      outcome: "failed",
      label: action.label,
      resultText: `⚠️ Échec : ${msg} — retape ✅ pour réessayer.`,
      origin: action.origin,
    };
  }
}

// Injecte une note dans la mémoire de conversation pour que l'agent connaisse l'issue
// des actions confirmées/annulées au tour suivant.
async function appendModelNote(chatId: string, note: string): Promise<void> {
  await TelegramState.updateOne(
    { chatId },
    {
      $push: {
        conversation: {
          $each: [{ role: "model", text: note, at: new Date() }],
          $slice: -2 * CONVERSATION_WINDOW,
        },
      },
    }
  ).catch(() => {});
}
