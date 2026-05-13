import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DocumentListRow = {
  id: string;
  filename: string;
  content_type: string | null;
  file_size_bytes: number | null;
  chunk_count: number | null;
  total_tokens: number | null;
  uploaded_at: Date;
};

export async function GET(): Promise<Response> {
  const { rows } = await query<DocumentListRow>(
    `select id, filename, content_type, file_size_bytes, chunk_count, total_tokens, uploaded_at
       from documents
      order by uploaded_at desc`,
  );

  const documents = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    content_type: r.content_type,
    file_size_bytes: r.file_size_bytes,
    chunk_count: r.chunk_count ?? 0,
    total_tokens: r.total_tokens ?? 0,
    uploaded_at: r.uploaded_at instanceof Date ? r.uploaded_at.toISOString() : r.uploaded_at,
  }));

  return Response.json({ documents });
}
