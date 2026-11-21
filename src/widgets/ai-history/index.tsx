import { ArrowClockwiseIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetBadge } from "@/components/widget-ui";
import { WidgetShell } from "@/components/WidgetShell";
import { callAI } from "@/core/ai";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Given the date {MM-DD}, name 1 major historical event.
Format exactly:
YEAR: <YYYY>
EVENT: <1-sentence description, max 20 words>
IMPACT: <Why it matters today in 1 sentence, max 20 words>`;

interface HistoryEvent {
  year: string;
  event: string;
  impact: string;
}

const DEFAULT_SAMPLE: HistoryEvent = {
  year: "1969",
  event:
    "Apollo 12 astronauts Pete Conrad and Alan Bean achieve humanity's second manned Moon landing.",
  impact:
    "Proved pinpoint automated lunar targeting, laying foundational groundwork for modern GPS and satellite navigation.",
};

const HISTORY_DOMAINS = [
  "an astonishing scientific discovery, invention, or technological breakthrough",
  "a courageous exploration, maritime voyage, or aviation pioneer milestone",
  "a profound artistic, literary, architectural, or musical masterpiece debut",
  "an unexpected unsung hero or grassroots social movement triumph",
  "an ancient, classical, or medieval turning point that shaped world civilization",
  "a curious cultural phenomenon, codebreaking achievement, or medical milestone",
  "a pivotal philosophical treaty, peace accord, or diplomatic revolution",
];

function getFormattedDate(d = new Date()): { mmDd: string; display: string } {
  return {
    mmDd: format(d, "MM-dd"),
    display: format(d, "MMM d"),
  };
}

function parseHistoryOutput(raw: string): HistoryEvent {
  const yearMatch = raw.match(/YEAR:\s*([\s\S]*?)(?=\nEVENT:|$)/i);
  const eventMatch = raw.match(/EVENT:\s*([\s\S]*?)(?=\nIMPACT:|$)/i);
  const impactMatch = raw.match(/IMPACT:\s*([\s\S]*?)$/i);

  return {
    year: yearMatch?.[1]?.trim() || "1969",
    event: eventMatch?.[1]?.trim() || "",
    impact: impactMatch?.[1]?.trim() || "",
  };
}

export function AiHistoryWidget({ instance, editMode, patchState }: WidgetProps) {
  const currentDate = getFormattedDate();
  const savedDate =
    typeof instance.state.date === "string" ? instance.state.date : currentDate.mmDd;
  const savedItem = instance.state.historyItem as HistoryEvent | undefined;

  const [date, setDate] = useState(savedDate);
  const [historyItem, setHistoryItem] = useState<HistoryEvent>(savedItem || DEFAULT_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;

  const handleFetch = useCallback(
    async (targetDate: string, quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setErrorBanner(null);
      }

      const recentHistory = Array.isArray(instance.state.history)
        ? (instance.state.history as string[])
        : [];
      const avoidYears = [historyItem.year, ...recentHistory]
        .filter(Boolean)
        .slice(0, 15)
        .join(", ");
      const randomDomain =
        HISTORY_DOMAINS[Math.floor(Math.random() * HISTORY_DOMAINS.length)] ??
        "historical milestone";

      const userPrompt = `Date: ${targetDate}.
Theme focus: Pick ${randomDomain}.
Do NOT pick events from these years or previously used events: ${avoidYears}.
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

        const parsed = parseHistoryOutput(output);
        setHistoryItem(parsed);
        setDate(targetDate);
        const nextHistory = [parsed.year, ...recentHistory.filter((y) => y !== parsed.year)].slice(
          0,
          20,
        );
        patchState({ date: targetDate, historyItem: parsed, history: nextHistory });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!quiet || !msg.includes("No AI API key found")) {
          setErrorBanner(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    [model, endpoint, apiKey, historyItem.year, instance.state.history, patchState],
  );

  useEffect(() => {
    let active = true;
    const loadDaily = async () => {
      await Promise.resolve();
      if (!active) return;
      const todayMmDd = getFormattedDate().mmDd;
      if (!instance.state.historyItem || instance.state.date !== todayMmDd) {
        void handleFetch(todayMmDd, true);
      }
    };
    void loadDaily();

    const timer = setInterval(() => {
      const nextDate = getFormattedDate().mmDd;
      if (nextDate !== date) {
        void handleFetch(nextDate, true);
      }
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [instance.state.historyItem, instance.state.date, date, handleFetch]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(
      `📅 In ${historyItem.year} (${currentDate.display}):\n${historyItem.event}\nModern Impact: ${historyItem.impact}`,
    );
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
        <button
          type="button"
          onClick={() => void handleFetch(date)}
          disabled={loading}
          title="Refresh history event"
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
          <span>Today in History</span>
          <span className="font-mono">{date}</span>
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-2 p-1 min-block-full">
        {/* Header Badges */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WidgetBadge variant="accent">{historyItem.year}</WidgetBadge>
            <span className="text-sub font-medium text-fg-muted">{currentDate.display}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="
              flex cursor-pointer items-center gap-1 text-2xs text-fg-muted
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
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Event Body */}
        <div className="flex flex-1 flex-col justify-center gap-2 select-text">
          <p className="text-xs/relaxed font-medium text-fg">
            {loading ? (
              <span className="text-fg-muted italic">Consulting historical archives…</span>
            ) : (
              historyItem.event
            )}
          </p>

          <div className="rounded-lg border border-line bg-surface-raised/40 p-2">
            <span className="mbe-0.5 block font-mono text-3xs font-semibold text-ok">
              MODERN IMPACT
            </span>
            <p className="text-sub/relaxed text-fg-muted">
              {loading ? <span className="italic">…</span> : historyItem.impact}
            </p>
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

const aiHistoryModule: WidgetModule = {
  manifest,
  component: AiHistoryWidget,
  defaultSettings: {
    model: "gpt-4o-mini",
  },
  defaultState: {
    date: getFormattedDate().mmDd,
    historyItem: DEFAULT_SAMPLE,
  },
};

export default aiHistoryModule;
