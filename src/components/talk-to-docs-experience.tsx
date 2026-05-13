"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiKeyDialog } from "./api-key-dialog";
import { ProviderCard } from "./provider-card";
import { FileDrop } from "./file-drop";
import { DocumentRow, type DocumentSummary } from "./document-row";
import { ChatPanel } from "./chat-panel";
import type { Citation } from "./citation-pill";
import {
  PROVIDERS,
  defaultModelFor,
  getProvider,
  providerShortDescription,
} from "@/lib/models";
import { useApiKey, type ProviderId } from "@/lib/use-api-key";
import { useProvider } from "@/lib/use-provider";

const MAX_FILES = 10;

type FileStatus = "queued" | "parsing" | "chunking" | "embedding" | "done" | "error";

type FileProgress = {
  filename: string;
  status: FileStatus;
  chunk_count?: number;
  char_count?: number;
  error?: string;
};

function parseSSE(raw: string): { event: string; data: Record<string, unknown> } | null {
  let event = "message";
  let dataStr = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
  }
  if (!dataStr) return null;
  try {
    return { event, data: JSON.parse(dataStr) as Record<string, unknown> };
  } catch {
    return null;
  }
}

export function TalkToDocsExperience() {
  const { provider, setProvider, hydrated: providerHydrated } = useProvider();
  const { apiKey, setApiKey, hydrated: keyHydrated } = useApiKey(provider);

  // Derive model from provider: store the provider we last computed a model
  // for in state, and reset the model whenever the provider changes. This is
  // the React-recommended pattern for derived state (see
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [model, setModel] = useState<string>(() => defaultModelFor("anthropic"));
  const [modelProvider, setModelProvider] = useState<ProviderId>(provider);
  if (modelProvider !== provider) {
    setModelProvider(provider);
    setModel(defaultModelFor(provider));
  }

  const providerEntry = useMemo(() => getProvider(provider), [provider]);

  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<FileProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  // Documents list
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Chat state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  const refreshDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      if (!res.ok) {
        setDocuments([]);
        return;
      }
      const data = (await res.json()) as { documents?: DocumentSummary[] };
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDocuments();
  }, [refreshDocuments]);

  const handleIngestEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      const filename = typeof data.filename === "string" ? data.filename : null;
      if (!filename && event !== "error") return;
      switch (event) {
        case "file_start":
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.filename === filename ? { ...p, status: "parsing" } : p
            )
          );
          break;
        case "file_parsed":
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.filename === filename
                ? {
                    ...p,
                    status: "chunking",
                    char_count: Number(data.char_count) || 0,
                  }
                : p
            )
          );
          break;
        case "file_chunked":
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.filename === filename
                ? {
                    ...p,
                    status: "embedding",
                    chunk_count: Number(data.chunk_count) || 0,
                  }
                : p
            )
          );
          break;
        case "file_embedded":
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.filename === filename
                ? {
                    ...p,
                    status: "done",
                    chunk_count: Number(data.chunk_count) || p.chunk_count,
                  }
                : p
            )
          );
          break;
        case "error":
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.filename === filename
                ? { ...p, status: "error", error: String(data.error ?? "Failed") }
                : p
            )
          );
          if (!filename) {
            setUploadError(String(data.message ?? data.error ?? "Ingestion failed"));
          }
          break;
      }
    },
    []
  );

  const startIngest = useCallback(async () => {
    if (files.length === 0 || isUploading) return;
    uploadAbortRef.current?.abort();
    setUploadError(null);
    setUploadProgress(
      files.map((f) => ({ filename: f.name, status: "queued" }))
    );
    setIsUploading(true);

    const fd = new FormData();
    for (const f of files) fd.append("files", f);

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed with ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIndex;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          const parsed = parseSSE(rawEvent);
          if (parsed) handleIngestEvent(parsed.event, parsed.data);
        }
      }
      setFiles([]);
      await refreshDocuments();
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Upload failed.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  }, [files, isUploading, handleIngestEvent, refreshDocuments]);

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await fetch(`/api/documents/${id}`, { method: "DELETE" });
        await refreshDocuments();
      } finally {
        setDeletingId(null);
      }
    },
    [refreshDocuments]
  );

  const handleChatEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      switch (event) {
        case "retrieval_result": {
          const chunks = Array.isArray(data.chunks)
            ? (data.chunks as Array<Record<string, unknown>>)
            : [];
          setCitations(
            chunks.map((c) => ({
              document_id: String(c.document_id ?? ""),
              filename: String(c.filename ?? "document"),
              chunk_index: Number(c.chunk_index ?? 0),
              preview: String(c.preview ?? ""),
              page:
                typeof c.page === "number" ? c.page : c.page == null ? null : Number(c.page),
            }))
          );
          break;
        }
        case "answer_chunk": {
          const text = typeof data.text === "string" ? data.text : "";
          if (text.length > 0) setAnswer((prev) => prev + text);
          break;
        }
        case "final": {
          if (Array.isArray(data.citations)) {
            const finalCitations = (data.citations as Array<Record<string, unknown>>).map(
              (c) => ({
                document_id: String(c.document_id ?? ""),
                filename: String(c.filename ?? "document"),
                chunk_index: Number(c.chunk_index ?? 0),
                preview: String(c.preview ?? ""),
                page:
                  typeof c.page === "number"
                    ? c.page
                    : c.page == null
                      ? null
                      : Number(c.page),
              })
            );
            setCitations(finalCitations);
          }
          if (typeof data.model_used === "string") setModelUsed(data.model_used);
          break;
        }
        case "error":
          setChatError(String(data.message ?? "Chat failed"));
          break;
      }
    },
    []
  );

  const startChat = useCallback(async () => {
    if (!apiKey) {
      setChatError(`Add an API key for ${providerEntry.display_name} first.`);
      return;
    }
    const q = question.trim();
    if (q.length === 0) return;
    chatAbortRef.current?.abort();
    setAnswer("");
    setCitations([]);
    setChatError(null);
    setModelUsed(null);
    setIsAsking(true);

    const controller = new AbortController();
    chatAbortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LLM-Key": apiKey,
          "X-LLM-Provider": provider,
        },
        body: JSON.stringify({ question: q, provider, model }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed with ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIndex;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          const parsed = parseSSE(rawEvent);
          if (parsed) handleChatEvent(parsed.event, parsed.data);
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Chat stream failed.";
      setChatError(message);
    } finally {
      setIsAsking(false);
    }
  }, [apiKey, providerEntry.display_name, question, provider, model, handleChatEvent]);

  const hydrated = providerHydrated && keyHydrated;
  const hasKey = !!apiKey;
  const hasDocs = documents.length > 0;
  const chatDisabled = !hydrated || !hasKey || !hasDocs;
  const chatDisabledReason = !hydrated
    ? null
    : !hasKey
      ? `Add an API key for ${providerEntry.display_name} to enable chat.`
      : !hasDocs
        ? "Index at least one document to enable chat."
        : null;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Badge
          variant="secondary"
          className="bg-[#18181b] border-[#27272a] text-[#fbbf24] font-mono text-[10px] uppercase tracking-wider"
        >
          <Sparkles className="h-3 w-3 mr-1" /> RAG · Multi-provider · Cited answers
        </Badge>
      </div>
      <h1 className="text-center text-3xl sm:text-5xl font-semibold tracking-tight text-[#fafafa]">
        Talk to Docs
      </h1>
      <p className="mt-3 text-center text-[#a1a1aa] text-base sm:text-lg max-w-2xl mx-auto">
        Upload documents. Ask questions. Get cited answers.
      </p>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="bg-[#18181b]/60 border-[#27272a]">
            <CardContent className="p-5 space-y-5">
              <section>
                <Label className="text-xs uppercase tracking-wider text-[#a1a1aa] font-mono mb-3 block">
                  Provider
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => (
                    <ProviderCard
                      key={p.id}
                      provider={p.id}
                      name={p.display_name}
                      description={providerShortDescription(p.id)}
                      selected={provider === p.id}
                      onSelect={setProvider}
                      disabled={isUploading || isAsking}
                    />
                  ))}
                </div>
                <div className="mt-3">
                  {hydrated && (
                    <ApiKeyDialog
                      provider={provider}
                      apiKey={apiKey}
                      onSave={setApiKey}
                    />
                  )}
                </div>
              </section>

              <section>
                <Label className="text-xs uppercase tracking-wider text-[#a1a1aa] font-mono mb-2 block">
                  Model
                </Label>
                <Select
                  value={model}
                  onValueChange={setModel}
                  disabled={isAsking}
                >
                  <SelectTrigger className="w-full bg-[#18181b] border-[#27272a] text-[#fafafa]">
                    <SelectValue placeholder="Pick a model" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                    {providerEntry.models.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        className="focus:bg-[#27272a] focus:text-[#fafafa]"
                      >
                        <span className="font-medium">{m.display}</span>
                        <span className="text-[#a1a1aa] text-xs ml-2">
                          {m.description}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              <section>
                <Label className="text-xs uppercase tracking-wider text-[#a1a1aa] font-mono mb-2 block">
                  Documents to index
                </Label>
                <FileDrop
                  files={files}
                  onChange={setFiles}
                  max={MAX_FILES}
                  disabled={isUploading}
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-[10px] text-[#52525b] font-mono">
                    PDF · DOCX · CSV · XLSX · TXT · MD · up to {MAX_FILES} per run
                  </p>
                  <Button
                    type="button"
                    onClick={startIngest}
                    disabled={isUploading || files.length === 0}
                    className="h-10 bg-[#fbbf24] text-[#1c1304] hover:bg-[#f59e0b] font-medium"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Indexing
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" /> Index documents
                      </>
                    )}
                  </Button>
                </div>

                {uploadError && (
                  <div className="mt-3 rounded-md border border-[#f87171]/40 bg-[#f87171]/10 p-3 text-sm text-[#fca5a5]">
                    {uploadError}
                  </div>
                )}

                {uploadProgress.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {uploadProgress.map((p) => (
                      <UploadProgressRow key={p.filename} progress={p} />
                    ))}
                  </div>
                )}
              </section>
            </CardContent>
          </Card>

          <Card className="bg-[#18181b]/60 border-[#27272a]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-[#fafafa]">Indexed documents</h2>
                <span className="text-xs text-[#a1a1aa] font-mono">
                  {documents.length} doc{documents.length === 1 ? "" : "s"}
                </span>
              </div>
              {docsLoading && documents.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-[#52525b]">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading
                </div>
              ) : documents.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#27272a] bg-[#18181b]/40 px-3 py-6 text-center text-xs text-[#52525b]">
                  No documents yet. Upload above to get started.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {documents.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      onDelete={handleDeleteDocument}
                      deleting={deletingId === doc.id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#18181b]/60 border-[#27272a]">
          <CardContent className="p-5">
            <ChatPanel
              question={question}
              onQuestionChange={setQuestion}
              onAsk={startChat}
              isAsking={isAsking}
              answer={answer}
              citations={citations}
              errorMsg={chatError}
              modelUsed={modelUsed}
              disabled={chatDisabled}
              disabledReason={chatDisabledReason}
            />
          </CardContent>
        </Card>
      </div>

      <footer className="mt-14 border-t border-[#27272a] pt-6 text-center space-y-1">
        <p className="text-xs text-[#a1a1aa]">
          Built by Augusto García ·{" "}
          <a
            href="https://github.com/augusto-devingcc/talk-to-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#fbbf24] hover:underline underline-offset-4"
          >
            github.com/augusto-devingcc/talk-to-docs
          </a>
        </p>
        <p className="text-[10px] text-[#52525b] font-mono">
          powered by Neon + Vercel AI Gateway
        </p>
      </footer>
    </div>
  );
}

function UploadProgressRow({ progress }: { progress: FileProgress }) {
  const labelMap: Record<FileStatus, string> = {
    queued: "queued",
    parsing: "parsing",
    chunking: "chunking",
    embedding: "embedding",
    done: "indexed",
    error: "failed",
  };
  const isDone = progress.status === "done";
  const isError = progress.status === "error";
  const isWorking = !isDone && !isError;
  return (
    <div className="flex items-center gap-3 rounded-md border border-[#27272a] bg-[#18181b] px-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#fafafa] truncate">{progress.filename}</p>
        {progress.error && (
          <p className="text-[10px] text-[#fca5a5] font-mono mt-0.5">{progress.error}</p>
        )}
      </div>
      {isDone && progress.chunk_count != null && (
        <span className="inline-flex items-center rounded-full bg-[#34d399]/15 text-[#34d399] text-[10px] font-mono px-2 py-0.5">
          {progress.chunk_count} chunks
        </span>
      )}
      <span
        className={`text-[10px] font-mono uppercase tracking-wider ${
          isError
            ? "text-[#f87171]"
            : isDone
              ? "text-[#34d399]"
              : "text-[#fbbf24]"
        }`}
      >
        {isWorking && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
        {labelMap[progress.status]}
      </span>
    </div>
  );
}
