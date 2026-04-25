"use client";

import { createContext, useContext, ReactNode } from "react";

interface AuthContextValue {
  apiKey: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ apiKey, children }: { apiKey: string; children: ReactNode }) {
  return <AuthContext.Provider value={{ apiKey }}>{children}</AuthContext.Provider>;
}

export function useApiKey(): string {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useApiKey must be used inside <AuthProvider> (rendered by AuthGuard).");
  }
  return ctx.apiKey;
}
