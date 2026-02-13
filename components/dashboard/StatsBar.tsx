"use client";

import { motion } from "framer-motion";
import { Landmark, FileText, Send, MessageSquare, Trophy } from "lucide-react";

interface StatsBarProps {
  stats: Record<string, number>;
  total: number;
}

const statIcons = {
  "identifiée": Landmark,
  "lettre générée": FileText,
  "postulée": Send,
  "entretien": MessageSquare,
  "acceptée": Trophy,
};

const statLabels = {
  "identifiée": "Identifiées",
  "lettre générée": "Lettres",
  "postulée": "Postulées",
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

export function StatsBar({ stats, total }: StatsBarProps) {
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
      {/* Total KPI */}
      <motion.div
        className="card-elevated mb-6 p-4 sm:p-6 bg-gradient-to-br from-[var(--accent-orange)]/10 to-[var(--accent-blue)]/10 border border-[var(--accent-orange)]/20"
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <p className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
          Total candidatures
        </p>
        <motion.p
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)]"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          {total}
        </motion.p>
      </motion.div>

      {/* Stats grid - Mobile first */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        {statItems.map((key, idx) => {
          const Icon = statIcons[key];
          const label = statLabels[key];
          const color = statColors[key];
          const count = stats[key] || 0;

          return (
            <motion.div
              key={key}
              className="card p-3 sm:p-4 text-center hover:border-[var(--accent-orange)] transition-all duration-300 cursor-pointer h-full flex flex-col items-center justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4, scale: 1.05 }}
            >
              <div className={`${color} mb-2 flex-shrink-0`}>
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <motion.p
                className="text-lg sm:text-2xl font-bold text-[var(--text-primary)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.15, duration: 0.5 }}
              >
                {count}
              </motion.p>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium">
                {label}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
