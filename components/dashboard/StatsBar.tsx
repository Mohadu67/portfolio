"use client";

import { motion } from "framer-motion";
import { Landmark, FileText, Send, MessageSquare, Trophy, Briefcase } from "lucide-react";
import type { CandidatureStatut } from "@/models/Candidature";

interface StatsBarProps {
  stats: Record<string, number>;
  total: number;
  activeStatus: CandidatureStatut | null;
  onStatusClick: (status: CandidatureStatut | null) => void;
}

const statIcons = {
  "identifiée": Landmark,
  "lettre générée": FileText,
  "postulée": Send,
  "entretien": MessageSquare,
  "acceptée": Trophy,
};

const statLabels = {
  "identifiée": "À traiter",
  "lettre générée": "Prêtes",
  "postulée": "Envoyées",
  "entretien": "Entretiens",
  "acceptée": "Acceptées",
};

const statColors = {
  "identifiée": "text-[var(--status-identifiee)]",
  "lettre générée": "text-[var(--status-lettre)]",
  "postulée": "text-[var(--status-postule)]",
  "entretien": "text-[var(--status-entretien)]",
  "acceptée": "text-[var(--status-acceptee)]",
};

const statBorderColors = {
  "identifiée": "border-[var(--status-identifiee)]",
  "lettre générée": "border-[var(--status-lettre)]",
  "postulée": "border-[var(--status-postule)]",
  "entretien": "border-[var(--status-entretien)]",
  "acceptée": "border-[var(--status-acceptee)]",
};

export function StatsBar({ stats, total, activeStatus, onStatusClick }: StatsBarProps) {
  const statItems = [
    "identifiée",
    "lettre générée",
    "postulée",
    "entretien",
    "acceptée",
  ] as const;

  return (
    <motion.div
      className="mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {/* Total card - compact */}
        <motion.div
          onClick={() => onStatusClick(null)}
          className={`card p-3 text-center cursor-pointer transition-all duration-300 h-full flex flex-col items-center justify-center ${
            activeStatus === null
              ? "border-[var(--accent-orange)] bg-[var(--accent-orange)]/5"
              : "hover:border-[var(--accent-orange)]"
          }`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="text-[var(--accent-orange)] mb-1.5">
            <Briefcase size={20} strokeWidth={1.5} />
          </div>
          <p className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{total}</p>
          <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5 font-medium">Total</p>
        </motion.div>

        {statItems.map((key, idx) => {
          const Icon = statIcons[key];
          const label = statLabels[key];
          const color = statColors[key];
          const borderColor = statBorderColors[key];
          const count = stats[key] || 0;
          const isActive = activeStatus === key;

          return (
            <motion.div
              key={key}
              onClick={() => onStatusClick(isActive ? null : key)}
              className={`card p-3 text-center cursor-pointer transition-all duration-300 h-full flex flex-col items-center justify-center ${
                isActive
                  ? `${borderColor} bg-[var(--bg-secondary)]`
                  : "hover:border-[var(--accent-orange)]"
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (idx + 1) * 0.08 }}
              whileHover={{ y: -3, scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className={`${color} mb-1.5`}>
                <Icon size={20} strokeWidth={1.5} />
              </div>
              <p className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{count}</p>
              <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5 font-medium">{label}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
