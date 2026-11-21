import { useCallback, useEffect, useRef, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

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
      footer={
        <div className="flex items-center justify-end font-mono text-3xs text-fg-muted select-none inline-full">
          <span>
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-between min-block-full">
        <textarea
          value={text}
          onChange={handleTextChange}
          placeholder="Write something…"
          style={{ fontSize: `${fontSize}px` }}
          className={`
            flex-1 resize-none border-none bg-transparent p-0 leading-relaxed
            text-fg outline-none select-text inline-full min-block-0
            placeholder:text-fg-muted/40
            ${lineWrapping ? "whitespace-pre-wrap" : `overflow-x-auto whitespace-pre`}
          `}
        />
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
