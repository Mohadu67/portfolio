"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Clock,
  TrendingUp,
  Briefcase,
  Send,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/contexts/AuthContext";

interface SummaryAlert {
  relancesEnRetard: number;
  relancesAujourdhui: number;
  candidaturesStagnantes: number;
  entretiens: number;
}

interface AgendaItem {
  candidatureId: string;
  index: number;
  entreprise: string;
  poste: string;
  scheduledFor: string;
  templateTitle?: string;
}

interface StagnantItem {
  _id: string;
  entreprise: string;
  poste: string;
  daysSince: number;
}

interface RetardItem extends AgendaItem {
  daysLate: number;
}

interface ActivityItem {
  when: number;
  kind: "email";
  candidatureId: string;
  entreprise: string;
  poste: string;
  subject: string;
  status: "sent" | "failed";
  type: "candidature" | "relance";
}

interface Summary {
  stats: Record<string, number>;
  total: number;
  alerts: SummaryAlert;
  todayAgenda: AgendaItem[];
  stagnantes: StagnantItem[];
  enRetard: RetardItem[];
  aVenir7j: AgendaItem[];
  metrics: { candidatures7j: number; emailsSent7j: number; responseRate: number };
  recentActivity: ActivityItem[];
}

const STATUS_LABELS: Record<string, string> = {
  identifiée: "À traiter",
  "lettre générée": "Prêtes",
  postulée: "Postulées",
  "réponse reçue": "Réponses",
  entretien: "Entretiens",
  refus: "Refus",
  acceptée: "Acceptées",
};

const STATUS_COLOR: Record<string, string> = {
  identifiée: "var(--status-identifiee)",
  "lettre générée": "var(--status-lettre)",
  postulée: "var(--status-postule)",
  "réponse reçue": "var(--status-reponse)",
  entretien: "var(--status-entretien)",
  refus: "var(--status-refus)",
  acceptée: "var(--status-acceptee)",
};

export default function WarRoom() {
  const apiKey = useApiKey();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/summary", { headers: { "x-api-key": apiKey } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Erreur"))
      .finally(() => setLoading(false));
  }, [apiKey]);

  if (loading || !data) {
    return <p className="text-center text-[var(--text-secondary)] py-12">Chargement…</p>;
  }

  const hasAlert =
    data.alerts.relancesEnRetard > 0 ||
    data.alerts.relancesAujourdhui > 0 ||
    data.alerts.candidaturesStagnantes > 0 ||
    data.alerts.entretiens > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header>
        <p className="text-xs font-medium tracking-wider uppercase text-[var(--accent-orange)] mb-1">
          War Room · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h2 className="text-3xl font-bold">Salut Mohammed 👋</h2>
      </header>

      {/* Alerts banner */}
      {hasAlert && (
        <div className="rounded-2xl border border-[var(--accent-warning)]/30 bg-[var(--accent-warning)]/5 p-4">
          <div className="flex items-center gap-2 mb-2 text-[var(--accent-warning)] text-sm font-semibold">
            <AlertTriangle size={16} /> À traiter en priorité
          </div>
          <div className="flex flex-wrap gap-2">
            {data.alerts.relancesEnRetard > 0 && (
              <Link
                href="/dashboard/relances"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] text-sm font-medium hover:bg-[var(--accent-danger)]/20"
              >
                <Clock size={14} /> {data.alerts.relancesEnRetard} relance{data.alerts.relancesEnRetard > 1 ? "s" : ""} en retard
              </Link>
            )}
            {data.alerts.relancesAujourdhui > 0 && (
              <Link
                href="/dashboard/relances"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-warning)]/10 text-[var(--accent-warning)] text-sm font-medium hover:bg-[var(--accent-warning)]/20"
              >
                <Calendar size={14} /> {data.alerts.relancesAujourdhui} relance{data.alerts.relancesAujourdhui > 1 ? "s" : ""} aujourd&apos;hui
              </Link>
            )}
            {data.alerts.candidaturesStagnantes > 0 && (
              <Link
                href="/dashboard/candidatures"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-info)]/10 text-[var(--accent-info)] text-sm font-medium hover:bg-[var(--accent-info)]/20"
              >
                <TrendingUp size={14} /> {data.alerts.candidaturesStagnantes} candidatures sans réponse {">"} 7j
              </Link>
            )}
            {data.alerts.entretiens > 0 && (
              <Link
                href="/dashboard/candidatures"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-success)]/10 text-[var(--accent-success)] text-sm font-medium hover:bg-[var(--accent-success)]/20"
              >
                <CheckCircle2 size={14} /> {data.alerts.entretiens} entretien{data.alerts.entretiens > 1 ? "s" : ""} en cours
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's agenda */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-[var(--accent-orange)]" />
              Agenda — aujourd&apos;hui & en retard
            </h3>
            <Link
              href="/dashboard/relances"
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-orange)] inline-flex items-center gap-1"
            >
              Tout voir <ArrowRight size={12} />
            </Link>
          </div>

          {data.enRetard.length === 0 && data.todayAgenda.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] py-4">Aucune relance prévue aujourd&apos;hui. Profite-en pour en programmer.</p>
          ) : (
            <div className="space-y-2">
              {data.enRetard.map((r) => (
                <Link
                  key={`late-${r.candidatureId}-${r.index}`}
                  href="/dashboard/relances"
                  className="flex items-center gap-3 rounded-lg border border-[var(--accent-danger)]/30 bg-[var(--accent-danger)]/5 p-3 hover:bg-[var(--accent-danger)]/10"
                >
                  <Clock size={16} className="text-[var(--accent-danger)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {r.entreprise} — {r.poste}
                    </p>
                    <p className="text-xs text-[var(--accent-danger)]">
                      En retard de {r.daysLate} j
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-[var(--text-tertiary)]" />
                </Link>
              ))}
              {data.todayAgenda.map((r) => (
                <Link
                  key={`today-${r.candidatureId}-${r.index}`}
                  href="/dashboard/relances"
                  className="flex items-center gap-3 rounded-lg border border-[var(--accent-warning)]/30 bg-[var(--accent-warning)]/5 p-3 hover:bg-[var(--accent-warning)]/10"
                >
                  <Calendar size={16} className="text-[var(--accent-warning)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {r.entreprise} — {r.poste}
                    </p>
                    <p className="text-xs text-[var(--accent-warning)]">
                      {new Date(r.scheduledFor).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                      {r.templateTitle ?? "Relance"}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-[var(--text-tertiary)]" />
                </Link>
              ))}
            </div>
          )}

          {data.aVenir7j.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                {data.aVenir7j.length} à venir cette semaine
              </summary>
              <div className="space-y-2 mt-2">
                {data.aVenir7j.map((r) => (
                  <div
                    key={`up-${r.candidatureId}-${r.index}`}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border-soft)] p-2 text-sm"
                  >
                    <Calendar size={12} className="text-[var(--text-tertiary)]" />
                    <span className="flex-1 truncate text-[var(--text-secondary)]">
                      {r.entreprise} — {r.poste}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {new Date(r.scheduledFor).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Metrics */}
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[var(--accent-blue)]" />
            Cette semaine
          </h3>
          <div className="space-y-4">
            <Metric label="Nouvelles candidatures" value={data.metrics.candidatures7j} icon={Briefcase} />
            <Metric label="Emails envoyés" value={data.metrics.emailsSent7j} icon={Send} />
            <Metric label="Total candidatures" value={data.total} icon={CheckCircle2} />
          </div>
          <Link
            href="/dashboard/candidatures"
            className="mt-4 inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--accent-orange)]"
          >
            Voir toutes les candidatures <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Mini-pipeline */}
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
        <h3 className="font-semibold mb-4">Pipeline</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.keys(STATUS_LABELS).map((statut) => (
            <Link
              key={statut}
              href="/dashboard/candidatures"
              className="rounded-lg border border-[var(--border-soft)] p-3 hover:border-[var(--accent-orange)]/40 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full mb-2"
                style={{ background: STATUS_COLOR[statut] }}
              />
              <p className="text-2xl font-bold tabular-nums" style={{ color: STATUS_COLOR[statut] }}>
                {data.stats[statut] ?? 0}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">{STATUS_LABELS[statut]}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Stagnantes */}
      {data.stagnantes.length > 0 && (
        <div className="rounded-2xl border border-[var(--accent-info)]/30 bg-[var(--accent-info)]/5 p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock size={16} className="text-[var(--accent-info)]" />
            Stagnantes — pense à relancer
          </h3>
          <div className="space-y-2">
            {data.stagnantes.map((c) => (
              <div key={c._id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate text-[var(--text-primary)]">
                  {c.entreprise} <span className="text-[var(--text-tertiary)] text-xs">— {c.poste}</span>
                </span>
                <span className="text-xs text-[var(--accent-info)]">{c.daysSince}j</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {data.recentActivity.length > 0 && (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-5">
          <h3 className="font-semibold mb-3">Dernière activité</h3>
          <div className="space-y-2">
            {data.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-1.5">
                {a.status === "sent" ? (
                  <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-red-400 flex-shrink-0" />
                )}
                <span className="text-xs text-[var(--text-tertiary)]">
                  {a.type === "candidature" ? "Candidature" : "Relance"}
                </span>
                <span className="flex-1 truncate text-[var(--text-secondary)]">
                  {a.entreprise} — {a.poste}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {new Date(a.when).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/dashboard/candidatures"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 hover:border-[var(--accent-orange)]/40 transition-colors flex items-center gap-3"
        >
          <Briefcase size={20} className="text-[var(--accent-orange)]" />
          <div>
            <p className="font-semibold text-sm">Nouvelle recherche</p>
            <p className="text-xs text-[var(--text-tertiary)]">Trouver des offres</p>
          </div>
        </Link>
        <Link
          href="/dashboard/cv"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 hover:border-[var(--accent-orange)]/40 transition-colors flex items-center gap-3"
        >
          <Briefcase size={20} className="text-[var(--accent-success)]" />
          <div>
            <p className="font-semibold text-sm">Éditer le CV</p>
            <p className="text-xs text-[var(--text-tertiary)]">Sections, photo, médias</p>
          </div>
        </Link>
        <Link
          href="/dashboard/chat"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 hover:border-[var(--accent-orange)]/40 transition-colors flex items-center gap-3"
        >
          <Sparkles size={20} className="text-[var(--accent-violet)]" />
          <div>
            <p className="font-semibold text-sm">Chat IA</p>
            <p className="text-xs text-[var(--text-tertiary)]">Demande conseil</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Briefcase;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Icon size={14} className="text-[var(--text-tertiary)]" />
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
