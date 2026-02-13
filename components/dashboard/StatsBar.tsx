"use client";

interface StatsBarProps {
  stats: Record<string, number>;
  total: number;
}

export function StatsBar({ stats, total }: StatsBarProps) {
  const statItems = [
    { key: "identifiée", label: "Identifiées", color: "bg-blue-500" },
    { key: "lettre générée", label: "Lettres", color: "bg-purple-500" },
    { key: "postulée", label: "Postulées", color: "bg-green-500" },
    { key: "entretien", label: "Entretiens", color: "bg-orange-500" },
    { key: "acceptée", label: "Acceptées", color: "bg-emerald-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {statItems.map(({ key, label, color }) => (
        <div key={key} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats[key] || 0}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      ))}
    </div>
  );
}
