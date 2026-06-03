"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, Send, CheckCircle2, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ICandidature, IRelance, CandidatureType } from "@/models/Candidature";

interface FollowUpModalProps {
  candidature: ICandidature | null;
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (candidature: ICandidature, relance: IRelance) => Promise<void>;
  onSendNow: (candidature: ICandidature, message: string, templateTitle: string) => Promise<void>;
  onCancel: (candidature: ICandidature) => Promise<void>;
  apiKey: string;
}

type TemplateKey = "initial" | "second" | "final";

function buildTemplates(type: CandidatureType) {
  const typeLabel =
    type === "cdi" ? "un poste en développement" :
    type === "alternance" ? "une alternance en développement" :
    "un stage en développement";

  return {
    initial: {
      title: "Relance 1",
      subtitle: "Semaine 1",
      days: 7,
      icon: "⚡",
      message:
        `Bonjour,\n\nJe me permets de revenir vers vous suite à ma candidature {contexte}, envoyée il y a une semaine.\n\nJe souhaitais m'assurer que vous aviez bien reçu mon dossier (CV + lettre de motivation) et vous confirmer ma disponibilité pour un échange à votre convenance.\n\nN'hésitez pas à me contacter si vous avez besoin d'informations complémentaires.\n\nBien cordialement,\nMohammed Hamiani`,
    },
    second: {
      title: "Relance 2",
      subtitle: "Semaine 3",
      days: 21,
      icon: "🔥",
      message:
        `Bonjour,\n\nJe reviens vers vous concernant ma candidature {contexte}. Depuis mon dernier message, j'ai continué à travailler sur des projets fullstack qui renforcent ma conviction que je pourrais apporter une vraie valeur à votre équipe.\n\nJe serais ravi d'échanger avec vous, même brièvement, pour vous présenter mon parcours et comprendre vos besoins actuels. Je suis flexible sur les créneaux.\n\nBien cordialement,\nMohammed Hamiani`,
    },
    final: {
      title: "Relance 3",
      subtitle: "Semaine 5",
      days: 35,
      icon: "🎯",
      message:
        `Bonjour,\n\nJe me permets un dernier message concernant ma candidature {contexte}.\n\nJe comprends que les processus de recrutement prennent du temps et que vous recevez de nombreuses candidatures. Si mon profil correspond à vos besoins, je reste très motivé et disponible pour un entretien.\n\nMerci pour le temps accordé à ma candidature.\n\nBien cordialement,\nMohammed Hamiani`,
    },
    _typeLabel: typeLabel,
  };
}

export function FollowUpModal({
  candidature,
  isOpen,
  onClose,
  onSchedule,
  onSendNow,
  onCancel,
  apiKey,
}: FollowUpModalProps) {
  const [selectedTemplate, setSelectedTemplate] = React.useState<TemplateKey>("initial");
  const [loading, setLoading] = React.useState(false);
  const [editedMessage, setEditedMessage] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);
  const [view, setView] = React.useState<"select" | "manage">("select");

  React.useEffect(() => {
    if (isOpen && candidature?.relance && candidature.relance.status === "programmée") {
      setView("manage");
      setSelectedTemplate(candidature.relance.template);
    } else {
      setView("select");
    }
  }, [isOpen, candidature]);

  if (!isOpen || !candidature) return null;

  const type = candidature.type || "alternance";
  const templates = buildTemplates(type);
  const isSpontanee = candidature.poste.toLowerCase().includes("spontanée") || candidature.poste.toLowerCase().includes("spontanee");

  const contexte = isSpontanee
    ? `pour ${templates._typeLabel} chez ${candidature.entreprise}`
    : `pour le poste de ${candidature.poste} chez ${candidature.entreprise}`;

  const template = templates[selectedTemplate];
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + template.days);

  const currentMessage = isEditing
    ? editedMessage
    : (view === "manage" && candidature.relance?.message)
      ? candidature.relance.message
      : template.message.replace("{contexte}", contexte);

  const handleSchedule = async () => {
    setLoading(true);
    try {
      const message = isEditing ? editedMessage : template.message.replace("{contexte}", contexte);
      const relance: IRelance = {
        date: followUpDate.toISOString().split("T")[0],
        template: selectedTemplate,
        message,
        status: "programmée",
      };
      await onSchedule(candidature, relance);
      toast.success(`Relance programmée pour ${followUpDate.toLocaleDateString("fr-FR")}`);
      onClose();
    } catch {
      toast.error("Erreur lors de la programmation");
    } finally {
      setLoading(false);
    }
  };

  const handleSendNow = async () => {
    setLoading(true);
    try {
      const message = isEditing ? editedMessage : currentMessage;
      await onSendNow(candidature, message, template.title);
      toast.success("Relance envoyée !");
      onClose();
    } catch {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await onCancel(candidature);
      toast.success("Relance annulée");
      onClose();
    } catch {
      toast.error("Erreur lors de l'annulation");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditing = () => {
    setEditedMessage(currentMessage);
    setIsEditing(true);
  };

  const handleSwitchToSelect = () => {
    setView("select");
    setIsEditing(false);
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
              {view === "manage" ? "Gérer la relance" : "Programmer une relance"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-[var(--text-secondary)]">{candidature.entreprise}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]">
                {type === "stage" ? "Stage" : type === "alternance" ? "Alternance" : "CDI"}
              </span>
            </div>
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
          <AnimatePresence mode="wait">
            {view === "manage" && candidature.relance ? (
              <motion.div
                key="manage"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                {/* Current relance info */}
                <div className="p-5 bg-gradient-to-r from-[var(--accent-orange)]/10 to-[var(--accent-orange)]/5 border border-[var(--accent-orange)]/30 rounded-xl">
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
                        Relance programmée
                      </p>
                      <p className="text-sm font-bold text-[var(--accent-orange)]">
                        {new Date(candidature.relance.date + "T00:00:00").toLocaleDateString("fr-FR", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {templates[candidature.relance.template]?.title || "Relance"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Message preview */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[var(--text-secondary)] text-sm font-semibold flex items-center gap-2">
                      <Send size={16} className="text-[var(--accent-blue)]" />
                      Message de relance
                    </p>
                    {!isEditing && (
                      <motion.button
                        onClick={handleStartEditing}
                        className="text-xs px-3 py-1 rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 transition-all flex items-center gap-1"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Edit3 size={12} />
                        Modifier
                      </motion.button>
                    )}
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      className="w-full h-48 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--accent-blue)]/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]/80 font-mono text-xs sm:text-sm resize-none"
                    />
                  ) : (
                    <div className="p-4 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 rounded-xl font-mono text-xs sm:text-sm text-[var(--text-primary)] whitespace-pre-wrap border border-[var(--border-color)]/30 max-h-40 overflow-y-auto">
                      {candidature.relance.message}
                    </div>
                  )}
                </div>

                {/* Modify template button */}
                <motion.button
                  onClick={handleSwitchToSelect}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-[var(--border-color)]/50 text-[var(--text-secondary)] hover:border-[var(--accent-orange)]/60 hover:text-[var(--text-primary)] transition-all text-sm flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.01 }}
                >
                  <Edit3 size={16} />
                  Changer de modèle
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
              >
                {/* Templates */}
                <div className="space-y-3">
                  <p className="text-[var(--text-secondary)] text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock size={16} className="text-[var(--accent-orange)]" />
                    Choisir un modèle de relance
                  </p>

                  {(["initial", "second", "final"] as const).map((key, idx) => {
                    const tmpl = templates[key];
                    return (
                      <motion.button
                        key={key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + idx * 0.1 }}
                        onClick={() => {
                          setSelectedTemplate(key);
                          setIsEditing(false);
                        }}
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
                              Programmé dans {tmpl.days} jours - {new Date(Date.now() + tmpl.days * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR")}
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
                    );
                  })}
                </div>

                {/* Timeline info */}
                <div className="p-5 bg-gradient-to-r from-[var(--accent-orange)]/10 to-[var(--accent-orange)]/5 border border-[var(--accent-orange)]/30 rounded-xl">
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
                    </div>
                  </div>
                </div>

                {/* Message preview / edit */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[var(--text-secondary)] text-sm font-semibold flex items-center gap-2">
                      <Send size={16} className="text-[var(--accent-blue)]" />
                      Aperçu du message
                    </p>
                    {!isEditing ? (
                      <motion.button
                        onClick={handleStartEditing}
                        className="text-xs px-3 py-1 rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 transition-all flex items-center gap-1"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Edit3 size={12} />
                        Personnaliser
                      </motion.button>
                    ) : (
                      <motion.button
                        onClick={() => setIsEditing(false)}
                        className="text-xs px-3 py-1 rounded bg-[var(--accent-orange)]/20 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/30 transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Annuler modif
                      </motion.button>
                    )}
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      className="w-full h-48 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--accent-blue)]/50 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]/80 font-mono text-xs sm:text-sm resize-none"
                    />
                  ) : (
                    <div className="p-4 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 rounded-xl font-mono text-xs sm:text-sm text-[var(--text-primary)] whitespace-pre-wrap border border-[var(--border-color)]/30 max-h-40 overflow-y-auto">
                      {template.message.replace("{contexte}", contexte)}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.div
          className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 p-4 sm:p-6 border-t border-[var(--border-color)]/50 relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {view === "manage" ? (
            <>
              <motion.button
                onClick={handleCancel}
                disabled={loading}
                className="px-5 py-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all font-medium flex items-center gap-2 disabled:opacity-50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Trash2 size={16} />
                Annuler la relance
              </motion.button>
              <motion.button
                onClick={handleSendNow}
                disabled={loading || !candidature.email}
                className="ml-auto px-8 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] font-semibold hover:shadow-lg hover:shadow-[var(--accent-orange)]/30 disabled:opacity-50 flex items-center gap-2 transition-all"
                whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(255, 158, 100, 0.3)" }}
                whileTap={{ scale: 0.95 }}
              >
                <Send size={18} />
                {loading ? "Envoi..." : "Envoyer maintenant"}
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                onClick={onClose}
                className="px-6 py-3 rounded-lg border border-[var(--border-color)]/50 text-[var(--text-primary)] hover:border-[var(--accent-orange)]/60 hover:bg-[var(--accent-orange)]/5 transition-all font-medium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Annuler
              </motion.button>
              <div className="flex gap-3 ml-auto">
                <motion.button
                  onClick={handleSendNow}
                  disabled={loading || !candidature.email}
                  className="px-6 py-3 rounded-lg border border-[var(--accent-orange)]/50 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/10 font-medium disabled:opacity-50 flex items-center gap-2 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send size={16} />
                  {loading ? "Envoi..." : "Envoyer maintenant"}
                </motion.button>
                <motion.button
                  onClick={handleSchedule}
                  disabled={loading}
                  className="px-8 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] font-semibold hover:shadow-lg hover:shadow-[var(--accent-orange)]/30 disabled:opacity-50 flex items-center gap-2 transition-all"
                  whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(255, 158, 100, 0.3)" }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Calendar size={18} />
                  {loading ? "Programmation..." : "Programmer"}
                </motion.button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
