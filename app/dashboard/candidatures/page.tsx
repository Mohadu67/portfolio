"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Search } from "lucide-react";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { CandidatureList } from "@/components/dashboard/CandidatureList";
import { LetterModal } from "@/components/dashboard/LetterModal";
import { GenerateLetterModal } from "@/components/dashboard/GenerateLetterModal";
import { RelanceComposer } from "@/components/dashboard/relances/RelanceComposer";
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

  const onSelect = (id: string) => {
    const c = data.candidatures.find((x) => x._id === id);
    if (c) {
      setSelected(c);
      setShowLetter(true);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mes candidatures</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Suivi et relance des offres ajoutées depuis la recherche unifiée.
          </p>
        </div>
        <Link
          href="/dashboard/recherche"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Search size={14} /> Trouver de nouvelles offres
        </Link>
      </div>

      <StatsBar
        stats={data.stats}
        total={data.total}
        activeStatus={filterStatus}
        onStatusClick={setFilterStatus}
      />

      <div>
        <div className="flex items-center gap-3 mb-4">
          <Briefcase size={22} className="text-[var(--accent-orange)]" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {filterStatus ? STATUS_LABELS[filterStatus] : "Toutes les candidatures"}
          </h2>
        </div>
        <CandidatureList
          candidatures={data.candidatures}
          filterStatus={filterStatus ?? undefined}
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
          <RelanceComposer
            open={showFollowUp}
            mode={selected ? { kind: "create", candidature: selected } : null}
            apiKey={apiKey}
            onClose={closeAll}
            onSaved={data.load}
          />
          <LetterModal
            candidature={selected}
            isOpen={showLetter}
            onClose={closeAll}
            apiKey={apiKey}
            onUpdate={data.update}
            onRequestGenerate={() => {
              setShowLetter(false);
              setShowGenerate(true);
            }}
          />
        </>
      )}
    </div>
  );
}
