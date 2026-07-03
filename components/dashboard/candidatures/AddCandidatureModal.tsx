"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { CandidatureType } from "@/models/Candidature";

// Ajout manuel d'une candidature — pour le cas « j'ai déjà le contact » : email connu,
// lettre écrite/collée à la main, pas besoin de passer par la recherche d'offres.
// Avec une lettre → statut « lettre générée » (prête à envoyer) ; le CV est résolu
// automatiquement à l'envoi selon le type (scope cv-files, fallback CV par défaut).

interface AddCandidatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onCreated: () => void;
}

const inputClass =
  "w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--accent-orange)] focus:outline-none";

export function AddCandidatureModal({ isOpen, onClose, apiKey, onCreated }: AddCandidatureModalProps) {
  const [entreprise, setEntreprise] = useState("");
  const [poste, setPoste] = useState("");
  const [email, setEmail] = useState("");
  const [localisation, setLocalisation] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<CandidatureType>("alternance");
  const [lettre, setLettre] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setEntreprise("");
    setPoste("");
    setEmail("");
    setLocalisation("");
    setUrl("");
    setType("alternance");
    setLettre("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!entreprise.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/candidatures", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          entreprise: entreprise.trim(),
          poste: poste.trim() || "Candidature spontanée",
          email: email.trim(),
          localisation: localisation.trim(),
          url: url.trim(),
          type,
          lettre,
          plateforme: "Autre",
        }),
      });
      if (res.status === 409) throw new Error("Une candidature avec cette URL existe déjà");
      if (!res.ok) throw new Error("Échec de la création");
      toast.success(
        lettre.trim()
          ? "Candidature créée — prête à envoyer (le CV sera joint automatiquement)"
          : "Candidature créée dans « Offres à traiter »"
      );
      reset();
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="card-elevated max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Ajouter une candidature</h2>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Contact déjà connu ? Renseigne l&apos;email et colle ta lettre : elle sera prête à envoyer,
              CV joint automatiquement selon le type.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="add-entreprise" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Entreprise <span className="text-[var(--accent-danger)]">*</span>
            </label>
            <input
              id="add-entreprise"
              value={entreprise}
              onChange={(e) => setEntreprise(e.target.value)}
              placeholder="Extia"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="add-poste" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Poste
            </label>
            <input
              id="add-poste"
              value={poste}
              onChange={(e) => setPoste(e.target.value)}
              placeholder="Candidature spontanée"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="add-email" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Email du contact
            </label>
            <input
              id="add-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marie.dupont@entreprise.fr"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="add-type" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Type
            </label>
            <select
              id="add-type"
              value={type}
              onChange={(e) => setType(e.target.value as CandidatureType)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="alternance">Alternance</option>
              <option value="stage">Stage</option>
              <option value="cdi">CDI</option>
            </select>
          </div>
          <div>
            <label htmlFor="add-localisation" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Ville
            </label>
            <input
              id="add-localisation"
              value={localisation}
              onChange={(e) => setLocalisation(e.target.value)}
              placeholder="Strasbourg"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="add-url" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              URL (annonce ou site) <span className="text-[var(--text-tertiary)]">— optionnel</span>
            </label>
            <input
              id="add-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="add-lettre" className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Lettre de motivation <span className="text-[var(--text-tertiary)]">— optionnel, colle ton texte</span>
          </label>
          <textarea
            id="add-lettre"
            value={lettre}
            onChange={(e) => setLettre(e.target.value)}
            placeholder="Sans lettre, la candidature arrive dans « Offres à traiter » et tu pourras la générer avec l'IA."
            rows={8}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--accent-orange)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Création…" : lettre.trim() ? "Créer (prête à envoyer)" : "Créer"}
          </button>
        </div>
      </form>
    </div>
  );
}
