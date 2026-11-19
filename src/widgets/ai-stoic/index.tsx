import { useState, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { callAI } from "../../core/ai";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Provide 1 Stoic or mindful insight.
Format exactly:
QUOTE: "<1 sentence quote or principle>" — <Philosopher>
FOCUS: <1 specific behavioral micro-action for today, max 15 words>`;

interface StoicInsight {
  quote: string;
  author: string;
  focus: string;
}

const DEFAULT_SAMPLE: StoicInsight = {
  quote:
    "You have power over your mind - not outside events. Realize this, and you will find strength.",
  author: "Marcus Aurelius",
  focus: "When interrupted today, take one slow breath before responding.",
};

const PROMPT_TOPICS = [
  "Marcus Aurelius on resilience",
  "Epictetus on things in our control",
  "Seneca on the brevity of life",
  "Musonius Rufus on daily discipline",
  "Zeno of Citium on stillness",
  "Marcus Aurelius on morning gratitude",
  "Seneca on overcoming anxiety",
];

function parseStoicOutput(raw: string): StoicInsight {
  const quoteMatch = raw.match(/QUOTE:\s*([\s\S]*?)(?=\nFOCUS:|$)/i);
  const focusMatch = raw.match(/FOCUS:\s*([\s\S]*?)$/i);

  const rawQuote = quoteMatch?.[1]?.trim() || "";
  let quote = rawQuote;
  let author = "Stoic Sage";

  if (rawQuote.includes("—")) {
    const parts = rawQuote.split("—");
    quote = parts[0]?.trim().replace(/^"|"$/g, "") || "";
    author = parts[1]?.trim() || "Marcus Aurelius";
  } else if (rawQuote.includes("-")) {
    const parts = rawQuote.split("-");
    quote = parts[0]?.trim().replace(/^"|"$/g, "") || "";
    author = parts[1]?.trim() || "Marcus Aurelius";
  }

  return {
    quote: quote || DEFAULT_SAMPLE.quote,
    author: author || DEFAULT_SAMPLE.author,
    focus: focusMatch?.[1]?.trim() || DEFAULT_SAMPLE.focus,
  };
}

export function AiStoicWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedInsight = instance.state.insight as StoicInsight | undefined;
  const savedCompleted = Boolean(instance.state.completed);

  const [insight, setInsight] = useState<StoicInsight>(savedInsight || DEFAULT_SAMPLE);
  const [completed, setCompleted] = useState(savedCompleted);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const philosopher =
    typeof instance.settings.philosopher === "string" ? instance.settings.philosopher : undefined;
  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;

  const handleFetch = useCallback(
    async (topic?: string) => {
      setLoading(true);
      setErrorBanner(null);

      const userPrompt =
        topic || philosopher
          ? `Focus: ${topic || philosopher}`
          : (PROMPT_TOPICS[Math.floor(Math.random() * PROMPT_TOPICS.length)] ?? "Stoic resilience");

      try {
        const output = await callAI({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          maxTokens: 60,
          model,
          endpoint,
          apiKey,
        });

        const parsed = parseStoicOutput(output);
        setInsight(parsed);
        setCompleted(false);
        patchState({ insight: parsed, completed: false });
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [philosopher, model, endpoint, apiKey, patchState],
  );

  const handleCopy = () => {
    void navigator.clipboard.writeText(
      `"${insight.quote}" — ${insight.author}\nToday's Focus: ${insight.focus}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleCompleted = () => {
    const next = !completed;
    setCompleted(next);
    patchState({ completed: next });
  };

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
      headerSlot={
        <svg
          className="text-amber-500 h-3 w-3 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      }
      headerActions={
        <button
          type="button"
          onClick={() => void handleFetch()}
          disabled={loading}
          title="New reflection"
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-raised hover:text-fg disabled:opacity-40"
        >
          <svg
            className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
    >
      <div className="flex h-full min-h-0 flex-1 flex-col justify-between gap-2 p-1">
        {/* Quote Section */}
        <div className="flex flex-1 flex-col justify-center gap-1 select-text">
          <p className="font-serif text-xs leading-relaxed text-fg italic">
            {loading ? (
              <span className="font-sans text-fg-muted not-italic">Reflecting…</span>
            ) : (
              `“${insight.quote}”`
            )}
          </p>
          <span className="text-right font-sans text-[11px] font-medium text-fg-muted">
            — {insight.author}
          </span>
        </div>

        {/* Action Chip / Micro Challenge */}
        <div
          onClick={toggleCompleted}
          className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-all ${
            completed
              ? "border-ok/40 bg-ok/10"
              : "border-line bg-surface-raised/40 hover:bg-surface-raised"
          }`}
        >
          <div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-line bg-surface">
            {completed && (
              <svg className="h-2.5 w-2.5 text-ok" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span
              className={`font-mono text-[9px] font-semibold ${completed ? "text-ok line-through" : "text-accent-500"}`}
            >
              TODAY'S MICRO-ACTION
            </span>
            <p
              className={`text-[11px] leading-tight select-text ${completed ? "text-fg-muted line-through" : "text-fg"}`}
            >
              {insight.focus}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[10px] text-fg-muted">
          <span>~15 in / ~40 out tokens</span>
          <button
            type="button"
            onClick={handleCopy}
            className="cursor-pointer text-fg-muted hover:text-fg"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>
    </WidgetShell>
  );
}

const aiStoicModule: WidgetModule = {
  manifest,
  component: AiStoicWidget,
  defaultSettings: {
    model: "gpt-4o-mini",
  },
  defaultState: {
    insight: DEFAULT_SAMPLE,
    completed: false,
  },
};

export default aiStoicModule;
