"use client";

import type { ICandidature } from "@/models/Candidature";

interface CandidatureListProps {
  candidatures: ICandidature[];
  onSelect?: (id: string) => void;
  apiKey: string;
}

export function CandidatureList({
  candidatures,
  onSelect,
  apiKey,
}: CandidatureListProps) {
  const getStatusColor = (statut: string) => {
    const colors: Record<string, string> = {
      identifiée: "bg-blue-500/20 text-blue-300",
      "lettre générée": "bg-purple-500/20 text-purple-300",
      postulée: "bg-green-500/20 text-green-300",
      "réponse reçue": "bg-yellow-500/20 text-yellow-300",
      entretien: "bg-orange-500/20 text-orange-300",
      refus: "bg-red-500/20 text-red-300",
      acceptée: "bg-emerald-500/20 text-emerald-300",
    };
    return colors[statut] || "bg-slate-500/20 text-slate-300";
  };

  return (
    <div className="space-y-3">
      {candidatures.length === 0 ? (
        <p className="text-slate-400 text-center py-8">Aucune candidature trouvée</p>
      ) : (
        candidatures.map((cand) => (
          <div
            key={cand._id?.toString()}
            onClick={() => onSelect?.(cand._id?.toString() || "")}
            className="bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 rounded-lg p-4 cursor-pointer transition-all"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-white">{cand.poste}</h3>
                <p className="text-slate-400 text-sm">{cand.entreprise}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(cand.statut)}`}>
                {cand.statut}
              </span>
            </div>
            <p className="text-slate-400 text-sm">{cand.localisation}</p>
          </div>
        ))
      )}
    </div>
  );
}
