import { ArrowClockwise, Check, Copy } from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import { callAI } from "@/core/ai";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

const SYSTEM_PROMPT = `Pick 1 unusual, memorable, and expressive word or cultural slang term.
Rules:
- Be unexpected and diverse. Never pick clichés or overused words (avoid: petrichor, sonder, serendipity, ephemeral, defenestration, mellifluous).
- Provide accurate phonetic transcription.
Format exactly:
WORD: <Word> (/phonetic/) [Part of Speech]
DEF: <Concise definition, max 14 words>
USE: "<Sample conversational sentence, max 20 words>"`;

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

const THEMES_BY_FLAVOR: Record<string, string[]> = {
  literary: [
    "rare evocative English word from classic literature",
    "striking aesthetic, architectural, or sensory adjective",
    "poetic term for light, shadows, weather, or atmosphere",
    "philosophical noun describing nuanced human emotion or time",
    "forgotten maritime, astronomical, or nocturnal term",
    "evocative adjective for voice, sound, or silences",
    "archaic psychological observation or character trait",
    "word for an unexpected everyday sensation or beauty",
  ],
  slang: [
    "clever modern colloquialism or internet vernacular",
    "witty workplace or creative culture slang",
    "contemporary youth culture or subculture term",
    "playful conversational portmanteau or blend word",
    "informal regional English slang with vivid meaning",
    "witty idiom condensed into a punchy term",
  ],
  untranslatable: [
    "poetic Japanese aesthetic concept (nature, impermanence, mindfulness)",
    "German compound noun capturing a very specific dilemma, habit, or feeling",
    "Portuguese or Spanish term of deep emotion, longing, or warmth",
    "Nordic term for comfort, cozy resilience, or connection with nature",
    "Greek or Italian term for passion, craftsmanship, or joie de vivre",
    "indigenous or world language concept with no direct English translation",
    "French or Arabic term capturing an evocative mood or social dynamic",
  ],
  all: [
    "rare evocative literary adjective or noun",
    "subtle psychological phenomenon or obscure emotion",
    "modern cultural slang or witty portmanteau",
    "untranslatable foreign philosophical concept",
    "aesthetic, architectural, or atmospheric descriptor",
    "curious vintage idiom condensed into one word",
    "sensory texture, sound, or natural phenomenon descriptor",
    "clever neologism or forgotten historical gem",
  ],
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

    const themeList = THEMES_BY_FLAVOR[flavor] ?? THEMES_BY_FLAVOR["all"] ?? [];
    const chosenTheme =
      themeList.length > 0
        ? (themeList[Math.floor(Math.random() * themeList.length)] ?? "expressive word")
        : "expressive word";
    const randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];

    const recentHistory = Array.isArray(instance.state.history)
      ? (instance.state.history as string[])
      : [];
    const avoidWords = [
      "sonder",
      "petrichor",
      "serendipity",
      "ephemeral",
      "defenestration",
      "mellifluous",
      vocab.word,
      ...recentHistory,
    ]
      .filter(Boolean)
      .slice(0, 15)
      .join(", ");

    const userPrompt = `Pick a fresh, uncommon word.
Category: ${chosenTheme}.
Letter hint: starting with or containing '${randomLetter}'.
Do NOT pick any of these words: ${avoidWords}.
Random variation seed: ${Math.floor(Math.random() * 1000000)}.`;

    try {
      const output = await callAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 75,
        temperature: 0.95,
        model,
        endpoint,
        apiKey,
      });

      const parsed = parseVocabOutput(output);
      setVocab(parsed);
      const nextHistory = [
        parsed.word,
        ...recentHistory.filter((w) => w.toLowerCase() !== parsed.word.toLowerCase()),
      ].slice(0, 20);
      patchState({ vocab: parsed, history: nextHistory });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [flavor, model, endpoint, apiKey, vocab.word, instance.state.history, patchState]);

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

      headerActions={
        <button
          type="button"
          onClick={() => void handleFetch()}
          disabled={loading}
          title="Next word"
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
      footer={
        <div className="flex items-center justify-between text-[10px] text-fg-muted inline-full">
          <span>Word of the day</span>
          <span>Daily lexicon</span>
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-1.5 p-1 select-text min-block-full">
        {/* Word Title & Pronunciation Header */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold tracking-tight text-fg">{vocab.word}</span>
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
          <div className="flex items-center gap-2 text-[11px] text-fg-muted">
            <span className="font-mono text-accent-500">{vocab.phonetic}</span>
            {vocab.pos && (
              <span className="rounded-sm bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] font-medium text-fg-muted">
                {vocab.pos}
              </span>
            )}
          </div>
        </div>

        {/* Definition */}
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <div className="rounded-lg border border-line bg-surface-raised/40 p-2">
            <span className="mbe-0.5 block font-mono text-[9px] font-semibold text-fg-muted">
              MEANING
            </span>
            <p className="text-xs/relaxed text-fg">
              {loading ? (
                <span className="text-fg-muted italic">Discovering rare word…</span>
              ) : (
                vocab.def
              )}
            </p>
          </div>

          {/* Real World Usage */}
          <div className="rounded-lg border border-line bg-surface-raised/40 p-2">
            <span className="mbe-0.5 block font-mono text-[9px] font-semibold text-ok">
              IN CONTEXT
            </span>
            <p className="text-xs/relaxed text-fg italic">
              {loading ? <span className="text-fg-muted not-italic">…</span> : `“${vocab.use}”`}
            </p>
          </div>
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
    history: [DEFAULT_SAMPLE.word],
  },
};

export default aiVocabModule;
