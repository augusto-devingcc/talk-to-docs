"use client";

import { Check } from "lucide-react";
import { ProviderLogo } from "./provider-logo";
import type { ProviderId } from "@/lib/use-api-key";

type Props = {
  provider: ProviderId;
  name: string;
  description: string;
  selected: boolean;
  onSelect: (id: ProviderId) => void;
  disabled?: boolean;
};

export function ProviderCard({
  provider,
  name,
  description,
  selected,
  onSelect,
  disabled,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(provider)}
      aria-pressed={selected}
      className={`group relative w-full text-left rounded-lg border p-4 transition-colors ${
        selected
          ? "border-[#fbbf24] bg-[#fbbf24]/5"
          : "border-[#27272a] bg-[#18181b] hover:border-[#fbbf24]/50"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center transition-colors ${
            selected
              ? "bg-[#fbbf24]/10 text-[#fbbf24]"
              : "bg-[#27272a] text-[#a1a1aa] group-hover:text-[#fafafa]"
          }`}
        >
          <ProviderLogo provider={provider} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[#fafafa] truncate">{name}</p>
            {selected && (
              <span
                aria-hidden
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#fbbf24] text-[#1c1304]"
              >
                <Check className="h-3 w-3" />
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#a1a1aa] leading-snug">{description}</p>
        </div>
      </div>
    </button>
  );
}
