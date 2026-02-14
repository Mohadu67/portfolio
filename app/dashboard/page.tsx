"use client";

import { useState, useEffect } from "react";
import { BarChart3, Lock, Clock, LogOut, FileText, Briefcase, Building2 } from "lucide-react";
import { SearchPanel } from "@/components/dashboard/SearchPanel";
import { CompanySearchPanel } from "@/components/dashboard/CompanySearchPanel";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { CandidatureList } from "@/components/dashboard/CandidatureList";
import { LetterModal } from "@/components/dashboard/LetterModal";
import { SearchLoadingModal } from "@/components/dashboard/SearchLoadingModal";
import { GenerateLetterModal } from "@/components/dashboard/GenerateLetterModal";
import { FollowUpModal } from "@/components/dashboard/FollowUpModal";
import { toast } from "sonner";
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
  const [searchProgress, setSearchProgress] = useState(0);
  const [selectedCandidature, setSelectedCandidature] = useState<ICandidature | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showGenerateLetterModal, setShowGenerateLetterModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"offres" | "entreprises">("offres");

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
    setSearchProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setSearchProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 30;
      });
    }, 300);

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
        setSearchProgress(100);
        await new Promise((resolve) => setTimeout(resolve, 500));
        await loadCandidatures(apiKey);
        toast.success(`${data.nouvelles} nouvelles offres trouvées!`);
      } else {
        throw new Error("Erreur lors de la recherche");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la recherche");
    } finally {
      clearInterval(progressInterval);
      setSearching(false);
      setSearchProgress(0);
    }
  };

  const handleSelectCandidature = (id: string) => {
    const cand = candidatures.find((c) => c._id === id);
    if (cand) {
      setSelectedCandidature(cand);
      setShowModal(true);
    }
  };

  const handleOpenGenerateLetter = (candidature: ICandidature) => {
    setSelectedCandidature(candidature);
    setShowGenerateLetterModal(true);
  };

  const handleOpenFollowUp = (candidature: ICandidature) => {
    setSelectedCandidature(candidature);
    setShowFollowUpModal(true);
  };

  const handleSendCandidature = async (candidature: ICandidature, lettre: string, email: string) => {
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidature_id: candidature._id,
          email_destinataire: email,
          lettre,
        }),
      });

      if (!res.ok) throw new Error("Erreur lors de l'envoi");

      await loadCandidatures(apiKey);
    } catch (error) {
      throw error;
    }
  };

  const handleScheduleFollowUp = async (candidature: ICandidature, followUpDate: string) => {
    try {
      await handleUpdateCandidature(candidature._id || "", {
        notes: `Relance prévue pour ${followUpDate}`,
      });
    } catch (error) {
      throw error;
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
          <div className="mb-4">
            <Clock size={48} className="mx-auto text-[var(--accent-orange)] animate-spin" />
          </div>
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
            <div className="flex items-center justify-center mb-4">
              <Lock size={32} className="text-[var(--accent-orange)] mr-2" />
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                Dashboard Privé
              </h1>
            </div>
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
      <nav className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart3 size={28} className="text-[var(--accent-orange)]" />
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Dashboard Stage
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Mohammed Hamiani
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <Link
              href="/"
              className="text-[var(--text-secondary)] hover:text-[var(--accent-orange)] transition-colors text-sm font-medium"
            >
              Portfolio
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab("offres")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "offres"
                ? "bg-[var(--accent-orange)] text-[var(--bg-primary)]"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
            }`}
          >
            <Briefcase size={18} />
            Offres d'emploi
          </button>
          <button
            onClick={() => setActiveTab("entreprises")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "entreprises"
                ? "bg-[var(--accent-blue)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
            }`}
          >
            <Building2 size={18} />
            Recherche entreprises
          </button>
        </div>

        {/* Tab: Offres d'emploi */}
        {activeTab === "offres" && (
          <>
            <SearchPanel
              onSearch={handleSearch}
              isLoading={searching}
              apiKey={apiKey}
            />

            <StatsBar stats={stats} total={total} />

            <div>
              <div className="flex items-center gap-3 mb-6">
                <FileText size={28} className="text-[var(--accent-orange)]" />
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                  Candidatures
                </h2>
              </div>
              <CandidatureList
                candidatures={candidatures}
                onSelect={handleSelectCandidature}
                onDelete={handleDeleteCandidature}
                onGenerateLetter={handleOpenGenerateLetter}
                onFollowUp={handleOpenFollowUp}
                onUpdate={handleUpdateCandidature}
                apiKey={apiKey}
              />
            </div>
          </>
        )}

        {/* Tab: Recherche entreprises */}
        {activeTab === "entreprises" && (
          <>
            <CompanySearchPanel
              apiKey={apiKey}
              onCandidatureCreated={() => loadCandidatures(apiKey)}
            />

            <StatsBar stats={stats} total={total} />

            <div>
              <div className="flex items-center gap-3 mb-6">
                <FileText size={28} className="text-[var(--accent-orange)]" />
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                  Candidatures
                </h2>
              </div>
              <CandidatureList
                candidatures={candidatures}
                onSelect={handleSelectCandidature}
                onDelete={handleDeleteCandidature}
                onGenerateLetter={handleOpenGenerateLetter}
                onFollowUp={handleOpenFollowUp}
                onUpdate={handleUpdateCandidature}
                apiKey={apiKey}
              />
            </div>
          </>
        )}
      </main>

      {/* Search Loading Modal */}
      <SearchLoadingModal isOpen={searching} progress={searchProgress} />

      {/* Generate Letter Modal */}
      {selectedCandidature && (
        <GenerateLetterModal
          candidature={selectedCandidature}
          isOpen={showGenerateLetterModal}
          onClose={() => {
            setShowGenerateLetterModal(false);
            setSelectedCandidature(null);
          }}
          apiKey={apiKey}
          onSend={handleSendCandidature}
          onUpdate={handleUpdateCandidature}
        />
      )}

      {/* Follow Up Modal */}
      {selectedCandidature && (
        <FollowUpModal
          candidature={selectedCandidature}
          isOpen={showFollowUpModal}
          onClose={() => {
            setShowFollowUpModal(false);
            setSelectedCandidature(null);
          }}
          onFollowUp={handleScheduleFollowUp}
        />
      )}

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
