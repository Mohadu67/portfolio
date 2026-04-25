import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Candidature, ICandidature, IRelanceLog, RelanceStatus, CandidatureStatut } from "@/models/Candidature";
import { verifyAuth } from "@/lib/auth";

const STAGNANT_DAYS = 7;
const ENTRETIEN_REMINDER_DAYS = 7;

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const all = await Candidature.find({}).lean<ICandidature[]>();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Stats par statut
    const stats: Record<string, number> = {};
    for (const c of all) {
      stats[c.statut] = (stats[c.statut] ?? 0) + 1;
    }

    // Relances dues / en retard / aujourd'hui
    const allRelances: Array<{ candidature: ICandidature; log: IRelanceLog; index: number }> = [];
    for (const c of all) {
      (c.relanceHistory ?? []).forEach((log, index) => {
        allRelances.push({ candidature: c, log, index });
      });
    }

    const programmees = allRelances.filter((r) => r.log.status === "programmée");
    const enRetard = programmees.filter((r) => new Date(r.log.scheduledFor).getTime() < now - day);
    const aujourdhui = programmees.filter((r) => {
      const t = new Date(r.log.scheduledFor).getTime();
      return t >= now - day / 2 && t <= now + day;
    });
    const aVenir7j = programmees.filter((r) => {
      const t = new Date(r.log.scheduledFor).getTime();
      return t > now + day && t <= now + 7 * day;
    });

    // Candidatures stagnantes (postulée > 7j sans relance)
    const stagnantes = all.filter((c) => {
      if (c.statut !== "postulée") return false;
      const sentAt = c.created_at ? new Date(c.created_at).getTime() : 0;
      const daysSince = (now - sentAt) / day;
      const hasPendingRelance = (c.relanceHistory ?? []).some(
        (r: IRelanceLog) => r.status === "programmée" || r.status === "envoyée"
      );
      return daysSince > STAGNANT_DAYS && !hasPendingRelance;
    });

    // Entretiens
    const entretiens = all.filter((c) => c.statut === "entretien");

    // Métriques 7j
    const lastWeek = all.filter((c) => c.created_at && now - new Date(c.created_at).getTime() < 7 * day);
    const sent7j = all.filter((c) =>
      (c.emailsSent ?? []).some((e) => now - new Date(e.date).getTime() < 7 * day && e.status === "sent")
    ).length;
    const responses7j = all.filter(
      (c) =>
        c.statut === "réponse reçue" || c.statut === "entretien" || c.statut === "acceptée"
    ).length;
    const responseRate = sent7j > 0 ? Math.round((responses7j / Math.max(sent7j, 1)) * 100) : 0;

    // Dernières actions
    const recentActivity = all
      .flatMap((c) =>
        (c.emailsSent ?? []).map((e) => ({
          when: new Date(e.date).getTime(),
          kind: "email" as const,
          candidatureId: String(c._id),
          entreprise: c.entreprise,
          poste: c.poste,
          subject: e.subject,
          status: e.status,
          type: e.type,
        }))
      )
      .sort((a, b) => b.when - a.when)
      .slice(0, 5);

    return NextResponse.json({
      stats,
      total: all.length,
      alerts: {
        relancesEnRetard: enRetard.length,
        relancesAujourdhui: aujourdhui.length,
        candidaturesStagnantes: stagnantes.length,
        entretiens: entretiens.length,
      },
      todayAgenda: aujourdhui.map((r) => ({
        candidatureId: String(r.candidature._id),
        index: r.index,
        entreprise: r.candidature.entreprise,
        poste: r.candidature.poste,
        scheduledFor: r.log.scheduledFor,
        templateTitle: r.log.templateTitle,
      })),
      stagnantes: stagnantes.slice(0, 5).map((c) => ({
        _id: String(c._id),
        entreprise: c.entreprise,
        poste: c.poste,
        daysSince: Math.floor((now - new Date(c.created_at).getTime()) / day),
      })),
      enRetard: enRetard.slice(0, 5).map((r) => ({
        candidatureId: String(r.candidature._id),
        index: r.index,
        entreprise: r.candidature.entreprise,
        poste: r.candidature.poste,
        scheduledFor: r.log.scheduledFor,
        daysLate: Math.floor((now - new Date(r.log.scheduledFor).getTime()) / day),
      })),
      aVenir7j: aVenir7j.slice(0, 10).map((r) => ({
        candidatureId: String(r.candidature._id),
        index: r.index,
        entreprise: r.candidature.entreprise,
        poste: r.candidature.poste,
        scheduledFor: r.log.scheduledFor,
        templateTitle: r.log.templateTitle,
      })),
      metrics: {
        candidatures7j: lastWeek.length,
        emailsSent7j: sent7j,
        responseRate,
      },
      recentActivity,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/dashboard/summary]", msg);
    return NextResponse.json({ error: "Failed", details: msg }, { status: 500 });
  }
}
