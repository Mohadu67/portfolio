"use client";

import { CandidatureCard } from "./CandidatureCard";
import type { ICandidature, CandidatureStatut } from "@/models/Candidature";

interface CandidatureListProps {
  candidatures: ICandidature[];
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<ICandidature>) => Promise<void>;
  apiKey: string;
}

export function CandidatureList({
  candidatures,
  onSelect,
  onDelete,
  onUpdate,
  apiKey,
}: CandidatureListProps) {
  if (candidatures.length === 0) {
    return (
      <div className="card-elevated p-8 text-center">
        <p className="text-2xl mb-2">📭</p>
        <p className="text-[var(--text-secondary)]">
          Aucune candidature trouvée. Lancez une recherche pour commencer!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {candidatures.map((cand) => (
        <CandidatureCard
          key={cand._id?.toString()}
          candidature={cand}
          onSelect={onSelect}
          onDelete={onDelete}
          apiKey={apiKey}
        />
      ))}
    </div>
  );
}
