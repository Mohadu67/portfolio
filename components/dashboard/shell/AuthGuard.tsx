"use client";

import { ReactNode } from "react";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { AuthProvider } from "@/lib/contexts/AuthContext";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        Chargement…
      </div>
    );
  }

  if (auth.status === "anonymous") {
    return <LoginScreen onSubmit={auth.login} />;
  }

  return <AuthProvider apiKey={auth.apiKey}>{children}</AuthProvider>;
}

function LoginScreen({ onSubmit }: { onSubmit: (key: string) => void }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const key = String(fd.get("apiKey") ?? "");
          if (key.trim()) onSubmit(key.trim());
        }}
        className="w-full max-w-sm"
      >
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-7 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-center gap-2 mb-5 text-[var(--accent-orange)]">
            <Lock size={26} />
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cockpit privé</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
            Authentification par clé API.
          </p>
          <input
            name="apiKey"
            type="password"
            placeholder="Clé secrète"
            autoFocus
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
          />
          <button
            type="submit"
            className="w-full mt-4 py-3 rounded-lg bg-[var(--accent-orange)] text-[var(--bg-primary)] font-semibold hover:opacity-90 transition-opacity"
          >
            Entrer
          </button>
        </div>
        <Link
          href="/"
          className="block text-center mt-5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          ← Retour au portfolio
        </Link>
      </form>
    </div>
  );
}
