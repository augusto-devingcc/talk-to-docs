"use client";

import { ArrowRight, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CitationPill, type Citation } from "./citation-pill";

type Props = {
  question: string;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  isAsking: boolean;
  answer: string;
  citations: Citation[];
  errorMsg: string | null;
  modelUsed: string | null;
  disabled?: boolean;
  disabledReason?: string | null;
};

export function ChatPanel({
  question,
  onQuestionChange,
  onAsk,
  isAsking,
  answer,
  citations,
  errorMsg,
  modelUsed,
  disabled,
  disabledReason,
}: Props) {
  const canSubmit = !disabled && !isAsking && question.trim().length > 0;
  return (
    <div className="space-y-4">
      <div>
        <Label
          htmlFor="ttd-question"
          className="text-xs uppercase tracking-wider text-[#a1a1aa] font-mono mb-2 block"
        >
          Question
        </Label>
        <Textarea
          id="ttd-question"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          rows={3}
          disabled={disabled || isAsking}
          placeholder={
            disabled
              ? (disabledReason ?? "Add a key and index a document to start.")
              : "What is this document about? Summarize the key risks. Find the total revenue for Q3."
          }
          className="bg-[#18181b] border-[#27272a] text-[#fafafa] font-mono text-sm placeholder:text-[#52525b]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
              e.preventDefault();
              onAsk();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-[#52525b] font-mono">
            Cmd+Enter to send
          </p>
          <Button
            type="button"
            onClick={onAsk}
            disabled={!canSubmit}
            className="h-10 bg-[#fbbf24] text-[#1c1304] hover:bg-[#f59e0b] font-medium"
          >
            {isAsking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Thinking
              </>
            ) : (
              <>
                Ask <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-[#f87171]/40 bg-[#f87171]/10 p-3 text-sm text-[#fca5a5]">
          {errorMsg}
        </div>
      )}

      <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-4 min-h-[180px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#a1a1aa] font-mono">
            <MessageSquare className="h-3 w-3" /> Answer
          </div>
          {modelUsed && (
            <span className="text-[10px] font-mono text-[#52525b]">{modelUsed}</span>
          )}
        </div>
        {answer.length === 0 && !isAsking ? (
          <div className="flex items-center gap-2 text-sm text-[#52525b]">
            <Sparkles className="h-4 w-4" />
            The streamed answer will appear here, with citations below.
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#fafafa]">
            {answer}
            {isAsking && <span className="inline-block w-2 h-4 ml-0.5 bg-[#fbbf24] animate-pulse align-middle" />}
          </p>
        )}
      </div>

      {citations.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-[#a1a1aa] font-mono mb-2">
            Citations
          </div>
          <div className="flex flex-wrap gap-2">
            {citations.map((c, i) => (
              <CitationPill key={`${c.document_id}-${c.chunk_index}-${i}`} citation={c} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
