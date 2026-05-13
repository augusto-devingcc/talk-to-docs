import mammoth from 'mammoth';

export async function parse(buffer: Buffer): Promise<{ text: string; pages?: number }> {
  const { value } = await mammoth.extractRawText({ buffer });
  return { text: value };
}
