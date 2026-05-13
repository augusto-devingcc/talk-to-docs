import { extractText, getDocumentProxy } from 'unpdf';

export async function parse(buffer: Buffer): Promise<{ text: string; pages?: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join('\n') : text;
  return { text: merged, pages: totalPages };
}
