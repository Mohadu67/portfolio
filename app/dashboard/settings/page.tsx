"use client";

import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mx-auto mb-4">
          <SettingsIcon size={22} className="text-[var(--text-secondary)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Settings — Lot 5</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          Profil, clés API, templates relances, templates emails de candidature, prompts IA, préférences notifications,
          options d&apos;automatisation.
        </p>
      </div>
    </div>
  );
}
