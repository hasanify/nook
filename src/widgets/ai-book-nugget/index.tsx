import { useState, useCallback } from "react";
import { ArrowClockwise, Check, Copy } from "@phosphor-icons/react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { callAI } from "../../core/ai";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Extract 1 actionable idea from the book/topic.
Format exactly:
BOOK: <Title by Author>
CORE: <Key takeaway in 1 sentence, max 20 words>
APPLY: <How to use it today in 1 sentence, max 15 words>`;

interface BookNugget {
  book: string;
  core: string;
  apply: string;
}

const CURATED_BOOKS = [
  "Atomic Habits by James Clear",
  "Thinking, Fast and Slow by Daniel Kahneman",
  "Deep Work by Cal Newport",
  "The Psychology of Money by Morgan Housel",
  "Essentialism by Greg McKeown",
  "Antifragile by Nassim Nicholas Taleb",
  "Zero to One by Peter Thiel",
  "High Output Management by Andy Grove",
  "Principles by Ray Dalio",
  "Man's Search for Meaning by Viktor Frankl",
  "The Courage to Be Disliked by Ichiro Kishimi",
  "Range by David Epstein",
  "Skin in the Game by Nassim Nicholas Taleb",
  "Creativity, Inc. by Ed Catmull",
  "The Almanack of Naval Ravikant by Eric Jorgenson",
  "Show Your Work! by Austin Kleon",
  "Meditations by Marcus Aurelius",
  "The Beginning of Infinity by David Deutsch",
  "Poor Charlie's Almanack by Charlie Munger",
  "Make It Stick by Peter C. Brown",
  "Never Split the Difference by Chris Voss",
  "Four Thousand Weeks by Oliver Burkeman",
  "The War of Art by Steven Pressfield",
  "Drive by Daniel H. Pink",
  "Influence by Robert Cialdini",
  "Flow by Mihaly Csikszentmihalyi",
  "Peak by Anders Ericsson",
  "The Black Swan by Nassim Nicholas Taleb",
  "Guns, Germs, and Steel by Jared Diamond",
  "Sapiens by Yuval Noah Harari",
  "Finite and Infinite Games by James P. Carse",
  "Breath by James Nestor",
  "Algorithms to Live By by Brian Christian",
  "The Daily Stoic by Ryan Holiday",
  "Atomic Focus by Matthew Syed",
  "Mastery by Robert Greene",
];

const NUGGET_ANGLES = [
  "one counter-intuitive rule that challenges conventional wisdom",
  "a subtle psychological habit you can test immediately",
  "a powerful mental model for decision-making under uncertainty",
  "the most profound single lesson in the entire work",
  "a ruthless prioritization tactic for daily focus",
  "an unexpected biological or cognitive truth about performance",
  "a mindset shift for resilience in the face of setbacks",
];

const DEFAULT_SAMPLE: BookNugget = {
  book: "Atomic Habits by James Clear",
  core: "Small 1% daily improvements compound into massive long-term personal and professional transformations.",
  apply: "Anchor one 2-minute micro-habit directly to your existing morning coffee routine.",
};

function parseBookOutput(raw: string): BookNugget {
  const bookMatch = raw.match(/BOOK:\s*([\s\S]*?)(?=\nCORE:|$)/i);
  const coreMatch = raw.match(/CORE:\s*([\s\S]*?)(?=\nAPPLY:|$)/i);
  const applyMatch = raw.match(/APPLY:\s*([\s\S]*?)$/i);

  return {
    book: bookMatch?.[1]?.trim() || "Non-Fiction Framework",
    core: coreMatch?.[1]?.trim() || "",
    apply: applyMatch?.[1]?.trim() || "",
  };
}

export function AiBookNuggetWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedNugget = instance.state.nugget as BookNugget | undefined;

  const [nugget, setNugget] = useState<BookNugget>(savedNugget || DEFAULT_SAMPLE);
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

  const handleFetch = useCallback(
    async (targetBook: string) => {
      const cleanBook = targetBook.trim();
      if (!cleanBook) return;

      setLoading(true);
      setErrorBanner(null);

      const recentHistory = Array.isArray(instance.state.history)
        ? (instance.state.history as string[])
        : [];
      const avoidList = [nugget.book, ...recentHistory].filter(Boolean).slice(0, 15).join(", ");
      const randomAngle =
        NUGGET_ANGLES[Math.floor(Math.random() * NUGGET_ANGLES.length)] ?? "key insight";

      const userPrompt = `Book: ${cleanBook}.
Angle: Highlight ${randomAngle}.
Do NOT repeat takeaways from: ${avoidList}.
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

        const parsed = parseBookOutput(output);
        setNugget(parsed);
        const nextHistory = [
          parsed.book,
          ...recentHistory.filter((b) => b.toLowerCase() !== parsed.book.toLowerCase()),
        ].slice(0, 20);
        patchState({ nugget: parsed, history: nextHistory });
        setShowInput(false);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [model, endpoint, apiKey, nugget.book, instance.state.history, patchState],
  );

  const handleShuffle = () => {
    const candidates = CURATED_BOOKS.filter(
      (b) => !b.toLowerCase().includes(nugget.book.toLowerCase().split(" ")[0] ?? ""),
    );
    const next = candidates[Math.floor(Math.random() * candidates.length)] ?? "Essentialism";
    void handleFetch(next);
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(
      `📖 ${nugget.book}\n• Core: ${nugget.core}\n• Apply: ${nugget.apply}`,
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={loading}
            title="Next book nugget"
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-raised hover:text-fg disabled:opacity-40"
          >
            <ArrowClockwise className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
    >
      <div className="flex min-h-full flex-1 flex-col justify-between gap-2 p-1">
        {/* Book Header Tag */}
        <div className="flex items-center justify-between">
          <span className="truncate rounded-md bg-accent-500/10 px-2 py-0.5 text-[10px] font-medium text-accent-500">
            {nugget.book}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-fg-muted hover:text-fg"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 shrink-0 text-ok" weight="bold" />
                <span className="text-ok">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Content sections */}
        <div className="flex flex-1 flex-col justify-center gap-2 select-text">
          <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface-raised/40 p-2">
            <span className="font-mono text-[9px] font-semibold text-fg-muted">CORE MODEL</span>
            <p className="text-xs leading-relaxed text-fg">
              {loading ? (
                <span className="text-fg-muted italic">Extracting capsule…</span>
              ) : (
                nugget.core
              )}
            </p>
          </div>

          <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-surface-raised/40 p-2">
            <span className="font-mono text-[9px] font-semibold text-ok">HOW TO APPLY TODAY</span>
            <p className="text-xs leading-relaxed text-fg">
              {loading ? <span className="text-fg-muted italic">…</span> : nugget.apply}
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
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
                    void handleFetch(inputVal.trim());
                  } else if (e.key === "Escape") {
                    setShowInput(false);
                  }
                }}
                placeholder="Enter book title or author… (Enter)"
                className="flex-1 rounded-md border border-line bg-surface-raised/40 px-2 py-1 text-xs text-fg placeholder:text-fg-muted/50 focus:border-accent-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (inputVal.trim()) void handleFetch(inputVal.trim());
                }}
                className="cursor-pointer rounded-md bg-accent-500 px-2 py-1 text-[10px] font-medium text-white"
              >
                Go
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[10px] text-fg-muted">
              <span>~20 in / ~45 out tokens</span>
              <button
                type="button"
                onClick={() => {
                  setInputVal("");
                  setShowInput(true);
                }}
                className="cursor-pointer text-accent-500 hover:underline"
              >
                Search book
              </button>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const aiBookNuggetModule: WidgetModule = {
  manifest,
  component: AiBookNuggetWidget,
  defaultSettings: {
    model: "gpt-4o-mini",
  },
  defaultState: {
    nugget: DEFAULT_SAMPLE,
  },
};

export default aiBookNuggetModule;
