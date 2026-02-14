"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Mail,
  Phone,
  FileText,
  Send,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Building2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { ScrapedCompanyData } from "@/lib/web-scraper";

interface ScrapedCompanyCardProps {
  data: ScrapedCompanyData;
  url: string;
  apiKey: string;
  onCandidatureCreated: () => void;
}

export function ScrapedCompanyCard({
  data,
  url,
  apiKey,
  onCandidatureCreated,
}: ScrapedCompanyCardProps) {
  const [showAbout, setShowAbout] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [lettre, setLettre] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState(data.emails[0] || "");
  const [customEmail, setCustomEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [poste, setPoste] = useState("");
  const [candidatureId, setCandidatureId] = useState<string | null>(null);

  const handleCreateCandidature = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/candidatures", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entreprise: data.companyName || new URL(url).hostname,
          poste: poste || "Candidature spontanée",
          plateforme: "Web",
          localisation: "",
          url,
          description: data.description.substring(0, 500),
          email: selectedEmail || customEmail,
          aboutText: data.aboutText,
          statut: "identifiée",
          date: new Date().toISOString().split("T")[0],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || "Erreur");
      }

      const created = await res.json();
      setCandidatureId(created._id);
      toast.success("Candidature créée !");
      onCandidatureCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateLetter = async () => {
    if (!candidatureId) return;
    setGeneratingLetter(true);
    try {
      const res = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ candidature_id: candidatureId }),
      });

      if (!res.ok) throw new Error("Erreur lors de la génération");

      const result = await res.json();
      setLettre(result.lettre);
      toast.success("Lettre générée !");
      onCandidatureCreated();
    } catch (error) {
      toast.error("Erreur lors de la génération de la lettre");
    } finally {
      setGeneratingLetter(false);
    }
  };

  const handleSendEmail = async () => {
    if (!candidatureId) return;
    const email = selectedEmail || customEmail;
    if (!email) {
      toast.error("Veuillez saisir un email destinataire");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidature_id: candidatureId,
          email_destinataire: email,
        }),
      });

      if (!res.ok) throw new Error("Erreur lors de l'envoi");

      toast.success(`Email envoyé à ${email} !`);
      onCandidatureCreated();
    } catch (error) {
      toast.error("Erreur lors de l'envoi de l'email");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      className="card-elevated p-5 border-l-4 border-[var(--accent-blue)]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Building2 size={24} className="text-[var(--accent-blue)]" />
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {data.companyName || new URL(url).hostname}
            </h3>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent-orange)] hover:underline flex items-center gap-1"
            >
              <Globe size={12} />
              {new URL(url).hostname}
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
        <span className="px-2 py-1 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded text-xs font-medium">
          Web
        </span>
      </div>

      {/* Description */}
      {data.description && (
        <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-3">
          {data.description}
        </p>
      )}

      {/* Emails & Phones */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {data.emails.length > 0 && (
          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-1">
              <Mail size={14} className="text-[var(--accent-orange)]" />
              Emails trouvés ({data.emails.length})
            </p>
            <div className="space-y-1">
              {data.emails.map((email) => (
                <label key={email} className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="radio"
                    name="email"
                    value={email}
                    checked={selectedEmail === email}
                    onChange={() => { setSelectedEmail(email); setCustomEmail(""); }}
                    className="accent-[var(--accent-orange)]"
                  />
                  {email}
                </label>
              ))}
            </div>
          </div>
        )}

        {data.phones.length > 0 && (
          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-1">
              <Phone size={14} className="text-[var(--accent-blue)]" />
              Téléphones trouvés ({data.phones.length})
            </p>
            <div className="space-y-1">
              {data.phones.map((phone) => (
                <p key={phone} className="text-sm text-[var(--text-primary)]">{phone}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom email input */}
      <div className="mb-4">
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
          Ou saisir un email manuellement
        </label>
        <input
          type="email"
          value={customEmail}
          onChange={(e) => { setCustomEmail(e.target.value); setSelectedEmail(""); }}
          placeholder="email@entreprise.com"
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
        />
      </div>

      {/* About text toggle */}
      {data.aboutText && (
        <div className="mb-4">
          <button
            onClick={() => setShowAbout(!showAbout)}
            className="flex items-center gap-2 text-sm font-medium text-[var(--accent-blue)] hover:underline"
          >
            {showAbout ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Page "À propos" ({data.aboutText.length} caractères)
          </button>
          {showAbout && (
            <motion.div
              className="mt-2 p-3 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-secondary)] max-h-60 overflow-y-auto whitespace-pre-line"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              {data.aboutText}
            </motion.div>
          )}
        </div>
      )}

      {/* Poste input */}
      {!candidatureId && (
        <div className="mb-4">
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
            Poste visé (optionnel, sinon candidature spontanée)
          </label>
          <input
            type="text"
            value={poste}
            onChange={(e) => setPoste(e.target.value)}
            placeholder="ex: Développeur Fullstack"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border-color)]">
        {!candidatureId ? (
          <motion.button
            onClick={handleCreateCandidature}
            disabled={creating}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Créer candidature
          </motion.button>
        ) : (
          <>
            {!lettre ? (
              <motion.button
                onClick={handleGenerateLetter}
                disabled={generatingLetter}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-orange)]/20 text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {generatingLetter ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {generatingLetter ? "Génération..." : "Générer lettre"}
              </motion.button>
            ) : (
              <motion.button
                onClick={handleSendEmail}
                disabled={sending || (!selectedEmail && !customEmail)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg btn-orange disabled:opacity-50 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? "Envoi..." : "Envoyer candidature"}
              </motion.button>
            )}
          </>
        )}
      </div>

      {/* Letter preview */}
      {lettre && (
        <motion.div
          className="mt-4 p-4 bg-[var(--bg-secondary)] rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent-orange)]" />
            Prévisualisation de la lettre
          </h4>
          <div className="text-sm text-[var(--text-secondary)] whitespace-pre-line max-h-60 overflow-y-auto">
            {lettre}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
