import { Schema, model, models } from "mongoose";

export type CVSectionType =
  | "profile"
  | "socials"
  | "skills"
  | "projects"
  | "education"
  | "experience"
  | "contact"
  | "quiz"
  | "story"
  | "custom";

export interface CVProfileContent {
  name: string;
  title: string;
  tagline: string;
  location: string;
  availability: string;
  phone: string;
  email: string;
  photo: string;
}

export interface CVSocialItem {
  id: string;
  name: string;
  handle: string;
  url: string;
  icon: string;
}

export interface CVSkillItem {
  id: string;
  name: string;
  level: "Expert" | "Avancé" | "Intermédiaire" | "Débutant";
  years: string;
  category: string;
  bugStory?: string;
}

export interface CVProjectItem {
  id: string;
  name: string;
  url: string;
  description: string;
  image: string;
  stack: string[];
  credentials?: { email: string; password: string };
}

export interface CVEducationItem {
  id: string;
  school: string;
  degree: string;
  field: string;
  period: string;
  description: string;
  capabilities: string;
}

export interface CVExperienceItem {
  id: string;
  company: string;
  position: string;
  description: string;
  startDate: string;
  endDate: string;
  details: string;
}

export interface CVContactContent {
  email: string;
  phone: string;
  calendly: string;
  cta: string;
}

export interface CVCustomItem {
  id: string;
  title: string;
  description: string;
}

export interface CVCustomContent {
  subtitle?: string;
  body?: string;
  items?: CVCustomItem[];
}

export interface CVQuizQuestion {
  id: string;
  question: string;
  hint?: string;
  choices: string[];
  correctIndex: number;
}

export interface CVQuizContent {
  intro?: string;
  items: CVQuizQuestion[];
}

export interface CVStoryTransferSkill {
  title: string;
  body: string;
  code?: string;
}

export interface CVStorySeekingItem {
  label: string;
  value: string;
}

export interface CVStoryContent {
  hero: { name: string; tagline: string; location: string };
  rupture: { year: string; eyebrow: string; lines: string[]; closing: string };
  kitchens: {
    eyebrow: string;
    title: string;
    intro: string;
    outro: string;
    transferTitle: string;
    transferIntro: string;
    transferSkills: CVStoryTransferSkill[];
  };
  doubleLife: {
    eyebrow: string;
    day: { title: string; body: string };
    night: { title: string; body: string };
  };
  leap: { year: string; eyebrow: string; title: string; body: string; badge: string };
  skills: { eyebrow: string; title: string; subtitle: string };
  projects: { eyebrow: string; title: string; subtitle: string };
  present: {
    eyebrow: string;
    title: string;
    body: string;
    seekingEnabled: boolean;
    seekingTitle: string;
    seekingItems: CVStorySeekingItem[];
  };
  contact: { eyebrow: string; title: string; body: string };
}

export type CVSectionContent =
  | CVProfileContent
  | { items: CVSocialItem[] }
  | { items: CVSkillItem[] }
  | { items: CVProjectItem[] }
  | { items: CVEducationItem[] }
  | { items: CVExperienceItem[] }
  | CVContactContent
  | CVQuizContent
  | CVStoryContent
  | CVCustomContent;

export interface ICVSection {
  _id?: string;
  key: string;
  type: CVSectionType;
  title: string;
  order: number;
  isVisible: boolean;
  content: CVSectionContent;
  created_at: Date;
  updated_at: Date;
}

const cvSectionSchema = new Schema<ICVSection>(
  {
    key: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ["profile", "socials", "skills", "projects", "education", "experience", "contact", "quiz", "story", "custom"],
      required: true,
    },
    title: { type: String, required: true },
    order: { type: Number, required: true, default: 0, index: true },
    isVisible: { type: Boolean, default: true },
    content: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const CVSection = models.CVSection || model<ICVSection>("CVSection", cvSectionSchema);
