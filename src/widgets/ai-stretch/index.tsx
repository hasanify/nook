import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetBadge } from "@/components/widget-ui";
import { WidgetShell } from "@/components/WidgetShell";
import { callAI } from "@/core/ai";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Provide 1 discreet 45-second physical stretch or eye exercise for desk workers.
Format exactly:
NAME: <Stretch Name>
HOW: <Step 1 (max 12 words)>. <Step 2 (max 12 words)>.
TIME: <Duration in seconds>`;

interface StretchItem {
  name: string;
  how: string;
  time: number;
}

const DEFAULT_SAMPLE: StretchItem = {
  name: "Seated Neck & Trapezius Release",
  how: "Drop right ear gently to shoulder without hunching. Hold twenty seconds then switch sides smoothly.",
  time: 45,
};

const FOCUS_QUERIES = [
  "neck and upper trapezius tension release",
  "20-20-20 eye strain reset and focal distance stretch",
  "wrist flexor and extensor stretch for keyboard fatigue",
  "seated thoracic spine twist and rib cage expansion",
  "doorway chest opener and shoulder blade squeeze",
  "levator scapulae neck tilt and chin tuck reset",
  "seated piriformis and glute chair stretch",
  "diaphragmatic box breathing and pelvic tilt alignment",
  "seated cat-cow spine wave and postural decompression",
  "forearm prayer stretch with gentle finger extension",
  "palming eye relaxation and warm dark palm rest",
  "ankle alphabet circles and calf pump for circulation",
  "suboccipital skull base self-massage and jaw release",
  "seated hamstring reach and lower back decompression",
  "shoulder clock rotations and collarbone wideners",
];

function parseStretchOutput(raw: string): StretchItem {
  const nameMatch = raw.match(/NAME:\s*([\s\S]*?)(?=\nHOW:|$)/i);
  const howMatch = raw.match(/HOW:\s*([\s\S]*?)(?=\nTIME:|$)/i);
  const timeMatch = raw.match(/TIME:\s*(\d+)/i);

  return {
    name: nameMatch?.[1]?.trim() || DEFAULT_SAMPLE.name,
    how: howMatch?.[1]?.trim() || DEFAULT_SAMPLE.how,
    time: timeMatch ? parseInt(timeMatch[1] ?? "45", 10) : 45,
  };
}

export function AiStretchWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedStretch = instance.state.stretch as StretchItem | undefined;

  const [stretch, setStretch] = useState<StretchItem>(savedStretch || DEFAULT_SAMPLE);
  const [secondsLeft, setSecondsLeft] = useState(stretch.time || 45);
  const [timerRunning, setTimerRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;
  const focusArea =
    typeof instance.settings.focusArea === "string" ? instance.settings.focusArea : "all";

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRunning(false);

    const recentHistory = Array.isArray(instance.state.history)
      ? (instance.state.history as string[])
      : [];
    const avoidList = [stretch.name, ...recentHistory].filter(Boolean).slice(0, 15).join(", ");

    const randomTarget =
      focusArea === "all"
        ? FOCUS_QUERIES[Math.floor(Math.random() * FOCUS_QUERIES.length)]
        : `desk exercise for ${focusArea}`;

    const userPrompt = `Target: ${randomTarget}.
Do NOT repeat stretches like: ${avoidList}.
Random variation seed: ${Math.floor(Math.random() * 1000000)}.`;

    try {
      const output = await callAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 60,
        temperature: 0.9,
        model,
        endpoint,
        apiKey,
      });

      const parsed = parseStretchOutput(output);
      setStretch(parsed);
      setSecondsLeft(parsed.time || 45);
      const nextHistory = [
        parsed.name,
        ...recentHistory.filter((s) => s.toLowerCase() !== parsed.name.toLowerCase()),
      ].slice(0, 20);
      patchState({ stretch: parsed, history: nextHistory });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [focusArea, model, endpoint, apiKey, stretch.name, instance.state.history, patchState]);

  const toggleTimer = () => {
    if (timerRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setTimerRunning(false);
    } else {
      if (secondsLeft <= 0) {
        setSecondsLeft(stretch.time || 45);
      }
      setTimerRunning(true);
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimerRunning(false);
    setSecondsLeft(stretch.time || 45);
  };

  // Split into steps if periods exist
  const steps = stretch.how
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);

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
          title="New stretch"
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
          <span>Desk Wellness</span>
          <span>45-sec micro-break</span>
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-2 p-1 min-block-full">
        {/* Name and Timer Bar */}
        <div className="flex items-center justify-between">
          <WidgetBadge variant="ok">{stretch.name}</WidgetBadge>
          <div className="flex items-center gap-1.5">
            <span
              className={`
                font-mono text-xs font-bold
                ${secondsLeft === 0 ? "text-ok" : "text-fg-muted"}
              `}
            >
              {secondsLeft === 0 ? "DONE!" : `${secondsLeft}s`}
            </span>
            <button
              type="button"
              onClick={toggleTimer}
              className={`
                cursor-pointer rounded-sm px-2 py-0.5 text-2xs font-medium
                text-white transition-colors
                ${
                  timerRunning
                    ? `
                  bg-amber-500
                  hover:bg-amber-600
                `
                    : `
                  bg-ok
                  hover:bg-ok/90
                `
                }
              `}
            >
              {timerRunning ? "Pause" : secondsLeft === 0 ? "Restart" : "Start"}
            </button>
            {secondsLeft < (stretch.time || 45) && (
              <button
                type="button"
                onClick={resetTimer}
                className="
                  cursor-pointer text-2xs text-fg-muted
                  hover:text-fg
                "
              >
                ↺
              </button>
            )}
          </div>
        </div>

        {/* 2 Step Execution */}
        <div className="flex flex-1 flex-col justify-center gap-1.5 select-text">
          {loading ? (
            <p className="text-xs text-fg-muted italic">Consulting wellness coach…</p>
          ) : (
            steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg border border-line bg-surface-raised/40 p-2"
              >
                <span className="flex shrink-0 items-center justify-center rounded-full bg-surface text-3xs font-bold text-accent-500 shadow-2xs block-4 inline-4">
                  {idx + 1}
                </span>
                <p className="text-xs/relaxed text-fg">{step}.</p>
              </div>
            ))
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const aiStretchModule: WidgetModule = {
  manifest,
  component: AiStretchWidget,
  defaultSettings: {
    focusArea: "all",
    model: "gpt-4o-mini",
  },
  defaultState: {
    stretch: DEFAULT_SAMPLE,
  },
};

export default aiStretchModule;
