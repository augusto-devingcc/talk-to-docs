# Talk to Docs

Upload PDFs, DOCX, CSV, XLSX, TXT, or MD files. Ask questions. Get answers with citations to the source chunks.

<!-- screenshot here -->

## Stack

- Next.js 16 (App Router, React 19, TypeScript strict)
- Tailwind CSS v4 + shadcn/ui
- Neon Postgres + pgvector for chunk storage and vector search
- Vercel AI Gateway for embeddings (`openai/text-embedding-3-small`, 1536 dims)
- Multi-provider BYOK for chat: OpenAI, Anthropic, or Vercel AI Gateway
- File parsing via `unpdf`, `mammoth`, `papaparse`, and `xlsx`
- SSE streaming for both ingestion progress and chat answers

## Local development

```bash
npm install
npm run dev
```

The app reads from `.env.local`. You need the following variables:

```
DATABASE_URL=postgres://...        # Neon connection string with pgvector
AI_GATEWAY_API_KEY=vck_...         # Vercel AI Gateway key for embeddings (server-only)
```

The database schema (extensions, tables, indexes) is in `SPEC.md` and must be applied to the Neon database before first run.

## Bring your own key

Chat completions run on a key supplied by the visitor at runtime. The flow:

1. Visitor picks a provider in the UI (OpenAI, Anthropic, or Vercel AI Gateway).
2. Visitor pastes a key. The key is stored in `localStorage` under `ttd.<provider>.key`.
3. On every chat request the browser sends the key as the `X-LLM-Key` header along with `X-LLM-Provider`.
4. The server uses the key to instantiate the correct SDK client for the duration of the request, then drops it. The key is never written to disk, logs, or the database.

The embeddings key (`AI_GATEWAY_API_KEY`) stays server-side. It is used at ingestion time and at query time to embed retrieval text, and never exposed to the browser.

## Scripts

- `npm run dev` starts the local dev server.
- `npm run build` produces a production build.
- `npm run lint` runs ESLint with the Next.js config.

## Deploy

The project is linked to Vercel as `talk-to-docs` under `augusto-6836s-projects`. Pushing to `main` triggers a production deploy. Neon Postgres is provisioned through the Vercel Marketplace; the connection vars are pulled to `.env.local` by `vercel env pull`. Add `AI_GATEWAY_API_KEY` to the Vercel project environment before deploying.

Live demo: TBD on first deploy.

## Author

Built by Augusto García. Source at https://github.com/augusto-devingcc/talk-to-docs.
