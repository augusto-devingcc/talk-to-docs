# Talk to Docs — Spec

**Purpose:** Portfolio Piece 4 for Augusto García's Upwork profile. A RAG demo that lets visitors upload documents (PDF, DOCX, CSV, XLSX, TXT, MD) and ask questions, with answers grounded in the documents and rendered with source citations.

## Brand (intentionally different from Pieces 2 and 3)

Pieces 2 and 3 use slate-900 + emerald-400. This piece breaks the family with warm-amber to signal "different surface, same builder."

- Background: `#09090B` (zinc-950)
- Surface: `#18181B` (zinc-900)
- Surface elevated: `#27272A` (zinc-800)
- Accent: `#FBBF24` (amber-400)
- Accent strong: `#F59E0B` (amber-500)
- Text primary: `#FAFAFA` (zinc-50)
- Text muted: `#A1A1AA` (zinc-400)
- Active / status: `#34D399` (emerald-400, used sparingly for success states)
- Error: `#F87171` (red-400)
- Fonts: Geist Sans + Geist Mono (consistent with other pieces, but smaller-feeling at 14px base)

## Live URL

Will be assigned by Vercel on deploy. Currently the project is linked as `augusto-6836s-projects/talk-to-docs`. The default `talk-to-docs.vercel.app` is the target.

## What the demo does

1. Visitor picks a provider for chat: **OpenAI**, **Anthropic**, or **Vercel AI Gateway**.
2. Visitor pastes the corresponding API key. Key stays in browser localStorage only, sent as `X-LLM-Key` header per request, never persisted server-side.
3. Visitor picks a model from the chosen provider's dropdown.
4. Visitor uploads one or more documents (PDF, DOCX, CSV, XLSX, TXT, MD). Each file is parsed, chunked, embedded, and stored in Neon Postgres + pgvector.
5. Document list shows each uploaded file with chunk count + ingestion status.
6. Visitor types a question. Backend retrieves the top-k chunks via cosine similarity, builds a context window, sends prompt + context to the chosen LLM, streams the answer back via SSE.
7. UI renders the answer plus a citations panel: clickable badges showing source document, chunk index, and a preview of the chunk text.

## Stack (all cloud, all production-grade)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router (React 19) |
| Styling | Tailwind v4 + shadcn/ui |
| Hosting | Vercel |
| Vector DB | **Neon Postgres + pgvector** (provisioned via Vercel Marketplace, free tier) |
| Embeddings | **Vercel AI Gateway** with `openai/text-embedding-3-small` (1536 dimensions, server-funded via `AI_GATEWAY_API_KEY`) |
| Chat LLM | **Multi-provider BYOK**: OpenAI, Anthropic, or Vercel AI Gateway. User picks + pastes their own key. |
| File parsing | `unpdf` for PDF, `mammoth` for DOCX, `papaparse` for CSV, `xlsx` (sheetjs) for XLSX, native for TXT/MD |
| Streaming | SSE protocol for chat answers and ingestion progress |
| TypeScript | strict mode end to end |

## Database schema (already applied)

```sql
create extension vector;
create extension pgcrypto;

create table documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  content_type text,
  file_size_bytes int,
  chunk_count int default 0,
  total_tokens int default 0,
  uploaded_at timestamptz default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_count int,
  metadata jsonb default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index idx_chunks_document_id on chunks(document_id);
create index idx_chunks_embedding on chunks using hnsw (embedding vector_cosine_ops);
create index idx_documents_uploaded_at on documents(uploaded_at desc);
```

## Multi-provider model picker (current as of May 2026)

The user picks one of three providers, then a model within that provider. Display official logos beside each provider name.

### OpenAI (logo: OpenAI mark)
- `gpt-4o` (fast, balanced)
- `gpt-4o-mini` (cheap, fast)

### Anthropic (logo: Anthropic mark)
- `claude-haiku-4-5` (fast, cheap)
- `claude-sonnet-4-6` (balanced default)
- `claude-opus-4-7` (best quality, slower)

### Vercel AI Gateway (logo: Vercel mark)
- Lets the user route through Vercel's unified gateway. Models exposed: same Anthropic + OpenAI catalog. Key advantage: a single API key handles all providers and gives observability + caching. Useful for clients already on the Vercel stack.

The research agent will verify model availability and naming through the gateway docs. Names above are tentative until confirmed.

## SSE event protocol (chat)

```
event: retrieval_start
data: {"question":"..."}

event: retrieval_result
data: {"chunks":[{"document_id":"...","filename":"...","chunk_index":3,"preview":"..."}]}

event: answer_chunk
data: {"text":"..."}

event: final
data: {"citations":[...],"total_tokens":1234,"model_used":"..."}

event: error
data: {"message":"..."}
```

## SSE event protocol (ingestion)

```
event: file_start
data: {"filename":"...","size":12345}

event: file_parsed
data: {"filename":"...","char_count":24000}

event: file_chunked
data: {"filename":"...","chunk_count":18}

event: file_embedded
data: {"filename":"...","document_id":"...","duration_ms":4200}

event: error
data: {"filename":"...","error":"..."}
```

## BYOK pattern

The visitor's chat API key never touches disk on the server. It is:

- Stored only in browser localStorage under `ttd.<provider>.key` (e.g., `ttd.anthropic.key`)
- Sent per request as `X-LLM-Key` header along with `X-LLM-Provider` (one of `openai`, `anthropic`, `vercel`)
- Used to initialize the appropriate SDK client (Anthropic SDK, OpenAI SDK, or Vercel AI Gateway client)
- Dropped at end of request

The `AI_GATEWAY_API_KEY` for embeddings stays server-side only (it is cheap and rate-limited at the gateway, so the abuse surface is small).

## Repo + deploy

- GitHub: `https://github.com/augusto-devingcc/talk-to-docs` (created, empty, AGENTS.md + CLAUDE.md removed)
- Vercel project: `talk-to-docs` under team `augusto-6836s-projects` (linked, Neon resource connected, env vars pulled to `.env.local`)
- Server env vars to set in Vercel before production deploy: all Neon vars (already configured via Vercel marketplace), plus `AI_GATEWAY_API_KEY`

## What "done" means

1. ✅ Live demo at the assigned `.vercel.app` URL, working end-to-end on at least one sample document type.
2. ✅ Multi-provider model picker with proper logos and BYOK gate.
3. ✅ Citations render with clickable source previews.
4. ✅ All 6 file types ingest successfully on a sample test.
5. ✅ `npm run build` and `npm run lint` clean.
6. ✅ README updated, AGENTS.md / CLAUDE.md not present, no secrets in repo.
7. ✅ Pushed to `origin/main`, Vercel auto-deploys from main.
