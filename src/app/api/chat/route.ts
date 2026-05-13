import { NextRequest } from 'next/server';
import { query, toVectorLiteral } from '@/lib/db';
import { embed } from '@/lib/embeddings';
import { getProvider, isProviderName, validateKeyForProvider } from '@/lib/providers';
import type { LLMUsage } from '@/lib/providers';
import { createSSEStream } from '@/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type ChunkRow = {
  id: string;
  content: string;
  chunk_index: number;
  document_id: string;
  filename: string;
  similarity: number;
};

type ChatBody = {
  question?: unknown;
  provider?: unknown;
  model?: unknown;
  top_k?: unknown;
};

const DEFAULT_TOP_K = 8;
const MAX_TOP_K = 20;
const PREVIEW_LENGTH = 240;

const SYSTEM_PROMPT =
  'Answer using only the context below. Cite the source document for each claim using [document name §chunk_index]. If the context does not answer the question, say so.';

export async function POST(req: NextRequest): Promise<Response> {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return Response.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return Response.json({ error: 'Field "question" is required.' }, { status: 400 });
  }

  const providerName = body.provider;
  if (!isProviderName(providerName)) {
    return Response.json(
      { error: 'Field "provider" must be one of: openai, anthropic, vercel.' },
      { status: 400 },
    );
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) {
    return Response.json({ error: 'Field "model" is required.' }, { status: 400 });
  }

  const topK = (() => {
    const raw = body.top_k;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_TOP_K;
    return Math.max(1, Math.min(MAX_TOP_K, Math.floor(raw)));
  })();

  const apiKey = req.headers.get('x-llm-key');
  const validation = validateKeyForProvider(providerName, apiKey);
  if (!validation.ok) {
    return Response.json({ error: validation.reason }, { status: 401 });
  }

  return createSSEStream(async (write) => {
    await write('retrieval_start', { question });

    const queryEmbedding = await embed(question);
    const literal = toVectorLiteral(queryEmbedding);

    const { rows } = await query<ChunkRow>(
      `select c.id, c.content, c.chunk_index,
              d.id as document_id, d.filename,
              1 - (c.embedding <=> $1::vector) as similarity
         from chunks c
         join documents d on d.id = c.document_id
        order by c.embedding <=> $1::vector
        limit $2`,
      [literal, topK],
    );

    const citations = rows.map((r) => ({
      document_id: r.document_id,
      filename: r.filename,
      chunk_index: r.chunk_index,
      preview: r.content.slice(0, PREVIEW_LENGTH),
      similarity: Number(r.similarity),
    }));

    await write('retrieval_result', { chunks: citations });

    if (rows.length === 0) {
      await write('answer_chunk', {
        text: 'No documents have been indexed yet, so I cannot answer from the context.',
      });
      await write('final', { citations: [], total_tokens: 0, model_used: model });
      return;
    }

    const contextBlock = rows
      .map(
        (r) =>
          `[${r.filename} §${r.chunk_index}]\n${r.content}`,
      )
      .join('\n\n---\n\n');

    const userPrompt = `Context:\n\n${contextBlock}\n\nQuestion: ${question}`;

    const provider = getProvider(providerName);
    const stream = provider.stream({
      apiKey: apiKey as string,
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let usage: LLMUsage | undefined;
    let errored = false;
    for await (const event of stream) {
      if (event.type === 'text') {
        await write('answer_chunk', { text: event.text });
      } else if (event.type === 'done') {
        usage = event.usage;
      } else if (event.type === 'error') {
        errored = true;
        await write('error', { message: event.message });
        break;
      }
    }

    if (!errored) {
      await write('final', {
        citations,
        total_tokens: usage?.totalTokens ?? null,
        model_used: model,
      });
    }
  });
}
