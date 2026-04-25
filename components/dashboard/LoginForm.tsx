"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

interface LoginFormProps {
  onSubmit: (key: string) => void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [apiKey, setApiKey] = useState("");

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="card-elevated p-8">
          <div className="flex items-center justify-center mb-4">
            <Lock size={32} className="text-[var(--accent-orange)] mr-2" />
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Dashboard Privé</h1>
          </div>
          <p className="text-[var(--text-secondary)] mb-6">
            Authentifiez-vous avec votre clé secrète pour accéder au dashboard de recherche de stage.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (apiKey.trim()) onSubmit(apiKey.trim());
            }}
            className="space-y-4"
          >
            <input
              type="password"
              placeholder="Clé secrète"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-orange)] transition-colors"
              autoFocus
            />
            <button type="submit" className="w-full btn-orange font-semibold py-3">
              Se connecter
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
            <p className="text-xs text-[var(--text-tertiary)] text-center">
              Besoin d&apos;aide ?{" "}
              <Link href="/#contact" className="text-[var(--accent-orange)] hover:underline">
                Contactez-moi
              </Link>
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="block text-center mt-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          ← Retour au portfolio
        </Link>
      </div>
    </div>
  );
}
