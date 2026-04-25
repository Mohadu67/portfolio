import { connectDB } from "@/lib/mongodb";
import { Candidature, ICandidature } from "@/models/Candidature";
import { CVSection, ICVSection } from "@/models/CVSection";

export interface AIContext {
  profile: Record<string, unknown> | null;
  cvSections: Array<{ key: string; type: string; title: string; content: unknown }>;
  candidatures: Array<{
    _id: string;
    entreprise: string;
    poste: string;
    statut: string;
    type: string;
    plateforme: string;
    localisation: string;
    email: string;
    url: string;
    description: string;
    notes: string;
    created_at: string;
    relances: Array<{
      scheduledFor: string;
      status: string;
      message: string;
      templateTitle?: string;
      sentAt?: string | null;
    }>;
    emailsSent: Array<{ date: string; subject: string; type: string; status: string }>;
    hasLetter: boolean;
  }>;
}

export async function buildAIContext(): Promise<AIContext> {
  await connectDB();
  const [sections, candidatures] = await Promise.all([
    CVSection.find({}).sort({ order: 1 }).lean<ICVSection[]>(),
    Candidature.find({}).sort({ created_at: -1 }).lean<ICandidature[]>(),
  ]);

  const profileSection = sections.find((s) => s.type === "profile");
  return {
    profile: (profileSection?.content as Record<string, unknown>) ?? null,
    cvSections: sections.map((s) => ({
      key: s.key,
      type: s.type,
      title: s.title,
      content: s.content,
    })),
    candidatures: candidatures.map((c) => ({
      _id: String(c._id),
      entreprise: c.entreprise,
      poste: c.poste,
      statut: c.statut,
      type: c.type,
      plateforme: c.plateforme,
      localisation: c.localisation ?? "",
      email: c.email ?? "",
      url: c.url ?? "",
      description: (c.description ?? "").slice(0, 240),
      notes: c.notes ?? "",
      created_at: c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at),
      relances: (c.relanceHistory ?? []).map((r) => ({
        scheduledFor: r.scheduledFor instanceof Date ? r.scheduledFor.toISOString() : String(r.scheduledFor),
        status: r.status,
        message: r.message.slice(0, 200),
        templateTitle: r.templateTitle,
        sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : null,
      })),
      emailsSent: (c.emailsSent ?? []).map((e) => ({
        date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
        subject: e.subject,
        type: e.type,
        status: e.status,
      })),
      hasLetter: !!c.lettre,
    })),
  };
}

export function contextSummary(ctx: AIContext): string {
  const total = ctx.candidatures.length;
  const byStatus = ctx.candidatures.reduce(
    (acc, c) => {
      acc[c.statut] = (acc[c.statut] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const upcomingRelances = ctx.candidatures.flatMap((c) =>
    c.relances.filter((r) => r.status === "programmée")
  ).length;

  return `${total} candidatures (${Object.entries(byStatus)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ")}) · ${upcomingRelances} relances programmées`;
}
