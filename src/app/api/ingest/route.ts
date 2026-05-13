import { NextRequest } from 'next/server';
import { withClient, toVectorLiteral } from '@/lib/db';
import { embedBatch } from '@/lib/embeddings';
import { parseFile } from '@/lib/parse';
import { chunkText } from '@/lib/chunking';
import { createSSEStream } from '@/lib/sse';
import { validateKeyForProvider, type Provider } from '@/lib/providers/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type DocumentRow = { id: string };

function parseProvider(value: string | null): Provider | null {
  if (value === 'openai' || value === 'vercel') return value;
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const provider = parseProvider(req.headers.get('x-llm-provider'));
  if (!provider) {
    return Response.json(
      { error: 'Missing or unsupported X-LLM-Provider header. Use "openai" or "vercel".' },
      { status: 400 },
    );
  }
  const apiKey = req.headers.get('x-llm-key');
  const keyCheck = validateKeyForProvider(provider, apiKey);
  if (!keyCheck.ok) {
    return Response.json({ error: keyCheck.reason }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: 'Expected multipart/form-data body.' }, { status: 400 });
  }

  const files = formData.getAll('files').filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return Response.json({ error: 'No files provided. Use the "files" form field.' }, { status: 400 });
  }

  const embedAuth = { provider, apiKey: apiKey as string };

  return createSSEStream(async (write) => {
    const documentIds: string[] = [];

    for (const file of files) {
      const filename = file.name || 'unnamed';
      const contentType = file.type || null;
      const size = file.size;

      await write('file_start', { filename, size });

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await parseFile(filename, contentType, buffer);

        await write('file_parsed', { filename, char_count: parsed.text.length });

        const chunks = chunkText(parsed.text);
        await write('file_chunked', { filename, chunk_count: chunks.length });

        if (chunks.length === 0) {
          await write('error', { filename, error: 'No extractable text found.' });
          continue;
        }

        const startedAt = Date.now();
        const embeddings = await embedBatch(chunks.map((c) => c.content), embedAuth);
        if (embeddings.length !== chunks.length) {
          throw new Error('Embedding count did not match chunk count.');
        }

        const totalTokens = chunks.reduce((sum, c) => sum + c.tokens, 0);

        const documentId = await withClient(async (client) => {
          await client.query('BEGIN');
          try {
            const insertDoc = await client.query<DocumentRow>(
              `insert into documents (filename, content_type, file_size_bytes, chunk_count, total_tokens)
               values ($1, $2, $3, $4, $5)
               returning id`,
              [filename, contentType, size, chunks.length, totalTokens],
            );
            const docId = insertDoc.rows[0].id;

            for (let i = 0; i < chunks.length; i++) {
              const c = chunks[i];
              await client.query(
                `insert into chunks (document_id, chunk_index, content, token_count, embedding)
                 values ($1, $2, $3, $4, $5::vector)`,
                [docId, c.index, c.content, c.tokens, toVectorLiteral(embeddings[i])],
              );
            }

            await client.query('COMMIT');
            return docId;
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          }
        });

        documentIds.push(documentId);
        await write('file_embedded', {
          filename,
          document_id: documentId,
          duration_ms: Date.now() - startedAt,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ingestion failed.';
        await write('error', { filename, error: message });
      }
    }

    await write('final', { document_ids: documentIds });
  });
}
