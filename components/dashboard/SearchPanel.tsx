"use client";

import { useState } from "react";

interface SearchPanelProps {
  onSearch: (keywords: string, location: string) => Promise<void>;
  isLoading?: boolean;
  apiKey: string;
}

export function SearchPanel({
  onSearch,
  isLoading = false,
  apiKey,
}: SearchPanelProps) {
  const [keywords, setKeywords] = useState("stage développeur fullstack");
  const [location, setLocation] = useState("France");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await onSearch(keywords, location);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la recherche");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-elevated p-6 mb-6">
      <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        🔍 Rechercher des offres
      </h2>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
            Mots-clés
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="ex: stage développeur fullstack"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
          />
        </div>

        <div>
          <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
            Localisation
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="ex: France, Île-de-France"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded p-3 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full btn-orange disabled:opacity-50 disabled:cursor-not-allowed font-semibold py-3"
      >
        {isLoading ? "🔄 Recherche en cours..." : "🚀 Lancer la recherche"}
      </button>

      <p className="text-xs text-[var(--text-tertiary)] mt-4 text-center">
        Recherche sur: JSearch, Adzuna, France Travail
      </p>
    </form>
  );
}
