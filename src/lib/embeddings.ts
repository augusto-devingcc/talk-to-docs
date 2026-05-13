import { embed as aiEmbed, embedMany } from 'ai';

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

function ensureGatewayKey(): void {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is not set');
  }
}

export async function embed(text: string): Promise<number[]> {
  ensureGatewayKey();
  const { embedding } = await aiEmbed({
    model: EMBEDDING_MODEL,
    value: text,
  });
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  ensureGatewayKey();
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: EMBEDDING_MODEL,
    values: texts,
  });
  return embeddings;
}
