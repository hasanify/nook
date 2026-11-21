import { ArrowClockwise, Check, Copy } from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { Banner } from "@/components/Banner";
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
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const monthName = d.toLocaleString("en-US", { month: "short" });
  return {
    mmDd: `${mm}-${dd}`,
    display: `${monthName} ${d.getDate()}`,
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
    async (targetDate: string) => {
      setLoading(true);
      setErrorBanner(null);

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
        setErrorBanner(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [model, endpoint, apiKey, historyItem.year, instance.state.history, patchState],
  );

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
          <ArrowClockwise
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
    >
      <div className="flex flex-1 flex-col justify-between gap-2 p-1 min-block-full">
        {/* Header Badges */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-accent-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-accent-500">
              {historyItem.year}
            </span>
            <span className="text-[11px] font-medium text-fg-muted">{currentDate.display}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="
              flex cursor-pointer items-center gap-1 text-[10px] text-fg-muted
              hover:text-fg
            "
          >
            {copied ? (
              <>
                <Check className="shrink-0 text-ok block-3 inline-3" weight="bold" />
                <span className="text-ok">Copied</span>
              </>
            ) : (
              <>
                <Copy className="block-3 inline-3" />
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
            <span className="mbe-0.5 block font-mono text-[9px] font-semibold text-ok">
              MODERN IMPACT
            </span>
            <p className="text-[11px] leading-relaxed text-fg-muted">
              {loading ? <span className="italic">…</span> : historyItem.impact}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-bs border-line/40 pbs-1 text-[10px] text-fg-muted">
          <span>~15 in / ~50 out tokens</span>
          <span className="font-mono">{date}</span>
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
