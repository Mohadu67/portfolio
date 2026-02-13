"use client";

import { useState, useEffect } from "react";
import { SearchPanel } from "@/components/dashboard/SearchPanel";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { CandidatureList } from "@/components/dashboard/CandidatureList";
import { LetterModal } from "@/components/dashboard/LetterModal";
import type { ICandidature } from "@/models/Candidature";
import Link from "next/link";

export default function Dashboard() {
  const [apiKey, setApiKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [candidatures, setCandidatures] = useState<ICandidature[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [selectedCandidature, setSelectedCandidature] = useState<ICandidature | null>(null);
  const [showModal, setShowModal] = useState(false);

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
        const data = await res.json();
        await loadCandidatures(apiKey);
      } else {
        throw new Error("Erreur lors de la recherche");
      }
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCandidature = (id: string) => {
    const cand = candidatures.find((c) => c._id === id);
    if (cand) {
      setSelectedCandidature(cand);
      setShowModal(true);
    }
  };

  const handleDeleteCandidature = async (id: string) => {
    try {
      const res = await fetch(`/api/candidatures/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        await loadCandidatures(apiKey);
      }
    } catch (error) {
      console.error("Delete error:", error);
      throw error;
    }
  };

  const handleUpdateCandidature = async (
    id: string,
    updates: Partial<ICandidature>
  ) => {
    try {
      const res = await fetch(`/api/candidatures/${id}`, {
        method: "PATCH",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await loadCandidatures(apiKey);
        // Update selected candidature
        if (selectedCandidature && selectedCandidature._id === id) {
          const updated = candidatures.find((c) => c._id === id);
          if (updated) {
            setSelectedCandidature(updated);
          }
        }
      }
    } catch (error) {
      console.error("Update error:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-[var(--text-secondary)]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="card-elevated p-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
              🔐 Dashboard Privé
            </h1>
            <p className="text-[var(--text-secondary)] mb-6">
              Authentifiez-vous avec votre clé secrète pour accéder au dashboard de
              recherche de stage.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                placeholder="Clé secrète"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
                autoFocus
              />
              <button
                type="submit"
                className="w-full btn-orange font-semibold py-3"
              >
                Se connecter
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
              <p className="text-xs text-[var(--text-tertiary)] text-center">
                Besoin d'aide ? Contactez{" "}
                <a
                  href="mailto:Hamiani.Mohammed@hotmail.com"
                  className="text-[var(--accent-orange)] hover:underline"
                >
                  Mohammed
                </a>
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="block text-center mt-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            ← Retour au portfolio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Navigation */}
      <nav className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              📊 Dashboard Stage
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Mohammed Hamiani
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/"
              className="text-[var(--text-secondary)] hover:text-[var(--accent-orange)] transition-colors text-sm font-medium"
            >
              Portfolio
            </Link>
            <button
              onClick={handleLogout}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Panel */}
        <SearchPanel
          onSearch={handleSearch}
          isLoading={searching}
          apiKey={apiKey}
        />

        {/* Stats */}
        <StatsBar stats={stats} total={total} />

        {/* Candidatures Section */}
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
            📋 Candidatures
          </h2>
          <CandidatureList
            candidatures={candidatures}
            onSelect={handleSelectCandidature}
            onDelete={handleDeleteCandidature}
            onUpdate={handleUpdateCandidature}
            apiKey={apiKey}
          />
        </div>
      </main>

      {/* Letter Modal */}
      {selectedCandidature && (
        <LetterModal
          candidature={selectedCandidature}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedCandidature(null);
          }}
          apiKey={apiKey}
          onUpdate={handleUpdateCandidature}
        />
      )}
    </div>
  );
}
