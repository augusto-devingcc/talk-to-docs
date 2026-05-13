import { parse as parsePdf } from './pdf';
import { parse as parseDocx } from './docx';
import { parse as parseCsv } from './csv';
import { parse as parseXlsx } from './xlsx';
import { parse as parseText } from './text';

export type ParsedDocument = { text: string; pages?: number };

export type SupportedFormat = 'pdf' | 'docx' | 'csv' | 'xlsx' | 'text';

const EXTENSION_MAP: Record<string, SupportedFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  csv: 'csv',
  xlsx: 'xlsx',
  xls: 'xlsx',
  txt: 'text',
  md: 'text',
  markdown: 'text',
};

const MIME_MAP: Record<string, SupportedFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'text/plain': 'text',
  'text/markdown': 'text',
};

export function detectFormat(filename: string, contentType?: string | null): SupportedFormat | null {
  if (contentType) {
    const lowered = contentType.toLowerCase().split(';')[0].trim();
    if (MIME_MAP[lowered]) return MIME_MAP[lowered];
  }
  const dot = filename.lastIndexOf('.');
  if (dot >= 0) {
    const ext = filename.slice(dot + 1).toLowerCase();
    if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];
  }
  return null;
}

export async function parseFile(
  filename: string,
  contentType: string | null | undefined,
  buffer: Buffer,
): Promise<ParsedDocument> {
  const format = detectFormat(filename, contentType);
  if (!format) {
    throw new Error(`Unsupported file format for "${filename}" (content-type=${contentType ?? 'unknown'})`);
  }
  switch (format) {
    case 'pdf':
      return parsePdf(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'csv':
      return parseCsv(buffer);
    case 'xlsx':
      return parseXlsx(buffer);
    case 'text':
      return parseText(buffer);
  }
}
