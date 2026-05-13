import { encode } from 'gpt-tokenizer';

export type Chunk = { index: number; content: string; tokens: number };

const DEFAULT_TARGET_TOKENS = 600;
const DEFAULT_OVERLAP_TOKENS = 60;

export function countTokens(s: string): number {
  return encode(s).length;
}

function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitSentences(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/g);
  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

function hardSplitByTokens(text: string, targetTokens: number): string[] {
  const words = text.split(/\s+/);
  const parts: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    if (countTokens(current.join(' ')) >= targetTokens) {
      parts.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) parts.push(current.join(' '));
  return parts;
}

function tailForOverlap(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return '';
  const sentences = splitSentences(text);
  const buf: string[] = [];
  for (let i = sentences.length - 1; i >= 0; i--) {
    buf.unshift(sentences[i]);
    if (countTokens(buf.join(' ')) >= overlapTokens) break;
  }
  return buf.join(' ');
}

export function chunkText(
  text: string,
  targetTokens: number = DEFAULT_TARGET_TOKENS,
  overlapTokens: number = DEFAULT_OVERLAP_TOKENS,
): Chunk[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const units: string[] = [];
  for (const paragraph of splitParagraphs(trimmed)) {
    if (countTokens(paragraph) <= targetTokens) {
      units.push(paragraph);
      continue;
    }
    for (const sentence of splitSentences(paragraph)) {
      if (countTokens(sentence) <= targetTokens) {
        units.push(sentence);
      } else {
        units.push(...hardSplitByTokens(sentence, targetTokens));
      }
    }
  }

  const chunks: Chunk[] = [];
  let buffer = '';
  let bufferTokens = 0;
  let index = 0;

  const flush = () => {
    if (!buffer.trim()) return;
    chunks.push({ index, content: buffer.trim(), tokens: bufferTokens });
    index += 1;
    const overlap = tailForOverlap(buffer, overlapTokens);
    buffer = overlap;
    bufferTokens = overlap ? countTokens(overlap) : 0;
  };

  for (const unit of units) {
    const unitTokens = countTokens(unit);
    if (bufferTokens + unitTokens > targetTokens && buffer) {
      flush();
    }
    buffer = buffer ? `${buffer}\n\n${unit}` : unit;
    bufferTokens = countTokens(buffer);
  }

  if (buffer.trim()) {
    chunks.push({ index, content: buffer.trim(), tokens: bufferTokens });
  }

  return chunks;
}
