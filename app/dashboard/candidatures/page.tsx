"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Search, X } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredCandidatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.candidatures;
    return data.candidatures.filter((c) => {
      const haystack = [
        c.entreprise,
        c.poste,
        c.localisation,
        c.email,
        c.notes,
        c.plateforme,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data.candidatures, searchQuery]);

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
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Briefcase size={22} className="text-[var(--accent-orange)]" />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {filterStatus ? STATUS_LABELS[filterStatus] : "Toutes les candidatures"}
            </h2>
            {searchQuery && (
              <span className="text-sm text-[var(--text-tertiary)]">
                · {filteredCandidatures.length} résultat{filteredCandidatures.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (entreprise, poste, ville, notes…)"
              className="w-full pl-9 pr-9 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-tertiary)] hover:text-[var(--accent-danger)] transition-colors"
                title="Effacer la recherche"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <CandidatureList
          candidatures={filteredCandidatures}
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
