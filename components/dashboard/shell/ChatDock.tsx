"use client";

import { Sparkles, X } from "lucide-react";
import { useApiKey } from "@/lib/contexts/AuthContext";
import { ChatPanel } from "@/components/dashboard/chat/ChatPanel";

interface ChatDockProps {
  open: boolean;
  onClose: () => void;
}

export function ChatDock({ open, onClose }: ChatDockProps) {
  const apiKey = useApiKey();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-[min(440px,100vw)] bg-[var(--bg-primary)] border-l border-[var(--border-soft)] shadow-2xl shadow-black/40 transition-transform duration-200 flex flex-col ${
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

        {open && <ChatPanel apiKey={apiKey} variant="dock" />}
      </aside>
    </>
  );
}
