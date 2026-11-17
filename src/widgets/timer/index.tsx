import { WidgetShell } from "../../components/WidgetShell";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

export function TimerWidget({ instance, editMode }: WidgetProps) {
  const mode = typeof instance.settings.mode === "string" ? instance.settings.mode : "pomodoro";

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      onToggleEditMode={() => {}}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <div className="font-mono text-3xl font-bold tracking-wider text-fg">25:00</div>
        <div className="text-xs tracking-wider text-fg-muted uppercase">{mode} mode</div>
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: TimerWidget,
  defaultSettings: {
    mode: "pomodoro",
    soundNotification: true,
  },
  defaultState: {
    secondsLeft: 25 * 60,
    isRunning: false,
  },
};

export default module;
