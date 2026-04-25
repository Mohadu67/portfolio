"use client";

import { Sparkles, X } from "lucide-react";

interface ChatDockProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Placeholder du dock chat IA. Le contenu réel arrive au Lot 4.
 * Pour l'instant : panneau coulissant qui montre que le shell est en place.
 */
export function ChatDock({ open, onClose }: ChatDockProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-[min(420px,100vw)] bg-[var(--bg-card)] border-l border-[var(--border-soft)] shadow-2xl shadow-black/40 transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div
          className="flex items-center justify-between px-4 border-b border-[var(--border-soft)]"
          style={{ height: "var(--topbar-height)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent-orange)]" />
            <h2 className="font-semibold text-[var(--text-primary)]">Chat IA</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center h-[calc(100%-var(--topbar-height))] px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-orange)]/20 to-[var(--accent-blue)]/20 flex items-center justify-center mb-4">
            <Sparkles size={26} className="text-[var(--accent-orange)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
            Chat IA — bientôt
          </h3>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            L&apos;assistant agentique arrivera au Lot 4 : il aura accès à toutes tes candidatures,
            relances et CV, et pourra <em>agir</em> (programmer une relance, générer une lettre…)
            avec ta confirmation.
          </p>
        </div>
      </aside>
    </>
  );
}
