"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, AlertCircle, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { ICandidature } from "@/models/Candidature";

interface FollowUpModalProps {
  candidature: ICandidature | null;
  isOpen: boolean;
  onClose: () => void;
  onFollowUp: (candidature: ICandidature, followUpDate: string) => Promise<void>;
}

const FOLLOW_UP_TEMPLATES = {
  initial: {
    title: "Relance 1",
    subtitle: "Semaine 1",
    days: 7,
    icon: "⚡",
    message:
      "Bonjour,\n\nJe suis revenu vers vous concernant ma candidature pour le poste de {poste}. Je reste très motivé par cette opportunité au sein de {entreprise}.\n\nCordialement,\nMohammed",
  },
  second: {
    title: "Relance 2",
    subtitle: "Semaine 3",
    days: 21,
    icon: "🔥",
    message:
      "Bonjour,\n\nJ'espère que vous avez bien reçu ma candidature pour {poste}. Je suis toujours très intéressé par cette position et reste à votre disposition pour discuter davantage.\n\nCordialement,\nMohammed",
  },
  final: {
    title: "Relance 3",
    subtitle: "Semaine 5",
    days: 35,
    icon: "🎯",
    message:
      "Bonjour,\n\nComme suite à ma candidature envoyée le {date}, je tenais à vous recontacter pour connaître l'avancement du processus de sélection pour le poste de {poste}.\n\nJe reste à votre écoute.\nCordialement,\nMohammed",
  },
};

export function FollowUpModal({
  candidature,
  isOpen,
  onClose,
  onFollowUp,
}: FollowUpModalProps) {
  const [selectedTemplate, setSelectedTemplate] = React.useState<
    keyof typeof FOLLOW_UP_TEMPLATES
  >("initial");
  const [loading, setLoading] = React.useState(false);

  if (!isOpen || !candidature) return null;

  const template = FOLLOW_UP_TEMPLATES[selectedTemplate];
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + template.days);

  const handleScheduleFollowUp = async () => {
    setLoading(true);
    try {
      await onFollowUp(candidature, followUpDate.toISOString().split("T")[0]);
      toast.success(`Relance prévue pour ${followUpDate.toLocaleDateString("fr-FR")}`);
      onClose();
    } catch (error) {
      toast.error("Erreur lors de la programmation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-secondary)]/50 border border-[var(--accent-orange)]/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-3 sm:mx-0 shadow-2xl"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Background Effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[var(--accent-orange)]/5 via-transparent to-[var(--accent-blue)]/5 pointer-events-none" />

        {/* Header */}
        <motion.div
          className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-color)]/50 relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] bg-clip-text text-transparent">
              Programmer une relance
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{candidature.entreprise}</p>
          </motion.div>
          <motion.button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--accent-orange)] transition-colors"
            whileHover={{ rotate: 90, scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={24} />
          </motion.button>
        </motion.div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 relative z-10">
          {/* Templates */}
          <motion.div className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            <div>
              <p className="text-[var(--text-secondary)] text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock size={16} className="text-[var(--accent-orange)]" />
                Choisir un modèle de relance
              </p>
            </div>

            {Object.entries(FOLLOW_UP_TEMPLATES).map(([key, tmpl], idx) => (
              <motion.button
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                onClick={() => setSelectedTemplate(key as keyof typeof FOLLOW_UP_TEMPLATES)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all group relative overflow-hidden ${
                  selectedTemplate === key
                    ? "border-[var(--accent-orange)] bg-gradient-to-r from-[var(--accent-orange)]/15 to-[var(--accent-orange)]/5"
                    : "border-[var(--border-color)]/50 hover:border-[var(--accent-orange)]/60 bg-[var(--bg-secondary)]/30"
                }`}
                whileHover={{ scale: 1.02, boxShadow: "0 10px 30px rgba(255, 158, 100, 0.15)" }}
              >
                <div className="flex items-start gap-3 relative">
                  <div className="text-2xl flex-shrink-0">{tmpl.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--text-primary)]">{tmpl.title}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]">
                        {tmpl.subtitle}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      Programmé dans {tmpl.days} jours • {new Date(Date.now() + tmpl.days * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {selectedTemplate === key && (
                    <motion.div
                      className="absolute -top-1 -right-1"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <CheckCircle2 size={20} className="text-[var(--accent-orange)]" />
                    </motion.div>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>

          {/* Timeline info */}
          <motion.div
            className="p-5 bg-gradient-to-r from-[var(--accent-orange)]/10 to-[var(--accent-orange)]/5 border border-[var(--accent-orange)]/30 rounded-xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex gap-4 items-start">
              <motion.div
                className="p-2 bg-[var(--accent-orange)]/20 rounded-lg flex-shrink-0"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Calendar size={20} className="text-[var(--accent-orange)]" />
              </motion.div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--text-primary)] text-sm mb-1">
                  Relance programmée pour
                </p>
                <p className="text-sm font-bold text-[var(--accent-orange)]">
                  {followUpDate.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Vous serez notifié le jour J pour envoyer votre message
                </p>
              </div>
            </div>
          </motion.div>

          {/* Message preview */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <p className="text-[var(--text-secondary)] text-sm font-semibold mb-3 flex items-center gap-2">
              <Send size={16} className="text-[var(--accent-blue)]" />
              Aperçu du message
            </p>
            <div className="p-4 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 rounded-xl font-mono text-xs sm:text-sm text-[var(--text-primary)] whitespace-pre-wrap border border-[var(--border-color)]/30 max-h-40 overflow-y-auto">
              {template.message.replace("{poste}", candidature.poste).replace("{entreprise}", candidature.entreprise)}
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 p-4 sm:p-6 border-t border-[var(--border-color)]/50 relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            onClick={onClose}
            className="px-6 py-3 rounded-lg border border-[var(--border-color)]/50 text-[var(--text-primary)] hover:border-[var(--accent-orange)]/60 hover:bg-[var(--accent-orange)]/5 transition-all font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Annuler
          </motion.button>
          <motion.button
            onClick={handleScheduleFollowUp}
            disabled={loading}
            className="ml-auto px-8 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] font-semibold hover:shadow-lg hover:shadow-[var(--accent-orange)]/30 disabled:opacity-50 flex items-center gap-2 transition-all"
            whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(255, 158, 100, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            <Calendar size={18} />
            {loading ? "Programmation..." : "Programmer la relance"}
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
