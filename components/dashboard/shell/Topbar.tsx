"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, Menu } from "lucide-react";

const TITLES: Record<string, string> = {
  "/dashboard": "War Room",
  "/dashboard/candidatures": "Candidatures",
  "/dashboard/recherche": "Recherche",
  "/dashboard/relances": "Relances",
  "/dashboard/cv": "CV Builder",
  "/dashboard/cv-files": "Mes CVs",
  "/dashboard/media": "Médias",
  "/dashboard/chat": "Chat IA",
  "/dashboard/settings": "Settings",
};

function deriveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  // /dashboard/candidatures/[id] etc.
  for (const [prefix, label] of Object.entries(TITLES)) {
    if (pathname.startsWith(prefix + "/")) return label;
  }
  return "Dashboard";
}

interface TopbarProps {
  onOpenChat: () => void;
  onOpenMobileNav?: () => void;
  actions?: ReactNode;
}

export function Topbar({ onOpenChat, onOpenMobileNav, actions }: TopbarProps) {
  const pathname = usePathname();
  const title = deriveTitle(pathname);

  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac/i.test(navigator.userAgent));
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 border-b border-[var(--border-soft)] bg-[var(--bg-primary)]/85 backdrop-blur-xl"
      style={{ height: "var(--topbar-height)" }}
    >
      {onOpenMobileNav && (
        <button
          onClick={onOpenMobileNav}
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>
      )}

      <h1 className="text-base font-semibold text-[var(--text-primary)] truncate flex-1">
        {title}
      </h1>

      {actions}

      <button
        onClick={onOpenChat}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-orange)]/50 hover:bg-[var(--bg-hover)] transition-colors text-sm"
      >
        <Sparkles size={14} className="text-[var(--accent-orange)]" />
        <span>Demander à l&apos;IA</span>
        <kbd className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-tertiary)] font-mono">
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
    </header>
  );
}
