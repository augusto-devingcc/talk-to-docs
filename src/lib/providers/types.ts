export type ProviderName = 'openai' | 'anthropic' | 'vercel';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LLMRequest = {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
};

export type LLMUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type LLMStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; usage?: LLMUsage }
  | { type: 'error'; message: string };

export type ProviderAdapter = {
  stream(req: LLMRequest): AsyncIterable<LLMStreamEvent>;
};

export const KEY_PREFIX: Record<ProviderName, string> = {
  openai: 'sk-',
  anthropic: 'sk-ant-',
  vercel: 'vck_',
};

export function validateKeyForProvider(
  provider: ProviderName,
  key: string | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    return { ok: false, reason: 'Missing X-LLM-Key header.' };
  }
  const expected = KEY_PREFIX[provider];
  if (!key.startsWith(expected)) {
    return {
      ok: false,
      reason: `Invalid key format for provider "${provider}". Expected key starting with "${expected}".`,
    };
  }
  return { ok: true };
}
