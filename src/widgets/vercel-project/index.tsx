import { WidgetShell } from "../../components/WidgetShell";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

export function VercelProjectWidget({ instance, editMode }: WidgetProps) {
  const proj =
    typeof instance.settings.projectId === "string" && instance.settings.projectId
      ? instance.settings.projectId
      : "No project configured";

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      onToggleEditMode={() => {}}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="truncate text-xs font-medium text-fg">{proj}</div>
        <div className="text-xs text-fg-muted italic">Configure project in Settings</div>
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: VercelProjectWidget,
  defaultSettings: {
    projectId: "",
  },
  defaultState: {
    lastDeployment: "",
  },
};

export default module;
