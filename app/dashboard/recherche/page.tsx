"use client";

import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";

export default function RecherchePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--accent-orange)]/20 flex items-center justify-center mx-auto mb-4">
          <Search size={22} className="text-[var(--accent-blue)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Recherche unifiée — bientôt</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6">
          Recherche d&apos;offres + entreprises dans une seule interface, avec recherches sauvegardées,
          filtres avancés et détection de doublons. Arrive au Lot&nbsp;2.
        </p>
        <Link
          href="/dashboard/candidatures"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold text-sm"
        >
          Aller aux candidatures <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
