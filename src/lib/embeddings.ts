import { embed as aiEmbed, embedMany } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import type { Provider } from './providers/types';

export type EmbedAuth = { provider: Provider; apiKey: string };

const EMBEDDING_DIMENSIONS = 1536;

function buildEmbeddingModel(auth: EmbedAuth) {
  if (auth.provider === 'openai') {
    const client = createOpenAI({ apiKey: auth.apiKey });
    return client.embedding('text-embedding-3-small');
  }
  if (auth.provider === 'vercel') {
    const gateway = createGateway({ apiKey: auth.apiKey });
    return gateway.textEmbeddingModel('openai/text-embedding-3-small');
  }
  throw new Error(`Provider ${auth.provider} does not support embeddings via BYOK`);
}

export async function embed(text: string, auth: EmbedAuth): Promise<number[]> {
  const { embedding } = await aiEmbed({
    model: buildEmbeddingModel(auth),
    value: text,
  });
  return embedding;
}

export async function embedBatch(texts: string[], auth: EmbedAuth): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: buildEmbeddingModel(auth),
    values: texts,
  });
  return embeddings;
}

export { EMBEDDING_DIMENSIONS };
