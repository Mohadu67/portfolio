"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, FileText, Send, Trash2, Hourglass } from "lucide-react";
import { toast } from "sonner";
import type { ICandidature } from "@/models/Candidature";
import { STATUS_CSS_VAR } from "./status";

interface CandidatureRowProps {
  candidature: ICandidature;
  onGenerateLetter: (c: ICandidature) => void;
  onOpenLetter: (c: ICandidature) => void;
  onFollowUp: (c: ICandidature) => void;
  onDelete: (id: string) => Promise<void>;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function relativeDay(value: Date | string | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // Jours calendaires locaux (pas des fenêtres de 24 h) : hier 23 h → « hier » dès minuit.
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "auj.";
  if (days === 1) return "hier";
  if (days < 30) return `${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Prochaine relance programmée : union des deux systèmes (champ legacy `relance`
// + `relanceHistory`), on affiche la plus proche.
function nextRelanceDate(c: ICandidature): Date | null {
  const dates = (c.relanceHistory ?? [])
    .filter((r) => r.status === "programmée")
    .map((r) => new Date(r.scheduledFor));
  if (c.relance?.status === "programmée") {
    dates.push(new Date(`${c.relance.date}T00:00:00`));
  }
  const valid = dates.filter((d) => !Number.isNaN(d.getTime()));
  if (valid.length === 0) return null;
  return new Date(Math.min(...valid.map((d) => d.getTime())));
}

// Ligne compacte et scannable : pastille statut · poste/entreprise · signaux · action
// principale contextuelle. Toute la ligne est cliquable (lien étendu) vers la page
// détail ; les boutons restent au-dessus du lien (z-10).
export function CandidatureRow({
  candidature: c,
  onGenerateLetter,
  onOpenLetter,
  onFollowUp,
  onDelete,
}: CandidatureRowProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const relance = nextRelanceDate(c);
  const relanceOverdue = relance !== null && relance.getTime() < startOfDay(new Date());
  const pendingApproval = (c.autoReplies ?? []).some((a) => a.approvalStatus === "pending");

  const handleDelete = async () => {
    if (!c._id) return;
    if (!confirm(`Supprimer la candidature « ${c.entreprise} — ${c.poste} » ?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(String(c._id));
      toast.success("Candidature supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const meta = [c.entreprise, c.localisation, c.plateforme].filter(Boolean).join(" · ");

  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-3 transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-hover)]">
      <span
        aria-hidden
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ background: STATUS_CSS_VAR[c.statut] }}
      />

      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/candidatures/${c._id}`}
          aria-label={`${c.poste} — ${c.entreprise}`}
          className="focus:outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-[var(--border-focus)]"
        >
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{c.poste}</p>
        </Link>
        <p className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">{meta}</p>
      </div>

      {/* Signaux — badges complets dès sm, icônes seules sur mobile */}
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        {pendingApproval && (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-400">
            <Hourglass size={11} /> Validation Telegram
          </span>
        )}
        {relance && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
              relanceOverdue
                ? "bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]"
                : "bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]"
            }`}
          >
            <Clock size={11} />
            {relanceOverdue
              ? "Relance en retard"
              : `Relance ${relance.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
          </span>
        )}
      </div>
      {(pendingApproval || relance) && (
        <div className="flex sm:hidden items-center gap-1.5 flex-shrink-0">
          {pendingApproval && <Hourglass size={13} className="text-sky-400" aria-label="Validation Telegram en attente" />}
          {relance && (
            <Clock
              size={13}
              className={relanceOverdue ? "text-[var(--accent-danger)]" : "text-[var(--accent-warning)]"}
              aria-label={relanceOverdue ? "Relance en retard" : "Relance programmée"}
            />
          )}
        </div>
      )}

      <span className="hidden sm:block w-12 flex-shrink-0 text-right text-xs tabular-nums text-[var(--text-tertiary)]">
        {relativeDay(c.updated_at)}
      </span>

      {/* Actions — au-dessus du lien étendu */}
      <div className="relative z-10 flex flex-shrink-0 items-center gap-1.5">
        {c.statut === "identifiée" && (
          <button
            onClick={() => onGenerateLetter(c)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)]/15 px-2.5 text-xs font-medium text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)]/25"
          >
            <FileText size={13} /> Lettre
          </button>
        )}
        {c.statut === "lettre générée" && (
          <button
            onClick={() => onOpenLetter(c)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-success)]/15 px-2.5 text-xs font-medium text-[var(--accent-success)] transition-colors hover:bg-[var(--accent-success)]/25"
          >
            <Send size={13} /> Envoyer
          </button>
        )}
        {c.statut === "postulée" && (
          <button
            onClick={() => onFollowUp(c)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-orange)]/15 px-2.5 text-xs font-medium text-[var(--accent-orange)] transition-colors hover:bg-[var(--accent-orange)]/25"
          >
            <Clock size={13} /> {relance ? "Gérer" : "Relancer"}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Supprimer ${c.entreprise}`}
          title="Supprimer"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--accent-danger)]/10 hover:text-[var(--accent-danger)] disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
