"use client";

import { Sparkles } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-orange)]/20 to-[var(--accent-blue)]/20 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={22} className="text-[var(--accent-orange)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Chat IA agentique — Lot 4</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          L&apos;assistant aura accès à toutes tes candidatures, relances et CV.
          Il pourra <em>agir</em> avec ta confirmation : programmer une relance,
          générer une lettre, modifier ton CV, lancer une recherche d&apos;offres.
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-4">
          Streaming Anthropic Opus 4.7 (1M cache) · Tool use · Conversations persistées
        </p>
      </div>
    </div>
  );
}
