"use client";

import { Quote } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type Citation = {
  document_id: string;
  filename: string;
  chunk_index: number;
  preview: string;
  page?: number | null;
};

type Props = {
  citation: Citation;
  index: number;
};

export function CitationPill({ citation, index }: Props) {
  const preview = citation.preview.slice(0, 150);
  const trimmed = citation.preview.length > 150 ? `${preview}…` : preview;
  const pageLabel = citation.page != null ? ` · p.${citation.page}` : "";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#27272a] bg-[#18181b] hover:bg-[#27272a] hover:border-[#fbbf24]/40 px-2.5 py-1 text-xs text-[#fafafa] transition-colors max-w-full"
        >
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#fbbf24]/15 text-[#fbbf24] text-[10px] font-mono px-1">
            {index + 1}
          </span>
          <span className="truncate font-mono text-[11px] text-[#a1a1aa]">
            {citation.filename}
            <span className="text-[#fbbf24]/80">
              {pageLabel} · #{citation.chunk_index}
            </span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-sm border-[#27272a] bg-[#09090b] text-[#fafafa]"
      >
        <div className="flex items-start gap-2">
          <Quote className="h-3 w-3 text-[#fbbf24] mt-0.5 shrink-0" />
          <p className="text-xs leading-relaxed text-[#fafafa]">{trimmed}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
