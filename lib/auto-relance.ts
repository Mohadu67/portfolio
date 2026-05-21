import type { HydratedDocument } from "mongoose";
import type { ICandidature, IRelanceLog } from "@/models/Candidature";
import { getSettings } from "@/models/Settings";

const DEFAULT_TEMPLATE_TITLE = "Auto-relance J+7";

function buildDefaultMessage(candidature: ICandidature, days: number): string {
  const company = candidature.entreprise || "votre entreprise";
  const poste = candidature.poste || "le poste";
  return [
    `Bonjour,`,
    ``,
    `Je me permets de revenir vers vous concernant ma candidature pour ${poste} chez ${company}, envoyée il y a ${days} jours.`,
    ``,
    `Je reste très motivé par cette opportunité et je serais ravi d'échanger avec vous sur la suite à donner.`,
    ``,
    `Bien cordialement,`,
  ].join("\n");
}

/**
 * Pousse une relance "programmée" à J+N si :
 *   - l'automation est activée dans Settings ;
 *   - aucune relance "programmée" n'existe déjà sur cette candidature.
 *
 * Mute le document Mongoose en mémoire — n'appelle PAS save().
 * Appelle save() côté caller pour bundler avec d'autres mutations.
 */
export async function scheduleAutoRelance(
  candidature: HydratedDocument<ICandidature>
): Promise<IRelanceLog | null> {
  const settings = await getSettings();
  if (!settings.automation?.autoRelanceJ7Enabled) return null;

  const hasPending = (candidature.relanceHistory ?? []).some(
    (r) => r.status === "programmée"
  );
  if (hasPending) return null;

  const days = settings.automation.autoRelanceDays || 7;
  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + days);

  const entry: IRelanceLog = {
    scheduledFor,
    template: "second",
    templateTitle: DEFAULT_TEMPLATE_TITLE,
    message: buildDefaultMessage(candidature, days),
    status: "programmée",
  };

  candidature.relanceHistory = [...(candidature.relanceHistory ?? []), entry];
  return entry;
}
