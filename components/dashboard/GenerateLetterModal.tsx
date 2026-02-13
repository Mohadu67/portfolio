"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Send, Sparkles } from "lucide-react";
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

const templateDescriptions = {
  formal: "Approche professionnelle et formelle, idéale pour les grandes entreprises",
  passionate: "Style motivé et enthousiaste pour montrer votre passion",
  technical: "Accent sur vos compétences techniques et expérience",
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
  const [generatedCV, setGeneratedCV] = useState("");
  const [step, setStep] = useState<"template" | "generate" | "review">("template");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(candidature?.email || "");
  const [activeTab, setActiveTab] = useState<"cv" | "letter">("cv");

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
      setGeneratedCV(data.cv || "");
      setActiveTab("cv");
      setStep("review");
      toast.success("Lettre et CV générés avec succès!");
    } catch (error) {
      toast.error("Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = () => {
    const textToCopy = activeTab === "cv" ? generatedCV : editingLetter;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(activeTab === "cv" ? "CV copié!" : "Lettre copiée!");
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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-secondary)]/50 border border-[var(--accent-blue)]/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-3 sm:mx-0 shadow-2xl"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Background Effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[var(--accent-blue)]/5 via-transparent to-[var(--accent-orange)]/5 pointer-events-none" />

        {/* Header */}
        <motion.div
          className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-color)]/50 relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <motion.h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] bg-clip-text text-transparent">
            {step === "template"
              ? "Choisir un modèle"
              : step === "generate"
                ? "Génération en cours..."
                : "Réviser et envoyer"}
          </motion.h2>
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">
          <AnimatePresence mode="wait">
            {step === "template" && (
              <motion.div
                key="template"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <p className="text-[var(--text-secondary)] mb-2 text-sm">Candidature pour</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">
                    {candidature.entreprise} • {candidature.poste}
                  </p>
                </motion.div>

                <div className="space-y-3">
                  {Object.entries(LETTER_TEMPLATES).map(([key, preview], idx) => (
                    <motion.button
                      key={key}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + idx * 0.1 }}
                      className={`w-full p-4 rounded-xl text-left border-2 transition-all group relative overflow-hidden ${
                        template === key
                          ? "border-[var(--accent-orange)] bg-gradient-to-r from-[var(--accent-orange)]/15 to-[var(--accent-orange)]/5"
                          : "border-[var(--border-color)]/50 hover:border-[var(--accent-orange)]/60 bg-[var(--bg-secondary)]/30"
                      }`}
                      onClick={() => setTemplate(key as keyof typeof LETTER_TEMPLATES)}
                      whileHover={{ scale: 1.02, boxShadow: "0 10px 30px rgba(255, 158, 100, 0.15)" }}
                    >
                      {template === key && (
                        <motion.div
                          className="absolute -top-1 -right-1 text-[var(--accent-orange)]"
                          initial={{ rotate: -180, scale: 0 }}
                          animate={{ rotate: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          <Sparkles size={20} />
                        </motion.div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)]" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-[var(--text-primary)] capitalize">
                            {key === "formal"
                              ? "Formel"
                              : key === "passionate"
                                ? "Passionné"
                                : "Technique"}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            {templateDescriptions[key as keyof typeof templateDescriptions]}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === "generate" && (
              <motion.div
                key="generate"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center space-y-8 py-12"
              >
                <motion.div
                  className="flex justify-center relative"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] rounded-full blur-2xl opacity-30"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                    <Send size={56} className="text-[var(--accent-orange)] relative z-10 drop-shadow-lg" />
                  </motion.div>
                </motion.div>

                <div>
                  <motion.p
                    className="text-xl font-semibold text-[var(--text-primary)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Génération de votre lettre...
                  </motion.p>
                  <motion.p
                    className="text-sm text-[var(--text-secondary)] mt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    Basée sur le modèle <span className="text-[var(--accent-orange)] font-medium">{template}</span>
                  </motion.p>
                </div>

                {/* Loading dots animation */}
                <motion.div className="flex justify-center gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-[var(--accent-orange)]"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}

            {step === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {/* Email input */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Email de l'entreprise
                  </label>
                  <motion.input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--border-color)]/50 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]/80 focus:shadow-lg focus:shadow-[var(--accent-orange)]/20 transition-all"
                    placeholder="contact@entreprise.com"
                    whileFocus={{ scale: 1.01 }}
                  />
                </motion.div>

                {/* CV and Letter tabs */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  {/* Tab buttons */}
                  <div className="flex gap-2 mb-3">
                    <motion.button
                      onClick={() => setActiveTab("cv")}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        activeTab === "cv"
                          ? "bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)]"
                          : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]/50 hover:border-[var(--accent-orange)]/60"
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      📄 Curriculum Vitae
                    </motion.button>
                    <motion.button
                      onClick={() => setActiveTab("letter")}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        activeTab === "letter"
                          ? "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-blue)]/80 text-white"
                          : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]/50 hover:border-[var(--accent-blue)]/60"
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      ✉️ Lettre de motivation
                    </motion.button>
                  </div>

                  {/* Content */}
                  <AnimatePresence mode="wait">
                    {activeTab === "cv" && (
                      <motion.div
                        key="cv"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.textarea
                          value={generatedCV}
                          readOnly
                          className="w-full h-64 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--border-color)]/50 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]/80 font-mono text-sm transition-all resize-none cursor-default"
                        />
                      </motion.div>
                    )}

                    {activeTab === "letter" && (
                      <motion.div
                        key="letter"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.textarea
                          value={editingLetter}
                          onChange={(e) => setEditingLetter(e.target.value)}
                          className="w-full h-64 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--border-color)]/50 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]/80 focus:shadow-lg focus:shadow-[var(--accent-blue)]/20 font-mono text-sm transition-all resize-none"
                          whileFocus={{ scale: 1.01 }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Copy button */}
                <motion.button
                  type="button"
                  onClick={handleCopyContent}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                    copied
                      ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30"
                      : "bg-gradient-to-r from-[var(--accent-orange)]/10 to-[var(--accent-orange)]/5 text-[var(--text-primary)] border border-[var(--accent-orange)]/30 hover:border-[var(--accent-orange)]/60"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {copied ? (
                    <>
                      <Check size={18} />
                      Copié!
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copier {activeTab === "cv" ? "le CV" : "la lettre"}
                    </>
                  )}
                </motion.button>
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
          {step !== "template" && (
            <motion.button
              onClick={() => setStep(step === "generate" ? "template" : "generate")}
              className="px-6 py-3 rounded-lg border border-[var(--border-color)]/50 text-[var(--text-primary)] hover:border-[var(--accent-orange)]/60 hover:bg-[var(--accent-orange)]/5 transition-all font-medium"
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
              className="ml-auto px-8 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] font-semibold hover:shadow-lg hover:shadow-[var(--accent-orange)]/30 disabled:opacity-50 transition-all"
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(255, 158, 100, 0.3)" }}
              whileTap={{ scale: 0.95 }}
            >
              Générer la lettre
            </motion.button>
          )}

          {step === "review" && (
            <motion.button
              onClick={handleSend}
              disabled={loading || !email}
              className="ml-auto px-8 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-blue)]/80 text-white font-semibold hover:shadow-lg hover:shadow-[var(--accent-blue)]/30 disabled:opacity-50 transition-all"
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(46, 159, 216, 0.3)" }}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? "Envoi en cours..." : "Envoyer la candidature"}
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
