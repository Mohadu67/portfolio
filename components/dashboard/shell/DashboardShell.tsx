"use client";

import { ReactNode, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ChatDock } from "./ChatDock";
import { MobileNav } from "./MobileNav";

interface DashboardShellProps {
  children: ReactNode;
  topbarActions?: ReactNode;
}

export function DashboardShell({ children, topbarActions }: DashboardShellProps) {
  const { logout } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Cmd/Ctrl + K toggles chat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setChatOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setChatOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Toaster richColors position="top-right" />
      <Sidebar onLogout={logout} />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onLogout={logout} />

      <div
        className="flex flex-col min-h-screen md:transition-[padding] md:duration-200"
        style={{ paddingLeft: 0 }}
      >
        <ShellInner
          onOpenChat={() => setChatOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          topbarActions={topbarActions}
        >
          {children}
        </ShellInner>
      </div>

      <ChatDock open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

function ShellInner({
  children,
  onOpenChat,
  onOpenMobileNav,
  topbarActions,
}: {
  children: ReactNode;
  onOpenChat: () => void;
  onOpenMobileNav: () => void;
  topbarActions?: ReactNode;
}) {
  return (
    <div
      className="flex-1 flex flex-col"
      style={{
        marginLeft: 0,
        // The actual sidebar offset is handled via media query + inline style on the root via CSS variables
      }}
    >
      <div className="md:ml-[var(--sidebar-width)] sidebar-collapsed:md:ml-[var(--sidebar-width-collapsed)] flex-1 flex flex-col">
        <Topbar
          onOpenChat={onOpenChat}
          onOpenMobileNav={onOpenMobileNav}
          actions={topbarActions}
        />
        <main className="flex-1 px-4 sm:px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
