export async function parse(buffer: Buffer): Promise<{ text: string; pages?: number }> {
  return { text: buffer.toString('utf-8') };
}
