import Papa from 'papaparse';

export async function parse(buffer: Buffer): Promise<{ text: string; pages?: number }> {
  const raw = buffer.toString('utf-8');
  const parsed = Papa.parse<string[]>(raw, { skipEmptyLines: true });
  const rows = parsed.data;
  if (rows.length === 0) {
    return { text: '' };
  }
  const [header, ...body] = rows;
  const headerLine = header.map((h) => String(h ?? '').trim()).join(' | ');
  const dataLines = body.map((row) => row.map((v) => String(v ?? '').trim()).join(' | '));
  return { text: [headerLine, ...dataLines].join('\n') };
}
