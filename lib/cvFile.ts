import fs from "fs";
import path from "path";
import { connectDB } from "./mongodb";
import { CVFile } from "@/models/CVFile";
import type { CandidatureType } from "@/models/Candidature";

export interface ResolvedCV {
  buffer: Buffer;
  filename: string;
  source: "db-explicit" | "db-default" | "db-by-type" | "fallback";
}

const FALLBACK_PATH = path.join(process.cwd(), "candidatureModel", "cv-mohammed.pdf");

export async function resolveCVForSend(opts: { cvFileId?: string | null; type?: CandidatureType }): Promise<ResolvedCV> {
  await connectDB();

  if (opts.cvFileId) {
    const cv = await CVFile.findById(opts.cvFileId);
    if (cv) {
      return { buffer: Buffer.from(cv.data), filename: cv.filename, source: "db-explicit" };
    }
  }

  if (opts.type) {
    const byType = await CVFile.findOne({ scope: opts.type });
    if (byType) {
      return { buffer: Buffer.from(byType.data), filename: byType.filename, source: "db-by-type" };
    }
  }

  const def = await CVFile.findOne({ isDefault: true });
  if (def) {
    return { buffer: Buffer.from(def.data), filename: def.filename, source: "db-default" };
  }

  if (fs.existsSync(FALLBACK_PATH)) {
    return { buffer: fs.readFileSync(FALLBACK_PATH), filename: "cv-mohammed.pdf", source: "fallback" };
  }

  throw new Error("Aucun CV disponible : importe un CV depuis le dashboard ou ajoute candidatureModel/cv-mohammed.pdf");
}
