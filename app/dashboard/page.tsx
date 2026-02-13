"use client";

import { useState, useEffect } from "react";
import { SearchPanel } from "@/components/dashboard/SearchPanel";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { CandidatureList } from "@/components/dashboard/CandidatureList";
import type { ICandidature } from "@/models/Candidature";

export default function Dashboard() {
  const [apiKey, setApiKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [candidatures, setCandidatures] = useState<ICandidature[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const savedKey = sessionStorage.getItem("api-key");
    if (savedKey) {
      setApiKey(savedKey);
      setIsAuthenticated(true);
      loadCandidatures(savedKey);
    }
    setLoading(false);
  }, []);

  const loadCandidatures = async (key: string) => {
    try {
      const res = await fetch("/api/candidatures", {
        headers: { "x-api-key": key },
      });
      if (res.ok) {
        const data = await res.json();
        setCandidatures(data.candidatures);
        setStats(data.stats);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error loading candidatures:", error);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      sessionStorage.setItem("api-key", apiKey);
      setIsAuthenticated(true);
      loadCandidatures(apiKey);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("api-key");
    setApiKey("");
    setIsAuthenticated(false);
  };

  const handleSearch = async (keywords: string, location: string) => {
    setSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keywords, location, nb_results: 10 }),
      });

      if (res.ok) {
        await loadCandidatures(apiKey);
        alert("Recherche terminée !");
      } else {
        alert("Erreur lors de la recherche");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Erreur lors de la recherche");
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">Chargement...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard Privé</h1>
            <p className="text-slate-400 mb-6">Authentifiez-vous avec votre clé secrète</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                placeholder="Clé secrète"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                Se connecter
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="border-b border-purple-500/20 bg-slate-900/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Dashboard Stage</h1>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-slate-300 transition-colors text-sm font-medium"
          >
            Déconnexion
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <SearchPanel
          onSearch={handleSearch}
          isLoading={searching}
          apiKey={apiKey}
        />

        <StatsBar stats={stats} total={total} />

        <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📋 Candidatures</h2>
          <CandidatureList
            candidatures={candidatures}
            apiKey={apiKey}
          />
        </div>
      </main>
    </div>
  );
}
