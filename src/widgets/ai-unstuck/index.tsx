import { useState, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { callAI } from "../../core/ai";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Break the task into 4 micro-steps to overcome inertia. Each step must take under 5 minutes.
Format exactly:
1. [2m] <step, max 8 words>
2. [3m] <step, max 8 words>
3. [5m] <step, max 8 words>
4. [5m] <step, max 8 words>`;

interface MicroStep {
  id: number;
  time: string;
  text: string;
  done: boolean;
}

const DEFAULT_SAMPLE_STEPS: MicroStep[] = [
  { id: 1, time: "2m", text: "Open document and write section headings", done: false },
  { id: 2, time: "3m", text: "Jot down 3 biggest milestones hit", done: false },
  { id: 3, time: "5m", text: "Write 2 sentences for the first milestone", done: false },
  { id: 4, time: "5m", text: "List key metrics and next quarter goals", done: false },
];

function parseStepsOutput(raw: string): MicroStep[] {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const steps: MicroStep[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    const match = line.match(/^\d+\.\s*\[(.*?)\]\s*(.*)$/);
    if (match) {
      steps.push({
        id: i + 1,
        time: match[1]?.trim() || "3m",
        text: match[2]?.trim() || line,
        done: false,
      });
    } else if (line) {
      steps.push({
        id: i + 1,
        time: "3m",
        text: line.replace(/^\d+\.\s*/, ""),
        done: false,
      });
    }
  }

  return steps.length >= 2 ? steps.slice(0, 4) : DEFAULT_SAMPLE_STEPS;
}

export function AiUnstuckWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedTask =
    typeof instance.state.task === "string"
      ? instance.state.task
      : "Quarterly project review document";
  const savedSteps = instance.state.steps as MicroStep[] | undefined;

  const [task, setTask] = useState(savedTask);
  const [steps, setSteps] = useState<MicroStep[]>(savedSteps || DEFAULT_SAMPLE_STEPS);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;

  const handleBreakTask = useCallback(async () => {
    const cleanTask = task.trim();
    if (!cleanTask) return;

    setLoading(true);
    setErrorBanner(null);

    try {
      const userPrompt = `Task: ${cleanTask}
Angle: Break into hyper-concrete, ridiculously low-friction initial movements to shatter psychological inertia.
Random variation seed: ${Math.floor(Math.random() * 1000000)}.`;

      const output = await callAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 85,
        temperature: 0.85,
        model,
        endpoint,
        apiKey,
      });

      const parsed = parseStepsOutput(output);
      setSteps(parsed);
      patchState({ task: cleanTask, steps: parsed });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [task, model, endpoint, apiKey, patchState]);

  const toggleStep = (id: number) => {
    const updated = steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    setSteps(updated);
    patchState({ steps: updated });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleBreakTask();
    }
  };

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

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
      <div className="flex min-h-full flex-1 flex-col justify-between gap-2 p-1">
        {/* Input Row */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={task}
            onChange={(e) => {
              setTask(e.target.value);
              patchState({ task: e.target.value });
            }}
            onKeyDown={handleKeyDown}
            placeholder="What task are you dreading? (Enter)"
            className="flex-1 rounded-lg border border-line bg-surface-raised/40 px-2.5 py-1 text-xs text-fg placeholder:text-fg-muted/50 focus:border-accent-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleBreakTask()}
            disabled={loading || !task.trim()}
            className="cursor-pointer rounded-lg bg-accent-500 px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "…" : "Break"}
          </button>
        </div>

        {/* 4 Micro Steps Checklist */}
        <div className="flex flex-1 flex-col justify-around gap-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-fg-muted italic">
              Breaking down inertia…
            </div>
          ) : (
            steps.map((step) => (
              <div
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 transition-all select-none ${
                  step.done
                    ? "border-ok/30 bg-ok/5"
                    : "border-line bg-surface-raised/40 hover:bg-surface-raised"
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    step.done
                      ? "border-ok bg-ok text-white"
                      : "border-line bg-surface hover:border-accent-500"
                  }`}
                >
                  {step.done && (
                    <svg className="h-3 w-3 stroke-current" viewBox="0 0 24 24" fill="none">
                      <polyline
                        points="20 6 9 17 4 12"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                {/* Minute badge */}
                <span
                  className={`py-0.2 shrink-0 rounded px-1 font-mono text-[9px] font-bold ${
                    step.done ? "bg-ok/10 text-ok" : "bg-accent-500/10 text-accent-500"
                  }`}
                >
                  {step.time}
                </span>

                {/* Step text */}
                <span
                  className={`flex-1 text-[11px] leading-tight select-text ${
                    step.done ? "text-fg-muted line-through" : "font-medium text-fg"
                  }`}
                >
                  {step.text}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Progress Bar & Footer */}
        <div className="flex flex-col gap-1 border-t border-line/40 pt-1.5">
          <div className="flex items-center justify-between text-[10px] text-fg-muted">
            <span>
              {completedCount} of {steps.length} steps completed
            </span>
            <span className="font-mono font-semibold">{progressPercent}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full bg-ok transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

const aiUnstuckModule: WidgetModule = {
  manifest,
  component: AiUnstuckWidget,
  defaultSettings: {
    model: "gpt-4o-mini",
  },
  defaultState: {
    task: "Quarterly project review document",
    steps: DEFAULT_SAMPLE_STEPS,
  },
};

export default aiUnstuckModule;
