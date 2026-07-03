"use client";

import type { CandidatureStatut } from "@/models/Candidature";
import { PIPELINE_ORDER, STATUS_LABEL, STATUS_CSS_VAR, STATUS_CHIP_ACTIVE } from "./status";

interface PipelineFiltersProps {
  stats: Record<string, number>;
  total: number;
  active: CandidatureStatut | null;
  onChange: (status: CandidatureStatut | null) => void;
}

// Barre de chips-filtres : une par étape du pipeline, dans l'ordre du parcours.
// Même langage visuel que le mini-pipeline du War Room (pastille couleur + compteur).
export function PipelineFilters({ stats, total, active, onChange }: PipelineFiltersProps) {
  return (
    <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        aria-pressed={active === null}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
          active === null
            ? "border-[var(--accent-orange)] text-[var(--accent-orange)] bg-[var(--accent-orange)]/10"
            : "border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]"
        }`}
      >
        Toutes
        <span className="tabular-nums opacity-70">{total}</span>
      </button>

      {PIPELINE_ORDER.map((status) => {
        const count = stats[status] ?? 0;
        const isActive = active === status;
        return (
          <button
            key={status}
            onClick={() => onChange(isActive ? null : status)}
            aria-pressed={isActive}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? STATUS_CHIP_ACTIVE[status]
                : `border-[var(--border-soft)] hover:border-[var(--border-focus)] ${
                    count === 0
                      ? "text-[var(--text-tertiary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`
            }`}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: STATUS_CSS_VAR[status] }}
            />
            {STATUS_LABEL[status]}
            <span className="tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
