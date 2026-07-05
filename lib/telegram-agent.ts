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
import { executeTool, ToolRunResult } from "./ai/tool-runner";
import {
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
  sendTelegramChatAction,
  sendTelegramAudio,
  getTelegramFileAsBase64,
} from "./telegram";

const MODEL = process.env.CHAT_MODEL ?? "gemini-2.5-flash";
const MAX_TOOL_ROUNDS = 6;
const CONVERSATION_WINDOW = 16;

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
  "• « ajoute une candidature chez X, poste dev fullstack »",
  "• « supprime la candidature test »",
  "• « programme une relance pour Extia lundi 9h »",
  "• « rappelle-moi de préparer l'entretien dimanche 18h » / « annule ce rappel »",
  "• « passe Divalto en entretien »",
  "• « pourquoi tu ne proposes plus tel domaine ? » (blacklist)",
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
  const profileName = lite.profileName ?? process.env.PROFIL_NOM ?? "Mohammed Hamiani";
  const memoryBlock = await buildMemoryBlock();
  return `Tu es le compagnon de route et conseiller carrière personnel de ${profileName}, joignable sur Telegram. Tu n'es pas un chatbot générique : tu le connais (bloc mémoire ci-dessous), tu suis sa recherche d'alternance comme un coach — opinionated, bienveillant mais franc, orienté résultats. Tu adaptes chaque conseil à SON profil, son école, son parcours et ses préférences. Tu communiques en français, direct, factuel. Phrases courtes, pas de blabla, pas de markdown (texte brut Telegram : pas de **, pas de #, tirets simples pour les listes).

Tu appelles l'utilisateur « patron » — de temps en temps, pas à chaque message (environ un message sur deux ou trois, aux moments naturels : salutation, bonne nouvelle, confirmation). Ex. « Salut patron », « C'est envoyé, patron. ». Jamais « mon maître », jamais son prénom.

MÉMOIRE PROACTIVE : dès que la conversation révèle une info personnelle DURABLE (école intégrée, dates, rythme d'alternance, préférences de boîtes, traits de personnalité, objectifs, événements de parcours), appelle remember_fact SANS qu'on te le demande — puis continue ta réponse normalement. Si une info clé pour bien le conseiller te manque (école, date de démarrage, rythme), pose UNE question courte au moment naturel, pas un interrogatoire. list_memory / forget_fact pour consulter et corriger.${memoryBlock}

Brièveté : 1 phrase plutôt que 3. Pas d'introduction ni de conclusion bavarde. N'annonce pas ce que tu vas faire — fais-le.

Confirmation des actions : quand tu appelles un tool d'action (schedule_relance, cancel_relance, update_candidature_status, update_candidature_notes, send_relance_now, apply_to_company, process_pending_candidatures, create_candidature, delete_candidature), le système envoie AUTOMATIQUEMENT des boutons ✅/❌ à l'utilisateur. NE demande JAMAIS de confirmation dans le texte, appelle directement le tool. Après l'appel, contente-toi d'annoncer en une phrase ce qui attend sa confirmation.

VÉRITÉ SUR L'ÉTAT (critique) : une action à confirmation n'est PAS faite tant que l'utilisateur n'a pas tapé ✅. Ne dis JAMAIS « c'est envoyé » ou « c'est fait » à ce stade — dis « en attente de ta validation ». Une action n'est réellement faite que quand une ligne « Action exécutée (…) » apparaît dans l'historique. De même, dry_run = simulation : rien n'est envoyé.

Les tools de lecture (list_candidatures, get_candidature, get_lettre, get_stats, list_relances_due, list_pending_approvals, resend_pending_approval, list_cv_sections, get_cv_section, research_company, search_offers, list_reminders, list_blacklist) s'exécutent immédiatement — utilise-les librement quand la question porte sur les données. cancel_reminder, unblacklist_domain, write_letter et set_lettre s'exécutent aussi immédiatement (rien n'est envoyé, versions archivées) : ne les appelle que sur demande explicite et non ambiguë de l'utilisateur.

Recherche d'offres : « cherche des offres », « il y a quoi en ce moment ? » → search_offers (job boards en direct). Pour suivre une offre qui l'intéresse → create_candidature avec les infos de l'offre (rien n'est envoyé). Bilan/avancement (« où j'en suis ? ») → get_stats. « Montre-moi la lettre » → get_lettre.

Tests d'envoi : apply_to_company persiste la candidature en base MÊME en dry_run. Après un test, propose delete_candidature pour nettoyer, sinon les envois suivants vers la même URL seront bloqués en doublon.

PERSONNALISATION DES LETTRES — c'est ton point fort, sers-t'en :
- Par défaut la lettre = template fixe + un paragraphe central généré. Dès que l'utilisateur exprime un angle (« insiste sur le management », « parle de leur produit X », « ton plus direct »), passe letter_instruction à apply_to_company/create_candidature, ou write_letter(candidature_id, instruction) sur une candidature existante — montre le résultat, itère jusqu'à ce qu'il valide.
- Pour une lettre 100 % sur mesure : RÉDIGE-LA TOI-MÊME dans la conversation, en t'appuyant sur ta mémoire (école, parcours, objectifs), le CV (get_cv_section) et l'entreprise (research_company, get_candidature). Propose un angle, discute, ajuste. Une fois qu'il dit explicitement OK → set_lettre pour l'enregistrer : c'est elle qui partira.
- Workflow candidature soignée : apply_to_company en dry_run → get_lettre → itérations (write_letter ou set_lettre) → envoi réel (la lettre validée est conservée si tu ne repasses pas de letter_instruction et que le type ne change pas).
- Avant une candidature importante, demande-lui s'il veut un angle particulier plutôt que d'envoyer la lettre standard.

Rappels : schedule_telegram_reminder pour tout ce qui est « rappelle-moi de… » (préparer un entretien, une échéance) — c'est un message Telegram différé, PAS un email. Quand l'utilisateur annonce un entretien : mets à jour le statut (update_candidature_status) ET propose un rappel de préparation la veille.

Quand l'utilisateur mentionne une entreprise (« c'est quoi X ? », « ils recrutent ? », « tu penses quoi de X ? ») → research_company. Présente le récap (activité, score d'adéquation, offres de leur page carrières, déjà contactée ou non) puis, si c'est pertinent et pas déjà contacté, propose de candidater — apply_to_company déclenchera les boutons de confirmation.

RÈGLE ANTI-INVENTION (critique) : ne cite JAMAIS de noms d'entreprises, de postes, de chiffres ou de dates qui ne viennent pas d'un résultat de tool. Si la donnée demandée n'apparaît ni dans un résultat de tool du tour courant, ni dans une ligne « [résultat …] » de l'historique, appelle le tool — ne complète JAMAIS de mémoire. Inventer une liste est une faute grave.
L'historique peut contenir des lignes « [résultat <tool>] {…} » : ce sont les vraies données de tes appels précédents (avec les _id). Réutilise-les pour les questions de suivi (« détail du 2e », « celle d'Orano »…).

Si l'utilisateur demande « ce qui est en attente » de validation Telegram → list_pending_approvals, puis propose resend_pending_approval pour renvoyer les boutons d'une réponse précise.

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
      text: "Transcris fidèlement ce message vocal (français par défaut). Réponds UNIQUEMENT avec la transcription, sans commentaire ni guillemets. Si l'audio est vide ou inintelligible, réponds exactement : [inaudible]",
    },
  ]);
  const transcription = result.response.text().trim();

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
  opts: { voiceReply?: boolean } = {}
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await sendTelegramMessage("⚠️ GEMINI_API_KEY non configuré côté serveur — je ne peux pas réfléchir.");
    return;
  }

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
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  });

  let finalText = "";
  const proposals: Array<Pick<ITelegramPendingAction, "token" | "tool" | "input" | "label" | "origin">> = [];
  // Digests des tools de lecture exécutés : persistés dans la mémoire de conversation pour
  // que les tours suivants disposent des VRAIES données (noms, _id) — sans ça le modèle
  // « se souvient » qu'une liste existe mais pas de son contenu, et invente.
  const toolDigests: string[] = [];

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
      const args = (fc.args ?? {}) as Record<string, unknown>;
      if (!def) {
        responseParts.push({ functionResponse: { name: fc.name, response: { error: `Tool inconnu : ${fc.name}` } } });
        continue;
      }
      if (def.requiresConfirmation) {
        const token = randomBytes(12).toString("hex");
        const label = await describeAction(fc.name, args);
        proposals.push({ token, tool: fc.name, input: args, label, origin: "agent" as const });
        responseParts.push({
          functionResponse: {
            name: fc.name,
            response: {
              status: "awaiting_user_confirmation",
              note: "Des boutons ✅/❌ ont été envoyés à l'utilisateur. N'appelle plus ce tool ; annonce en une phrase que ça attend sa confirmation.",
            },
          },
        });
      } else {
        try {
          const r = await executeTool(fc.name, args);
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

  // Persistance ATOMIQUE ($push + $slice) — jamais de réécriture des tableaux entiers :
  // deux messages traités en parallèle (webhook fire-and-forget) feraient du last-writer-wins
  // et pourraient ressusciter une pendingAction déjà confirmée (double exécution) ou effacer
  // des tours de conversation.
  const newMessages = [
    { role: "user" as const, text, at: new Date() },
    // Max 3 digests par tour pour ne pas noyer le dialogue dans la fenêtre glissante.
    ...toolDigests.slice(-3).map((d) => ({ role: "model" as const, text: d, at: new Date() })),
    ...(finalText.trim() ? [{ role: "model" as const, text: finalText.trim(), at: new Date() }] : []),
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

  if (finalText.trim()) {
    const reply = finalText.trim();
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
    await sendTelegramMessage("Je n'ai pas de réponse — reformule ou tape /aide.");
  }

  for (const p of proposals) {
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
    if (action.origin === "prospection" && action.candidatureId) {
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

  try {
    const result = await executeTool(action.tool, action.input ?? {});
    const resultText = formatToolResult(action.tool, result);
    await appendModelNote(state.chatId, `Action exécutée (${action.label}) → ${resultText}`);
    return { outcome: "executed", label: action.label, resultText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendModelNote(state.chatId, `Action en échec (${action.label}) → ${msg}`);
    return { outcome: "failed", label: action.label, resultText: `⚠️ Échec : ${msg}` };
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
