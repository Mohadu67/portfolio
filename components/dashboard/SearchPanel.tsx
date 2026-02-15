"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Sparkles } from "lucide-react";

interface SearchPanelProps {
  onSearch: (keywords: string, location: string) => Promise<void>;
  isLoading?: boolean;
  apiKey: string;
}

const QUICK_SEARCHES = [
  { label: "Développeur Fullstack", keywords: "stage développeur fullstack" },
  { label: "Développeur Frontend", keywords: "stage développeur frontend react" },
  { label: "Développeur Backend", keywords: "stage développeur backend node" },
  { label: "Développeur Web", keywords: "stage développeur web" },
];

const POPULAR_CITIES = [
  "Strasbourg",
  "Paris",
  "Lyon",
  "Marseille",
  "Toulouse",
  "Nice",
  "Nantes",
  "Bordeaux",
  "Lille",
  "Rennes",
];

export function SearchPanel({
  onSearch,
  isLoading = false,
  apiKey,
}: SearchPanelProps) {
  const [keywords, setKeywords] = useState("stage développeur fullstack");
  const [location, setLocation] = useState("Strasbourg");
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

  const handleQuickSearch = async (searchKeywords: string) => {
    setKeywords(searchKeywords);
    try {
      await onSearch(searchKeywords, location);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la recherche");
    }
  };

  return (
    <motion.div
      className="card-elevated p-6 mb-8 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-card)]/50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Search size={28} className="text-[var(--accent-orange)]" />
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Rechercher des offres</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Inputs */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
              Mots-clés
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="ex: stage développeur fullstack"
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
              Localisation
            </label>
            <div className="relative">
              <MapPin size={18} className="absolute left-3 top-3.5 text-[var(--accent-orange)]" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ex: France, Île-de-France"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Quick searches */}
        <div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mb-3 flex items-center gap-2">
            <Sparkles size={14} />
            Recherches rapides
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SEARCHES.map((search) => (
              <motion.button
                key={search.label}
                type="button"
                onClick={() => handleQuickSearch(search.keywords)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)] hover:border-[var(--accent-orange)] border border-[var(--border-color)] transition-colors disabled:opacity-50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {search.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Popular cities */}
        <div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mb-3 flex items-center gap-2">
            <MapPin size={14} />
            Villes populaires
          </p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_CITIES.map((city) => (
              <motion.button
                key={city}
                type="button"
                onClick={() => setLocation(city)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors disabled:opacity-50 ${
                  location === city
                    ? "bg-[var(--accent-orange)] border-[var(--accent-orange)] text-[var(--bg-primary)]"
                    : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {city}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            {error}
          </motion.div>
        )}

        {/* Submit button */}
        <motion.button
          type="submit"
          disabled={isLoading}
          className="w-full btn-orange disabled:opacity-50 disabled:cursor-not-allowed font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
          whileHover={{ scale: !isLoading ? 1.02 : 1 }}
          whileTap={{ scale: !isLoading ? 0.98 : 1 }}
        >
          <Search size={18} />
          {isLoading ? "Recherche en cours..." : "Lancer la recherche"}
        </motion.button>

        {/* Info */}
        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Recherche sur: JSearch, France Travail, Indeed
        </p>
      </form>
    </motion.div>
  );
}
