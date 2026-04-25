"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Calendar, FileText, Sparkles, Search, Image as ImageIcon } from "lucide-react";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { StatsBar } from "@/components/dashboard/StatsBar";

interface QuickLink {
  href: string;
  label: string;
  description: string;
  icon: typeof Briefcase;
  accent: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: "/dashboard/candidatures",
    label: "Candidatures",
    description: "Pipeline kanban + table dense, filtres, bulk actions",
    icon: Briefcase,
    accent: "var(--accent-orange)",
  },
  {
    href: "/dashboard/recherche",
    label: "Recherche",
    description: "Offres + entreprises, recherches sauvegardées",
    icon: Search,
    accent: "var(--accent-blue)",
  },
  {
    href: "/dashboard/relances",
    label: "Relances",
    description: "Calendrier, timeline, composer libre",
    icon: Calendar,
    accent: "var(--accent-warning)",
  },
  {
    href: "/dashboard/cv",
    label: "CV Builder",
    description: "Sections dynamiques, preview live, photo",
    icon: FileText,
    accent: "var(--accent-success)",
  },
  {
    href: "/dashboard/media",
    label: "Médias",
    description: "Photo, CVs PDF, assets projets",
    icon: ImageIcon,
    accent: "var(--accent-violet)",
  },
  {
    href: "/dashboard/chat",
    label: "Chat IA",
    description: "Assistant agentique avec accès à toutes tes données",
    icon: Sparkles,
    accent: "var(--accent-orange)",
  },
];

export default function DashboardHome() {
  const apiKey = useApiKey();
  const data = useDashboardData(apiKey);
  const [filterStatus, setFilterStatus] = useState<null>(null);

  useEffect(() => {
    data.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-wider uppercase text-[var(--accent-orange)]">War Room</p>
        <h2 className="text-3xl font-bold text-[var(--text-primary)]">
          Salut Mohammed 👋
        </h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
          Le War Room intelligent (alertes, agenda du jour, kanban mini, métriques) arrive au Lot&nbsp;2.
          Pour l&apos;instant, voici un tableau de bord rapide vers chaque module.
        </p>
      </header>

      <StatsBar
        stats={data.stats}
        total={data.total}
        activeStatus={filterStatus}
        onStatusClick={() => setFilterStatus(null)}
      />

      <section>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
          Modules
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 hover:border-[var(--accent-orange)]/40 hover:bg-[var(--bg-hover)] transition-all"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${link.accent}1a`, color: link.accent }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-orange)] transition-colors">
                      {link.label}
                    </h4>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-2">
                      {link.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
