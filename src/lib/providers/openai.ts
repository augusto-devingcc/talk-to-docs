import OpenAI from 'openai';
import type { LLMRequest, LLMStreamEvent, ProviderAdapter } from './types';

export const openaiProvider: ProviderAdapter = {
  async *stream(req: LLMRequest): AsyncIterable<LLMStreamEvent> {
    const client = new OpenAI({ apiKey: req.apiKey });
    try {
      const stream = await client.chat.completions.create({
        model: req.model,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: req.system },
          ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: req.maxTokens ?? 2048,
      });

      let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: 'text', text: delta };
        }
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }
      yield { type: 'done', usage };
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'OpenAI request failed.' };
    }
  },
};
