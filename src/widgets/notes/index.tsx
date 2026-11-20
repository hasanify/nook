import { useState, useRef, useEffect, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;
const MAX_BYTES = 100 * 1024; // 100 KB limit

export function NotesWidget({ instance, editMode, patchState }: WidgetProps) {
  const initialText = typeof instance.state.text === "string" ? instance.state.text : "";
  const [text, setText] = useState(initialText);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fontSize =
    typeof instance.settings.fontSize === "string" ? instance.settings.fontSize : "13";
  const lineWrapping =
    typeof instance.settings.lineWrapping === "boolean" ? instance.settings.lineWrapping : true;

  // Sync if external state changes (e.g. from duplicate)
  useEffect(() => {
    if (
      typeof instance.state.text === "string" &&
      instance.state.text !== text &&
      !saveTimerRef.current
    ) {
      setText(instance.state.text);
    }
  }, [instance.state.text, text]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const byteSize = new Blob([val]).size;

      if (byteSize > MAX_BYTES) {
        setErrorBanner("Character limit reached (100 KB maximum).");
        return;
      }

      setErrorBanner(null);
      setText(val);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        patchState({ text: val });
      }, 500);
    },
    [patchState],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

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
      <div className="flex h-full min-h-0 flex-1 flex-col justify-between">
        <textarea
          value={text}
          onChange={handleTextChange}
          placeholder="Write something…"
          style={{ fontSize: `${fontSize}px` }}
          className={`min-h-0 w-full flex-1 resize-none border-none bg-transparent p-0 leading-relaxed text-fg outline-none select-text placeholder:text-fg-muted/40 ${
            lineWrapping ? "whitespace-pre-wrap" : "overflow-x-auto whitespace-pre"
          }`}
        />
        <div className="mt-auto flex items-center justify-end border-t border-line/20 pt-1 pb-1 font-mono text-[9px] text-fg-muted/50 select-none">
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        </div>
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: NotesWidget,
  defaultSettings: {
    fontSize: "13",
    lineWrapping: true,
  },
  defaultState: {
    text: "",
  },
};

export default module;
