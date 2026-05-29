import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { connectDB } from "./mongodb";
import { Candidature, CandidatureStatut, ICandidature, IEmailReceived, IAutoReply } from "@/models/Candidature";
import { getSettingsDoc } from "@/models/Settings";
import { CVSection } from "@/models/CVSection";
import { sendNotification } from "./notifications";
import { classifyAndReply } from "./gemini";
import { replyInThread } from "./email";
import {
  buildCandidatureEmailIndex,
  findCandidatureForSender,
  normalizeEmail as normalizeEmailShared,
} from "./gmail-imap-matching";

const ARCHIVE_LABEL = "Cockpit/Réponses candidatures";

interface MatchedEmail {
  uid: number;
  date: Date;
  from: string;
  fromName?: string;
  subject: string;
  snippet: string;
  bodyText: string;
  messageId?: string;
  references?: string;
}

const normalizeEmail = normalizeEmailShared;

function snippetFromBody(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

interface SyncResult {
  ok: boolean;
  scanned: number;
  matched: number;
  archived: number;
  autoReplied: number;
  autoReplySkipped: number;
  errors: string[];
  matchedDetails: Array<{
    candidatureId: string;
    entreprise: string;
    from: string;
    subject: string;
    autoReply?: {
      category: string;
      confidence: number;
      sent: boolean;
      error?: string;
    };
  }>;
}

export async function syncGmailInbox(opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const result: SyncResult = {
    ok: false,
    scanned: 0,
    matched: 0,
    archived: 0,
    autoReplied: 0,
    autoReplySkipped: 0,
    errors: [],
    matchedDetails: [],
  };

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    result.errors.push("GMAIL_USER ou GMAIL_APP_PASSWORD manquant");
    return result;
  }

  await connectDB();
  const settingsDoc = await getSettingsDoc();
  const autoArchive = settingsDoc.gmail.autoArchiveResponses && !opts.dryRun;
  const autoReplyEnabled = !!settingsDoc.gmail.autoReplyEnabled;
  const autoReplyMinConfidence = typeof settingsDoc.gmail.autoReplyMinConfidence === "number"
    ? settingsDoc.gmail.autoReplyMinConfidence
    : 0.7;
  const profileAvailability = settingsDoc.profile?.availability ?? "";
  // Calendly url is read from the CVSection "contact" — single source of truth (no duplicate).
  let profileCalendlyUrl = "";
  try {
    const contactSection = await CVSection.findOne({ type: "contact" }).lean<{ content?: { calendly?: string } } | null>();
    profileCalendlyUrl = contactSection?.content?.calendly?.trim() ?? "";
  } catch {
    /* ignore — pas bloquant si la section n'existe pas encore */
  }

  // Build candidate emails map (lowercase email -> candidature)
  const candidatures = await Candidature.find({
    email: { $ne: "" },
  }).lean<ICandidature[]>();

  // Index email exact + index domaine pour le fallback "collègue répond depuis l'autre alias".
  // Cf. lib/gmail-imap-matching.ts pour la logique testée.
  const candidatureIndex = buildCandidatureEmailIndex(candidatures);

  if (candidatureIndex.emailToCandidature.size === 0) {
    result.ok = true;
    return result;
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search unseen messages from last 30 days then filter en code via l'index candidatures.
      // (Le filtrage IMAP par FROM ne supporte qu'une seule adresse à la fois — on filtre côté code.)
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const searchResult = await client.search({ seen: false, since });
      const uids: number[] = Array.isArray(searchResult) ? (searchResult as number[]) : [];
      result.scanned = uids.length;

      const selfEmail = normalizeEmail(process.env.GMAIL_USER ?? "");
      const BOUNCE_PREFIXES = ["mailer-daemon@", "postmaster@", "noreply@", "no-reply@", "bounces@"];

      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(String(uid), {
            envelope: true,
            internalDate: true,
            source: true,
          });
          if (!msg || !msg.envelope) continue;

          const fromAddr = msg.envelope.from?.[0];
          const fromEmail = normalizeEmail(fromAddr?.address);
          if (!fromEmail) continue;

          // Match exact email d'abord, fallback domaine si 1 seule candidature sur le domaine.
          const candidature = findCandidatureForSender(fromEmail, candidatureIndex);
          if (!candidature) continue;

          // Parse message for snippet + full body (needed for auto-reply classification)
          let snippet = "";
          let bodyText = "";
          let references: string | undefined;
          let parsedHeaders: Map<string, unknown> | null = null;
          if (msg.source) {
            try {
              const parsed = await simpleParser(msg.source as Buffer);
              snippet = snippetFromBody(parsed.text);
              // Keep up to 8k chars — enough context for classification, bounded for DB size
              bodyText = (parsed.text ?? "").slice(0, 8000);
              const ref = parsed.references;
              if (ref) references = Array.isArray(ref) ? ref.join(" ") : ref;
              parsedHeaders = parsed.headers as unknown as Map<string, unknown>;
            } catch {
              // ignore parse error
            }
          }

          // ---------- Safeguards : éviter boucles infinies et auto-replies sur bounces / mailing lists ----------
          // 1. Ne JAMAIS répondre à un mail qu'on s'est envoyé à soi-même (Gmail rapatrie parfois les sent en INBOX)
          if (selfEmail && fromEmail === selfEmail) continue;
          // 2. Skip les bounces / no-reply / postmaster
          if (BOUNCE_PREFIXES.some((p) => fromEmail.startsWith(p))) continue;
          // 3. Skip les headers d'auto-replies / mailing lists / bulk
          if (parsedHeaders) {
            const getHeader = (name: string): string => {
              const raw = parsedHeaders!.get(name.toLowerCase());
              if (!raw) return "";
              if (typeof raw === "string") return raw.toLowerCase();
              if (Array.isArray(raw)) return raw.map(String).join(" ").toLowerCase();
              return String(raw).toLowerCase();
            };
            const autoSubmitted = getHeader("auto-submitted");
            const precedence = getHeader("precedence");
            const listId = getHeader("list-id");
            const xAutoreply = getHeader("x-autoreply");
            if (autoSubmitted && autoSubmitted.includes("auto-replied")) continue;
            if (precedence && (precedence.includes("bulk") || precedence.includes("list") || precedence.includes("auto_reply"))) continue;
            if (listId) continue;
            if (xAutoreply) continue;
          }

          const messageId = msg.envelope.messageId ?? undefined;

          // ---------- Idempotence atomique : updateOne avec condition $ne sur messageId ----------
          // Évite la race condition cron + bouton manuel qui sinon enverraient 2 auto-replies.
          // findOneAndUpdate retourne le doc post-update si modifiedCount === 1, sinon on skip.
          const rawDate = msg.internalDate ?? msg.envelope.date ?? new Date();
          const matched: MatchedEmail = {
            uid,
            date: rawDate instanceof Date ? rawDate : new Date(rawDate),
            from: fromEmail,
            fromName: fromAddr?.name,
            subject: msg.envelope.subject ?? "(sans sujet)",
            snippet,
            bodyText,
            messageId,
            references,
          };

          let candDoc;
          if (opts.dryRun) {
            // En dry-run on lit le doc sans muter
            candDoc = await Candidature.findById(candidature._id);
            if (!candDoc) continue;
            if (
              messageId &&
              (candDoc.emailsReceived ?? []).some((e: IEmailReceived) => e.messageId === messageId)
            ) {
              continue;
            }
          } else {
            const newEmailEntry = {
              date: matched.date,
              from: matched.from,
              fromName: matched.fromName,
              subject: matched.subject,
              snippet: matched.snippet,
              bodyText: matched.bodyText,
              messageId: matched.messageId,
              references: matched.references,
              uid: matched.uid,
              archived: autoArchive,
            };
            // Condition d'idempotence : messageId absent du tableau (ou messageId vide → toujours push)
            const filter = messageId
              ? { _id: candidature._id, "emailsReceived.messageId": { $ne: messageId } }
              : { _id: candidature._id };
            candDoc = await Candidature.findOneAndUpdate(
              filter,
              {
                $push: { emailsReceived: newEmailEntry },
                $set: {
                  ...(matched.date ? { updated_at: new Date() } : {}),
                },
              },
              { new: true }
            );
            if (!candDoc) {
              // Un autre process a déjà traité ce messageId (race condition évitée), skip silencieusement
              continue;
            }
            // À tout mail entrant : annuler les relances en attente + bumper postulée → réponse reçue.
            // updateOne atomique (au lieu de candDoc.save()) pour ne pas écraser un autoReplies poussé
            // par un sync gmail concurrent entre le findOneAndUpdate ci-dessus et maintenant.
            const bumpStatut = candDoc.statut === "postulée";
            await Candidature.updateOne(
              { _id: candDoc._id },
              {
                $set: {
                  ...(bumpStatut ? { statut: "réponse reçue" } : {}),
                  "relanceHistory.$[r].status": "annulée",
                  "relanceHistory.$[r].error": "Réponse reçue de l'entreprise",
                },
              },
              { arrayFilters: [{ "r.status": "programmée" }] }
            );
            // Refléter en mémoire pour la suite de la boucle (classify + autoReply)
            if (bumpStatut) candDoc.statut = "réponse reçue";
            for (const r of candDoc.relanceHistory ?? []) {
              if (r.status === "programmée") {
                r.status = "annulée";
                r.error = "Réponse reçue de l'entreprise";
              }
            }
          }

          result.matched++;
          const detail: SyncResult["matchedDetails"][number] = {
            candidatureId: String(candDoc._id),
            entreprise: candDoc.entreprise,
            from: matched.from,
            subject: matched.subject,
          };
          result.matchedDetails.push(detail);

          // ---------- Auto-reply ----------
          // Garde dure : sans messageId on ne peut pas garantir l'idempotence atomique (race condition
          // entre 2 syncs concurrents → double envoi possible) ni tracer proprement dans autoReplies.
          // On préfère ne pas répondre du tout plutôt qu'envoyer 2x à un RH.
          if (autoReplyEnabled && matched.bodyText.trim().length > 0 && matched.messageId) {
            try {
              // Idempotence pré-classify : si une autoReply existe déjà pour ce inboundMessageId, skip
              // (couvre le cas où l'idempotence emailsReceived a foiré mais autoReplies est en place)
              if (!opts.dryRun) {
                const already = (candDoc.autoReplies ?? []).some(
                  (a: IAutoReply) => a.inboundMessageId === matched.messageId
                );
                if (already) {
                  // Skip auto-reply silencieusement : déjà traité par un run concurrent
                  continue;
                }
              }

              const cls = await classifyAndReply({
                entreprise: candDoc.entreprise,
                poste: candDoc.poste,
                candidatureType: candDoc.type,
                fromName: matched.fromName,
                subject: matched.subject,
                bodyText: matched.bodyText,
                availability: profileAvailability,
                calendlyUrl: profileCalendlyUrl,
              });

              // Si l'IA détecte un refus ou un entretien avec confiance suffisante, on fait remonter
              // le statut au-delà de "réponse reçue". On ne dégrade pas un statut terminal déjà posé
              // manuellement (refus/acceptée) ni un statut "entretien" déjà en cours.
              if (!opts.dryRun && cls.confidence >= autoReplyMinConfidence) {
                const TERMINAL: CandidatureStatut[] = ["refus", "acceptée", "entretien"];
                let inferredStatut: CandidatureStatut | null = null;
                if (cls.category === "refus") inferredStatut = "refus";
                else if (cls.category === "entretien") inferredStatut = "entretien";
                if (inferredStatut && !TERMINAL.includes(candDoc.statut)) {
                  await Candidature.updateOne(
                    { _id: candDoc._id, statut: { $nin: TERMINAL } },
                    { $set: { statut: inferredStatut } }
                  );
                  candDoc.statut = inferredStatut;
                }
              }

              const shouldSend = cls.confidence >= autoReplyMinConfidence;
              let sentMessageId: string | undefined;
              let sendError: string | undefined;

              if (shouldSend && !opts.dryRun) {
                // Idempotence atomique sur le push d'autoReply : on push UNIQUEMENT si aucune autoReply
                // n'existe encore pour cet inboundMessageId. modifiedCount === 1 → on est propriétaire de l'envoi.
                if (matched.messageId) {
                  const claim = await Candidature.updateOne(
                    {
                      _id: candDoc._id,
                      "autoReplies.inboundMessageId": { $ne: matched.messageId },
                    },
                    {
                      $push: {
                        autoReplies: {
                          date: new Date(),
                          inboundMessageId: matched.messageId,
                          category: cls.category,
                          confidence: cls.confidence,
                          reply: cls.reply,
                          sent: false,
                          sentMessageId: undefined,
                          error: null,
                          model: cls.model,
                          dryRun: false,
                        },
                      },
                    }
                  );
                  if (claim.modifiedCount !== 1) {
                    // Une autre exécution a déjà claim cet inbound, on skip pour éviter le double envoi.
                    continue;
                  }
                }

                try {
                  const sent = await replyInThread({
                    to: matched.from,
                    subject: matched.subject,
                    bodyText: cls.reply,
                    inReplyToMessageId: matched.messageId,
                    references: matched.references,
                  });
                  sentMessageId = sent.messageId;
                  result.autoReplied++;
                } catch (sendErr) {
                  sendError = sendErr instanceof Error ? sendErr.message : String(sendErr);
                  result.errors.push(`Auto-reply send failed for ${candDoc.entreprise}: ${sendError}`);
                }

                // Patch l'entrée autoReplies pushée plus haut avec le résultat de l'envoi
                if (matched.messageId) {
                  await Candidature.updateOne(
                    { _id: candDoc._id, "autoReplies.inboundMessageId": matched.messageId },
                    {
                      $set: {
                        "autoReplies.$.sent": !!sentMessageId,
                        "autoReplies.$.sentMessageId": sentMessageId,
                        "autoReplies.$.error": sendError ?? null,
                      },
                    }
                  );
                }
              } else if (!shouldSend) {
                result.autoReplySkipped++;
                // Confidence trop basse : on log quand même pour traçabilité (pas d'envoi)
                if (!opts.dryRun) {
                  const autoReply: IAutoReply = {
                    date: new Date(),
                    inboundMessageId: matched.messageId,
                    category: cls.category,
                    confidence: cls.confidence,
                    reply: cls.reply,
                    sent: false,
                    sentMessageId: undefined,
                    error: null,
                    model: cls.model,
                    dryRun: false,
                  };
                  const skipFilter = matched.messageId
                    ? { _id: candDoc._id, "autoReplies.inboundMessageId": { $ne: matched.messageId } }
                    : { _id: candDoc._id };
                  await Candidature.updateOne(skipFilter, { $push: { autoReplies: autoReply } });
                }
              }

              if (opts.dryRun) {
                // En dry-run on n'écrit rien en DB, juste le détail en réponse
              }

              detail.autoReply = {
                category: cls.category,
                confidence: cls.confidence,
                sent: !!sentMessageId,
                error: sendError,
              };
            } catch (classifyErr) {
              const msg = classifyErr instanceof Error ? classifyErr.message : String(classifyErr);
              result.errors.push(`Auto-reply classify failed for ${candDoc.entreprise}: ${msg}`);
            }
          }

          // Notification
          if (!opts.dryRun) {
            sendNotification({
              type: "inbox",
              candidature: {
                _id: String(candDoc._id),
                entreprise: candDoc.entreprise,
                poste: candDoc.poste,
                statut: candDoc.statut,
              },
              emailFrom: matched.fromName ? `${matched.fromName} <${matched.from}>` : matched.from,
              emailSubject: matched.subject,
              snippet: matched.snippet,
            }).catch((e) => console.error("[gmail-imap] notification failed:", e));
          }

          // Archive (move out of INBOX) if configured
          if (autoArchive) {
            try {
              await client.messageMove(String(uid), ARCHIVE_LABEL).catch(async () => {
                // Label may not exist — create it (Gmail folder = label)
                await client.mailboxCreate(ARCHIVE_LABEL).catch(() => {});
                await client.messageMove(String(uid), ARCHIVE_LABEL);
              });
              result.archived++;
            } catch (err) {
              result.errors.push(
                `Archive failed for uid ${uid}: ${err instanceof Error ? err.message : err}`
              );
            }
          }
        } catch (err) {
          result.errors.push(
            `Message ${uid}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    result.ok = true;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  // Update settings with last sync info
  if (!opts.dryRun) {
    settingsDoc.gmail.lastSyncAt = new Date();
    settingsDoc.gmail.lastSyncSummary = `${result.matched} match${result.matched > 1 ? "s" : ""} sur ${result.scanned} non lus${result.archived > 0 ? `, ${result.archived} archivé(s)` : ""}${result.autoReplied > 0 ? `, ${result.autoReplied} auto-réponse(s)` : ""}${result.autoReplySkipped > 0 ? `, ${result.autoReplySkipped} skip (confiance)` : ""}${result.errors.length ? `, ${result.errors.length} erreur(s)` : ""}`;
    await settingsDoc.save();
  }

  return result;
}
