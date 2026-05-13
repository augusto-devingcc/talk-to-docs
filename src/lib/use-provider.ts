"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProviderId } from "./use-api-key";

const STORAGE_KEY = "ttd.provider";
const DEFAULT_PROVIDER: ProviderId = "anthropic";

function isValidProvider(value: string | null): value is ProviderId {
  return value === "openai" || value === "anthropic" || value === "vercel";
}

export function useProvider() {
  const [provider, setProviderState] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Hydrating from localStorage is the canonical use case for an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isValidProvider(stored)) setProviderState(stored);
    setHydrated(true);
  }, []);

  const setProvider = useCallback((next: ProviderId) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, next);
    setProviderState(next);
  }, []);

  return { provider, setProvider, hydrated };
}
