import { jsPDF } from "jspdf";

export async function generateLettrePDF(
  lettre: string,
  entreprise: string,
  poste: string
): Promise<Buffer> {
  const nom = process.env.PROFIL_NOM || "Hamiani Mohammed";
  const adresse =
    process.env.PROFIL_ADRESSE || "9a rue des champs 67201 Eckbolsheim";
  const email =
    process.env.PROFIL_EMAIL || "Hamiani.Mohammed@hotmail.com";
  const telephone = process.env.PROFIL_TELEPHONE || "07 83 33 06 94";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background - blue rectangle
  doc.setFillColor(74, 155, 217); // #4A9BD9
  doc.rect(0, 0, pageWidth, 35, "F");

  // Header text - white
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(nom, 15, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(adresse, 15, 21);
  doc.text(email, 15, 26);
  doc.text(telephone, 15, 31);

  // Body text - black
  doc.setTextColor(0, 0, 0);
  let y = 50;

  // Object line
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Objet : Candidature au poste de ${poste} — ${entreprise}`, 15, y);
  y += 12;

  // Salutation
  doc.setFont("helvetica", "normal");
  doc.text("Madame, Monsieur,", 15, y);
  y += 10;

  // Letter body paragraphs
  const paragraphes = lettre
    .split(/\n\n+/)
    .filter((p) => p.trim());

  const maxWidth = pageWidth - 30; // 15mm margins each side

  for (const paragraphe of paragraphes) {
    const lines = doc.splitTextToSize(paragraphe.trim(), maxWidth);

    // Check if we need a new page
    const blockHeight = lines.length * 5.5;
    if (y + blockHeight > 270) {
      doc.addPage();
      y = 20;
    }

    doc.text(lines, 15, y);
    y += blockHeight + 4;
  }

  // Signature
  if (y + 20 > 270) {
    doc.addPage();
    y = 20;
  }
  y += 8;
  doc.text("Bien cordialement,", 15, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text(nom, 15, y);

  // Convert to Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
