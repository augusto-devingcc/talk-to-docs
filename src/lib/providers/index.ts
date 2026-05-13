import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { vercelProvider } from './vercel';
import type { ProviderAdapter, ProviderName } from './types';

export * from './types';

export function getProvider(name: ProviderName): ProviderAdapter {
  switch (name) {
    case 'openai':
      return openaiProvider;
    case 'anthropic':
      return anthropicProvider;
    case 'vercel':
      return vercelProvider;
  }
}

export function isProviderName(value: unknown): value is ProviderName {
  return value === 'openai' || value === 'anthropic' || value === 'vercel';
}
