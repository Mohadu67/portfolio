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
  const [keywords, setKeywords] = useState("stage développeur web");
  const [location, setLocation] = useState("France");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSearch(keywords, location);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4">🔍 Rechercher des offres</h2>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">
            Mots-clés
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="ex: stage développeur web"
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">
            Localisation
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="ex: France"
            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded transition-colors"
      >
        {isLoading ? "Recherche en cours..." : "Lancer la recherche"}
      </button>
    </form>
  );
}
