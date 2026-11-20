import { useState, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { callAI } from "../../core/ai";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Generate 1 self-reflective question for an evening or morning micro-journal.
Rules: Under 15 words. Open-ended. Focuses on gratitude, progress, or clarity.`;

const DEFAULT_SAMPLE_PROMPT = "What is one small win today that you haven't celebrated yet?";

const JOURNAL_THEMES = [
  "uncovering an unexpressed gratitude or small hidden beauty",
  "identifying mental clutter to release before tonight",
  "celebrating a quiet victory or micro-progress nobody noticed",
  "finding genuine clarity on a decision currently causing hesitation",
  "noticing who energized or supported you recently and why",
  "exploring an assumption you held today that might not be true",
  "giving yourself permission to slow down or forgive a misstep",
  "imagining the most peaceful version of tomorrow morning",
  "reflecting on what energized your curious mind the most today",
  "grounding yourself in physical sensations and simple presence",
];

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AiJournalPromptWidget({ instance, editMode, patchState }: WidgetProps) {
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  const savedPrompt =
    typeof instance.state.prompt === "string" ? instance.state.prompt : DEFAULT_SAMPLE_PROMPT;
  const savedAnswer =
    typeof instance.state.lastAnswer === "string" ? instance.state.lastAnswer : "";
  const savedDate =
    typeof instance.state.lastAnswerDate === "string" ? instance.state.lastAnswerDate : "";
  const savedStreak = typeof instance.state.streak === "number" ? instance.state.streak : 0;

  const [prompt, setPrompt] = useState(savedPrompt);
  const [answerInput, setAnswerInput] = useState("");
  const [lastAnswer, setLastAnswer] = useState(savedAnswer);
  const [lastDate, setLastDate] = useState(savedDate);
  const [streak, setStreak] = useState(savedStreak);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const isAnsweredToday = lastDate === todayKey && Boolean(lastAnswer);

  const focus = typeof instance.settings.focus === "string" ? instance.settings.focus : "any";
  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;

  const handleFetchPrompt = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);

    const recentHistory = Array.isArray(instance.state.history)
      ? (instance.state.history as string[])
      : [];
    const avoidList = [prompt, ...recentHistory].filter(Boolean).slice(0, 15).join(", ");
    const randomTheme =
      JOURNAL_THEMES[Math.floor(Math.random() * JOURNAL_THEMES.length)] ??
      "daily progress or gratitude";

    const chosenTheme = focus && focus !== "any" ? `${focus} (${randomTheme})` : randomTheme;

    const userPrompt = `Theme: ${chosenTheme}.
Make the question deeply insightful, novel, and concise.
Do NOT use clichés or ask questions similar to: ${avoidList}.
Random variation seed: ${Math.floor(Math.random() * 1000000)}.`;

    try {
      const output = await callAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 50,
        temperature: 0.95,
        model,
        endpoint,
        apiKey,
      });

      const clean = output.trim().replace(/^["'\d.\s]+|["'\s]+$/g, "");
      setPrompt(clean);
      const nextHistory = [
        clean,
        ...recentHistory.filter((p) => p.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 20);
      patchState({ prompt: clean, history: nextHistory });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [focus, model, endpoint, apiKey, prompt, instance.state.history, patchState]);

  const handleLogAnswer = (textToLog: string) => {
    const clean = textToLog.trim();
    if (!clean) return;

    let newStreak = streak;
    if (lastDate === todayKey) {
      // already answered today, keep streak
    } else if (lastDate === yesterdayKey) {
      newStreak = streak + 1;
    } else {
      newStreak = 1;
    }

    setLastAnswer(clean);
    setLastDate(todayKey);
    setStreak(newStreak);
    setIsEditing(false);
    setAnswerInput("");

    patchState({
      lastAnswer: clean,
      lastAnswerDate: todayKey,
      streak: newStreak,
    });
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
        <div className="flex items-center gap-1.5">
          {/* Streak Flame Badge */}
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              streak > 0 ? "bg-amber-500/15 text-amber-500" : "bg-surface-raised text-fg-muted"
            }`}
            title={`${streak} day streak`}
          >
            <span>🔥</span>
            <span>{streak}</span>
          </div>

          <button
            type="button"
            onClick={() => void handleFetchPrompt()}
            disabled={loading}
            title="New prompt"
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
        {/* Daily Question */}
        <div className="flex flex-1 flex-col justify-center gap-1 select-text">
          <span className="font-mono text-[9px] font-semibold text-accent-500">
            TODAY&apos;S REFLECTION
          </span>
          <p className="text-xs leading-relaxed font-medium text-fg">
            {loading ? (
              <span className="text-fg-muted italic">Crafting reflection question…</span>
            ) : (
              prompt
            )}
          </p>
        </div>

        {/* Answer section */}
        <div className="border-t border-line/40 pt-2">
          {isAnsweredToday && !isEditing ? (
            <div className="flex flex-col gap-1 rounded-lg border border-ok/30 bg-ok/5 p-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1 font-semibold text-ok">
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-ok"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Logged today</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAnswerInput(lastAnswer);
                    setIsEditing(true);
                  }}
                  className="cursor-pointer text-fg-muted hover:text-fg"
                >
                  Edit
                </button>
              </div>
              <p className="text-xs leading-relaxed text-fg italic select-text">
                &ldquo;{lastAnswer}&rdquo;
              </p>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && answerInput.trim()) {
                    handleLogAnswer(answerInput);
                  }
                }}
                placeholder="1-sentence reflection… (Enter)"
                className="flex-1 rounded-lg border border-line bg-surface-raised/40 px-2.5 py-1 text-xs text-fg placeholder:text-fg-muted/50 focus:border-accent-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleLogAnswer(answerInput)}
                disabled={!answerInput.trim()}
                className="cursor-pointer rounded-lg bg-accent-500 px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Log
              </button>
            </div>
          )}
        </div>

        {/* Token Budget Note */}
        <div className="flex items-center justify-between text-[10px] text-fg-muted">
          <span>~15 in / ~20 out tokens</span>
          <span>1 sentence micro-log</span>
        </div>
      </div>
    </WidgetShell>
  );
}

const aiJournalPromptModule: WidgetModule = {
  manifest,
  component: AiJournalPromptWidget,
  defaultSettings: {
    focus: "any",
    model: "gpt-4o-mini",
  },
  defaultState: {
    prompt: DEFAULT_SAMPLE_PROMPT,
    lastAnswer: "",
    lastAnswerDate: "",
    streak: 0,
  },
};

export default aiJournalPromptModule;
