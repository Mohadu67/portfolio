"use client";

interface StatsBarProps {
  stats: Record<string, number>;
  total: number;
}

export function StatsBar({ stats, total }: StatsBarProps) {
  const statItems = [
    { key: "identifiée", label: "Identifiées", icon: "📌" },
    { key: "lettre générée", label: "Lettres", icon: "📝" },
    { key: "postulée", label: "Postulées", icon: "✉️" },
    { key: "entretien", label: "Entretiens", icon: "💬" },
    { key: "acceptée", label: "Acceptées", icon: "✅" },
  ];

  return (
    <div>
      {/* Total */}
      <div className="card-elevated mb-6 p-6">
        <p className="text-[var(--text-secondary)] text-sm mb-1">Total candidatures</p>
        <p className="text-4xl font-bold text-[var(--text-primary)]">{total}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {statItems.map(({ key, label, icon }) => (
          <div
            key={key}
            className="card p-4 text-center hover:border-[var(--accent-orange)] transition-colors"
          >
            <div className="text-2xl mb-2">{icon}</div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {stats[key] || 0}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
