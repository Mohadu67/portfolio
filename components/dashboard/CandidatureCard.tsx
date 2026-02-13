"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Clock, Trash2, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import type { ICandidature } from "@/models/Candidature";

interface CandidatureCardProps {
  candidature: ICandidature;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onGenerateLetter?: (candidature: ICandidature) => void;
  onFollowUp?: (candidature: ICandidature) => void;
  apiKey: string;
}

const STATUS_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  identifiée: {
    border: "border-[var(--status-identifiee)]",
    bg: "bg-[var(--status-identifiee)]/10",
    text: "text-[var(--status-identifiee)]",
  },
  "lettre générée": {
    border: "border-[var(--status-lettre)]",
    bg: "bg-[var(--status-lettre)]/10",
    text: "text-[var(--status-lettre)]",
  },
  postulée: {
    border: "border-[var(--status-postule)]",
    bg: "bg-[var(--status-postule)]/10",
    text: "text-[var(--status-postule)]",
  },
  "réponse reçue": {
    border: "border-[var(--status-reponse)]",
    bg: "bg-[var(--status-reponse)]/10",
    text: "text-[var(--status-reponse)]",
  },
  entretien: {
    border: "border-[var(--status-entretien)]",
    bg: "bg-[var(--status-entretien)]/10",
    text: "text-[var(--status-entretien)]",
  },
  refus: {
    border: "border-[var(--status-refus)]",
    bg: "bg-[var(--status-refus)]/10",
    text: "text-[var(--status-refus)]",
  },
  acceptée: {
    border: "border-[var(--status-acceptee)]",
    bg: "bg-[var(--status-acceptee)]/10",
    text: "text-[var(--status-acceptee)]",
  },
};

export function CandidatureCard({
  candidature,
  onSelect,
  onDelete,
  onGenerateLetter,
  onFollowUp,
  apiKey,
}: CandidatureCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const statusColor = STATUS_COLORS[candidature.statut] || STATUS_COLORS.identifiée;

  const handleDelete = async () => {
    if (!candidature._id) return;
    if (confirm("Êtes-vous sûr de vouloir supprimer cette candidature ?")) {
      setIsDeleting(true);
      try {
        await onDelete?.(candidature._id as string);
        toast.success("Candidature supprimée");
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <motion.div
      className={`card p-3 sm:p-4 md:p-5 border-l-4 ${statusColor.border} hover:shadow-lg transition-all duration-300 hover:bg-[var(--bg-secondary)]`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 cursor-pointer" onClick={() => onSelect?.(candidature._id as string)}>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {candidature.poste}
          </h3>
          <p className="text-[var(--text-secondary)] font-medium">
            {candidature.entreprise}
          </p>
        </div>
      </div>

      {/* Location & Platform */}
      <div className="flex gap-3 mb-3 text-sm text-[var(--text-tertiary)] flex-wrap">
        <span>{candidature.localisation}</span>
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
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
          {candidature.statut}
        </span>
      </div>

      {/* Notes if present */}
      {candidature.notes && (
        <div className="mb-3 p-2 bg-[var(--bg-secondary)] rounded border border-[var(--border-color)] text-sm text-[var(--text-secondary)]">
          <span className="font-semibold">📌 Notes:</span> {candidature.notes}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border-color)]">
        {candidature.url && (
          <motion.a
            href={candidature.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs px-3 py-1.5 flex items-center gap-1 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ExternalLink size={14} />
            Offre
          </motion.a>
        )}

        {candidature.statut === "identifiée" && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onGenerateLetter?.(candidature);
            }}
            className="text-xs px-3 py-1.5 flex items-center gap-1 rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 transition-colors flex-1"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FileText size={14} />
            Lettre
          </motion.button>
        )}

        {candidature.statut === "postulée" && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onFollowUp?.(candidature);
            }}
            className="text-xs px-3 py-1.5 flex items-center gap-1 rounded bg-[var(--accent-orange)]/20 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/30 transition-colors flex-1"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Clock size={14} />
            Relance
          </motion.button>
        )}

        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          disabled={isDeleting}
          className="text-xs px-3 py-1.5 flex items-center gap-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Trash2 size={14} />
          {isDeleting ? "..." : "Suppr"}
        </motion.button>
      </div>
    </motion.div>
  );
}
