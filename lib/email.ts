import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { withRetry } from "./retry";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const transporter = getTransporter();

  await withRetry(
    () =>
      transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        html,
      }),
    { retries: 2, baseDelayMs: 1000 }
  );
}

export interface ReplyInThreadInput {
  to: string;
  subject: string;
  bodyText: string;
  inReplyToMessageId?: string;
  references?: string;
}

export interface ReplyInThreadResult {
  messageId?: string;
}

// RFC 2822 : Message-ID must be enclosed in angle brackets <...>.
// IMAP envelopes parfois retournent l'ID brut (sans chevrons) — Nodemailer attend la forme avec chevrons,
// sinon Gmail ne thread plus et certains MTA marquent la réponse comme orpheline.
function ensureBrackets(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "";
  const inner = trimmed.replace(/^<+/, "").replace(/>+$/, "");
  return `<${inner}>`;
}

function normalizeReferences(references: string | undefined): string {
  if (!references) return "";
  return references
    .split(/\s+/)
    .filter(Boolean)
    .map(ensureBrackets)
    .join(" ");
}

// URL du portfolio public — exposé via env pour pouvoir changer sans rebuild.
const PORTFOLIO_URL = process.env.PROFIL_PORTFOLIO_URL ?? "https://hamiani.mohammed.harmonith.fr";

function portfolioDisplay(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// Bloc signature + disclaimer compact (juste sous le corps du mail).
// Volontairement SANS séparateur "—\n" ni ligne horizontale "─────" : Gmail trim
// agressivement tout ce qui suit ces patterns reconnus comme signature, surtout sur les
// replies en milieu de thread mobile. Format compact = ratio body/footer + faible et
// pas de trigger heuristique → le RH voit toujours la mention IA + le portfolio.
function agentSignatureText(): string {
  return `\nAgent Cockpit · pour Mohammed Hamiani · ${PORTFOLIO_URL}`;
}

function agentSignatureHtml(): string {
  return `
<div style="margin-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1f2937;line-height:1.5;">
  <span style="font-weight:600;">Agent Cockpit</span>
  <span style="color:#6b7280;"> · pour Mohammed Hamiani · </span>
  <a href="${PORTFOLIO_URL}" style="color:#ff6b35;text-decoration:none;font-weight:500;">${portfolioDisplay(PORTFOLIO_URL)}</a>
</div>`;
}

// Disclaimer IA — 1 ligne, pas de cadre type signature. Garde l'essentiel : "c'est un agent
// IA + Mohammed corrige derrière si besoin".
const AGENT_FOOTER_TEXT = `🤖 Réponse rédigée par l'agent IA de Mohammed (corrigée humain-à-humain en cas de bourde).`;

const AGENT_FOOTER_HTML = `
<div style="margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#6b7280;font-style:italic;line-height:1.5;">
  🤖 Réponse rédigée par l'agent IA de Mohammed (corrigée humain-à-humain en cas de bourde).
</div>`;

// Send a reply that keeps Gmail threading by setting In-Reply-To + References headers.
export async function replyInThread(input: ReplyInThreadInput): Promise<ReplyInThreadResult> {
  const transporter = getTransporter();
  const subject = input.subject.toLowerCase().startsWith("re:")
    ? input.subject
    : `Re: ${input.subject}`;

  const inReplyTo = input.inReplyToMessageId ? ensureBrackets(input.inReplyToMessageId) : undefined;

  // References = original References (normalisée) + the message we reply to
  const refsParts: string[] = [];
  const normalizedExisting = normalizeReferences(input.references);
  if (normalizedExisting) refsParts.push(normalizedExisting);
  if (inReplyTo) refsParts.push(inReplyTo);
  const referencesHeader = refsParts.join(" ").trim();

  // RFC 2822 : header line max 998 chars. Si References est très long, on garde le 1er + les 5 derniers tokens
  // (pratique courante pour préserver la racine de thread + le contexte récent).
  const tokens = referencesHeader.split(/\s+/).filter(Boolean);
  const trimmedRefs = tokens.length > 6 ? [tokens[0], ...tokens.slice(-5)].join(" ") : tokens.join(" ");

  const htmlBody = input.bodyText
    .split("\n")
    .map((line) => (line.trim() ? `<p style="margin:0 0 12px 0">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : ""))
    .join("");

  // Ordre final : corps IA → signature Agent Cockpit + portfolio → footer mea culpa
  const textWithFooter = `${input.bodyText}\n${agentSignatureText()}\n\n${AGENT_FOOTER_TEXT}`;
  const htmlWithFooter = `<div style="font-family: Arial, sans-serif; max-width: 800px;">${htmlBody}${agentSignatureHtml()}${AGENT_FOOTER_HTML}</div>`;

  const info = await withRetry(
    () =>
      transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: input.to,
        subject,
        text: textWithFooter,
        html: htmlWithFooter,
        inReplyTo,
        references: trimmedRefs || undefined,
      }),
    { retries: 2, baseDelayMs: 1000 }
  );

  return { messageId: info?.messageId };
}

export async function sendCandidature(
  entreprise: string,
  poste: string,
  email: string,
  letterPdfBuffer: Buffer,
  candidatName: string = "Mohammed Hamiani",
  type: "stage" | "alternance" | "cdi" = "stage",
  cvOverride?: { buffer: Buffer; filename: string }
): Promise<void> {
  const isSpontanee = poste.toLowerCase().includes("spontanée") || poste.toLowerCase().includes("spontanee");

  let subjectPrefix = "Candidature";
  let typeLabel = "stage";
  let emailBody = "";

  if (type === "stage") {
    typeLabel = "stage";
    subjectPrefix = "Candidature - Stage";
  } else if (type === "alternance") {
    typeLabel = "alternance";
    subjectPrefix = "Candidature - Alternance";
  } else if (type === "cdi") {
    typeLabel = "CDI";
    subjectPrefix = "Candidature - CDI";
  }

  const subject = isSpontanee
    ? `${subjectPrefix} développeur - ${candidatName}`
    : `${subjectPrefix} - ${poste} - ${candidatName}`;

  if (isSpontanee) {
    const typeText =
      type === "cdi" ? "un CDI en développement web" :
      type === "alternance" ? "une alternance en développement web dès septembre 2026" :
      "un stage de 3 mois en développement web, avec la possibilité de poursuivre en alternance dès septembre 2026";

    emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <p>Bonjour,</p>
      <p>Actuellement en formation Concepteur Développeur d'Applications, je me permets de vous contacter car le travail de <strong>${entreprise}</strong> m'intéresse particulièrement.</p>
      <p>Je suis à la recherche de <strong>${typeText}</strong>.</p>
      <p>Vous trouverez ci-joint mon CV ainsi qu'une lettre de motivation détaillant mon parcours et mes motivations.</p>
      <p>Je serais ravi d'échanger avec vous à ce sujet.</p>
      <p>Cordialement,<br><strong>${candidatName}</strong></p>
    </div>
  `;
  } else {
    emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <p>Bonjour,</p>
      <p>Votre offre de <strong>${poste}</strong> a retenu toute mon attention et je souhaite vous proposer ma candidature.</p>
      <p>Vous trouverez ci-joint mon CV ainsi qu'une lettre de motivation détaillant mon parcours et mes motivations pour ce poste.</p>
      <p>Je reste disponible pour en discuter à votre convenance.</p>
      <p>Cordialement,<br><strong>${candidatName}</strong></p>
    </div>
  `;
  }

  const html = emailBody;

  let cvBuffer: Buffer;
  let cvFilename = `CV_${candidatName.replace(/\s+/g, "_")}.pdf`;
  if (cvOverride) {
    cvBuffer = cvOverride.buffer;
    if (cvOverride.filename) cvFilename = cvOverride.filename;
  } else {
    const cvPath = path.join(process.cwd(), "candidatureModel", "cv-mohammed.pdf");
    if (!fs.existsSync(cvPath)) {
      throw new Error(`Aucun CV disponible : importe un CV depuis /dashboard/cv-files ou place candidatureModel/cv-mohammed.pdf.`);
    }
    cvBuffer = fs.readFileSync(cvPath);
  }

  const transporter = getTransporter();
  await withRetry(
    () =>
      transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject,
        html,
        attachments: [
          {
            filename: cvFilename,
            content: cvBuffer,
            contentType: "application/pdf",
          },
          {
            filename: `Lettre_Motivation_${entreprise.replace(/\s+/g, "_")}.pdf`,
            content: letterPdfBuffer,
            contentType: "application/pdf",
          },
        ],
      }),
    {
      retries: 2,
      baseDelayMs: 1000,
      onRetry: (err, attempt) =>
        console.warn(`[sendCandidature] retry ${attempt + 1}: ${err instanceof Error ? err.message : err}`),
    }
  );
}

export async function sendRelance(
  entreprise: string,
  poste: string,
  email: string,
  message: string,
  templateTitle: string,
  type: "stage" | "alternance" | "cdi" = "stage",
  candidatName: string = "Mohammed Hamiani"
): Promise<void> {
  const isSpontanee = poste.toLowerCase().includes("spontanée") || poste.toLowerCase().includes("spontanee");

  let typeLabel = "Stage";
  if (type === "alternance") typeLabel = "Alternance";
  else if (type === "cdi") typeLabel = "CDI";

  const subject = isSpontanee
    ? `${templateTitle} - Candidature ${typeLabel} développeur - ${candidatName}`
    : `${templateTitle} - ${poste} - ${candidatName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      ${message.split("\n").map(line => line.trim() ? `<p>${line}</p>` : "").join("")}
    </div>
  `;

  const transporter = getTransporter();
  await withRetry(
    () =>
      transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject,
        html,
      }),
    {
      retries: 2,
      baseDelayMs: 1000,
      onRetry: (err, attempt) =>
        console.warn(`[sendRelance] retry ${attempt + 1}: ${err instanceof Error ? err.message : err}`),
    }
  );
}
