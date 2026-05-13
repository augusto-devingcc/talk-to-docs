import modelsCatalog from "../../MODELS.json";
import type { ProviderId } from "./use-api-key";

export type ModelEntry = {
  id: string;
  display: string;
  description: string;
  logo?: string;
};

export type ProviderEntry = {
  id: ProviderId;
  display_name: string;
  logo: string;
  key_prefix: string;
  key_format: string;
  description?: string;
  models: ModelEntry[];
};

type RawProvider = {
  display_name: string;
  logo: string;
  key_prefix: string;
  key_format: string;
  description?: string;
  models: Array<{
    id: string;
    display: string;
    description: string;
    logo?: string;
  }>;
};

const RAW = modelsCatalog as {
  providers: Record<ProviderId, RawProvider>;
};

export const PROVIDERS: ProviderEntry[] = (["openai", "vercel"] as ProviderId[]).map((id) => {
  const p = RAW.providers[id];
  return {
    id,
    display_name: p.display_name,
    logo: p.logo,
    key_prefix: p.key_prefix,
    key_format: p.key_format,
    description: p.description,
    models: p.models.map((m) => ({
      id: m.id,
      display: m.display,
      description: m.description,
      logo: m.logo,
    })),
  };
});

export function getProvider(id: ProviderId): ProviderEntry {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown provider: ${id}`);
  return found;
}

export function defaultModelFor(id: ProviderId): string {
  const provider = getProvider(id);
  const models = provider.models;
  if (models.length === 0) throw new Error(`No models for provider: ${id}`);
  const middleIdx = Math.floor(models.length / 2);
  return models[middleIdx].id;
}

export function providerShortDescription(id: ProviderId): string {
  const p = getProvider(id);
  if (p.description) return p.description;
  switch (id) {
    case "openai":
      return "Route direct to OpenAI with your sk- key.";
    case "vercel":
      return "Unified gateway across OpenAI and Anthropic. Uses a vck_ key.";
  }
}
