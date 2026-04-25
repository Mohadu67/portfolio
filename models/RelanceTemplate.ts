import { Schema, model, models } from "mongoose";

export interface IRelanceTemplate {
  _id?: string;
  name: string;
  message: string;
  defaultOffsetDays?: number;
  isBuiltin?: boolean;
  created_at: Date;
  updated_at: Date;
}

const relanceTemplateSchema = new Schema<IRelanceTemplate>(
  {
    name: { type: String, required: true },
    message: { type: String, required: true },
    defaultOffsetDays: { type: Number, default: 7 },
    isBuiltin: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const RelanceTemplate =
  models.RelanceTemplate || model<IRelanceTemplate>("RelanceTemplate", relanceTemplateSchema);

export const BUILTIN_TEMPLATES: Array<Pick<IRelanceTemplate, "name" | "message" | "defaultOffsetDays">> = [
  {
    name: "Relance polie (J+7)",
    defaultOffsetDays: 7,
    message: `Bonjour,

Je me permets de revenir vers vous concernant ma candidature au poste de {poste} envoyée la semaine dernière.

Je reste très intéressé par {entreprise} et serais ravi de pouvoir échanger avec vous sur cette opportunité.

Restant à votre disposition pour tout complément d'information.

Cordialement,
{prenom}`,
  },
  {
    name: "Relance ferme (J+14)",
    defaultOffsetDays: 14,
    message: `Bonjour,

Je vous adresse cette dernière relance concernant ma candidature pour le poste de {poste} chez {entreprise}.

Si l'offre n'est plus d'actualité ou que mon profil ne correspond pas à vos attentes, je comprendrais tout à fait — un simple retour me permettrait de poursuivre mes démarches.

Je reste néanmoins motivé par votre projet et disponible pour échanger.

Cordialement,
{prenom}`,
  },
  {
    name: "Suivi entretien",
    defaultOffsetDays: 5,
    message: `Bonjour,

Je tenais à vous remercier pour notre échange concernant le poste de {poste}. Notre discussion a renforcé mon intérêt pour {entreprise}.

Je me tiens à votre disposition pour la suite du processus et serais ravi d'apporter d'autres éléments si nécessaire.

Cordialement,
{prenom}`,
  },
];
