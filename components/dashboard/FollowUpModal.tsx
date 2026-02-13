"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, AlertCircle, Send } from "lucide-react";
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
    title: "Relance 1 (Semaine 1)",
    days: 7,
    message:
      "Bonjour,\n\nJe suis revenu vers vous concernant ma candidature pour le poste de {poste}. Je reste très motivé par cette opportunité au sein de {entreprise}.\n\nCordialement,\nMohammed",
  },
  second: {
    title: "Relance 2 (Semaine 3)",
    days: 21,
    message:
      "Bonjour,\n\nJ'espère que vous avez bien reçu ma candidature pour {poste}. Je suis toujours très intéressé par cette position et reste à votre disposition pour discuter davantage.\n\nCordialement,\nMohammed",
  },
  final: {
    title: "Relance 3 (Semaine 5)",
    days: 35,
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-3 sm:mx-0"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Programmer une relance</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Candidature info */}
          <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-[var(--text-secondary)] text-sm mb-1">Candidature</p>
            <p className="text-[var(--text-primary)] font-semibold">
              {candidature.entreprise} - {candidature.poste}
            </p>
          </div>

          {/* Templates */}
          <div className="space-y-3">
            <p className="text-[var(--text-secondary)] text-sm font-medium">Choisir un modèle de relance</p>

            {Object.entries(FOLLOW_UP_TEMPLATES).map(([key, tmpl]) => (
              <motion.button
                key={key}
                onClick={() => setSelectedTemplate(key as keyof typeof FOLLOW_UP_TEMPLATES)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedTemplate === key
                    ? "border-[var(--accent-orange)] bg-[var(--accent-orange)]/10"
                    : "border-[var(--border-color)] hover:border-[var(--accent-orange)]"
                }`}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-start gap-3">
                  <Clock size={20} className="text-[var(--accent-orange)] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{tmpl.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {tmpl.days} jours à partir d'aujourd'hui
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Timeline info */}
          <motion.div
            className="p-4 bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/30 rounded-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex gap-3">
              <AlertCircle size={20} className="text-[var(--accent-blue)] flex-shrink-0" />
              <div>
                <p className="font-semibold text-[var(--accent-blue)] text-sm mb-1">
                  Programmé pour {followUpDate.toLocaleDateString("fr-FR")}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Vous serez notifié le jour de la relance pour vous permettre d'envoyer un message de suivi
                </p>
              </div>
            </div>
          </motion.div>

          {/* Message preview */}
          <div>
            <p className="text-[var(--text-secondary)] text-sm font-medium mb-2">Aperçu du message</p>
            <div className="p-4 bg-[var(--bg-secondary)] rounded-lg font-mono text-sm text-[var(--text-primary)] whitespace-pre-wrap">
              {template.message.replace("{poste}", candidature.poste).replace("{entreprise}", candidature.entreprise)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 p-4 sm:p-6 border-t border-[var(--border-color)]">
          <motion.button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-orange)] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Annuler
          </motion.button>
          <motion.button
            onClick={handleScheduleFollowUp}
            disabled={loading}
            className="ml-auto px-6 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Calendar size={16} />
            {loading ? "Programmation..." : "Programmer la relance"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import React from "react";
