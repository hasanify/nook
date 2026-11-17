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
  const [showSaved, setShowSaved] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setShowSaved(true);

        if (fadeTimerRef.current) {
          clearTimeout(fadeTimerRef.current);
        }
        fadeTimerRef.current = setTimeout(() => {
          setShowSaved(false);
        }, 2000);
      }, 500);
    },
    [patchState],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      onToggleEditMode={() => {}}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      headerSlot={
        <span
          className={`text-[10px] font-medium text-ok transition-opacity duration-300 ${
            showSaved ? "opacity-100" : "opacity-0"
          }`}
        >
          Saved ✓
        </span>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
    >
      <textarea
        value={text}
        onChange={handleTextChange}
        placeholder="Write something…"
        style={{ fontSize: `${fontSize}px` }}
        className={`h-full w-full resize-none border-none bg-transparent p-0 text-fg outline-none select-text placeholder:text-fg-muted ${
          lineWrapping ? "whitespace-pre-wrap" : "overflow-x-auto whitespace-pre"
        }`}
      />
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
