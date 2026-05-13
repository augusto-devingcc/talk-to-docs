import Anthropic from '@anthropic-ai/sdk';
import type { LLMRequest, LLMStreamEvent, ProviderAdapter } from './types';

export const anthropicProvider: ProviderAdapter = {
  async *stream(req: LLMRequest): AsyncIterable<LLMStreamEvent> {
    const client = new Anthropic({ apiKey: req.apiKey });
    try {
      const stream = client.messages.stream({
        model: req.model,
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        messages: req.messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta' &&
          event.delta.text
        ) {
          yield { type: 'text', text: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: 'done',
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        },
      };
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'Anthropic request failed.' };
    }
  },
};
