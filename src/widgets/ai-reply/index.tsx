import { useState, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { callAI } from "../../core/ai";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Generate 3 short contextual replies to the message. No preamble or quotes.
Format exactly:
1. Accept: <enthusiastic agreement, max 15 words>
2. Decline: <polite decline with brief reason, max 15 words>
3. Counter: <alternative proposal, max 15 words>`;

interface ReplyOptions {
  accept: string;
  decline: string;
  counter: string;
}

const DEFAULT_SAMPLE: ReplyOptions = {
  accept: "Sounds great, count me in! Looking forward to it.",
  decline: "Thanks for checking, but I won't be able to make it this time.",
  counter: "Could we reschedule for tomorrow afternoon instead?",
};

function parseReplyOutput(raw: string): ReplyOptions {
  const acceptMatch = raw.match(/1\.\s*Accept:\s*([\s\S]*?)(?=\n2\.|\nDecline:|$)/i);
  const declineMatch = raw.match(/2\.\s*Decline:\s*([\s\S]*?)(?=\n3\.|\nCounter:|$)/i);
  const counterMatch = raw.match(/3\.\s*Counter:\s*([\s\S]*?)$/i);

  return {
    accept: acceptMatch?.[1]?.trim() || "",
    decline: declineMatch?.[1]?.trim() || "",
    counter: counterMatch?.[1]?.trim() || "",
  };
}

export function AiReplyWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedMessage = typeof instance.state.message === "string" ? instance.state.message : "";
  const savedReplies = instance.state.replies as ReplyOptions | undefined;

  const [message, setMessage] = useState(savedMessage);
  const [replies, setReplies] = useState<ReplyOptions>(savedReplies || DEFAULT_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;

  const handleGenerate = useCallback(async () => {
    const text = message.trim();
    if (!text) return;

    setLoading(true);
    setErrorBanner(null);

    try {
      const userPrompt = `Incoming message: "${text}"
Rules: Provide fresh, natural, and distinct options.
Random variation seed: ${Math.floor(Math.random() * 1000000)}.`;

      const output = await callAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 100,
        temperature: 0.85,
        model,
        endpoint,
        apiKey,
      });

      const parsed = parseReplyOutput(output);
      setReplies(parsed);
      patchState({ message: text, replies: parsed });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [message, model, endpoint, apiKey, patchState]);

  const handleCopy = (key: "accept" | "decline" | "counter", text: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleGenerate();
    }
  };

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}

      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
    >
      <div className="flex min-h-full flex-1 flex-col gap-2 p-1">
        {/* Input Field */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              patchState({ message: e.target.value });
            }}
            onKeyDown={handleKeyDown}
            placeholder="Paste incoming message… (Enter)"
            className="flex-1 rounded-lg border border-line bg-surface-raised/40 px-2.5 py-1 text-xs text-fg placeholder:text-fg-muted/50 focus:border-accent-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading || !message.trim()}
            className="cursor-pointer rounded-lg bg-accent-500 px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "…" : "Reply"}
          </button>
        </div>

        {/* 3 Interactive Pills */}
        <div className="flex flex-1 flex-col justify-around gap-1.5">
          {/* Accept Pill */}
          <button
            type="button"
            onClick={() => handleCopy("accept", replies.accept)}
            className="group flex w-full cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface-raised/40 p-2 text-left transition-all hover:border-ok/40 hover:bg-surface-raised"
          >
            <span className="shrink-0 rounded bg-ok/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-ok">
              {copiedKey === "accept" ? "COPIED" : "ACCEPT"}
            </span>
            <span className="flex-1 text-[11px] leading-tight text-fg select-text">
              {replies.accept || <span className="text-fg-muted italic">Waiting for text…</span>}
            </span>
          </button>

          {/* Decline Pill */}
          <button
            type="button"
            onClick={() => handleCopy("decline", replies.decline)}
            className="group flex w-full cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface-raised/40 p-2 text-left transition-all hover:border-error/40 hover:bg-surface-raised"
          >
            <span className="shrink-0 rounded bg-error/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-error">
              {copiedKey === "decline" ? "COPIED" : "DECLINE"}
            </span>
            <span className="flex-1 text-[11px] leading-tight text-fg select-text">
              {replies.decline || <span className="text-fg-muted italic">Waiting for text…</span>}
            </span>
          </button>

          {/* Counter Pill */}
          <button
            type="button"
            onClick={() => handleCopy("counter", replies.counter)}
            className="group flex w-full cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface-raised/40 p-2 text-left transition-all hover:border-accent-500/40 hover:bg-surface-raised"
          >
            <span className="shrink-0 rounded bg-accent-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-accent-500">
              {copiedKey === "counter" ? "COPIED" : "COUNTER"}
            </span>
            <span className="flex-1 text-[11px] leading-tight text-fg select-text">
              {replies.counter || <span className="text-fg-muted italic">Waiting for text…</span>}
            </span>
          </button>
        </div>
      </div>
    </WidgetShell>
  );
}

const aiReplyModule: WidgetModule = {
  manifest,
  component: AiReplyWidget,
  defaultSettings: {
    model: "gpt-4o-mini",
  },
  defaultState: {
    message: "",
    replies: DEFAULT_SAMPLE,
  },
};

export default aiReplyModule;
