import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { connectDB } from "./mongodb";
import { Candidature, ICandidature, IEmailReceived } from "@/models/Candidature";
import { getSettingsDoc } from "@/models/Settings";
import { sendNotification } from "./notifications";

const ARCHIVE_LABEL = "Cockpit/Réponses candidatures";

interface MatchedEmail {
  uid: number;
  date: Date;
  from: string;
  fromName?: string;
  subject: string;
  snippet: string;
  messageId?: string;
}

function normalizeEmail(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

function snippetFromBody(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

interface SyncResult {
  ok: boolean;
  scanned: number;
  matched: number;
  archived: number;
  errors: string[];
  matchedDetails: Array<{
    candidatureId: string;
    entreprise: string;
    from: string;
    subject: string;
  }>;
}

export async function syncGmailInbox(opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const result: SyncResult = {
    ok: false,
    scanned: 0,
    matched: 0,
    archived: 0,
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

  // Build candidate emails map (lowercase email -> candidature)
  const candidatures = await Candidature.find({
    email: { $ne: "" },
  }).lean<ICandidature[]>();

  const emailToCandidature = new Map<string, ICandidature>();
  for (const c of candidatures) {
    const e = normalizeEmail(c.email);
    if (e) {
      // Latest wins (already sorted by Mongo default)
      if (!emailToCandidature.has(e)) emailToCandidature.set(e, c);
    }
  }

  if (emailToCandidature.size === 0) {
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
      // Search unseen messages from any of our candidature emails
      const fromAddresses = Array.from(emailToCandidature.keys());

      // IMAP search "FROM" can only take one address at a time efficiently — combine via OR
      // Simpler: fetch all unseen messages from last 30 days and filter in code
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const searchResult = await client.search({ seen: false, since });
      const uids: number[] = Array.isArray(searchResult) ? (searchResult as number[]) : [];
      result.scanned = uids.length;

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
          if (!fromEmail || !emailToCandidature.has(fromEmail)) continue;

          const candidature = emailToCandidature.get(fromEmail)!;

          // Parse message for snippet
          let snippet = "";
          if (msg.source) {
            try {
              const parsed = await simpleParser(msg.source as Buffer);
              snippet = snippetFromBody(parsed.text);
            } catch {
              // ignore parse error
            }
          }

          // Skip if already in emailsReceived (by messageId)
          const messageId = msg.envelope.messageId ?? undefined;
          const candDoc = await Candidature.findById(candidature._id);
          if (!candDoc) continue;
          if (
            messageId &&
            (candDoc.emailsReceived ?? []).some((e: IEmailReceived) => e.messageId === messageId)
          ) {
            continue;
          }

          const rawDate = msg.internalDate ?? msg.envelope.date ?? new Date();
          const matched: MatchedEmail = {
            uid,
            date: rawDate instanceof Date ? rawDate : new Date(rawDate),
            from: fromEmail,
            fromName: fromAddr?.name,
            subject: msg.envelope.subject ?? "(sans sujet)",
            snippet,
            messageId,
          };

          // Add to candidature
          candDoc.emailsReceived = [
            ...(candDoc.emailsReceived ?? []),
            {
              date: matched.date,
              from: matched.from,
              fromName: matched.fromName,
              subject: matched.subject,
              snippet: matched.snippet,
              messageId: matched.messageId,
              uid: matched.uid,
              archived: autoArchive,
            },
          ];

          // Update status if currently postulée
          if (candDoc.statut === "postulée") {
            candDoc.statut = "réponse reçue";
          }

          if (!opts.dryRun) {
            await candDoc.save();
          }

          result.matched++;
          result.matchedDetails.push({
            candidatureId: String(candDoc._id),
            entreprise: candDoc.entreprise,
            from: matched.from,
            subject: matched.subject,
          });

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
            }).catch(() => {});
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
    settingsDoc.gmail.lastSyncSummary = `${result.matched} match${result.matched > 1 ? "s" : ""} sur ${result.scanned} non lus${result.archived > 0 ? `, ${result.archived} archivé(s)` : ""}${result.errors.length ? `, ${result.errors.length} erreur(s)` : ""}`;
    await settingsDoc.save();
  }

  return result;
}
