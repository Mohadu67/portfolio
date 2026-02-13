import nodemailer from "nodemailer";

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
  lettre: string,
  candidatName: string = "Mohammed Hamiani"
): Promise<void> {
  const subject = `Candidature - Poste ${poste} chez ${entreprise}`;
  const html = `
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-dessous ma candidature pour le poste de <strong>${poste}</strong> chez <strong>${entreprise}</strong>.</p>
    <hr style="margin: 20px 0;" />
    <div style="white-space: pre-wrap; font-family: Arial, sans-serif;">
${lettre}
    </div>
    <hr style="margin: 20px 0;" />
    <p>Cordialement,<br><strong>${candidatName}</strong></p>
  `;

  await sendEmail(email, subject, html);
}
