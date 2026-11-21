import { ArrowClockwiseIcon, CheckIcon, FlameIcon } from "@phosphor-icons/react";
import { format, subDays } from "date-fns";
import { useCallback, useEffect, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import { callAI } from "@/core/ai";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

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
  return format(new Date(), "yyyy-MM-dd");
}

function getYesterdayKey(): string {
  return format(subDays(new Date(), 1), "yyyy-MM-dd");
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

  const handleFetchPrompt = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setErrorBanner(null);
      }

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
        patchState({ prompt: clean, history: nextHistory, lastPromptDate: todayKey });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!quiet || !msg.includes("No AI API key found")) {
          setErrorBanner(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [focus, model, endpoint, apiKey, prompt, instance.state.history, patchState, todayKey],
  );

  useEffect(() => {
    let active = true;
    const loadDaily = async () => {
      await Promise.resolve();
      if (!active) return;
      if (!instance.state.prompt || instance.state.lastPromptDate !== todayKey) {
        void handleFetchPrompt(true);
      }
    };
    void loadDaily();

    const timer = setInterval(() => {
      const currentKey = getTodayKey();
      if (instance.state.lastPromptDate && instance.state.lastPromptDate !== currentKey) {
        void handleFetchPrompt(true);
      }
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [instance.state.prompt, instance.state.lastPromptDate, handleFetchPrompt, todayKey]);

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
          {/* Streak FlameIcon Badge */}
          <div
            className={`
              flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs
              font-bold
              ${streak > 0 ? "bg-amber-500/15 text-amber-500" : `bg-surface-raised text-fg-muted`}
            `}
            title={`${streak} day streak`}
          >
            <FlameIcon className="text-amber-500 block-3 inline-3" weight="fill" />
            <span>{streak}</span>
          </div>

          <button
            type="button"
            onClick={() => void handleFetchPrompt()}
            disabled={loading}
            title="New prompt"
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
        </div>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-between text-2xs text-fg-muted inline-full">
          <span>Daily Reflection</span>
          <span>1 sentence micro-log</span>
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-2 p-1 min-block-full">
        {/* Daily Question */}
        <div className="flex flex-1 flex-col justify-center gap-1 select-text">
          <span className="font-mono text-3xs font-semibold text-accent-500">
            TODAY&apos;S REFLECTION
          </span>
          <p className="text-xs/relaxed font-medium text-fg">
            {loading ? (
              <span className="text-fg-muted italic">Crafting reflection question…</span>
            ) : (
              prompt
            )}
          </p>
        </div>

        {/* Answer section */}
        <div className="border-bs border-line/40 pbs-2">
          {isAnsweredToday && !isEditing ? (
            <div className="flex flex-col gap-1 rounded-lg border border-ok/30 bg-ok/5 p-2">
              <div className="flex items-center justify-between text-2xs">
                <span className="flex items-center gap-1 font-semibold text-ok">
                  <CheckIcon className="shrink-0 text-ok block-3.5 inline-3.5" weight="bold" />
                  <span>Logged today</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAnswerInput(lastAnswer);
                    setIsEditing(true);
                  }}
                  className="
                    cursor-pointer text-fg-muted
                    hover:text-fg
                  "
                >
                  Edit
                </button>
              </div>
              <p className="text-xs/relaxed text-fg italic select-text">
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
                className="
                  flex-1 rounded-lg border border-line bg-surface-raised/40
                  px-2.5 py-1 text-xs text-fg
                  placeholder:text-fg-muted/50
                  focus:border-accent-500 focus:outline-none
                "
              />
              <button
                type="button"
                onClick={() => handleLogAnswer(answerInput)}
                disabled={!answerInput.trim()}
                className="
                  cursor-pointer rounded-lg bg-accent-500 px-2.5 py-1
                  text-sub font-medium text-white transition-opacity
                  hover:opacity-90
                  disabled:cursor-not-allowed disabled:opacity-40
                "
              >
                Log
              </button>
            </div>
          )}
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
