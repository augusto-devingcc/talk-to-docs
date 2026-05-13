"use client";

import { useCallback, useEffect, useState } from "react";

export type ProviderId = "openai" | "anthropic" | "vercel";

const STORAGE_KEYS: Record<ProviderId, string> = {
  openai: "ttd.openai.key",
  anthropic: "ttd.anthropic.key",
  vercel: "ttd.vercel.key",
};

const KEY_PREFIXES: Record<ProviderId, string> = {
  openai: "sk-",
  anthropic: "sk-ant-",
  vercel: "vck_",
};

const KEY_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  vercel: "Vercel AI Gateway",
};

export function storageKeyFor(provider: ProviderId): string {
  return STORAGE_KEYS[provider];
}

export function keyPrefixFor(provider: ProviderId): string {
  return KEY_PREFIXES[provider];
}

export function providerLabel(provider: ProviderId): string {
  return KEY_LABELS[provider];
}

export function isValidKey(provider: ProviderId, value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 16) return false;
  return trimmed.startsWith(KEY_PREFIXES[provider]);
}

export function useApiKey(provider: ProviderId) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEYS[provider]);
    // The keys are an external system (localStorage); hydrating into state is
    // the canonical use case for an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApiKeyState(stored && stored.length > 0 ? stored : null);
    setHydrated(true);
  }, [provider]);

  const setApiKey = useCallback(
    (key: string | null) => {
      if (typeof window === "undefined") return;
      const storageKey = STORAGE_KEYS[provider];
      if (key && key.length > 0) {
        window.localStorage.setItem(storageKey, key);
        setApiKeyState(key);
      } else {
        window.localStorage.removeItem(storageKey);
        setApiKeyState(null);
      }
    },
    [provider]
  );

  return { apiKey, setApiKey, hydrated };
}
