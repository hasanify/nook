import { ArrowClockwiseIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import { callAI } from "@/core/ai";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

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
  "Marcus Aurelius on inner citadel and unshakeable resilience",
  "Epictetus on the dichotomy of control (what is up to us vs not)",
  "Seneca on the shortness of life and valuing each hour",
  "Musonius Rufus on training the body and mind through daily discipline",
  "Zeno of Citium on flowing with nature and finding inner stillness",
  "Marcus Aurelius on morning gratitude and dealing with difficult people",
  "Seneca on conquering anxiety and unnecessary future dread",
  "Epictetus on freedom through self-mastery and detachment from reputation",
  "Chrysippus on rational judgment and mastering emotional impulses",
  "Cato the Younger on unwavering integrity and acting without pretense",
  "Seneca on voluntary discomfort to build profound fearlessness",
  "Marcus Aurelius on memento mori: keeping life in deep perspective",
  "Epictetus on transforming obstacles into fuel (amor fati)",
  "Hierocles on expanding circles of empathy to all human beings",
  "Seneca on anger as temporary madness and how to dissolve it instantly",
  "Marcus Aurelius on the view from above: cosmic humility",
  "Cleanthes on gratitude for the natural order and guiding reason",
  "Musonius Rufus on eating simply and practicing mindful restraint",
  "Epictetus on speaking only what is necessary and listening twice as much",
  "Marcus Aurelius on returning to your center after being knocked off balance",
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

      const recentHistory = Array.isArray(instance.state.history)
        ? (instance.state.history as string[])
        : [];
      const avoidList = [insight.quote, ...recentHistory].filter(Boolean).slice(0, 15).join(", ");

      const randomTopic =
        PROMPT_TOPICS[Math.floor(Math.random() * PROMPT_TOPICS.length)] ?? "Stoic resilience";
      const chosenFocus =
        topic || philosopher
          ? `Focus: ${topic || philosopher} (${randomTopic})`
          : `Focus: ${randomTopic}`;

      const userPrompt = `${chosenFocus}.
Rules: Select a striking, memorable quote or lesser-known teaching.
Do NOT quote or repeat: ${avoidList}.
Random variation seed: ${Math.floor(Math.random() * 1000000)}.`;

      try {
        const output = await callAI({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          maxTokens: 80,
          temperature: 0.95,
          model,
          endpoint,
          apiKey,
        });

        const parsed = parseStoicOutput(output);
        setInsight(parsed);
        setCompleted(false);
        const nextHistory = [
          parsed.quote,
          ...recentHistory.filter((q) => q.toLowerCase() !== parsed.quote.toLowerCase()),
        ].slice(0, 20);
        patchState({ insight: parsed, completed: false, history: nextHistory });
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [philosopher, model, endpoint, apiKey, insight.quote, instance.state.history, patchState],
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

      headerActions={
        <button
          type="button"
          onClick={() => void handleFetch()}
          disabled={loading}
          title="New reflection"
          className="
            flex cursor-pointer items-center justify-center rounded-sm
            text-fg-muted block-5 inline-5
            hover:bg-surface-raised hover:text-fg
            disabled:opacity-40
          "
        >
          <ArrowClockwiseIcon
            className={`
            block-3 inline-3
            ${loading ? "animate-spin" : ""}
          `}
          />
        </button>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-between text-2xs text-fg-muted inline-full">
          <span>Daily Stoic Reflection</span>
          <button
            type="button"
            onClick={handleCopy}
            className="
              flex cursor-pointer items-center gap-1 text-fg-muted
              hover:text-fg
            "
          >
            {copied ? (
              <>
                <CheckIcon className="shrink-0 text-ok block-3 inline-3" weight="bold" />
                <span className="text-ok">Copied</span>
              </>
            ) : (
              <>
                <CopyIcon className="block-3 inline-3" />
                <span>CopyIcon</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-2 p-1 min-block-full">
        {/* Quote Section */}
        <div className="flex flex-1 flex-col justify-center gap-1 select-text">
          <p className="font-serif text-xs/relaxed text-fg italic">
            {loading ? (
              <span className="font-sans text-fg-muted not-italic">Reflecting…</span>
            ) : (
              `“${insight.quote}”`
            )}
          </p>
          <span className="text-end font-sans text-sub font-medium text-fg-muted">
            — {insight.author}
          </span>
        </div>

        {/* Action Chip / Micro Challenge */}
        <div
          onClick={toggleCompleted}
          className={`
            flex cursor-pointer items-start gap-2 rounded-lg border p-2
            transition-all
            ${
              completed
                ? "border-ok/40 bg-ok/10"
                : `
                border-line bg-surface-raised/40
                hover:bg-surface-raised
              `
            }
          `}
        >
          <div className="mbs-0.5 flex shrink-0 items-center justify-center rounded-sm border border-line bg-surface block-3.5 inline-3.5">
            {completed && <CheckIcon className="text-ok block-2.5 inline-2.5" weight="bold" />}
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span
              className={`
                font-mono text-3xs font-semibold
                ${completed ? `text-ok line-through` : `text-accent-500`}
              `}
            >
              TODAY'S MICRO-ACTION
            </span>
            <p
              className={`
                text-sub/tight select-text
                ${completed ? `text-fg-muted line-through` : `text-fg`}
              `}
            >
              {insight.focus}
            </p>
          </div>
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
