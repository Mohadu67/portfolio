"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  Clock,
  LogOut,
  FileText,
  Briefcase,
  Building2,
  Calendar,
} from "lucide-react";
import { Toaster } from "sonner";
import { SearchPanel } from "@/components/dashboard/SearchPanel";
import { CompanySearchPanel } from "@/components/dashboard/CompanySearchPanel";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { CandidatureList } from "@/components/dashboard/CandidatureList";
import { LetterModal } from "@/components/dashboard/LetterModal";
import { SearchLoadingModal } from "@/components/dashboard/SearchLoadingModal";
import { GenerateLetterModal } from "@/components/dashboard/GenerateLetterModal";
import { FollowUpModal } from "@/components/dashboard/FollowUpModal";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import type { ICandidature, CandidatureStatut } from "@/models/Candidature";

const STATUS_LABELS: Record<CandidatureStatut, string> = {
  identifiée: "Offres à traiter",
  "lettre générée": "Prêtes à envoyer",
  postulée: "Candidatures envoyées",
  "réponse reçue": "Réponses reçues",
  entretien: "Entretiens en cours",
  refus: "Refus",
  acceptée: "Offres acceptées",
};

export default function Dashboard() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"offres" | "entreprises">("offres");
  const [filterStatus, setFilterStatus] = useState<CandidatureStatut | null>(null);
  const [selected, setSelected] = useState<ICandidature | null>(null);
  const [showLetter, setShowLetter] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const data = useDashboardData(apiKey);

  useEffect(() => {
    const saved = sessionStorage.getItem("api-key");
    if (saved) {
      setApiKey(saved);
      setAuthed(true);
    }
    setBootLoading(false);
  }, []);

  useEffect(() => {
    if (authed) data.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const handleLogin = (key: string) => {
    sessionStorage.setItem("api-key", key);
    setApiKey(key);
    setAuthed(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("api-key");
    setApiKey("");
    setAuthed(false);
  };

  const closeAll = () => {
    setShowLetter(false);
    setShowGenerate(false);
    setShowFollowUp(false);
    setSelected(null);
  };

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <Clock size={48} className="mx-auto text-[var(--accent-orange)] animate-spin mb-4" />
          <p className="text-[var(--text-secondary)]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!authed) return <LoginForm onSubmit={handleLogin} />;

  const offres = data.candidatures.filter((c) => c.plateforme !== "Web");
  const entreprises = data.candidatures.filter((c) => c.plateforme === "Web");

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Toaster richColors position="top-right" />

      <nav className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart3 size={28} className="text-[var(--accent-orange)]" />
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard Candidatures</h1>
              <p className="text-xs text-[var(--text-secondary)]">Mohammed Hamiani</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <Link
              href="/dashboard/cv"
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-orange)] transition-colors text-sm font-medium"
            >
              <FileText size={16} /> Éditer le CV
            </Link>
            <Link
              href="/dashboard/cv-files"
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-orange)] transition-colors text-sm font-medium"
            >
              <FileText size={16} /> Mes CVs
            </Link>
            <Link
              href="/dashboard/relances"
              className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-orange)] transition-colors text-sm font-medium"
            >
              <Calendar size={16} /> Relances
            </Link>
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
              <LogOut size={16} /> Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10">
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab("offres")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "offres"
                ? "bg-[var(--accent-orange)] text-[var(--bg-primary)]"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
            }`}
          >
            <Briefcase size={18} /> Offres d&apos;emploi
          </button>
          <button
            onClick={() => setActiveTab("entreprises")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "entreprises"
                ? "bg-[var(--accent-blue)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
            }`}
          >
            <Building2 size={18} /> Recherche entreprises
          </button>
        </div>

        <StatsBar
          stats={data.stats}
          total={data.total}
          activeStatus={filterStatus}
          onStatusClick={setFilterStatus}
        />

        {filterStatus ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Briefcase size={28} className="text-[var(--accent-orange)]" />
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                {STATUS_LABELS[filterStatus]}
              </h2>
            </div>
            <CandidatureList
              candidatures={data.candidatures}
              filterStatus={filterStatus}
              onSelect={(id) => {
                const c = data.candidatures.find((x) => x._id === id);
                if (c) {
                  setSelected(c);
                  setShowLetter(true);
                }
              }}
              onDelete={data.remove}
              onGenerateLetter={(c) => {
                setSelected(c);
                setShowGenerate(true);
              }}
              onFollowUp={(c) => {
                setSelected(c);
                setShowFollowUp(true);
              }}
              onUpdate={data.update}
              apiKey={apiKey}
            />
          </div>
        ) : activeTab === "offres" ? (
          <>
            <SearchPanel onSearch={data.search} isLoading={data.searching} apiKey={apiKey} />
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Briefcase size={28} className="text-[var(--accent-orange)]" />
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Offres d&apos;emploi</h2>
              </div>
              <CandidatureList
                candidatures={offres}
                onSelect={(id) => {
                  const c = data.candidatures.find((x) => x._id === id);
                  if (c) {
                    setSelected(c);
                    setShowLetter(true);
                  }
                }}
                onDelete={data.remove}
                onGenerateLetter={(c) => {
                  setSelected(c);
                  setShowGenerate(true);
                }}
                onFollowUp={(c) => {
                  setSelected(c);
                  setShowFollowUp(true);
                }}
                onUpdate={data.update}
                apiKey={apiKey}
              />
            </div>
          </>
        ) : (
          <>
            <CompanySearchPanel apiKey={apiKey} onCandidatureCreated={data.load} />
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Building2 size={28} className="text-[var(--accent-blue)]" />
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Recherche entreprises</h2>
              </div>
              <CandidatureList
                candidatures={entreprises}
                onSelect={(id) => {
                  const c = data.candidatures.find((x) => x._id === id);
                  if (c) {
                    setSelected(c);
                    setShowLetter(true);
                  }
                }}
                onDelete={data.remove}
                onGenerateLetter={(c) => {
                  setSelected(c);
                  setShowGenerate(true);
                }}
                onFollowUp={(c) => {
                  setSelected(c);
                  setShowFollowUp(true);
                }}
                onUpdate={data.update}
                apiKey={apiKey}
              />
            </div>
          </>
        )}
      </main>

      <SearchLoadingModal isOpen={data.searching} progress={data.searchProgress} />

      {selected && (
        <>
          <GenerateLetterModal
            candidature={selected}
            isOpen={showGenerate}
            onClose={closeAll}
            apiKey={apiKey}
            onSend={data.sendCandidature}
            onUpdate={data.update}
          />
          <FollowUpModal
            candidature={selected}
            isOpen={showFollowUp}
            onClose={closeAll}
            onSchedule={data.scheduleFollowUp}
            onSendNow={data.sendRelanceNow}
            onCancel={data.cancelRelance}
            apiKey={apiKey}
          />
          <LetterModal
            candidature={selected}
            isOpen={showLetter}
            onClose={closeAll}
            apiKey={apiKey}
            onUpdate={data.update}
          />
        </>
      )}
    </div>
  );
}
