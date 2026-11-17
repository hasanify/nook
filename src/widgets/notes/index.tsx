import { WidgetShell } from "../../components/WidgetShell";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

export function NotesWidget({ instance, editMode, patchState }: WidgetProps) {
  const text = typeof instance.state.text === "string" ? instance.state.text : "";
  const fontSize =
    typeof instance.settings.fontSize === "string" ? instance.settings.fontSize : "13";
  const lineWrapping =
    typeof instance.settings.lineWrapping === "boolean" ? instance.settings.lineWrapping : true;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    patchState({ text: e.target.value });
  };

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      onToggleEditMode={() => {}}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
    >
      <textarea
        value={text}
        onChange={handleTextChange}
        placeholder="Type a note..."
        style={{ fontSize: `${fontSize}px` }}
        className={`h-full w-full resize-none bg-transparent text-fg outline-none select-text placeholder:text-fg-muted ${
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
