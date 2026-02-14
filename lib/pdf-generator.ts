import { jsPDF } from "jspdf";

// Portfolio colors
const ORANGE = { r: 255, g: 158, b: 100 }; // #FF9E64
const BLUE = { r: 46, g: 159, b: 216 };    // #2E9FD8
const DARK = { r: 13, g: 17, b: 23 };      // #0D1117
const GRAY = { r: 120, g: 130, b: 145 };
const TEXT = { r: 40, g: 40, b: 50 };

export async function generateLettrePDF(
  lettre: string,
  entreprise: string,
  poste: string
): Promise<Buffer> {
  const nom = process.env.PROFIL_NOM || "Mohammed Hamiani";
  const adresse = process.env.PROFIL_ADRESSE || "9a rue des champs 67201 Eckbolsheim";
  const email = process.env.PROFIL_EMAIL || "Hamiani.Mohammed@hotmail.com";
  const telephone = process.env.PROFIL_TELEPHONE || "07 83 33 06 94";
  const titre = "Concepteur Développeur Fullstack";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // === HEADER BAND — dark bg ===
  doc.setFillColor(DARK.r, DARK.g, DARK.b);
  doc.rect(0, 0, pageWidth, 48, "F");

  // Orange accent line under header
  doc.setFillColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.rect(0, 48, pageWidth, 1.5, "F");

  // Name
  doc.setTextColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(nom.toUpperCase(), marginLeft, 18);

  // Title
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(titre, marginLeft, 25);

  // Contact info — right side
  doc.setTextColor(200, 200, 210);
  doc.setFontSize(8);
  const contactX = pageWidth - marginRight;
  doc.text(email, contactX, 16, { align: "right" });
  doc.text(telephone, contactX, 21, { align: "right" });
  doc.text(adresse, contactX, 26, { align: "right" });

  // LinkedIn / Portfolio hint
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setFontSize(7);
  doc.text("linkedin.com/in/mohammed-hamiani-461561243", contactX, 32, { align: "right" });
  doc.text("github.com/Mohadu67", contactX, 37, { align: "right" });

  // === BODY ===
  let y = 60;

  // Date — right aligned
  const today = new Date();
  const dateStr = `Strasbourg, le ${today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(dateStr, contactX, y, { align: "right" });
  y += 12;

  // Object line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(DARK.r, DARK.g, DARK.b);
  doc.text("Objet :", marginLeft, y);

  doc.setFont("helvetica", "normal");
  const objetText = `Candidature au poste de ${poste}`;
  doc.text(objetText, marginLeft + doc.getTextWidth("Objet : ") + 1, y);
  y += 5;

  // Thin blue line under object
  doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setLineWidth(0.4);
  doc.line(marginLeft, y, marginLeft + contentWidth, y);
  y += 10;

  // Salutation
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.text("Madame, Monsieur,", marginLeft, y);
  y += 9;

  // Clean letter content — remove "Madame, Monsieur," and signature if AI included them
  let cleanedLettre = lettre
    .replace(/^\s*Madame,?\s*Monsieur,?\s*/i, "")
    .replace(/\s*(Bien\s+)?[Cc]ordialement,?\s*$/m, "")
    .replace(/\s*Mohammed\s+Hamiani\s*$/m, "")
    .trim();

  // Letter body paragraphs
  const paragraphes = cleanedLettre
    .split(/\n\n+/)
    .filter((p) => p.trim());

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);

  for (const paragraphe of paragraphes) {
    const lines: string[] = doc.splitTextToSize(paragraphe.trim(), contentWidth);
    const blockHeight = lines.length * 5;

    // Page break check
    if (y + blockHeight > pageHeight - 40) {
      // Footer on current page
      drawFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      y = 25;
    }

    doc.text(lines, marginLeft, y);
    y += blockHeight + 4;
  }

  // Signature block
  if (y + 25 > pageHeight - 40) {
    drawFooter(doc, pageWidth, pageHeight);
    doc.addPage();
    y = 25;
  }

  y += 6;
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.setFont("helvetica", "normal");
  doc.text("Bien cordialement,", marginLeft, y);
  y += 8;

  // Name in orange
  doc.setFont("helvetica", "bold");
  doc.setTextColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.setFontSize(12);
  doc.text(nom, marginLeft, y);
  y += 5;

  // Title under name
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setFontSize(8);
  doc.text(titre, marginLeft, y);

  // Footer
  drawFooter(doc, pageWidth, pageHeight);

  // Convert to Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  // Thin orange line
  doc.setDrawColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.setLineWidth(0.3);
  doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);

  // Footer text
  doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Mohammed Hamiani — Concepteur Développeur Fullstack", 20, pageHeight - 10);
  doc.text("Portfolio : github.com/Mohadu67", pageWidth - 20, pageHeight - 10, { align: "right" });
}
