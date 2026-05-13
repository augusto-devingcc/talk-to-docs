import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return Response.json({ error: 'Invalid document id.' }, { status: 400 });
  }

  const result = await query(`delete from documents where id = $1`, [id]);
  if (result.rowCount === 0) {
    return Response.json({ error: 'Document not found.' }, { status: 404 });
  }

  return Response.json({ deleted: id });
}
