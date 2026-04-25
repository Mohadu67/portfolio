"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "api-key";

export type AuthState =
  | { status: "loading"; apiKey: null }
  | { status: "anonymous"; apiKey: null }
  | { status: "authenticated"; apiKey: string };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading", apiKey: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = sessionStorage.getItem(STORAGE_KEY);
    setState(k ? { status: "authenticated", apiKey: k } : { status: "anonymous", apiKey: null });
  }, []);

  const login = useCallback((key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    sessionStorage.setItem(STORAGE_KEY, trimmed);
    setState({ status: "authenticated", apiKey: trimmed });
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setState({ status: "anonymous", apiKey: null });
  }, []);

  return { ...state, login, logout };
}
