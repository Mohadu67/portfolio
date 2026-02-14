/* eslint-disable @typescript-eslint/no-require-imports */
import type { TDocumentDefinitions } from "pdfmake/interfaces";

function getPdfMake() {
  // pdfmake v0.3 exports a singleton, require it to avoid ESM issues
  const pdfmake = require("pdfmake/js/index");
  pdfmake.addFonts({
    Roboto: {
      normal: "node_modules/pdfmake/build/fonts/Roboto/Roboto-Regular.ttf",
      bold: "node_modules/pdfmake/build/fonts/Roboto/Roboto-Medium.ttf",
      italics: "node_modules/pdfmake/build/fonts/Roboto/Roboto-Italic.ttf",
      bolditalics:
        "node_modules/pdfmake/build/fonts/Roboto/Roboto-MediumItalic.ttf",
    },
  });
  return pdfmake;
}

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

  const paragraphes = lettre
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => ({
      text: p.trim(),
      margin: [0, 0, 0, 10] as [number, number, number, number],
      lineHeight: 1.5,
    }));

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 140, 40, 60],
    header: {
      stack: [
        {
          canvas: [
            {
              type: "rect",
              x: 0,
              y: 0,
              w: 595.28,
              h: 120,
              color: "#4A9BD9",
            },
          ],
        },
        {
          text: nom,
          fontSize: 22,
          bold: true,
          color: "#FFFFFF",
          margin: [40, -100, 0, 0],
        },
        {
          text: adresse,
          fontSize: 10,
          color: "#FFFFFF",
          margin: [40, 5, 0, 0],
        },
        {
          text: email,
          fontSize: 10,
          color: "#FFFFFF",
          margin: [40, 3, 0, 0],
        },
        {
          text: telephone,
          fontSize: 10,
          color: "#FFFFFF",
          margin: [40, 3, 0, 0],
        },
      ],
    },
    content: [
      {
        text: `Objet : Candidature au poste de ${poste} — ${entreprise}`,
        bold: true,
        margin: [0, 10, 0, 20],
      },
      {
        text: "Madame, Monsieur,",
        margin: [0, 0, 0, 15],
      },
      ...paragraphes,
      {
        text: "Bien cordialement,",
        margin: [0, 20, 0, 5],
      },
      {
        text: nom,
        bold: true,
        margin: [0, 0, 0, 0],
      },
    ],
    defaultStyle: {
      fontSize: 11,
      font: "Roboto",
    },
  };

  const pdfmake = getPdfMake();

  return new Promise((resolve, reject) => {
    const pdf = pdfmake.createPdf(docDefinition);
    pdf.getBuffer((buffer: Buffer) => {
      resolve(Buffer.from(buffer));
    }, (error: Error) => {
      reject(error);
    });
  });
}
