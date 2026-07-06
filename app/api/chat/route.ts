import { NextRequest } from "next/server";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { verifyAuth } from "@/lib/auth";
import { buildContextLite } from "@/lib/ai/context";
import { toolsForGemini, getTool } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.CHAT_MODEL ?? "gemini-2.5-flash";

interface ToolCallSnapshot {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultPayload {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface ClientMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallSnapshot[];
  tool_results?: ToolResultPayload[];
}

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(apiKey: string): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY non configuré côté serveur" }),
      { status: 500 }
    );
  }

  let messages: ClientMessage[] = [];
  try {
    const body = await request.json();
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages array empty" }), { status: 400 });
  }

  const lite = await buildContextLite();
  const profileName = lite.profileName ?? process.env.PROFIL_NOM ?? "Mohammed Hamiani";

  const systemPrompt = `Tu es l'assistant personnel de ${profileName}, développeur fullstack en recherche de stage/alternance/CDI. Tu communiques en français, direct, factuel, opinionated. Phrases courtes, listes à puces, pas de blabla.

RÈGLE GÉNÉRALE — Brièveté (vaut pour TOUTES tes réponses, pas juste les actions) : sois TERSE.
- Préfère 1 phrase à 3. Pas de phrase introductive ("D'accord", "Bien sûr", "Compris").
- N'annonce JAMAIS ce que tu vas faire avant de le faire ("Je vais lister tes candidatures", "Je vais programmer la relance"). Fais-le, point.
- Pas de récap de l'évidence : ne reformule pas la demande de l'utilisateur.
- Pas de conclusion bavarde ("N'hésite pas si...", "Dis-moi si tu veux..."). Termine sur le résultat.
- Pour un résultat de tool : annonce uniquement ce qui ne se déduit PAS du contexte UI. Ex : si la card de confirmation montre déjà le détail, tu n'as rien à ajouter après l'exécution sauf le résultat brut.

IMPORTANT — Confirmation des actions : quand tu appelles un tool d'action (schedule_relance, cancel_relance, update_candidature_status, update_candidature_notes, send_relance_now, apply_to_company), NE demande JAMAIS de confirmation conversationnelle ("Tu confirmes ?", "Je peux y aller ?", "Veux-tu que je...", "Tu es sûr ?"). L'interface affiche automatiquement soit une card de validation (le user clique Confirmer/Refuser) soit des boutons d'action cliquables (chips). Appelle directement le tool. Si tu veux annoncer ce que tu fais, fais-le en MAX UNE phrase courte, JAMAIS sous forme de question.

IMPORTANT — Questions à choix : ne pose JAMAIS une question de type "Veux-tu X ou Y ?" en attendant un "oui" / "non" / "X" tapé. Si tu as besoin d'un choix, soit tu appelles un tool d'action que l'UI confirmera, soit tu attends la prochaine demande explicite de l'utilisateur. Évite les questions rhétoriques.

IMPORTANT — Action chips : certains tool results contiennent un champ \`actions\` qui déclenche l'affichage de boutons cliquables sous ton message. Quand c'est le cas, NE liste PAS verbalement les options (les boutons les affichent), NE demande PAS confirmation, et NE propose PAS verbalement de retry — l'utilisateur cliquera. Limite-toi à une phrase qui annonce le motif/résultat. Exemples :
- Bouton "Réessayer..." visible → tu écris uniquement "Aucun email RH trouvé."
- Boutons "Envoyer à <email>" visibles → tu écris uniquement "Pas d'email RH valable. Candidat : <email> (domaine différent)."

Date du jour : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

Résumé du contexte : ${lite.summary}.

Tools disponibles (n'utilise un tool QUE si l'utilisateur mentionne explicitement ce qu'il veut) :
- list_candidatures(statut?, search?) → UNIQUEMENT si l'utilisateur parle d'une ou plusieurs candidatures précises ou demande une liste
- get_candidature(id) → UNIQUEMENT si l'utilisateur cite une candidature spécifique et veut un détail
- list_relances_due() → UNIQUEMENT si l'utilisateur parle de relances ou demande quoi faire aujourd'hui
- get_lettre(id) → si l'utilisateur veut voir/relire la lettre de motivation d'une candidature
- write_letter(id, instruction?) → (re)génère la lettre avec une consigne (« insiste sur X », « plus court ») et retourne le texte ; itérable, versions archivées
- set_lettre(id, lettre) → enregistre une lettre complète rédigée sur mesure en conversation, UNIQUEMENT après validation explicite de l'utilisateur
- set_email_body(id, texte) → enregistre un corps de mail d'accompagnement sur mesure (sans salutation/signature), utilisé à l'envoi à la place du modèle. reset=true pour revenir au modèle
- send_letter_to_me(candidature_id | lettre+entreprise) → envoie la lettre (PDF + CV) sur la boîte perso de l'utilisateur pour une candidature manuelle sur plateforme. N'envoie rien à l'entreprise
- get_stats() → si l'utilisateur demande un bilan/où il en est (répartition par statut, envois 7/30j, réponses)
- search_offers(keywords, location?) → si l'utilisateur demande de chercher des offres sur les job boards. Pour suivre une offre → create_candidature
- list_reminders() / cancel_reminder(due_at) → rappels Telegram programmés
- list_blacklist(search?) / unblacklist_domain(domain) → domaines écartés par la prospection auto
- list_cv_sections() / get_cv_section(key) → UNIQUEMENT si l'utilisateur parle de son CV
- Tools d'action : schedule_relance, cancel_relance, update_candidature_status, update_candidature_notes, send_relance_now, create_candidature (ajout manuel au pipeline, sans envoi), delete_candidature (suppression définitive — tests, doublons)
- apply_to_company(url) → UNIQUEMENT si l'utilisateur demande explicitement « envoie une candidature à <URL> » ou « candidate chez <URL> ». Génère lettre + envoie mail à l'email RH extrait.
  • Si le tool retourne \`skipReason\` mentionnant "aucun email RH" → l'UI affiche automatiquement des boutons d'action (chips) à l'utilisateur. NE redonne JAMAIS verbalement les options qu'il voit déjà. Limite-toi à UNE phrase qui annonce le motif. Exemples :
    - allowGenericEmailUsed=false → tu écris uniquement : "Aucun email RH trouvé." (les chips proposent retry + abandon)
    - allowGenericEmailUsed=true avec scrapedEmails → tu écris uniquement : "Pas d'email RH valable. Candidat : <email> (domaine différent)." (les chips proposent l'envoi à cet email + abandon)
    - allowGenericEmailUsed=true sans scrapedEmails utilisables → tu peux suggérer en 1 phrase la saisie manuelle via /candidatures.
  • email_override / allow_generic_email : tu peux les utiliser quand un chip déclenche l'appel, mais NE les invoque PAS directement sans une action utilisateur explicite (clic chip ou ordre clair).

Règle absolue : NE JAMAIS appeler un tool pour une salutation, une question générale ou un message qui ne cite pas explicitement une donnée précise. Pour une question vague, demande ce que l'utilisateur veut savoir avant d'appeler quoi que ce soit. Appelle le minimum de tools nécessaires.`;

  // Build tool_call id → name lookup. Gemini's functionResponse needs the function name,
  // not the call id used by the OpenAI shape we receive from the client.
  const idToName = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) idToName.set(tc.id, tc.name);
    }
  }

  // Convert client messages → Gemini Content[]
  const contents: Content[] = [];
  for (const m of messages) {
    if (m.role === "user" && m.tool_results && m.tool_results.length > 0) {
      const parts: Part[] = m.tool_results.map((tr) => {
        const name = idToName.get(tr.tool_use_id) ?? "unknown_tool";
        let response: Record<string, unknown>;
        if (tr.is_error) {
          response = { error: tr.content };
        } else {
          try {
            const parsed = JSON.parse(tr.content);
            // Tableau nu → 400 Gemini (functionResponse.response doit être un objet Struct).
            if (Array.isArray(parsed)) {
              response = { result: parsed };
            } else {
              response = typeof parsed === "object" && parsed !== null
                ? (parsed as Record<string, unknown>)
                : { result: parsed };
            }
          } catch {
            response = { result: tr.content };
          }
        }
        return { functionResponse: { name, response } };
      });
      contents.push({ role: "user", parts });
    } else if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.tool_calls) {
        parts.push({ functionCall: { name: tc.name, args: tc.input } });
      }
      contents.push({ role: "model", parts });
    } else if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant" && m.content) {
      contents.push({ role: "model", parts: [{ text: m.content }] });
    }
  }

  // Sliding window: keep last 8 turns, puis garantir que le premier turn est un user
  // text turn. Gemini exige : functionCall après (user|functionResponse), functionResponse
  // après functionCall. Donc on strip jusqu'à trouver un user text turn — ça élimine d'un
  // coup les orphan functionResponse (user avec funcResp en tête) ET les orphan functionCall
  // (model turns en tête, qui causent "function call turn comes immediately after...").
  let windowed = contents.slice(-8);
  while (windowed.length > 0) {
    const first = windowed[0];
    const isUserText = first.role === "user" && !first.parts?.some((p) => "functionResponse" in p);
    if (isUserText) break;
    windowed = windowed.slice(1);
  }

  const last = windowed[windowed.length - 1];
  if (!last || last.role !== "user") {
    return new Response(
      JSON.stringify({ error: "Last message must be user or tool response" }),
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const model = getGenAI(apiKey).getGenerativeModel({
          model: MODEL,
          systemInstruction: systemPrompt,
          tools: toolsForGemini(),
          generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
        });

        const result = await model.generateContentStream({ contents: windowed });

        const toolCallsAcc: Array<{ name: string; args: Record<string, unknown> }> = [];
        let finishReason: string | null = null;

        for await (const chunk of result.stream) {
          try {
            const text = chunk.text();
            if (text) send("delta", { text });
          } catch {
            // chunk.text() throws when the chunk contains no text part (e.g., pure functionCall)
          }

          const fcs = chunk.functionCalls?.();
          if (fcs && fcs.length > 0) {
            for (const fc of fcs) {
              toolCallsAcc.push({
                name: fc.name,
                args: (fc.args ?? {}) as Record<string, unknown>,
              });
            }
          }

          const fr = chunk.candidates?.[0]?.finishReason;
          if (fr) finishReason = fr;
        }

        if (toolCallsAcc.length > 0) {
          const ts = Date.now();
          const tool_calls = toolCallsAcc.map((tc, i) => {
            const def = getTool(tc.name);
            return {
              id: `call_${ts}_${i}`,
              name: tc.name,
              input: tc.args,
              requires_confirmation: def?.requiresConfirmation ?? true,
            };
          });
          send("tool_calls", { tool_calls });
        }

        send("done", { model: MODEL, finish_reason: finishReason });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[chat]", msg);
        send("error", { error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
