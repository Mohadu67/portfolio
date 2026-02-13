"use client";

import { motion } from "framer-motion";
import { Search, Zap, CheckCircle2 } from "lucide-react";

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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-secondary)]/50 border border-[var(--accent-orange)]/20 rounded-2xl p-6 sm:p-8 md:p-12 max-w-md w-full mx-3 sm:mx-4 shadow-2xl"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Glow Background Effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[var(--accent-orange)]/5 via-transparent to-[var(--accent-blue)]/5 pointer-events-none" />

        {/* Icon Animation */}
        <motion.div
          className="flex justify-center mb-6 relative"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] rounded-full blur-xl opacity-30"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Search size={48} className="text-[var(--accent-orange)] relative z-10 drop-shadow-lg" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h3
          className="text-2xl font-bold bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] bg-clip-text text-transparent text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Recherche en cours...
        </motion.h3>

        {/* Progress Bar */}
        <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-3 relative border border-[var(--border-color)]/50">
            <motion.div
              className="h-full bg-gradient-to-r from-[var(--accent-orange)] via-[var(--accent-blue)] to-[var(--accent-orange)] shadow-lg shadow-[var(--accent-orange)]/50"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <motion.p
            className="text-sm text-[var(--text-secondary)] text-center font-medium"
            key={Math.floor(progress)}
          >
            {Math.floor(progress)}% complète
          </motion.p>
        </motion.div>

        {/* Current Source */}
        <motion.div
          className="flex items-center justify-center gap-3 mb-8 p-4 bg-gradient-to-r from-[var(--accent-orange)]/10 to-[var(--accent-blue)]/10 rounded-xl border border-[var(--accent-orange)]/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
            <Zap size={16} className="text-[var(--accent-orange)]" />
          </motion.div>
          <p className="text-sm text-[var(--text-primary)] font-semibold">{currentSource}</p>
        </motion.div>

        {/* Source List */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {sources.map((source, idx) => {
            const sourceProgress = (sources.indexOf(source) / sources.length) * 100;
            const isCompleted = progress > sourceProgress;
            const isCurrent = currentSource === source;

            return (
              <motion.div
                key={source}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isCompleted
                    ? "bg-gradient-to-r from-[var(--accent-blue)]/20 to-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/30"
                    : isCurrent
                      ? "bg-gradient-to-r from-[var(--accent-orange)]/20 to-[var(--accent-orange)]/5 border border-[var(--accent-orange)]/30"
                      : "bg-[var(--bg-secondary)]/30 border border-[var(--border-color)]/30"
                }`}
                animate={isCurrent ? { scale: 1.02, x: 4 } : { scale: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <motion.div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isCompleted
                      ? "bg-[var(--accent-blue)] border-[var(--accent-blue)]"
                      : isCurrent
                        ? "border-[var(--accent-orange)]"
                        : "border-[var(--text-tertiary)]"
                  }`}
                  animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.6, repeat: Infinity }}
                >
                  {isCompleted && <CheckCircle2 size={14} className="text-white" />}
                </motion.div>
                <span className={`text-sm font-semibold ${isCompleted ? "text-[var(--accent-blue)]" : isCurrent ? "text-[var(--accent-orange)]" : "text-[var(--text-secondary)]"}`}>
                  {source}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
