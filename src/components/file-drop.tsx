"use client";

import { useCallback, useRef, useState } from "react";
import {
  FilePlus,
  FileSpreadsheet,
  FileText,
  FileType,
  Upload,
  X,
} from "lucide-react";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".csv", ".xlsx", ".txt", ".md"];
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

function isAccepted(file: File): boolean {
  return ACCEPTED_EXTENSIONS.includes(fileExtension(file.name));
}

function FileIcon({ name, className }: { name: string; className?: string }) {
  const ext = fileExtension(name);
  if (ext === ".csv" || ext === ".xlsx") return <FileSpreadsheet className={className} />;
  if (ext === ".pdf" || ext === ".docx") return <FileText className={className} />;
  return <FileType className={className} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
  disabled?: boolean;
};

export function FileDrop({ files, onChange, max, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const valid = Array.from(incoming).filter(isAccepted);
      const next = [...files, ...valid].slice(0, max);
      onChange(next);
    },
    [files, max, onChange]
  );

  const remove = (i: number) => {
    const next = [...files];
    next.splice(i, 1);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-[#fbbf24] bg-[#fbbf24]/5"
            : "border-[#27272a] bg-[#18181b]/40 hover:border-[#fbbf24]/50"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="mx-auto h-6 w-6 text-[#a1a1aa]" />
        <p className="mt-2 text-sm text-[#fafafa]">
          Drop PDF, DOCX, CSV, XLSX, TXT, or MD files here, or click to browse
        </p>
        <p className="mt-1 text-xs text-[#a1a1aa] font-mono">
          {files.length} / {max} selected
        </p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {files.map((file, i) => {
            return (
              <div
                key={`${file.name}-${i}`}
                className="group flex items-center gap-3 rounded-md border border-[#27272a] bg-[#18181b] px-3 py-2"
              >
                <FileIcon name={file.name} className="h-4 w-4 text-[#fbbf24] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#fafafa] truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-[#a1a1aa] font-mono">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  className="h-6 w-6 rounded-full text-[#a1a1aa] hover:text-[#f87171] hover:bg-[#f87171]/10 flex items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          {files.length < max && !disabled && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-md border border-dashed border-[#27272a] hover:border-[#fbbf24]/50 bg-[#18181b]/40 text-[#a1a1aa] hover:text-[#fbbf24] px-3 py-2 text-xs"
            >
              <FilePlus className="h-4 w-4" /> Add more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
