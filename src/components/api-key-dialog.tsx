"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ProviderId,
  isValidKey,
  keyPrefixFor,
  providerLabel,
} from "@/lib/use-api-key";

type Props = {
  provider: ProviderId;
  apiKey: string | null;
  onSave: (key: string | null) => void;
  triggerVariant?: "default" | "compact";
};

const KEY_HELP: Record<ProviderId, { href: string; label: string }> = {
  openai: {
    href: "https://platform.openai.com/api-keys",
    label: "platform.openai.com/api-keys",
  },
  vercel: {
    href: "https://vercel.com/dashboard/ai-gateway/api-keys",
    label: "vercel.com/dashboard/ai-gateway/api-keys",
  },
};

const PLACEHOLDERS: Record<ProviderId, string> = {
  openai: "sk-...",
  vercel: "vck_...",
};

export function ApiKeyDialog({ provider, apiKey, onSave, triggerVariant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(apiKey ?? "");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the apiKey/provider tuple we last synced into local state. When the
  // parent passes a different value (e.g. user switches provider), reset the
  // input. This is the React-recommended "previous value" pattern instead of
  // a useEffect that synchronously mirrors a prop into state.
  const [syncedFor, setSyncedFor] = useState<{ provider: ProviderId; apiKey: string | null }>({
    provider,
    apiKey,
  });
  if (syncedFor.provider !== provider || syncedFor.apiKey !== apiKey) {
    setSyncedFor({ provider, apiKey });
    setValue(apiKey ?? "");
    setError(null);
  }

  const label = providerLabel(provider);
  const prefix = keyPrefixFor(provider);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      onSave(null);
      setOpen(false);
      return;
    }
    if (!isValidKey(provider, trimmed)) {
      setError(`Key must start with ${prefix} and be at least 16 characters.`);
      return;
    }
    onSave(trimmed);
    setError(null);
    setOpen(false);
  };

  const handleClear = () => {
    setValue("");
    onSave(null);
    setError(null);
    setOpen(false);
  };

  const masked = apiKey
    ? `${apiKey.slice(0, Math.min(prefix.length + 3, apiKey.length - 4))}…${apiKey.slice(-4)}`
    : null;

  const help = KEY_HELP[provider];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setValue(apiKey ?? "");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {triggerVariant === "compact" ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#a1a1aa] hover:text-[#fbbf24] border border-[#27272a] hover:border-[#fbbf24]/50 bg-[#18181b] px-3 py-1.5 rounded-full transition-colors"
          >
            <KeyRound className="h-3 w-3" />
            {masked ? <span>{masked}</span> : <span>Set {label} key</span>}
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 border-[#27272a] bg-[#18181b] text-[#fafafa] hover:bg-[#27272a] hover:text-[#fbbf24]"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {masked ? `${label} key: ${masked}` : `Set API key for ${label}`}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#09090b] border-[#27272a] text-[#fafafa] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#fafafa] flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#fbbf24]" /> Bring your own {label} key
          </DialogTitle>
          <DialogDescription className="text-[#a1a1aa] pt-2 space-y-2">
            <span className="block">
              Your key lives only in your browser&apos;s localStorage. It is sent with
              each request as the <span className="font-mono">X-LLM-Key</span> header,
              never persisted on the server, never logged.
            </span>
            <span className="block">
              Get one at{" "}
              <a
                href={help.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#fbbf24] underline-offset-4 hover:underline"
              >
                {help.label}
              </a>
              .
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label className="text-xs uppercase tracking-wider text-[#a1a1aa] font-mono">
            API key
          </label>
          <div className="relative">
            <Input
              type={reveal ? "text" : "password"}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder={PLACEHOLDERS[provider]}
              className="bg-[#18181b] border-[#27272a] text-[#fafafa] font-mono pr-10"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-[#a1a1aa] hover:text-[#fbbf24]"
              aria-label={reveal ? "Hide key" : "Show key"}
            >
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-[#f87171]">{error}</p>}
          <div className="flex items-start gap-2 text-xs text-[#a1a1aa]">
            <ShieldCheck className="h-4 w-4 text-[#fbbf24] mt-0.5 shrink-0" />
            <span>
              The server forwards your key to {label} for the duration of one request and
              throws it away. Inspect the network tab to verify. Code is open-source at
              the repo link in the footer.
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-row sm:justify-between sm:gap-2 gap-2">
          {apiKey && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="text-[#f87171] hover:text-[#fca5a5] hover:bg-[#f87171]/10"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Remove key
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#27272a] bg-transparent hover:bg-[#18181b] text-[#fafafa]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-[#fbbf24] text-[#1c1304] hover:bg-[#f59e0b] font-medium"
            >
              Save key
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
