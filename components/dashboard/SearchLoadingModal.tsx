"use client";

import { motion } from "framer-motion";
import { Search, Zap } from "lucide-react";

interface SearchLoadingModalProps {
  isOpen: boolean;
  progress: number;
}

export function SearchLoadingModal({ isOpen, progress }: SearchLoadingModalProps) {
  if (!isOpen) return null;

  const sources = ["JSearch", "Adzuna", "France Travail"];
  const currentSource = sources[Math.floor((progress / 100) * sources.length)];

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 sm:p-8 md:p-12 max-w-md w-full mx-3 sm:mx-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Icon Animation */}
        <motion.div
          className="flex justify-center mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Search size={48} className="text-[var(--accent-orange)]" />
        </motion.div>

        {/* Title */}
        <h3 className="text-xl font-bold text-[var(--text-primary)] text-center mb-6">
          Recherche en cours...
        </h3>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-sm text-[var(--text-secondary)] text-center">
            {progress}% complète
          </p>
        </div>

        {/* Current Source */}
        <motion.div
          className="flex items-center justify-center gap-2 mb-6 p-3 bg-[var(--bg-secondary)] rounded-lg"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Zap size={16} className="text-[var(--accent-orange)]" />
          <p className="text-sm text-[var(--text-primary)] font-medium">
            Vérification: {currentSource}
          </p>
        </motion.div>

        {/* Source List */}
        <div className="space-y-2">
          {sources.map((source, idx) => {
            const sourceProgress = (sources.indexOf(source) / sources.length) * 100;
            const isCompleted = progress > sourceProgress;
            const isCurrent = currentSource === source;

            return (
              <motion.div
                key={source}
                className={`flex items-center gap-3 p-2 rounded transition-colors ${
                  isCompleted
                    ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]"
                    : isCurrent
                      ? "bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]"
                      : "text-[var(--text-secondary)]"
                }`}
                animate={isCurrent ? { scale: 1.05 } : { scale: 1 }}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    isCompleted
                      ? "bg-[var(--accent-blue)] border-[var(--accent-blue)]"
                      : isCurrent
                        ? "border-[var(--accent-orange)]"
                        : "border-[var(--text-tertiary)]"
                  }`}
                />
                <span className="text-sm font-medium">{source}</span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
