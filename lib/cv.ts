import { connectDB } from "@/lib/mongodb";
import {
  CVSection,
  ICVSection,
  CVProfileContent,
  CVSocialItem,
  CVSkillItem,
  CVProjectItem,
  CVEducationItem,
  CVExperienceItem,
  CVContactContent,
  CVQuizContent,
  CVStoryContent,
} from "@/models/CVSection";
import portfolioData from "@/data/portfolio.json";
import { DEFAULT_STORY } from "@/data/story";

export interface CVData {
  profile: CVProfileContent;
  socials: CVSocialItem[];
  skills: CVSkillItem[];
  projects: CVProjectItem[];
  education: CVEducationItem[];
  experience: CVExperienceItem[];
  contact: CVContactContent;
  quiz: CVQuizContent | null;
  story: CVStoryContent;
  customSections: Array<{
    _id: string;
    key: string;
    title: string;
    order: number;
    content: { subtitle?: string; body?: string; items?: Array<{ id: string; title: string; description: string }> };
  }>;
  sections: Array<{
    _id: string;
    key: string;
    type: ICVSection["type"];
    title: string;
    order: number;
    isVisible: boolean;
  }>;
}

const FALLBACK: CVData = {
  profile: portfolioData.profile as CVProfileContent,
  socials: portfolioData.socials as CVSocialItem[],
  skills: portfolioData.skills as CVSkillItem[],
  projects: portfolioData.projects as CVProjectItem[],
  education: portfolioData.education as CVEducationItem[],
  experience: portfolioData.experience as CVExperienceItem[],
  contact: portfolioData.contact as CVContactContent,
  quiz: null,
  story: DEFAULT_STORY,
  customSections: [],
  sections: [
    { _id: "fallback-profile", key: "profile", type: "profile", title: "Profile", order: 0, isVisible: true },
    { _id: "fallback-skills", key: "skills", type: "skills", title: "Compétences Techniques", order: 1, isVisible: true },
    { _id: "fallback-education", key: "education", type: "education", title: "Formation", order: 2, isVisible: true },
    { _id: "fallback-experience", key: "experience", type: "experience", title: "Expérience Professionnelle", order: 3, isVisible: true },
    { _id: "fallback-projects", key: "projects", type: "projects", title: "Projets", order: 4, isVisible: true },
    { _id: "fallback-contact", key: "contact", type: "contact", title: "Me contacter", order: 5, isVisible: true },
    { _id: "fallback-socials", key: "socials", type: "socials", title: "Connectez-vous", order: 6, isVisible: true },
  ],
};

// Merge profond : un champ absent du CMS retombe sur la valeur par défaut.
function mergeStory(partial: Partial<CVStoryContent> | null): CVStoryContent {
  if (!partial) return DEFAULT_STORY;
  const merged = { ...DEFAULT_STORY };
  (Object.keys(DEFAULT_STORY) as Array<keyof CVStoryContent>).forEach((key) => {
    const value = partial[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // @ts-expect-error structural deep merge
      merged[key] = { ...DEFAULT_STORY[key], ...value };
    } else if (value !== undefined) {
      // @ts-expect-error structural deep merge
      merged[key] = value;
    }
  });
  return merged;
}

export async function getCVData(): Promise<CVData> {
  try {
    await connectDB();
    const docs = await CVSection.find({}).sort({ order: 1 }).lean<ICVSection[]>();

    if (!docs.length) return FALLBACK;

    const findContent = <T>(type: ICVSection["type"]): T | null => {
      const doc = docs.find((d) => d.type === type);
      return doc ? (doc.content as T) : null;
    };

    const findItems = <T>(type: ICVSection["type"]): T[] | null => {
      const doc = docs.find((d) => d.type === type);
      if (!doc) return null;
      const c = doc.content as { items?: T[] };
      return Array.isArray(c?.items) ? c.items : null;
    };

    const data: CVData = {
      profile: findContent<CVData["profile"]>("profile") ?? FALLBACK.profile,
      socials: findItems<CVData["socials"][number]>("socials") ?? FALLBACK.socials,
      skills: findItems<CVData["skills"][number]>("skills") ?? FALLBACK.skills,
      projects: findItems<CVData["projects"][number]>("projects") ?? FALLBACK.projects,
      education: findItems<CVData["education"][number]>("education") ?? FALLBACK.education,
      experience: findItems<CVData["experience"][number]>("experience") ?? FALLBACK.experience,
      contact: findContent<CVData["contact"]>("contact") ?? FALLBACK.contact,
      quiz: findContent<CVQuizContent>("quiz"),
      story: mergeStory(findContent<Partial<CVStoryContent>>("story")),
      customSections: docs
        .filter((d) => d.type === "custom" && d.isVisible)
        .map((d) => ({
          _id: String(d._id),
          key: d.key,
          title: d.title,
          order: d.order,
          content: d.content as CVData["customSections"][number]["content"],
        })),
      sections: docs.map((d) => ({
        _id: String(d._id),
        key: d.key,
        type: d.type,
        title: d.title,
        order: d.order,
        isVisible: d.isVisible,
      })),
    };

    return data;
  } catch (err) {
    console.error("[getCVData] DB unreachable, using JSON fallback:", err);
    return FALLBACK;
  }
}

type SeedSection = Omit<ICVSection, "_id" | "created_at" | "updated_at">;

export const SEED_SECTIONS: SeedSection[] = [
  { key: "profile", type: "profile", title: "Profil", order: 0, isVisible: true, content: portfolioData.profile as CVProfileContent },
  { key: "skills", type: "skills", title: "Compétences Techniques", order: 1, isVisible: true, content: { items: portfolioData.skills as CVSkillItem[] } },
  { key: "education", type: "education", title: "Formation", order: 2, isVisible: true, content: { items: portfolioData.education as CVEducationItem[] } },
  { key: "experience", type: "experience", title: "Expérience Professionnelle", order: 3, isVisible: true, content: { items: portfolioData.experience as CVExperienceItem[] } },
  { key: "projects", type: "projects", title: "Projets", order: 4, isVisible: true, content: { items: portfolioData.projects as CVProjectItem[] } },
  { key: "story", type: "story", title: "Récit du portfolio", order: 5, isVisible: true, content: DEFAULT_STORY },
  { key: "quiz", type: "quiz", title: "Quiz interactif", order: 6, isVisible: true, content: { intro: "Mini-jeu : devine la bonne réponse.", items: [] } },
  { key: "contact", type: "contact", title: "Me contacter", order: 7, isVisible: true, content: portfolioData.contact as CVContactContent },
  { key: "socials", type: "socials", title: "Connectez-vous", order: 8, isVisible: true, content: { items: portfolioData.socials as CVSocialItem[] } },
];

// Sections singleton qui doivent toujours exister — auto-création si absentes
export const SINGLETON_SECTIONS: SeedSection[] = [
  { key: "story", type: "story", title: "Récit du portfolio", order: 5, isVisible: true, content: DEFAULT_STORY },
  { key: "quiz", type: "quiz", title: "Quiz interactif", order: 6, isVisible: true, content: { intro: "Mini-jeu : devine la bonne réponse.", items: [] } },
];
