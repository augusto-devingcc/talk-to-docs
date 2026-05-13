# RESEARCH.md — Talk to Docs

Reference material for the build agents. Verified May 2026 against primary sources. Keep this file as the single source of truth for package names, versions, model IDs, and minimal code patterns. Companion file: `MODELS.json`.

---

## Section 1 — Vercel AI Gateway (embeddings + chat)

### Packages

| Package | Latest stable (May 2026) | Role |
|---|---|---|
| `ai` | **6.0.182** | Core AI SDK. Provides `streamText`, `generateText`, `embed`, `embedMany`. |
| `@ai-sdk/gateway` | **3.0.114** | Gateway provider. Provides typed `GatewayProviderOptions` and the `gateway()` factory. Re-exported from `ai` as `gateway`. |

Install:

```bash
npm i ai @ai-sdk/gateway
```

You can address the gateway either with the string slug (e.g. `'openai/gpt-4o'`) or via the `gateway()` factory. The string form is the simpler default and is what the AI SDK docs recommend.

### Authentication

- **Server-funded embeddings call.** Set `AI_GATEWAY_API_KEY` in the server environment. The SDK auto-detects this env var when you pass a slug like `'openai/text-embedding-3-small'`. No explicit `apiKey` argument is needed.
- **Project is already linked to a Vercel project**, so OIDC tokens are also valid; if `AI_GATEWAY_API_KEY` is set it takes precedence.

### BYOK (client-supplied LLM key)

**Important:** The AI Gateway does **NOT** accept user keys via a custom HTTP request header. There is no `X-LLM-Key` pass-through at the gateway level. BYOK is configured per-call through `providerOptions.gateway.byok`. Source: https://vercel.com/docs/ai-gateway/authentication-and-byok/byok

That means the demo's `X-LLM-Key` pattern works like this:

1. Client always sends `X-LLM-Key` + `X-LLM-Provider` headers.
2. On the server route, read the headers.
3. **If `X-LLM-Provider === 'vercel'`**, the user's key is itself a Vercel AI Gateway key. Use it as the gateway key on that single request (override `AI_GATEWAY_API_KEY` for that call via the `apiKey` option on `createGateway`, see snippet below). Do **not** try to pass it through to the underlying provider unless you also know which provider the chosen model belongs to.
4. **If `X-LLM-Provider === 'openai'` or `'anthropic'`**, route the call directly through the official SDK with the user's key. Do not involve the gateway.

This keeps the design simple and avoids a known fallback behavior: if BYOK creds fail, the gateway falls back to system credentials and bills you (see https://vercel.com/docs/ai-gateway/authentication-and-byok/byok). For BYOK chat we go direct-to-provider; only embeddings stay on the gateway.

```ts
// BYOK with the Vercel Gateway itself as the chosen provider
import { createGateway } from '@ai-sdk/gateway';
import { streamText } from 'ai';

const gw = createGateway({ apiKey: userKey });    // userKey from X-LLM-Key
const result = await streamText({
  model: gw('anthropic/claude-sonnet-4.6'),
  messages: [...],
});
```

### Model ID format (gateway)

`<provider>/<model>`. The version uses **dots**, not dashes. Examples (all verified against `https://ai-gateway.vercel.sh/v1/models`):

- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `openai/text-embedding-3-small`
- `anthropic/claude-haiku-4.5`
- `anthropic/claude-sonnet-4.6`
- `anthropic/claude-opus-4.7`

Note the dot in `4.5`, `4.6`, `4.7`. The direct Anthropic API uses dashes for the same model (e.g. `claude-opus-4-7`). Do not mix the two.

### Streaming behavior

`streamText` returns an object with `.textStream` (async iterable of strings), `.fullStream` (async iterable of typed events), and `.toUIMessageStreamResponse()` for direct Next.js Response support. The SDK's stream is built on the AI SDK protocol; if you want a raw SSE wire format use `result.toTextStreamResponse()` (plain text streaming) or hand-roll SSE from the iterable.

Error handling: gateway errors surface as thrown `AI_*Error` subclasses (e.g. `AI_APICallError`, `AI_NoSuchModelError`). HTTP-level codes returned by the gateway include `401` (bad gateway key), `402` (out of credits and BYOK fallback failed), `404` (unknown model slug), `429` (rate limited), `5xx` (upstream provider issue). See https://vercel.com/docs/ai-gateway.

### Snippets

```ts
// Embed one string (server-side, using AI_GATEWAY_API_KEY from env)
import { embed } from 'ai';

const { embedding } = await embed({
  model: 'openai/text-embedding-3-small',
  value: 'What is RAG?',
});
// embedding is number[] of length 1536
```

```ts
// Embed a batch (used during ingestion)
import { embedMany } from 'ai';

const { embeddings } = await embedMany({
  model: 'openai/text-embedding-3-small',
  values: chunks.map((c) => c.content),
});
// embeddings[i] aligns with chunks[i]; embedMany auto-batches if too large
```

```ts
// Stream a chat completion through the gateway
import { streamText } from 'ai';

const result = await streamText({
  model: 'openai/gpt-4o',
  system: 'Answer only using the supplied context.',
  messages: [{ role: 'user', content: question }],
});

for await (const delta of result.textStream) {
  // forward delta to client SSE: writer.write(`event: answer_chunk\ndata: ${JSON.stringify({ text: delta })}\n\n`)
}

const usage = await result.usage;          // { inputTokens, outputTokens, totalTokens }
```

---

## Section 2 — Anthropic SDK (direct usage, BYOK chat path)

### Package

| Package | Latest stable (May 2026) |
|---|---|
| `@anthropic-ai/sdk` | **0.96.0** |

```bash
npm i @anthropic-ai/sdk
```

### Model IDs (direct API — verified against https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)

Starting with the 4.6 generation, model IDs are **dateless** and pin a single snapshot:

- `claude-opus-4-7` — pinned snapshot, no date suffix.
- `claude-sonnet-4-6` — pinned snapshot, no date suffix.
- `claude-haiku-4-5` — convenience alias on the Claude API that resolves to the dated snapshot `claude-haiku-4-5-20251001`. Either works.

Use the dashed-version IDs above for the direct API. The dot variants (`claude-opus-4.7`) are **only** for the Vercel AI Gateway, not for `@anthropic-ai/sdk`.

### Embeddings

Anthropic does **not** offer first-party embeddings. The Anthropic SDK has no `embeddings` resource. Do not attempt to embed with Anthropic. All embeddings go through the Vercel AI Gateway using `openai/text-embedding-3-small`.

### Streaming snippet

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: userKey });   // BYOK from X-LLM-Key

const stream = client.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: 'Answer only using the supplied context.',
  messages: [{ role: 'user', content: question }],
});

for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    // forward event.delta.text to client SSE
  }
}

const finalMessage = await stream.finalMessage();    // usage available on finalMessage.usage
```

Notes:
- `client.messages.stream(...)` is the typed iterable form. `client.messages.create({ stream: true })` returns a raw SSE-style stream of `RawMessageStreamEvent` if you need it.
- `max_tokens` is **required** for Anthropic. Pick a sensible default (e.g. 2048) and expose it as a config constant.

---

## Section 3 — OpenAI SDK (direct usage, BYOK chat path)

### Package

| Package | Latest stable (May 2026) |
|---|---|
| `openai` | **6.37.0** |

```bash
npm i openai
```

### Model IDs (direct API — verified at https://platform.openai.com/docs/models)

In the chat completions endpoint:

- `gpt-4o` — fast and balanced. Still GA and listed.
- `gpt-4o-mini` — cheap and fast. Still GA and listed.

Newer GA chat models that OpenAI shipped after gpt-4o (May 2026): the GPT-5 series — `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5`, `gpt-5.5-pro` (per https://developers.openai.com/api/docs/changelog). They are **not** required for this demo; the spec calls for `gpt-4o` and `gpt-4o-mini`. If we later want to expose them, the chat completions endpoint accepts them too. `// VERIFY:` if adding them, confirm pricing tiers and that they don't require the Responses API.

### Streaming snippet

```ts
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: userKey });   // BYOK from X-LLM-Key

const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  stream: true,
  messages: [
    { role: 'system', content: 'Answer only using the supplied context.' },
    { role: 'user', content: question },
  ],
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) {
    // forward delta to client SSE
  }
}
```

For final usage stats, pass `stream_options: { include_usage: true }`; the last chunk then carries `chunk.usage`.

---

## Section 4 — Document parsing

### PDF — `unpdf`

| Package | Version | License |
|---|---|---|
| `unpdf` | **1.6.2** | MIT |

```ts
import { extractText, getDocumentProxy } from 'unpdf';

export async function pdfToText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}
```

Quirks:
- `extractText(pdf, { mergePages: true })` returns `{ totalPages, text: string }`. Without `mergePages` it returns an array of per-page strings.
- Serverless-friendly. Uses an embedded build of PDF.js 5.x. No native deps.
- Large PDFs (>50 MB): consider streaming chunks, or cap upload size at the API route level.

### DOCX — `mammoth`

| Package | Version | License |
|---|---|---|
| `mammoth` | **1.12.0** | BSD-2-Clause |

```ts
import mammoth from 'mammoth';

export async function docxToText(buf: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}
```

Quirks:
- Each paragraph is followed by two newlines. Good for chunkers.
- Drops images and styles by design — use `convertToHtml` if you ever need formatting; for RAG, plain text is correct.
- Does not handle `.doc` (legacy binary). Reject non-`.docx` MIME types in the upload handler.

### CSV — `papaparse`

| Package | Version | License |
|---|---|---|
| `papaparse` | **5.5.3** | MIT |

```ts
import Papa from 'papaparse';

export function csvToText(buf: Buffer): string {
  const text = buf.toString('utf-8');
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  // For RAG, flatten to a readable "row N: col=val, col=val" representation.
  const [header, ...rows] = parsed.data;
  return rows
    .map((row, i) => `Row ${i + 1}: ` + row.map((v, j) => `${header[j]}=${v}`).join(', '))
    .join('\n');
}
```

Quirks:
- Default delimiter detection is fine for most files; force `delimiter: ','` if you see misdetection.
- Encoding: assume UTF-8. If you see mojibake, fall back to `iconv-lite` (`// VERIFY:` only if a sample file fails).

### XLSX — `xlsx` (SheetJS)

| Package | Version | License |
|---|---|---|
| `xlsx` | **0.18.5** (npm registry) | Apache-2.0 |

**Licensing caveat:** SheetJS officially considers the npm registry copy stale and recommends installing newer releases from their CDN (https://cdn.sheetjs.com/). For this demo, `xlsx@0.18.5` from npm is fine — Apache-2.0 licensed, free for commercial portfolio use, and reads all common XLSX files. Just expect that newer features (e.g. some chart parsing) are only in the CDN build. Source: https://docs.sheetjs.com/docs/getting-started/installation/nodejs

```ts
import * as XLSX from 'xlsx';

export function xlsxToText(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
    parts.push(`# Sheet: ${sheetName}\n${csv}`);
  }
  return parts.join('\n\n');
}
```

Quirks:
- Massive workbooks consume memory; cap upload size.
- Date cells return Excel serial numbers by default. Pass `{ raw: false }` to `sheet_to_csv` or use `cellDates: true` in `read` to get ISO strings.

### TXT / MD — native

No library needed.

```ts
export function plainToText(buf: Buffer): string {
  return buf.toString('utf-8');
}
```

For Markdown we keep the raw markdown text. Chunking and embedding handle it well; we do not strip syntax. If you ever need clean text, `remark` + `strip-markdown` is fine but not required.

---

## Section 5 — Chunking strategy

### Recommended

- Target **600 tokens per chunk**, **60 tokens of overlap** (~10%).
- Split on paragraph boundaries first, then sentence boundaries, then hard-cut.
- Maintain a `chunk_index` per document, persisted to the `chunks.chunk_index` column.
- Persist `token_count` per chunk for cost diagnostics.

### Token counting

| Package | Version | License | Notes |
|---|---|---|---|
| `gpt-tokenizer` | **3.4.0** | MIT | Pure JS, zero native deps. Lightest option for serverless. Recommended. |
| `tiktoken` | 1.0.22 | MIT | WASM-based, slightly faster but adds ~2 MB. Skip unless you need it. |

```bash
npm i gpt-tokenizer
```

```ts
import { encode } from 'gpt-tokenizer';

export function countTokens(s: string): number {
  return encode(s).length;
}
```

`gpt-tokenizer` defaults to the `cl100k_base` encoding, which matches `text-embedding-3-small` and `gpt-4o`. Close enough for chunk-sizing purposes against any model in this demo.

### Sketch of a chunker

```ts
import { encode, decode } from 'gpt-tokenizer';

export function chunkText(text: string, targetTokens = 600, overlap = 60) {
  const tokens = encode(text);
  const out: { content: string; tokenCount: number; index: number }[] = [];
  for (let i = 0, idx = 0; i < tokens.length; i += targetTokens - overlap, idx++) {
    const slice = tokens.slice(i, i + targetTokens);
    out.push({ content: decode(slice), tokenCount: slice.length, index: idx });
    if (i + targetTokens >= tokens.length) break;
  }
  return out;
}
```

This is a simple sliding-window over BPE tokens — good enough for the demo. For higher-quality chunking, switch to paragraph-aware logic later.

---

## Section 6 — pgvector retrieval

### Driver

| Package | Version | License |
|---|---|---|
| `pg` | **8.20.0** | MIT |

```bash
npm i pg
```

### Retrieval query

The cosine distance operator `<=>` works with the HNSW index already created in the schema (`using hnsw (embedding vector_cosine_ops)`). The embedding must be passed as a **pgvector literal string** (a JSON-style array cast to `vector`).

```ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function topK(queryEmbedding: number[], k = 5) {
  const literal = `[${queryEmbedding.join(',')}]`;
  const { rows } = await pool.query(
    `select c.id, c.content, c.chunk_index, c.metadata,
            d.id as document_id, d.filename,
            1 - (c.embedding <=> $1::vector) as similarity
       from chunks c
       join documents d on d.id = c.document_id
      order by c.embedding <=> $1::vector
      limit $2`,
    [literal, k],
  );
  return rows;
}
```

Notes:
- The expression `1 - (embedding <=> $1::vector)` converts cosine distance to a similarity score in `[-1, 1]`. Higher is better; useful to surface in citations or filter weak matches.
- `<=>` is the cosine distance operator. The HNSW index is built with `vector_cosine_ops`, so the planner will use the index when ordering by `<=>`. Confirmed correct for cosine similarity per the pgvector docs.
- `$1::vector` is the explicit cast that the index requires. Forgetting the cast forces a sequential scan.

### HNSW vs IVFFlat

HNSW (what we use) gives **better recall at small k**, no training step, slower index build, slightly higher memory. IVFFlat is faster to build and uses less memory but needs a representative sample for `lists` and tends to lose recall at small k. For demo-scale (thousands of chunks, k=5–8) HNSW is the right call. Index is already built with the correct ops class — no action needed.

---

## Verification flags

- `// VERIFY:` If we later expose GPT-5 series models (`gpt-5.4`, `gpt-5.5`) in the OpenAI dropdown, confirm they're available on the standard chat completions endpoint and that no extra account verification is required.
- `// VERIFY:` Anthropic Haiku 4.5 is the only model in our list still using a date-suffixed underlying ID (`claude-haiku-4-5-20251001`). The dateless alias `claude-haiku-4-5` works today; if the alias is ever retired, switch to the dated form.
- `// VERIFY:` Vercel AI Gateway BYOK fallback behavior: if a user-supplied gateway key fails, the gateway silently falls back to our system credentials and bills us. Our design avoids this by going direct-to-provider for BYOK chat. If we ever route BYOK chat through the gateway, set up monitoring on `AI_GATEWAY_API_KEY` spend.
- `// VERIFY:` `xlsx@0.18.5` is sufficient for the file types we test against. If clients hit edge-case formats, swap to SheetJS CDN install per their docs.

## Source list (primary)

- Vercel AI Gateway BYOK: https://vercel.com/docs/ai-gateway/authentication-and-byok/byok
- Vercel AI Gateway models: https://ai-gateway.vercel.sh/v1/models, https://vercel.com/ai-gateway/models
- AI SDK gateway provider: https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
- AI SDK `embed` / `embedMany`: https://ai-sdk.dev/docs/reference/ai-sdk-core/embed-many
- Anthropic model IDs: https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions
- Anthropic streaming: https://platform.claude.com/docs/en/api/messages-streaming
- OpenAI models: https://platform.openai.com/docs/models
- OpenAI changelog: https://developers.openai.com/api/docs/changelog
- unpdf: https://github.com/unjs/unpdf
- mammoth: https://github.com/mwilliamson/mammoth.js
- SheetJS installation note: https://docs.sheetjs.com/docs/getting-started/installation/nodejs
- pgvector: https://github.com/pgvector/pgvector
