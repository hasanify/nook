import { useState, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { callAI } from "../../core/ai";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Pick 1 expressive word or cultural slang term.
Format exactly:
WORD: <Word> (/phonetic/) [Part of Speech]
DEF: <Concise definition, max 12 words>
USE: "<Sample conversational sentence, max 18 words>"`;

interface VocabItem {
  word: string;
  phonetic: string;
  pos: string;
  def: string;
  use: string;
}

const DEFAULT_SAMPLE: VocabItem = {
  word: "Sonder",
  phonetic: "/ˈsɒn.dər/",
  pos: "noun",
  def: "The realization that each random passerby lives a life as complex as yours.",
  use: "Watching the rush-hour crowd at the station, she was struck by sudden sonder.",
};

const FLAVOR_PROMPTS = [
  "rare evocative literary word",
  "modern cultural slang or vernacular term",
  "poetic untranslatable foreign concept",
  "expressive architectural or aesthetic adjective",
  "clever conversational portmanteau",
];

function parseVocabOutput(raw: string): VocabItem {
  const wordMatch = raw.match(/WORD:\s*([\s\S]*?)(?=\nDEF:|$)/i);
  const defMatch = raw.match(/DEF:\s*([\s\S]*?)(?=\nUSE:|$)/i);
  const useMatch = raw.match(/USE:\s*([\s\S]*?)$/i);

  const rawWordLine = wordMatch?.[1]?.trim() || "Sonder (/ˈsɒn.dər/) [noun]";
  let word = "Sonder";
  let phonetic = "/ˈsɒn.dər/";
  let pos = "noun";

  const pMatch = rawWordLine.match(/\((.*?)\)/);
  if (pMatch) {
    phonetic = pMatch[1]?.trim() ?? "";
  }

  const posMatch = rawWordLine.match(/\[(.*?)\]/);
  if (posMatch) {
    pos = posMatch[1]?.trim() ?? "";
  }

  const cleanWord = rawWordLine
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .trim();
  if (cleanWord) {
    word = cleanWord;
  }

  const cleanUse = (useMatch?.[1]?.trim() || DEFAULT_SAMPLE.use).replace(/^"|"$/g, "");

  return {
    word,
    phonetic: phonetic.startsWith("/") ? phonetic : `/${phonetic}/`,
    pos,
    def: defMatch?.[1]?.trim() || DEFAULT_SAMPLE.def,
    use: cleanUse,
  };
}

export function AiVocabWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedVocab = instance.state.vocab as VocabItem | undefined;

  const [vocab, setVocab] = useState<VocabItem>(savedVocab || DEFAULT_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const flavor = typeof instance.settings.flavor === "string" ? instance.settings.flavor : "all";
  const model = typeof instance.settings.model === "string" ? instance.settings.model : undefined;
  const endpoint =
    typeof instance.settings.endpoint === "string" ? instance.settings.endpoint : undefined;
  const apiKey =
    typeof instance.settings.apiKey === "string" ? instance.settings.apiKey : undefined;

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);

    const userPrompt =
      flavor && flavor !== "all"
        ? `Pick a ${flavor} word`
        : (FLAVOR_PROMPTS[Math.floor(Math.random() * FLAVOR_PROMPTS.length)] ?? "expressive word");

    try {
      const output = await callAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 65,
        model,
        endpoint,
        apiKey,
      });

      const parsed = parseVocabOutput(output);
      setVocab(parsed);
      patchState({ vocab: parsed });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [flavor, model, endpoint, apiKey, patchState]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(
      `${vocab.word} ${vocab.phonetic} [${vocab.pos}]\n• Definition: ${vocab.def}\n• Example: "${vocab.use}"`,
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
      headerSlot={
        <svg
          className="h-3 w-3 shrink-0 text-accent-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      }
      headerActions={
        <button
          type="button"
          onClick={() => void handleFetch()}
          disabled={loading}
          title="Next word"
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
      <div className="flex h-full min-h-0 flex-1 flex-col justify-between gap-1.5 p-1 select-text">
        {/* Word Title & Pronunciation Header */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold tracking-tight text-fg">{vocab.word}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="cursor-pointer text-[10px] text-fg-muted hover:text-fg"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-fg-muted">
            <span className="font-mono text-accent-500">{vocab.phonetic}</span>
            {vocab.pos && (
              <span className="py-0.2 rounded bg-surface-raised px-1.5 font-mono text-[9px] font-medium text-fg-muted">
                {vocab.pos}
              </span>
            )}
          </div>
        </div>

        {/* Definition */}
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <div className="rounded-lg border border-line bg-surface-raised/40 p-2">
            <span className="mb-0.5 block font-mono text-[9px] font-semibold text-fg-muted">
              MEANING
            </span>
            <p className="text-xs leading-relaxed text-fg">
              {loading ? (
                <span className="text-fg-muted italic">Discovering rare word…</span>
              ) : (
                vocab.def
              )}
            </p>
          </div>

          {/* Real World Usage */}
          <div className="rounded-lg border border-line bg-surface-raised/40 p-2">
            <span className="mb-0.5 block font-mono text-[9px] font-semibold text-ok">
              IN CONTEXT
            </span>
            <p className="text-xs leading-relaxed text-fg italic">
              {loading ? <span className="text-fg-muted not-italic">…</span> : `“${vocab.use}”`}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[10px] text-fg-muted">
          <span>~15 in / ~45 out tokens</span>
          <span>Daily lexicon</span>
        </div>
      </div>
    </WidgetShell>
  );
}

const aiVocabModule: WidgetModule = {
  manifest,
  component: AiVocabWidget,
  defaultSettings: {
    flavor: "all",
    model: "gpt-4o-mini",
  },
  defaultState: {
    vocab: DEFAULT_SAMPLE,
  },
};

export default aiVocabModule;
