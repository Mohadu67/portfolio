"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import type { ToolCallState } from "./types";

interface ApplyToCompanyCardProps {
  state: ToolCallState;
  onEdit: (patch: Record<string, unknown>) => void;
}

interface ApplyInput {
  url?: string;
  type?: "stage" | "alternance" | "cdi";
  dry_run?: boolean;
  skip_quality_score?: boolean;
  allow_duplicate?: boolean;
  allow_generic_email?: boolean;
  email_override?: string;
}

// Card custom pour le tool apply_to_company.
// Permet d'éditer type/mode/options avant validation.
export function ApplyToCompanyCard({ state, onEdit }: ApplyToCompanyCardProps) {
  const effectiveInput = (state.editedInput ?? state.call.input) as ApplyInput;

  const url = effectiveInput.url ?? "";
  const type = effectiveInput.type ?? "stage";
  const dryRun = effectiveInput.dry_run === true;
  const skipQuality = effectiveInput.skip_quality_score === true;
  const allowDup = effectiveInput.allow_duplicate === true;
  const allowGeneric = effectiveInput.allow_generic_email === true;
  const emailOverride = effectiveInput.email_override ?? "";

  // Auto-ouverture des options avancées si l'IA a pré-rempli un flag avancé (ex : retry
  // avec allow_generic_email ou email_override) — l'utilisateur doit voir ce que l'IA a choisi.
  const hasAdvancedPreset = skipQuality || allowDup || allowGeneric || emailOverride.length > 0;
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedPreset);

  const readOnly = state.status !== "pending";

  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Envoyer une candidature
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">— apply_to_company</span>
        <span className="ml-auto">
          <StatusIcon status={state.status} />
        </span>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
          Cible
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-info)] hover:underline break-all"
          >
            <span className="break-all">{url}</span>
            <ExternalLink size={12} className="shrink-0" />
          </a>
        ) : (
          <span className="text-sm text-[var(--text-tertiary)] italic">(URL manquante)</span>
        )}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
          Type de contrat
        </div>
        <div className="flex flex-wrap gap-2">
          {(["stage", "alternance", "cdi"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={readOnly}
              onClick={() => onEdit({ type: t })}
              className={`px-3.5 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 min-h-[40px] ${
                type === t
                  ? "bg-[var(--accent-orange)] text-[var(--bg-primary)] border-[var(--accent-orange)]"
                  : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-soft)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {t === "stage" ? "Stage" : t === "alternance" ? "Alternance" : "CDI"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
          Mode
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onEdit({ dry_run: false })}
            className={`px-3.5 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 min-h-[40px] ${
              !dryRun
                ? "bg-[var(--accent-success)] text-[var(--bg-primary)] border-[var(--accent-success)]"
                : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-soft)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            Envoyer le mail
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onEdit({ dry_run: true })}
            className={`px-3.5 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 min-h-[40px] ${
              dryRun
                ? "bg-[var(--accent-info)] text-[var(--bg-primary)] border-[var(--accent-info)]"
                : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-soft)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            Dry-run (preview sans envoi)
          </button>
        </div>
      </div>

      <div className="text-sm">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Options avancées
        </button>
        {advancedOpen && (
          <div className="mt-2.5 space-y-2.5 pl-1">
            <label className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={skipQuality}
                onChange={(e) => onEdit({ skip_quality_score: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-[var(--accent-orange)] shrink-0"
              />
              <span>Ignorer le score qualité Gemini (cible déjà validée à la main)</span>
            </label>
            <label className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={allowDup}
                onChange={(e) => onEdit({ allow_duplicate: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-[var(--accent-orange)] shrink-0"
              />
              <span>Autoriser même si le domaine a déjà été contacté</span>
            </label>
            <label className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={allowGeneric}
                onChange={(e) => onEdit({ allow_generic_email: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-[var(--accent-orange)] shrink-0"
              />
              <span>
                Autoriser les emails génériques (contact@, info@) si pas d&apos;email RH trouvé
              </span>
            </label>
            <div className="space-y-1">
              <label
                htmlFor={`email-override-${state.call.id}`}
                className="block text-sm text-[var(--text-secondary)]"
              >
                Email destinataire (override) — bypass le picker auto
              </label>
              <input
                id={`email-override-${state.call.id}`}
                type="email"
                disabled={readOnly}
                value={emailOverride}
                onChange={(e) => onEdit({ email_override: e.target.value })}
                placeholder="ex: contact@boite.com (laisser vide pour auto)"
                className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {state.result && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
            Résultat
          </div>
          <pre className="text-xs whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded p-2.5 max-h-48 overflow-y-auto font-mono text-[var(--text-secondary)]">
            {state.result}
          </pre>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ToolCallState["status"] }) {
  if (status === "executing") {
    return <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)]" />;
  }
  if (status === "done") {
    return <Check size={14} className="text-[var(--accent-success)]" />;
  }
  if (status === "error") {
    return <AlertTriangle size={14} className="text-[var(--accent-danger)]" />;
  }
  if (status === "rejected") {
    return <X size={14} className="text-[var(--text-tertiary)]" />;
  }
  return null;
}
