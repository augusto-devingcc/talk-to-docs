"use client";

import { FileSpreadsheet, FileText, FileType, Loader2, X } from "lucide-react";

export type DocumentSummary = {
  id: string;
  filename: string;
  chunk_count: number;
  file_size_bytes?: number | null;
  uploaded_at?: string | null;
};

type Props = {
  doc: DocumentSummary;
  onDelete: (id: string) => void;
  deleting?: boolean;
};

function FileIcon({ name, className }: { name: string; className?: string }) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".xlsx")) {
    return <FileSpreadsheet className={className} />;
  }
  if (lower.endsWith(".pdf") || lower.endsWith(".docx")) {
    return <FileText className={className} />;
  }
  return <FileType className={className} />;
}

export function DocumentRow({ doc, onDelete, deleting }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[#27272a] bg-[#18181b] px-3 py-2">
      <FileIcon name={doc.filename} className="h-4 w-4 text-[#fbbf24] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#fafafa] truncate" title={doc.filename}>
          {doc.filename}
        </p>
        <p className="text-[10px] text-[#a1a1aa] font-mono">
          {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDelete(doc.id)}
        disabled={deleting}
        aria-label={`Delete ${doc.filename}`}
        className="h-6 w-6 rounded-full text-[#a1a1aa] hover:text-[#f87171] hover:bg-[#f87171]/10 flex items-center justify-center transition-colors disabled:opacity-50"
      >
        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </button>
    </div>
  );
}
