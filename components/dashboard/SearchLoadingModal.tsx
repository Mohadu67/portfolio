"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle2, Zap, Globe, Database, Cpu } from "lucide-react";

interface SearchLoadingModalProps {
  isOpen: boolean;
  progress: number;
}

const STEPS = [
  {
    id: 0,
    icon: Globe,
    label: "JSearch",
    description: "Scan des offres mondiales",
    color: "var(--accent-orange)",
    threshold: 0,
  },
  {
    id: 1,
    icon: Database,
    label: "France Travail",
    description: "Offres officielles FR",
    color: "var(--accent-blue)",
    threshold: 33,
  },
  {
    id: 2,
    icon: Zap,
    label: "Indeed",
    description: "Agrégateur d'offres",
    color: "#a855f7",
    threshold: 66,
  },
  {
    id: 3,
    icon: Cpu,
    label: "Analyse IA",
    description: "Tri & dédoublonnage",
    color: "#10b981",
    threshold: 90,
  },
];

const MESSAGES = [
  "Connexion aux sources d'emploi...",
  "Analyse des offres en cours...",
  "Filtrage par compétences...",
  "Vérification des doublons...",
  "Enrichissement des données...",
  "Tri par pertinence...",
  "Presque terminé...",
];

function Particle({ delay, duration }: { delay: number; duration: number }) {
  const x = Math.random() * 100;
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-[var(--accent-orange)]/40"
      style={{ left: `${x}%`, bottom: "-4px" }}
      animate={{ y: [-0, -280], opacity: [0, 0.8, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

export function SearchLoadingModal({ isOpen, progress }: SearchLoadingModalProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, [isOpen]);

  const currentStepIndex = STEPS.filter((s) => progress >= s.threshold).length - 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="relative max-w-sm w-full mx-4 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)",
              border: "1px solid rgba(255,165,0,0.15)",
              borderRadius: "24px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          >
            {/* Ambient glow top */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(ellipse, rgba(249,115,22,0.18) 0%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />

            {/* Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 10 }).map((_, i) => (
                <Particle key={i} delay={i * 0.4} duration={2.5 + Math.random() * 1.5} />
              ))}
            </div>

            <div className="relative p-7">
              {/* Icon + Radar */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  {/* Ripple rings */}
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 rounded-full border border-[var(--accent-orange)]/30"
                      style={{ margin: `-${(i + 1) * 12}px` }}
                      animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                      transition={{ duration: 1.8, delay: i * 0.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  ))}
                  <motion.div
                    className="relative w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(59,130,246,0.2))",
                      border: "1px solid rgba(249,115,22,0.3)",
                    }}
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Search size={28} className="text-[var(--accent-orange)]" />
                  </motion.div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-5">
                <h3
                  className="text-xl font-bold mb-1"
                  style={{
                    background: "linear-gradient(90deg, var(--accent-orange), var(--accent-blue))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Recherche en cours
                </h3>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={messageIndex}
                    className="text-xs"
                    style={{ color: "var(--text-secondary)" }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                  >
                    {MESSAGES[messageIndex]}
                    <span className="inline-block w-5 text-left">{dots}</span>
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div
                  className="h-2 rounded-full overflow-hidden mb-2"
                  style={{ background: "var(--bg-secondary)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <motion.div
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                      background: "linear-gradient(90deg, var(--accent-orange), var(--accent-blue), var(--accent-orange))",
                      backgroundSize: "200% 100%",
                    }}
                    animate={{
                      width: `${progress}%`,
                      backgroundPosition: ["0% 0%", "100% 0%"],
                    }}
                    transition={{
                      width: { duration: 0.6, ease: "easeOut" },
                      backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" },
                    }}
                  >
                    {/* Shimmer */}
                    <motion.div
                      className="absolute inset-0 w-12 h-full bg-white/20 skew-x-12"
                      animate={{ x: ["-100%", "400%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </motion.div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold" style={{ color: "var(--accent-orange)" }}>
                    {Math.floor(progress)}%
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {progress < 100 ? "en cours" : "terminé"}
                  </span>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {STEPS.map((step, idx) => {
                  const isCompleted = progress > step.threshold + 25;
                  const isCurrent = idx === currentStepIndex && !isCompleted;
                  const Icon = step.icon;

                  return (
                    <motion.div
                      key={step.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
                      style={{
                        background: isCompleted
                          ? `rgba(59,130,246,0.08)`
                          : isCurrent
                            ? `rgba(249,115,22,0.08)`
                            : "rgba(255,255,255,0.02)",
                        border: isCompleted
                          ? "1px solid rgba(59,130,246,0.2)"
                          : isCurrent
                            ? "1px solid rgba(249,115,22,0.2)"
                            : "1px solid rgba(255,255,255,0.04)",
                      }}
                      animate={isCurrent ? { x: [0, 2, 0] } : { x: 0 }}
                      transition={{ duration: 1.5, repeat: isCurrent ? Infinity : 0 }}
                    >
                      {/* Icon badge */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative"
                        style={{
                          background: isCompleted
                            ? "rgba(59,130,246,0.15)"
                            : isCurrent
                              ? "rgba(249,115,22,0.15)"
                              : "rgba(255,255,255,0.04)",
                        }}
                      >
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            <CheckCircle2 size={16} color="var(--accent-blue)" />
                          </motion.div>
                        ) : isCurrent ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            <Icon size={16} style={{ color: step.color }} />
                          </motion.div>
                        ) : (
                          <Icon size={16} style={{ color: "var(--text-tertiary)", opacity: 0.5 }} />
                        )}
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold leading-none mb-0.5"
                          style={{
                            color: isCompleted
                              ? "var(--accent-blue)"
                              : isCurrent
                                ? "var(--accent-orange)"
                                : "var(--text-tertiary)",
                          }}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)", opacity: 0.7 }}>
                          {step.description}
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <span className="text-xs font-medium" style={{ color: "var(--accent-blue)" }}>
                            ✓
                          </span>
                        ) : isCurrent ? (
                          <motion.div
                            className="flex gap-0.5"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-1 h-1 rounded-full"
                                style={{ background: "var(--accent-orange)" }}
                                animate={{ scale: [0.5, 1.2, 0.5], opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
                              />
                            ))}
                          </motion.div>
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--border-color)" }} />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
