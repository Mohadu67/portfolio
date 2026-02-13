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
  cv: string,
  candidatName: string = "Mohammed Hamiani"
): Promise<void> {
  const subject = `Candidature - Poste ${poste} chez ${entreprise}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <p>Bonjour,</p>
      <p>Veuillez trouver ci-dessous ma candidature pour le poste de <strong>${poste}</strong> chez <strong>${entreprise}</strong>.</p>

      <hr style="margin: 30px 0; border: none; border-top: 2px solid #eee;" />

      <h2 style="color: #333; margin-top: 30px; margin-bottom: 15px;">📄 Curriculum Vitae</h2>
      <div style="white-space: pre-wrap; font-family: 'Courier New', monospace; background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-size: 14px; line-height: 1.6;">
${cv}
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 2px solid #eee;" />

      <h2 style="color: #333; margin-top: 30px; margin-bottom: 15px;">✉️ Lettre de Motivation</h2>
      <div style="white-space: pre-wrap; font-family: Arial, sans-serif; padding: 15px; line-height: 1.8;">
${lettre}
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 2px solid #eee;" />

      <p>Cordialement,<br><strong>${candidatName}</strong></p>
    </div>
  `;

  await sendEmail(email, subject, html);
}
