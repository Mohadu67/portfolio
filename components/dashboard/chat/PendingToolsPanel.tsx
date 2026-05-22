"use client";

import { Check, X, Wrench, Loader2 } from "lucide-react";
import { ApplyToCompanyCard } from "./ApplyToCompanyCard";
import { ToolCard } from "./ToolCard";
import type { ToolCallState } from "./types";

interface PendingToolsPanelProps {
  pending: ToolCallState[];
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: (callId: string, patch: Record<string, unknown>) => void;
}

// Panneau de confirmation pour les tool_calls.
// Style neutre (border + bg-card) — pas d'override jaune sur le bloc englobant.
// Boutons gros et tactiles (min-h-[44px]).
export function PendingToolsPanel({
  pending,
  disabled,
  onApprove,
  onReject,
  onEdit,
}: PendingToolsPanelProps) {
  if (pending.length === 0) return null;
  const executing = pending.some((t) => t.status === "executing");
  const multiple = pending.length > 1;

  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <Wrench size={14} className="text-[var(--accent-orange)]" />
        <span>
          Action{multiple ? "s" : ""} demandée{multiple ? "s" : ""}
        </span>
        {executing && (
          <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)] ml-1" />
        )}
      </div>

      <div className="space-y-2.5">
        {pending.map((t) =>
          t.call.name === "apply_to_company" ? (
            <ApplyToCompanyCard
              key={t.call.id}
              state={t}
              onEdit={(patch) => onEdit(t.call.id, patch)}
            />
          ) : (
            <ToolCard key={t.call.id} state={t} />
          ),
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
        <button
          onClick={onApprove}
          disabled={disabled || executing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[var(--accent-success)] text-[var(--bg-primary)] text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity min-h-[44px] flex-1 sm:flex-initial"
        >
          <Check size={16} />
          Confirmer
        </button>
        <button
          onClick={onReject}
          disabled={disabled || executing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-[var(--border-soft)] bg-[var(--bg-primary)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors min-h-[44px] flex-1 sm:flex-initial"
        >
          <X size={16} />
          Refuser
        </button>
      </div>
    </div>
  );
}
