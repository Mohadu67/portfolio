"use client";

import { useEffect, useState } from "react";
import { Briefcase, Building2 } from "lucide-react";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { SearchPanel } from "@/components/dashboard/SearchPanel";
import { CompanySearchPanel } from "@/components/dashboard/CompanySearchPanel";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { CandidatureList } from "@/components/dashboard/CandidatureList";
import { LetterModal } from "@/components/dashboard/LetterModal";
import { SearchLoadingModal } from "@/components/dashboard/SearchLoadingModal";
import { GenerateLetterModal } from "@/components/dashboard/GenerateLetterModal";
import { FollowUpModal } from "@/components/dashboard/FollowUpModal";
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

export default function CandidaturesPage() {
  const apiKey = useApiKey();
  const data = useDashboardData(apiKey);
  const [activeTab, setActiveTab] = useState<"offres" | "entreprises">("offres");
  const [filterStatus, setFilterStatus] = useState<CandidatureStatut | null>(null);
  const [selected, setSelected] = useState<ICandidature | null>(null);
  const [showLetter, setShowLetter] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  useEffect(() => {
    data.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeAll = () => {
    setShowLetter(false);
    setShowGenerate(false);
    setShowFollowUp(false);
    setSelected(null);
  };

  const offres = data.candidatures.filter((c) => c.plateforme !== "Web");
  const entreprises = data.candidatures.filter((c) => c.plateforme === "Web");

  const onSelect = (id: string) => {
    const c = data.candidatures.find((x) => x._id === id);
    if (c) {
      setSelected(c);
      setShowLetter(true);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("offres")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "offres"
              ? "bg-[var(--accent-orange)] text-[var(--bg-primary)]"
              : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-soft)]"
          }`}
        >
          <Briefcase size={16} /> Offres d&apos;emploi
        </button>
        <button
          onClick={() => setActiveTab("entreprises")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "entreprises"
              ? "bg-[var(--accent-blue)] text-white"
              : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-soft)]"
          }`}
        >
          <Building2 size={16} /> Recherche entreprises
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
          <div className="flex items-center gap-3 mb-4">
            <Briefcase size={22} className="text-[var(--accent-orange)]" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {STATUS_LABELS[filterStatus]}
            </h2>
          </div>
          <CandidatureList
            candidatures={data.candidatures}
            filterStatus={filterStatus}
            onSelect={onSelect}
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
            <div className="flex items-center gap-3 mb-4">
              <Briefcase size={22} className="text-[var(--accent-orange)]" />
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Offres d&apos;emploi</h2>
            </div>
            <CandidatureList
              candidatures={offres}
              onSelect={onSelect}
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
            <div className="flex items-center gap-3 mb-4">
              <Building2 size={22} className="text-[var(--accent-blue)]" />
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Recherche entreprises</h2>
            </div>
            <CandidatureList
              candidatures={entreprises}
              onSelect={onSelect}
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
