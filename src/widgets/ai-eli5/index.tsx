import { useState, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { callAI } from "../../core/ai";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Explain the topic to a 5-year-old using a vivid everyday analogy.
Rules: Exactly 2 sentences. Max 45 words. Plain text only. No preamble.`;

const CURIOSITY_TOPICS = [
  "Quantum Computing",
  "Why the sky is blue",
  "Black holes and event horizons",
  "How airplanes stay in the air",
  "How the internet routes a message across the globe",
  "Photosynthesis and how plants eat sunshine",
  "How our brain stores and recalls memories",
  "DNA and the code of life",
  "Why gravity bends space and time",
  "How rainbows form in the mist",
  "Volcanoes and tectonic plates",
  "Neural networks and Artificial Intelligence",
  "How noise-cancelling headphones work",
  "Why the ocean has tides",
  "How mirrors reflect light",
  "Why stars twinkle at night",
  "How vaccines teach our immune system",
  "How optical fiber carries light under oceans",
  "Why ice floats on water",
  "How GPS satellites know your exact spot",
  "How bats use echolocation in pitch black",
  "Why lightning strikes before thunder is heard",
  "How touchscreens detect your fingertip",
  "How clocks and quartz crystals measure time",
  "Why leaves change color in autumn",
  "How solar panels convert light into electricity",
  "How fireflies glow without getting hot",
  "Why honey never spoils for thousands of years",
  "How whales communicate across entire oceans",
  "What causes the Northern Lights (Aurora)",
  "How CRISPR gene editing works",
  "Why we dream while sleeping",
  "How cryptography keeps passwords secret",
  "How carbon dating reveals the age of ancient fossils",
];

const ANALOGY_STYLES = [
  "Use a playground or amusement park analogy.",
  "Use a bustling kitchen, bakery, or recipe analogy.",
  "Use toy building blocks or LEGO structures as the analogy.",
  "Use a secret detective agency or message courier analogy.",
  "Use a musical symphony or orchestra analogy.",
  "Use an enchanted forest or animal kingdom analogy.",
  "Use a library with magical books as the analogy.",
];

const DEFAULT_SAMPLE = {
  topic: "Quantum Computing",
  explanation:
    "Regular computers think like flipping light switches on or off, one room at a time. A quantum computer has magical switches that can explore all the rooms in the castle at once!",
};

export function AiEli5Widget({ instance, editMode, patchState }: WidgetProps) {
  const savedTopic =
    typeof instance.state.topic === "string" ? instance.state.topic : DEFAULT_SAMPLE.topic;
  const savedExplanation =
    typeof instance.state.explanation === "string"
      ? instance.state.explanation
      : DEFAULT_SAMPLE.explanation;

  const [topic, setTopic] = useState(savedTopic);
  const [explanation, setExplanation] = useState(savedExplanation);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;

  const handleExplain = useCallback(
    async (targetTopic: string) => {
      const cleanTopic = targetTopic.trim();
      if (!cleanTopic) return;

      setLoading(true);
      setErrorBanner(null);

      const recentHistory = Array.isArray(instance.state.history)
        ? (instance.state.history as string[])
        : [];
      const avoidList = [topic, ...recentHistory].filter(Boolean).slice(0, 15).join(", ");
      const randomStyle =
        ANALOGY_STYLES[Math.floor(Math.random() * ANALOGY_STYLES.length)] ??
        "Use a vivid everyday analogy.";

      const userPrompt = `Topic to explain: ${cleanTopic}.
Analogy angle: ${randomStyle}
Do NOT repeat analogies or explanations for: ${avoidList}.
Random variation seed: ${Math.floor(Math.random() * 1000000)}.`;

      try {
        const output = await callAI({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          maxTokens: 85,
          temperature: 0.95,
          model,
          endpoint,
          apiKey,
        });

        setTopic(cleanTopic);
        setExplanation(output);
        const nextHistory = [
          cleanTopic,
          ...recentHistory.filter((t) => t.toLowerCase() !== cleanTopic.toLowerCase()),
        ].slice(0, 20);
        patchState({ topic: cleanTopic, explanation: output, history: nextHistory });
        setShowInput(false);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [model, endpoint, apiKey, topic, instance.state.history, patchState],
  );

  const handleShuffle = () => {
    const candidates = CURIOSITY_TOPICS.filter((t) => t.toLowerCase() !== topic.toLowerCase());
    const next = candidates[Math.floor(Math.random() * candidates.length)] ?? "Solar Panels";
    void handleExplain(next);
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(`ELI5: ${topic}\n${explanation}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={loading}
            title="Random wonder"
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
        </div>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
    >
      <div className="flex h-full min-h-0 flex-1 flex-col justify-between gap-2 p-1">
        {/* Main Card Content */}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-accent-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-500">
              {topic}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex cursor-pointer items-center gap-1 text-[10px] text-fg-muted transition-colors hover:text-fg"
            >
              {copied ? (
                <>
                  <svg
                    className="h-3 w-3 shrink-0 text-ok"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-ok">Copied</span>
                </>
              ) : (
                "Copy"
              )}
            </button>
          </div>

          <p className="text-xs leading-relaxed text-fg select-text">
            {loading ? (
              <span className="text-fg-muted italic">Consulting the wonder mirror…</span>
            ) : (
              explanation
            )}
          </p>
        </div>

        {/* Bottom Bar: Ask custom concept or toggle input */}
        <div className="border-t border-line/40 pt-1.5">
          {showInput ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                autoFocus
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputVal.trim()) {
                    void handleExplain(inputVal.trim());
                  } else if (e.key === "Escape") {
                    setShowInput(false);
                  }
                }}
                placeholder="Type topic & press Enter…"
                className="flex-1 rounded-md border border-line bg-surface-raised/40 px-2 py-1 text-xs text-fg placeholder:text-fg-muted/50 focus:border-accent-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (inputVal.trim()) void handleExplain(inputVal.trim());
                }}
                className="cursor-pointer rounded-md bg-accent-500 px-2 py-1 text-[10px] font-medium text-white"
              >
                Go
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[10px] text-fg-muted">
              <span>2 sentences • max 45 words</span>
              <button
                type="button"
                onClick={() => {
                  setInputVal(topic);
                  setShowInput(true);
                }}
                className="cursor-pointer text-accent-500 hover:underline"
              >
                Ask custom
              </button>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const aiEli5Module: WidgetModule = {
  manifest,
  component: AiEli5Widget,
  defaultSettings: {
    model: "gpt-4o-mini",
  },
  defaultState: {
    topic: DEFAULT_SAMPLE.topic,
    explanation: DEFAULT_SAMPLE.explanation,
  },
};

export default aiEli5Module;
