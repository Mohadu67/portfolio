"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import type { ToolCallState } from "./types";
import { TOOL_LABELS } from "./types";

interface ToolCardProps {
  state: ToolCallState;
}

// Card générique pour les tools sans UI custom.
// Style neutre (border + bg-card) — pas de couleur warning agressive.
// Compacte par défaut, expand pour voir les paramètres.
export function ToolCard({ state }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[state.call.name] ?? state.call.name;
  const inputPreview = state.editedInput ?? state.call.input;

  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-[var(--text-tertiary)] shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-[var(--text-tertiary)] shrink-0" />
        )}
        <span className="text-sm font-medium text-[var(--text-primary)] flex-1 truncate">
          {label}
        </span>
        <StatusIcon status={state.status} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border-soft)]">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 mt-2">
            Paramètres
          </div>
          <pre className="text-xs whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded p-2.5 max-h-48 overflow-y-auto font-mono text-[var(--text-secondary)]">
            {JSON.stringify(inputPreview, null, 2)}
          </pre>
          {state.result && (
            <>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5 mt-3">
                Résultat
              </div>
              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                {state.result}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ToolCallState["status"] }) {
  if (status === "executing") {
    return <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)] shrink-0" />;
  }
  if (status === "done") {
    return <Check size={14} className="text-[var(--accent-success)] shrink-0" />;
  }
  if (status === "error") {
    return <AlertTriangle size={14} className="text-[var(--accent-danger)] shrink-0" />;
  }
  if (status === "rejected") {
    return <X size={14} className="text-[var(--text-tertiary)] shrink-0" />;
  }
  return null;
}
