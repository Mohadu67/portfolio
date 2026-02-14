import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

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

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    html,
  });
}

export async function sendCandidature(
  entreprise: string,
  poste: string,
  email: string,
  letterPdfBuffer: Buffer,
  candidatName: string = "Mohammed Hamiani"
): Promise<void> {
  const subject = `Candidature - Poste ${poste} chez ${entreprise}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <p>Bonjour,</p>
      <p>Veuillez trouver ci-joint ma candidature pour le poste de <strong>${poste}</strong> chez <strong>${entreprise}</strong>.</p>
      <p>Vous trouverez en pièces jointes :</p>
      <ul>
        <li>Mon CV</li>
        <li>Ma lettre de motivation</li>
      </ul>
      <p>Je reste à votre disposition pour tout complément d'information.</p>
      <p>Cordialement,<br><strong>${candidatName}</strong></p>
    </div>
  `;

  const cvPath = path.join(process.cwd(), "candidatureModel", "cv-mohammed.pdf");
  const cvBuffer = fs.readFileSync(cvPath);

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: email,
    subject,
    html,
    attachments: [
      {
        filename: `CV_${candidatName.replace(/\s+/g, "_")}.pdf`,
        content: cvBuffer,
        contentType: "application/pdf",
      },
      {
        filename: `Lettre_Motivation_${entreprise.replace(/\s+/g, "_")}.pdf`,
        content: letterPdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
