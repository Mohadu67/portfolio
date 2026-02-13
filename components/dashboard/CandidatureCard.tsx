"use client";

import { useState } from "react";
import type { ICandidature } from "@/models/Candidature";

interface CandidatureCardProps {
  candidature: ICandidature;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  apiKey: string;
}

export function CandidatureCard({
  candidature,
  onSelect,
  onDelete,
  apiKey,
}: CandidatureCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      identifiée: "📌",
      "lettre générée": "📝",
      postulée: "✉️",
      "réponse reçue": "📬",
      entretien: "💬",
      refus: "❌",
      acceptée: "✅",
    };
    return icons[status] || "❓";
  };

  const handleDelete = async () => {
    if (!candidature._id) return;
    if (confirm("Êtes-vous sûr de vouloir supprimer cette candidature ?")) {
      setIsDeleting(true);
      try {
        await onDelete?.(candidature._id as string);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      className="card hover:border-[var(--accent-orange)] hover:bg-[var(--bg-secondary)] transition-all duration-300 cursor-pointer p-5"
      onClick={() => onSelect?.(candidature._id as string)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {candidature.poste}
          </h3>
          <p className="text-[var(--text-secondary)] font-medium">
            {candidature.entreprise}
          </p>
        </div>
        <span className="text-2xl ml-2">{getStatusIcon(candidature.statut)}</span>
      </div>

      {/* Location & Platform */}
      <div className="flex gap-3 mb-3 text-sm text-[var(--text-tertiary)]">
        <span>📍 {candidature.localisation}</span>
        <span>•</span>
        <span className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-xs text-[var(--accent-orange)]">
          {candidature.plateforme}
        </span>
      </div>

      {/* Description */}
      {candidature.description && (
        <p className="text-[var(--text-secondary)] text-sm mb-3 line-clamp-2">
          {candidature.description}
        </p>
      )}

      {/* Status Badge */}
      <div className="mb-3">
        <span className="inline-block px-3 py-1 bg-[var(--bg-secondary)] text-[var(--accent-orange)] rounded-full text-xs font-medium">
          {candidature.statut}
        </span>
      </div>

      {/* Notes if present */}
      {candidature.notes && (
        <div className="mb-3 p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border-color)] text-sm text-[var(--text-secondary)]">
          <span className="font-semibold">Notes:</span> {candidature.notes}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-3 border-t border-[var(--border-color)]">
        {candidature.url && (
          <a
            href={candidature.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs btn-blue px-3 py-1 flex-1 text-center"
          >
            Voir l'offre
          </a>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          disabled={isDeleting}
          className="text-xs px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded disabled:opacity-50 transition-colors"
        >
          {isDeleting ? "..." : "Supprimer"}
        </button>
      </div>
    </div>
  );
}
