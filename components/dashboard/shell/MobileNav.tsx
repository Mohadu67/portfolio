"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Search,
  Calendar,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Settings,
  X,
  LogOut,
  ExternalLink,
  StickyNote,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "War Room", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/candidatures", label: "Candidatures", icon: Briefcase },
  { href: "/dashboard/recherche", label: "Recherche", icon: Search },
  { href: "/dashboard/relances", label: "Relances", icon: Calendar },
  { href: "/dashboard/cv", label: "CV Builder", icon: FileText },
  { href: "/dashboard/media", label: "Médias", icon: ImageIcon },
  { href: "/dashboard/notes", label: "Notes", icon: StickyNote },
  { href: "/dashboard/chat", label: "Chat IA", icon: Sparkles },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function MobileNav({ open, onClose, onLogout }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={onClose} />}

      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-[var(--bg-card)] border-r border-[var(--border-soft)] shadow-2xl shadow-black/40 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className="flex items-center justify-between px-4 border-b border-[var(--border-soft)]"
          style={{ height: "var(--topbar-height)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-orange)] to-[var(--accent-blue)] flex items-center justify-center text-[var(--bg-primary)] font-black text-xs">
              MH
            </div>
            <span className="font-bold">Cockpit</span>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-[var(--bg-hover)]">
            <X size={16} />
          </button>
        </div>

        <nav className="px-2 py-3 space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--bg-active)] text-[var(--accent-orange)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border-soft)] p-2 space-y-1">
          <Link
            href="/"
            target="_blank"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            <ExternalLink size={16} /> Portfolio
          </Link>
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-danger)]"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
