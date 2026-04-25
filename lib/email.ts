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
