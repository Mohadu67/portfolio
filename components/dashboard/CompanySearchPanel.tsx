"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Globe,
  Link2,
  Loader2,
  ExternalLink,
  Building2,
  Bookmark,
  BookmarkCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ScrapedCompanyCard } from "./ScrapedCompanyCard";
import type { ScrapedCompanyData } from "@/lib/web-scraper";

interface CompanySearchPanelProps {
  apiKey: string;
  onCandidatureCreated: () => void;
}

interface GoogleResult {
  name: string;
  url: string;
  snippet: string;
  displayUrl: string;
}

interface ScrapedResult {
  url: string;
  data: ScrapedCompanyData;
}

interface SavedSearchItem {
  _id: string;
  url: string;
  companyName: string;
  type: "url" | "google";
  created_at: string;
}

export function CompanySearchPanel({ apiKey, onCandidatureCreated }: CompanySearchPanelProps) {
  const [mode, setMode] = useState<"google" | "url">("google");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState<string | null>(null);
  const [googleResults, setGoogleResults] = useState<GoogleResult[]>([]);
  const [scrapedResults, setScrapedResults] = useState<ScrapedResult[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);

  const fetchSavedSearches = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-searches", {
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setSavedSearches(data.searches);
      }
    } catch {
      // silent fail
    }
  }, [apiKey]);

  useEffect(() => {
    fetchSavedSearches();
  }, [fetchSavedSearches]);

  const handleSaveSearch = async (url: string, companyName: string, type: "url" | "google" = "url") => {
    setSavingUrl(url);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, companyName, type }),
      });

      if (!res.ok) throw new Error("Erreur");

      toast.success("Recherche sauvegardée");
      await fetchSavedSearches();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSavingUrl(null);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      const res = await fetch(`/api/saved-searches?id=${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });

      if (!res.ok) throw new Error("Erreur");

      toast.success("Recherche supprimée");
      setSavedSearches((prev) => prev.filter((s) => s._id !== id));
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const isUrlSaved = (url: string) => savedSearches.some((s) => s.url === url);

  const handleGoogleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setGoogleResults([]);
    try {
      const res = await fetch("/api/search-companies", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, location }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || "Erreur de recherche");
      }

      const data = await res.json();
      setGoogleResults(data.results);

      if (data.results.length === 0) {
        toast.info("Aucun résultat trouvé");
      } else {
        toast.success(`${data.results.length} résultats trouvés`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la recherche");
    } finally {
      setSearching(false);
    }
  };

  const handleScrape = async (url: string) => {
    // Check if already scraped
    if (scrapedResults.some((r) => r.url === url)) {
      toast.info("Ce site a déjà été analysé");
      return;
    }

    setScraping(true);
    setScrapingUrl(url);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || "Erreur de scraping");
      }

      const data: ScrapedCompanyData = await res.json();
      setScrapedResults((prev) => [{ url, data }, ...prev]);
      toast.success(`Site analysé : ${data.emails.length} email(s) trouvé(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors du scraping");
    } finally {
      setScraping(false);
      setScrapingUrl(null);
    }
  };

  const handleManualScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;

    try {
      new URL(manualUrl);
    } catch {
      toast.error("URL invalide");
      return;
    }

    await handleScrape(manualUrl);
    setManualUrl("");
  };

  return (
    <div className="space-y-6 mb-8">
      {/* Saved searches section */}
      {savedSearches.length > 0 && (
        <motion.div
          className="card p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <BookmarkCheck size={20} className="text-[var(--accent-orange)]" />
            Recherches sauvegardées ({savedSearches.length})
          </h3>
          <div className="space-y-2">
            {savedSearches.map((saved) => (
              <motion.div
                key={saved._id}
                className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                    {saved.companyName}
                  </p>
                  <p className="text-xs text-[var(--accent-blue)] truncate">{saved.url}</p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <motion.button
                    onClick={() => handleScrape(saved.url)}
                    disabled={scraping && scrapingUrl === saved.url}
                    className="px-3 py-1.5 text-xs rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 disabled:opacity-50 flex items-center gap-1 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {scraping && scrapingUrl === saved.url ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Search size={12} />
                    )}
                    Analyser
                  </motion.button>
                  <motion.button
                    onClick={() => handleDeleteSaved(saved._id)}
                    className="px-2 py-1.5 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Trash2 size={12} />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Mode selector */}
      <motion.div
        className="card-elevated p-6 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-card)]/50"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Building2 size={28} className="text-[var(--accent-blue)]" />
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Recherche d&apos;entreprises</h2>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("google")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "google"
                ? "bg-[var(--accent-blue)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Search size={16} />
            Recherche Google
          </button>
          <button
            onClick={() => setMode("url")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "url"
                ? "bg-[var(--accent-blue)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Link2 size={16} />
            URL manuelle
          </button>
        </div>

        {/* Google search mode */}
        {mode === "google" && (
          <form onSubmit={handleGoogleSearch} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
                  Recherche
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='ex: "association développement web"'
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
                  Localisation (optionnel)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="ex: Strasbourg"
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={searching || !query.trim()}
              className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 bg-[var(--accent-blue)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              whileHover={{ scale: !searching ? 1.02 : 1 }}
              whileTap={{ scale: !searching ? 0.98 : 1 }}
            >
              {searching ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              {searching ? "Recherche en cours..." : "Rechercher des entreprises"}
            </motion.button>

            <p className="text-xs text-[var(--text-tertiary)] text-center">
              Recherche via SerpAPI (100 requêtes/mois)
            </p>
          </form>
        )}

        {/* Manual URL mode */}
        {mode === "url" && (
          <form onSubmit={handleManualScrape} className="space-y-4">
            <div>
              <label className="block text-[var(--text-secondary)] text-sm font-medium mb-2">
                URL du site de l&apos;entreprise
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe size={18} className="absolute left-3 top-3.5 text-[var(--accent-blue)]" />
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://www.entreprise.com"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                  />
                </div>
                <motion.button
                  type="submit"
                  disabled={scraping || !manualUrl.trim()}
                  className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 bg-[var(--accent-blue)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  whileHover={{ scale: !scraping ? 1.02 : 1 }}
                  whileTap={{ scale: !scraping ? 0.98 : 1 }}
                >
                  {scraping ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  Analyser
                </motion.button>
              </div>
            </div>
          </form>
        )}
      </motion.div>

      {/* Google search results */}
      {googleResults.length > 0 && (
        <motion.div
          className="card p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Search size={20} className="text-[var(--accent-blue)]" />
            Résultats ({googleResults.length})
          </h3>
          <div className="space-y-3">
            {googleResults.map((result, i) => (
              <motion.div
                key={i}
                className="p-4 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-secondary)]/80 transition-colors"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[var(--text-primary)] text-sm truncate">
                      {result.name}
                    </h4>
                    <p className="text-xs text-[var(--accent-blue)] truncate">{result.displayUrl}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {result.snippet}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <motion.button
                      onClick={() => handleSaveSearch(result.url, result.name, "google")}
                      disabled={isUrlSaved(result.url) || savingUrl === result.url}
                      className={`px-2 py-1.5 text-xs rounded flex items-center gap-1 transition-colors ${
                        isUrlSaved(result.url)
                          ? "bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]"
                          : "bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)]"
                      }`}
                      whileHover={{ scale: 1.05 }}
                    >
                      {isUrlSaved(result.url) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    </motion.button>
                    <motion.a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)] flex items-center gap-1 transition-colors"
                      whileHover={{ scale: 1.05 }}
                    >
                      <ExternalLink size={12} />
                      Voir
                    </motion.a>
                    <motion.button
                      onClick={() => handleScrape(result.url)}
                      disabled={scraping && scrapingUrl === result.url}
                      className="px-3 py-1.5 text-xs rounded bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/30 disabled:opacity-50 flex items-center gap-1 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {scraping && scrapingUrl === result.url ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Search size={12} />
                      )}
                      Analyser
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Scraped results */}
      {scrapedResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Globe size={20} className="text-[var(--accent-blue)]" />
            Sites analysés ({scrapedResults.length})
          </h3>
          {scrapedResults.map((result) => (
            <div key={result.url} className="relative">
              <motion.button
                onClick={() => {
                  const name = result.data.companyName || new URL(result.url).hostname;
                  handleSaveSearch(result.url, name, "url");
                }}
                disabled={isUrlSaved(result.url) || savingUrl === result.url}
                className={`absolute top-4 right-4 z-10 px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
                  isUrlSaved(result.url)
                    ? "bg-[var(--accent-orange)]/20 text-[var(--accent-orange)]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/10"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {savingUrl === result.url ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isUrlSaved(result.url) ? (
                  <BookmarkCheck size={14} />
                ) : (
                  <Bookmark size={14} />
                )}
                {isUrlSaved(result.url) ? "Sauvegardé" : "Sauvegarder"}
              </motion.button>
              <ScrapedCompanyCard
                data={result.data}
                url={result.url}
                apiKey={apiKey}
                onCandidatureCreated={onCandidatureCreated}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
