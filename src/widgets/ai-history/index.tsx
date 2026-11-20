import { useState, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { callAI } from "../../core/ai";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

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

      try {
        const output = await callAI({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: `Date: ${targetDate}`,
          maxTokens: 75,
          model,
          endpoint,
          apiKey,
        });

        const parsed = parseHistoryOutput(output);
        setHistoryItem(parsed);
        setDate(targetDate);
        patchState({ date: targetDate, historyItem: parsed });
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [model, endpoint, apiKey, patchState],
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
        {/* Header Badges */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-accent-500">
              {historyItem.year}
            </span>
            <span className="text-[11px] font-medium text-fg-muted">{currentDate.display}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex cursor-pointer items-center gap-1 text-[10px] text-fg-muted hover:text-fg"
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

        {/* Event Body */}
        <div className="flex flex-1 flex-col justify-center gap-2 select-text">
          <p className="text-xs leading-relaxed font-medium text-fg">
            {loading ? (
              <span className="text-fg-muted italic">Consulting historical archives…</span>
            ) : (
              historyItem.event
            )}
          </p>

          <div className="rounded-lg border border-line bg-surface-raised/40 p-2">
            <span className="mb-0.5 block font-mono text-[9px] font-semibold text-ok">
              MODERN IMPACT
            </span>
            <p className="text-[11px] leading-relaxed text-fg-muted">
              {loading ? <span className="italic">…</span> : historyItem.impact}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[10px] text-fg-muted">
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
