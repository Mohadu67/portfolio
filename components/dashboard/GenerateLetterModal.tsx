"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Send, Wand2, FileText, Star, Eye } from "lucide-react";
import { toast } from "sonner";
import type { ICandidature } from "@/models/Candidature";

interface CVFileOption {
  _id: string;
  name: string;
  filename: string;
  scope: "default" | "stage" | "alternance" | "cdi";
  isDefault: boolean;
  size: number;
}

interface GenerateLetterModalProps {
  candidature: ICandidature | null;
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSend: (candidature: ICandidature, lettre: string, email: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<ICandidature>) => Promise<void>;
}

export function GenerateLetterModal({
  candidature,
  isOpen,
  onClose,
  apiKey,
  onSend,
  onUpdate,
}: GenerateLetterModalProps) {
  const [letterText, setLetterText] = useState("");
  const [type, setType] = useState<"stage" | "alternance" | "cdi">("stage");
  const [improvedLetter, setImprovedLetter] = useState("");
  const [step, setStep] = useState<"write" | "improved" | "review">("write");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(candidature?.email || "");
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [cvFiles, setCvFiles] = useState<CVFileOption[]>([]);
  const [selectedCvFileId, setSelectedCvFileId] = useState<string>("auto");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let aborted = false;
    fetch("/api/cv-files", { headers: { "x-api-key": apiKey } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("CVs unavailable"))))
      .then((data) => {
        if (!aborted) setCvFiles(data.files ?? []);
      })
      .catch(() => {
        if (!aborted) setCvFiles([]);
      });
    return () => {
      aborted = true;
    };
  }, [isOpen, apiKey]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen || !candidature) return null;

  const autoMatchCV =
    cvFiles.find((f) => f.scope === type) ?? cvFiles.find((f) => f.isDefault) ?? null;

  const previewSelectedCV = async () => {
    const id = selectedCvFileId === "auto" ? autoMatchCV?._id : selectedCvFileId;
    if (!id) {
      toast.error("Aucun CV à prévisualiser");
      return;
    }
    const cv = cvFiles.find((f) => f._id === id);
    try {
      const res = await fetch(`/api/cv-files/${id}/download`, { headers: { "x-api-key": apiKey } });
      if (!res.ok) throw new Error("Échec");
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewName(cv?.name ?? "Aperçu CV");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName("");
  };

  const handleGenerateProposal = async () => {
    setGeneratingProposal(true);
    try {
      const response = await fetch("/api/generate-proposal", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entreprise: candidature.entreprise,
          aboutText: candidature.aboutText || "",
          poste: candidature.poste,
        }),
      });

      if (!response.ok) throw new Error("Erreur lors de la génération");

      const data = await response.json();
      setLetterText(data.lettre);
      toast.success("Proposition générée! Relis et améliore si besoin.");
    } catch (error) {
      toast.error("Erreur lors de la génération");
    } finally {
      setGeneratingProposal(false);
    }
  };

  const handleImprove = async () => {
    if (!letterText.trim()) {
      toast.error("Écris d'abord ta lettre");
      return;
    }

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
          letterText: letterText.trim(),
          type,
        }),
      });

      if (!response.ok) throw new Error("Erreur lors de l'amélioration");

      const data = await response.json();
      setImprovedLetter(data.lettre);
      setStep("improved");
      toast.success("Lettre améliorée!");
    } catch (error) {
      toast.error("Erreur lors de l'amélioration");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(improvedLetter);
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
      // Send with type parameter
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidature_id: candidature._id,
          email_destinataire: email,
          type,
          ...(selectedCvFileId !== "auto" ? { cv_file_id: selectedCvFileId } : {}),
        }),
      });

      if (!res.ok) throw new Error("Erreur lors de l'envoi");

      await onUpdate(candidature._id || "", {
        lettre: improvedLetter,
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
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[var(--accent-blue)]/5 via-transparent to-[var(--accent-orange)]/5 pointer-events-none" />

        {/* Header */}
        <motion.div
          className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-color)]/50 relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <motion.h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-blue)] bg-clip-text text-transparent">
            {step === "write"
              ? "Écris ta lettre"
              : step === "improved"
                ? "Lettre améliorée"
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
            {step === "write" && (
              <motion.div
                key="write"
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

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Type de candidature
                  </label>
                  <div className="flex gap-2">
                    {(["stage", "alternance", "cdi"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                          type === t
                            ? "bg-[var(--accent-blue)] text-white"
                            : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {t === "stage" ? "Stage" : t === "alternance" ? "Alternance" : "CDI"}
                      </button>
                    ))}
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-[var(--text-primary)]">
                      Ta lettre de motivation
                    </label>
                    <motion.button
                      onClick={handleGenerateProposal}
                      disabled={generatingProposal || !candidature.aboutText}
                      className="text-xs px-3 py-1 rounded bg-[var(--accent-orange)]/20 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/30 disabled:opacity-50 transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {generatingProposal ? "Génération..." : "Générer une proposition"}
                    </motion.button>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">
                    Écris ta lettre comme tu le souhaites, ou clique sur "Générer une proposition" pour avoir une base. L'IA l'améliorera au niveau du style et de la structure.
                  </p>
                  <motion.textarea
                    value={letterText}
                    onChange={(e) => setLetterText(e.target.value)}
                    className="w-full h-80 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--border-color)]/50 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]/80 focus:shadow-lg focus:shadow-[var(--accent-orange)]/20 font-mono text-sm transition-all resize-none"
                    placeholder="Écris ici ce que tu veux dire à l'entreprise..."
                    whileFocus={{ scale: 1.01 }}
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">
                    {letterText.length} caractères
                  </p>
                </motion.div>
              </motion.div>
            )}

            {step === "improved" && (
              <motion.div
                key="improved"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Lettre améliorée
                  </label>
                  <motion.textarea
                    value={improvedLetter}
                    onChange={(e) => setImprovedLetter(e.target.value)}
                    className="w-full h-72 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--border-color)]/50 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]/80 focus:shadow-lg focus:shadow-[var(--accent-blue)]/20 font-mono text-sm transition-all resize-none"
                    whileFocus={{ scale: 1.01 }}
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">
                    Tu peux modifier si tu veux
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <motion.button
                    type="button"
                    onClick={handleCopyContent}
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
                        Copier la lettre
                      </>
                    )}
                  </motion.button>
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Email de l&apos;entreprise
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

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-[var(--accent-orange)]" />
                    CV à joindre
                  </label>
                  {cvFiles.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--border-color)]/60 px-4 py-3 text-sm text-[var(--text-secondary)]">
                      Aucun CV importé.{" "}
                      <Link
                        href="/dashboard/cv-files"
                        target="_blank"
                        className="text-[var(--accent-orange)] underline"
                      >
                        Importer un CV
                      </Link>
                      <span className="text-xs block mt-1 text-[var(--text-tertiary)]">
                        À défaut, le fichier <code>candidatureModel/cv-mohammed.pdf</code> sera utilisé.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <select
                          value={selectedCvFileId}
                          onChange={(e) => setSelectedCvFileId(e.target.value)}
                          className="flex-1 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--border-color)]/50 rounded-lg px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]/80 focus:shadow-lg focus:shadow-[var(--accent-orange)]/20 transition-all"
                        >
                          <option value="auto">
                            🤖 Auto — {autoMatchCV ? `${autoMatchCV.name} (${autoMatchCV.scope})` : "fichier statique fallback"}
                          </option>
                          {cvFiles.map((f) => (
                            <option key={f._id} value={f._id}>
                              {f.isDefault ? "★ " : ""}
                              {f.name} · {f.scope}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={previewSelectedCV}
                          disabled={selectedCvFileId === "auto" && !autoMatchCV}
                          className="px-3 rounded-lg border border-[var(--border-color)]/50 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 disabled:opacity-40 transition-all flex items-center gap-1.5 text-sm font-medium"
                          title="Aperçu du CV"
                        >
                          <Eye size={16} />
                          Aperçu
                        </button>
                      </div>
                      <p className="text-xs text-[var(--text-tertiary)] mt-2 flex items-center gap-1">
                        <Star size={11} /> = défaut · Auto choisit le CV correspondant au type ({type}), sinon le défaut.
                      </p>
                    </>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Lettre de motivation
                  </label>
                  <motion.div
                    className="w-full h-64 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-secondary)]/50 border border-[var(--border-color)]/50 rounded-lg px-4 py-3 text-[var(--text-primary)] font-mono text-sm transition-all overflow-y-auto"
                    whileFocus={{ scale: 1.01 }}
                  >
                    {improvedLetter}
                  </motion.div>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">
                    CV PDF et Lettre PDF seront joints à l&apos;email
                  </p>
                </motion.div>
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
          {step !== "write" && (
            <motion.button
              onClick={() => {
                if (step === "improved") {
                  setStep("write");
                } else {
                  setStep("improved");
                }
              }}
              className="px-6 py-3 rounded-lg border border-[var(--border-color)]/50 text-[var(--text-primary)] hover:border-[var(--accent-orange)]/60 hover:bg-[var(--accent-orange)]/5 transition-all font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Retour
            </motion.button>
          )}

          {step === "write" && (
            <motion.button
              onClick={handleImprove}
              disabled={loading || !letterText.trim()}
              className="ml-auto px-8 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-orange)]/80 text-[var(--bg-primary)] font-semibold hover:shadow-lg hover:shadow-[var(--accent-orange)]/30 disabled:opacity-50 transition-all flex items-center gap-2"
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(255, 158, 100, 0.3)" }}
              whileTap={{ scale: 0.95 }}
            >
              <Wand2 size={18} />
              Améliorer la lettre
            </motion.button>
          )}

          {step === "improved" && (
            <motion.button
              onClick={() => setStep("review")}
              className="ml-auto px-8 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-blue)]/80 text-white font-semibold hover:shadow-lg hover:shadow-[var(--accent-blue)]/30 transition-all"
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(46, 159, 216, 0.3)" }}
              whileTap={{ scale: 0.95 }}
            >
              Continuer
            </motion.button>
          )}

          {step === "review" && (
            <motion.button
              onClick={handleSend}
              disabled={loading || !email}
              className="ml-auto px-8 py-3 rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-blue)]/80 text-white font-semibold hover:shadow-lg hover:shadow-[var(--accent-blue)]/30 disabled:opacity-50 transition-all flex items-center gap-2"
              whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(46, 159, 216, 0.3)" }}
              whileTap={{ scale: 0.95 }}
            >
              <Send size={18} />
              {loading ? "Envoi en cours..." : "Envoyer la candidature"}
            </motion.button>
          )}
        </motion.div>
      </motion.div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={18} className="text-[var(--accent-orange)] flex-shrink-0" />
                <h2 className="font-semibold truncate text-[var(--text-primary)]">{previewName}</h2>
              </div>
              <button
                onClick={closePreview}
                className="p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
              >
                <X size={20} />
              </button>
            </div>
            <iframe src={previewUrl} title={previewName} className="flex-1 w-full bg-[var(--bg-primary)]" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
