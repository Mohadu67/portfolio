"use client";

import { useState, useEffect } from "react";
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
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  ExternalLink,
} from "lucide-react";

const STORAGE_KEY = "sidebar-collapsed";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match?: (pathname: string) => boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "War Room", icon: LayoutDashboard, match: (p) => p === "/dashboard" },
  { href: "/dashboard/candidatures", label: "Candidatures", icon: Briefcase },
  { href: "/dashboard/recherche", label: "Recherche", icon: Search },
  { href: "/dashboard/relances", label: "Relances", icon: Calendar },
  { href: "/dashboard/cv", label: "CV Builder", icon: FileText },
  { href: "/dashboard/media", label: "Médias", icon: ImageIcon },
  { href: "/dashboard/chat", label: "Chat IA", icon: Sparkles },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  onLogout: () => void;
}

export function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      return !c;
    });
  };

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col border-r border-[var(--border-soft)] bg-[var(--bg-card)]/95 backdrop-blur-xl transition-[width] duration-200"
      style={{ width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}
    >
      <div
        className="flex items-center gap-2 h-14 px-4 border-b border-[var(--border-soft)]"
        style={{ justifyContent: collapsed ? "center" : "flex-start" }}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-orange)] to-[var(--accent-blue)] flex items-center justify-center text-[var(--bg-primary)] font-black text-sm flex-shrink-0">
          MH
        </div>
        {!collapsed && (
          <span className="font-bold text-[var(--text-primary)] truncate">Cockpit</span>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.match ? item.match(pathname) : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--bg-active)] text-[var(--accent-orange)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border-soft)] p-2 space-y-1">
        <Link
          href="/"
          target="_blank"
          title={collapsed ? "Voir le portfolio" : undefined}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <ExternalLink size={16} className="flex-shrink-0" />
          {!collapsed && <span>Portfolio</span>}
        </Link>

        <button
          onClick={onLogout}
          title={collapsed ? "Déconnexion" : undefined}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-danger)] transition-colors"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>

        <button
          onClick={toggle}
          title={collapsed ? "Étendre" : "Réduire"}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          style={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && <span>Réduire</span>}
        </button>
      </div>
    </aside>
  );
}

export const SIDEBAR_VAR_OFFSET = `var(--sidebar-width)`;
