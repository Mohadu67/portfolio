"use client";

import { useState } from "react";
import type { ICandidature, CandidatureStatut } from "@/models/Candidature";

interface LetterModalProps {
  candidature: ICandidature;
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onUpdate?: (id: string, updates: Partial<ICandidature>) => Promise<void>;
}

export function LetterModal({
  candidature,
  isOpen,
  onClose,
  apiKey,
  onUpdate,
}: LetterModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [letter, setLetter] = useState(candidature.lettre || "");
  const [email, setEmail] = useState(candidature.email || "");
  const [notes, setNotes] = useState(candidature.notes || "");
  const [status, setStatus] = useState<CandidatureStatut>(candidature.statut);

  if (!isOpen) return null;

  const handleGenerateLetter = async () => {
    setIsGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ candidature_id: candidature._id }),
      });

      if (!res.ok) {
        throw new Error("Erreur lors de la génération");
      }

      const data = await res.json();
      setLetter(data.lettre);
      setSuccess("Lettre générée avec succès!");

      // Update local state
      await onUpdate?.(candidature._id as string, {
        lettre: data.lettre,
        statut: "lettre générée" as CandidatureStatut,
      });
      setStatus("lettre générée");

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email) {
      setError("Veuillez entrer l'email de l'entreprise");
      return;
    }

    setIsSending(true);
    setError("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          candidature_id: candidature._id,
          email_destinataire: email,
        }),
      });

      if (!res.ok) {
        throw new Error("Erreur lors de l'envoi");
      }

      setSuccess("Email envoyé avec succès!");

      // Update status to "postulée"
      await onUpdate?.(candidature._id as string, {
        statut: "postulée" as CandidatureStatut,
        email,
      });
      setStatus("postulée");

      setTimeout(() => {
        setSuccess("");
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await onUpdate?.(candidature._id as string, {
        notes,
        statut: status,
      });
      setSuccess("Modifications sauvegardées!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError("Erreur lors de la sauvegarde");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-elevated w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              {candidature.poste}
            </h2>
            <p className="text-[var(--text-secondary)]">{candidature.entreprise}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ✕
          </button>
        </div>

        {/* Status & Notes Section */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
              Statut
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CandidatureStatut)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-orange)]"
            >
              <option value="identifiée">📌 Identifiée</option>
              <option value="lettre générée">📝 Lettre générée</option>
              <option value="postulée">✉️ Postulée</option>
              <option value="réponse reçue">📬 Réponse reçue</option>
              <option value="entretien">💬 Entretien</option>
              <option value="refus">❌ Refus</option>
              <option value="acceptée">✅ Acceptée</option>
            </select>
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
              Notes personnelles
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajoutez vos notes personnelles..."
              className="w-full h-24 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] resize-none"
            />
          </div>

          <button
            onClick={handleSaveNotes}
            className="w-full btn-blue text-sm"
          >
            Sauvegarder les modifications
          </button>
        </div>

        {/* Letter Section */}
        <div className="mb-6 border-t border-[var(--border-color)] pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              Lettre de motivation
            </h3>
            {!letter && (
              <button
                onClick={handleGenerateLetter}
                disabled={isGenerating}
                className="btn-orange text-sm disabled:opacity-50"
              >
                {isGenerating ? "Génération..." : "Générer avec Claude"}
              </button>
            )}
          </div>

          {letter ? (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-4 mb-4 max-h-64 overflow-y-auto">
              <p className="text-[var(--text-secondary)] whitespace-pre-wrap text-sm leading-relaxed">
                {letter}
              </p>
            </div>
          ) : (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded p-8 text-center text-[var(--text-tertiary)]">
              Aucune lettre générée. Cliquez sur "Générer avec Claude" pour en créer une.
            </div>
          )}

          {/* Send Email Section */}
          {letter && (
            <div className="space-y-3">
              <div>
                <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
                  Email de l'entreprise
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@entreprise.com"
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)]"
                />
              </div>
              <button
                onClick={handleSendEmail}
                disabled={isSending || !email}
                className="w-full btn-orange disabled:opacity-50"
              >
                {isSending ? "Envoi en cours..." : "✉️ Envoyer la candidature"}
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded p-3 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 border border-green-500/50 rounded p-3 mb-4 text-green-400 text-sm">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
