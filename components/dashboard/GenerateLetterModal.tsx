"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Send } from "lucide-react";
import { toast } from "sonner";
import type { ICandidature } from "@/models/Candidature";

interface GenerateLetterModalProps {
  candidature: ICandidature | null;
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSend: (candidature: ICandidature, lettre: string, email: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<ICandidature>) => Promise<void>;
}

const LETTER_TEMPLATES = {
  formal:
    "Madame, Monsieur,\n\nC'est avec un grand intérêt que je vous présente ma candidature pour le poste de {poste} au sein de votre entreprise {entreprise}.",
  passionate:
    "Passionné par le développement web et l'innovation, je suis ravi de postuler pour le rôle de {poste} chez {entreprise}.",
  technical:
    "Fort d'une expertise en {competences} et d'une expérience concrète en développement fullstack, je suis intéressé par cette opportunité de {poste} chez {entreprise}.",
};

export function GenerateLetterModal({
  candidature,
  isOpen,
  onClose,
  apiKey,
  onSend,
  onUpdate,
}: GenerateLetterModalProps) {
  const [template, setTemplate] = useState<keyof typeof LETTER_TEMPLATES>("formal");
  const [generatedLetter, setGeneratedLetter] = useState("");
  const [editingLetter, setEditingLetter] = useState("");
  const [step, setStep] = useState<"template" | "generate" | "review">("template");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(candidature?.email || "");

  if (!isOpen || !candidature) return null;

  const handleGenerateLetter = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidature_id: candidature._id,
          template,
        }),
      });

      if (!response.ok) throw new Error("Erreur lors de la génération");

      const data = await response.json();
      setGeneratedLetter(data.lettre);
      setEditingLetter(data.lettre);
      setStep("review");
      toast.success("Lettre générée avec succès!");
    } catch (error) {
      toast.error("Erreur lors de la génération de la lettre");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLetter = () => {
    navigator.clipboard.writeText(editingLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Lettre copiée!");
  };

  const handleSend = async () => {
    if (!email) {
      toast.error("Veuillez entrer l'email de l'entreprise");
      return;
    }
    setLoading(true);
    try {
      await onSend(candidature, editingLetter, email);
      await onUpdate(candidature._id || "", {
        lettre: editingLetter,
        statut: "postulée",
        email,
      });
      onClose();
      toast.success("Candidature envoyée!");
    } catch (error) {
      toast.error("Erreur lors de l'envoi");
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
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {step === "template"
              ? "Choisir un modèle"
              : step === "generate"
                ? "Générer la lettre"
                : "Réviser et envoyer"}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {step === "template" && (
              <motion.div
                key="template"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <p className="text-[var(--text-secondary)] mb-6">
                  {candidature.entreprise} - {candidature.poste}
                </p>

                {Object.entries(LETTER_TEMPLATES).map(([key, preview]) => (
                  <motion.button
                    key={key}
                    className={`w-full p-4 rounded-lg text-left border-2 transition-all ${
                      template === key
                        ? "border-[var(--accent-orange)] bg-[var(--accent-orange)]/10"
                        : "border-[var(--border-color)] hover:border-[var(--accent-orange)]"
                    }`}
                    onClick={() => setTemplate(key as keyof typeof LETTER_TEMPLATES)}
                    whileHover={{ scale: 1.02 }}
                  >
                    <h3 className="font-semibold text-[var(--text-primary)] mb-2 capitalize">
                      {key === "formal"
                        ? "Formel"
                        : key === "passionate"
                          ? "Passionné"
                          : "Technique"}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {preview.substring(0, 100)}...
                    </p>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {step === "generate" && (
              <motion.div
                key="generate"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center space-y-6"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Send size={48} className="mx-auto text-[var(--accent-orange)]" />
                </motion.div>
                <p className="text-[var(--text-primary)] font-medium">
                  Génération de votre lettre de motivation...
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Basée sur le modèle {template} et vos informations
                </p>
              </motion.div>
            )}

            {step === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Email input */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Email de l'entreprise
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
                    placeholder="contact@entreprise.com"
                  />
                </div>

                {/* Letter preview */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Lettre de motivation
                  </label>
                  <textarea
                    value={editingLetter}
                    onChange={(e) => setEditingLetter(e.target.value)}
                    className="w-full h-64 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)] font-mono text-sm"
                  />
                </div>

                {/* Copy button */}
                <motion.button
                  type="button"
                  onClick={handleCopyLetter}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--accent-orange)]/20 rounded text-[var(--text-primary)] transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {copied ? (
                    <>
                      <Check size={16} />
                      Copié!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copier la lettre
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 p-4 sm:p-6 border-t border-[var(--border-color)]">
          {step !== "template" && (
            <motion.button
              onClick={() => setStep(step === "generate" ? "template" : "generate")}
              className="px-6 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent-orange)] transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Retour
            </motion.button>
          )}

          {step === "template" && (
            <motion.button
              onClick={() => {
                setStep("generate");
                setTimeout(handleGenerateLetter, 500);
              }}
              disabled={loading}
              className="ml-auto px-6 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold hover:opacity-90 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Générer
            </motion.button>
          )}

          {step === "review" && (
            <motion.button
              onClick={handleSend}
              disabled={loading || !email}
              className="ml-auto px-6 py-2 rounded-lg bg-[var(--accent-blue)] text-white font-semibold hover:opacity-90 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? "Envoi..." : "Envoyer la candidature"}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
