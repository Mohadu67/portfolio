"use client";

interface EmptyStateProps {
  onPick: (suggestion: string) => void;
}

const SUGGESTIONS = [
  "Que dois-je faire aujourd'hui ?",
  "Quelles candidatures je devrais relancer cette semaine ?",
  "Programme une relance polie pour ma candidature la plus ancienne sans réponse.",
  "Donne-moi un récap de la semaine.",
];

// État vide façon Claude.ai : titre généreux + suggestions discrètes.
export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4">
      <div className="w-full max-w-2xl mx-auto text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
            Comment puis-je t&apos;aider ?
          </h1>
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
            J&apos;ai accès à tes candidatures, ton CV et tes relances. Je peux aussi agir avec ta confirmation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="group px-4 py-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-orange)]/40 hover:bg-[var(--bg-hover)] transition-colors min-h-[56px] leading-relaxed"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
