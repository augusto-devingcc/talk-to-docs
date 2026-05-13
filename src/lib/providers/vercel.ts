import { createGateway } from '@ai-sdk/gateway';
import { streamText } from 'ai';
import type { LLMRequest, LLMStreamEvent, ProviderAdapter } from './types';

export const vercelProvider: ProviderAdapter = {
  async *stream(req: LLMRequest): AsyncIterable<LLMStreamEvent> {
    try {
      const gateway = createGateway({ apiKey: req.apiKey });
      const result = streamText({
        model: gateway(req.model),
        system: req.system,
        messages: req.messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        maxOutputTokens: req.maxTokens ?? 2048,
      });

      for await (const delta of result.textStream) {
        if (delta) {
          yield { type: 'text', text: delta };
        }
      }

      const usage = await result.usage;
      yield {
        type: 'done',
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        },
      };
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'Vercel Gateway request failed.' };
    }
  },
};
