import { Check, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import { callAI } from "@/core/ai";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Rewrite the input into 3 distinct styles without commentary or pleasantries.
Output format exactly:
[PRO] <polite, professional version (max 25 words)>
[CON] <direct, concise version (max 15 words)>
[WRM] <friendly, warm version (max 25 words)>`;

interface ToneResult {
  pro: string;
  con: string;
  wrm: string;
}

const DEFAULT_SAMPLE: ToneResult = {
  pro: "Could you please provide an update on the document at your earliest convenience?",
  con: "Please send the updated document today.",
  wrm: "Hope your week is going great! Just checking in on the document whenever you have a moment.",
};

function parseToneOutput(raw: string): ToneResult {
  const proMatch = raw.match(/\[PRO\]\s*([\s\S]*?)(?=\[CON\]|\[WRM\]|$)/i);
  const conMatch = raw.match(/\[CON\]\s*([\s\S]*?)(?=\[WRM\]|$)/i);
  const wrmMatch = raw.match(/\[WRM\]\s*([\s\S]*?)$/i);

  return {
    pro: proMatch?.[1]?.trim() || "",
    con: conMatch?.[1]?.trim() || "",
    wrm: wrmMatch?.[1]?.trim() || "",
  };
}

export function AiToneWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedDraft = typeof instance.state.draft === "string" ? instance.state.draft : "";
  const savedResult = instance.state.result as ToneResult | undefined;

  const [draft, setDraft] = useState(savedDraft);
  const [result, setResult] = useState<ToneResult>(savedResult || DEFAULT_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;

  const handleGenerate = useCallback(async () => {
    const textToTransform = draft.trim();
    if (!textToTransform) return;

    setLoading(true);
    setErrorBanner(null);

    try {
      const userPrompt = `Text to rewrite: "${textToTransform}"
Rules: Expressive, idiomatic, and non-generic versions.
Random variation seed: ${Math.floor(Math.random() * 1000000)}.`;

      const output = await callAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 130,
        temperature: 0.85,
        model,
        endpoint,
        apiKey,
      });

      const parsed = parseToneOutput(output);
      setResult(parsed);
      patchState({ draft: textToTransform, result: parsed });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [draft, model, endpoint, apiKey, patchState]);

  const handleCopy = (key: "pro" | "con" | "wrm", text: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
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
      <div className="flex flex-1 flex-col gap-2.5 p-1 min-block-full">
        {/* Input Box */}
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                patchState({ draft: e.target.value });
              }}
              onKeyDown={handleKeyDown}
              placeholder="Paste rough draft… (Enter to polish)"
              rows={2}
              className="
                resize-none rounded-lg border border-line bg-surface-raised/40
                px-2.5 py-1.5 text-xs text-fg inline-full
                placeholder:text-fg-muted/50
                focus:border-accent-500 focus:outline-none
              "
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-fg-muted">Select tone preset</span>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={loading || !draft.trim()}
              className="
                flex cursor-pointer items-center gap-1.5 rounded-md
                bg-accent-500 px-2.5 py-1 text-[11px] font-medium text-white
                transition-opacity
                hover:opacity-90
                disabled:cursor-not-allowed disabled:opacity-40
              "
            >
              {loading ? (
                <>
                  <CircleNotch className="animate-spin block-3 inline-3" />
                  <span>Polishing…</span>
                </>
              ) : (
                <>
                  <Sparkle className="block-3 inline-3" weight="fill" />
                  <span>Polish</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3 Copyable Card Tiles */}
        <div className="flex flex-1 flex-col gap-2">
          {/* Professional Tile */}
          <div
            onClick={() => handleCopy("pro", result.pro)}
            className="
              group relative flex cursor-pointer flex-col gap-1 rounded-lg
              border border-line bg-surface-raised/50 p-2.5 transition-all
              hover:border-accent-500/50 hover:bg-surface-raised
            "
          >
            <div className="flex items-center justify-between">
              <span className="rounded-sm bg-accent-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-accent-500">
                PRO • Professional
              </span>
              <span
                className="
                flex items-center gap-1 text-[10px] text-fg-muted opacity-0
                transition-opacity
                group-hover:opacity-100
              "
              >
                {copiedKey === "pro" ? (
                  <>
                    <Check className="shrink-0 text-ok block-3 inline-3" weight="bold" />
                    <span className="font-medium text-ok">Copied!</span>
                  </>
                ) : (
                  "Click to copy"
                )}
              </span>
            </div>
            <p className="text-xs/relaxed text-fg select-text">
              {result.pro || <span className="text-fg-muted italic">Awaiting prompt…</span>}
            </p>
          </div>

          {/* Concise Tile */}
          <div
            onClick={() => handleCopy("con", result.con)}
            className="
              group relative flex cursor-pointer flex-col gap-1 rounded-lg
              border border-line bg-surface-raised/50 p-2.5 transition-all
              hover:border-accent-500/50 hover:bg-surface-raised
            "
          >
            <div className="flex items-center justify-between">
              <span className="rounded-sm bg-ok/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-ok">
                CON • Concise
              </span>
              <span
                className="
                flex items-center gap-1 text-[10px] text-fg-muted opacity-0
                transition-opacity
                group-hover:opacity-100
              "
              >
                {copiedKey === "con" ? (
                  <>
                    <Check className="shrink-0 text-ok block-3 inline-3" weight="bold" />
                    <span className="font-medium text-ok">Copied!</span>
                  </>
                ) : (
                  "Click to copy"
                )}
              </span>
            </div>
            <p className="text-xs/relaxed text-fg select-text">
              {result.con || <span className="text-fg-muted italic">Awaiting prompt…</span>}
            </p>
          </div>

          {/* Warm Tile */}
          <div
            onClick={() => handleCopy("wrm", result.wrm)}
            className="
              group relative flex cursor-pointer flex-col gap-1 rounded-lg
              border border-line bg-surface-raised/50 p-2.5 transition-all
              hover:border-accent-500/50 hover:bg-surface-raised
            "
          >
            <div className="flex items-center justify-between">
              <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-500">
                WRM • Warm
              </span>
              <span
                className="
                flex items-center gap-1 text-[10px] text-fg-muted opacity-0
                transition-opacity
                group-hover:opacity-100
              "
              >
                {copiedKey === "wrm" ? (
                  <>
                    <Check className="shrink-0 text-ok block-3 inline-3" weight="bold" />
                    <span className="font-medium text-ok">Copied!</span>
                  </>
                ) : (
                  "Click to copy"
                )}
              </span>
            </div>
            <p className="text-xs/relaxed text-fg select-text">
              {result.wrm || <span className="text-fg-muted italic">Awaiting prompt…</span>}
            </p>
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

const aiToneModule: WidgetModule = {
  manifest,
  component: AiToneWidget,
  defaultSettings: {
    model: "gpt-4o-mini",
  },
  defaultState: {
    draft: "",
    result: DEFAULT_SAMPLE,
  },
};

export default aiToneModule;
