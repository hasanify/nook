import { WidgetShell } from "../../components/WidgetShell";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

export function GitHubRepoWidget({ instance, editMode }: WidgetProps) {
  const repo =
    typeof instance.settings.repository === "string" && instance.settings.repository
      ? instance.settings.repository
      : "No repo configured";

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
        <div className="truncate text-xs font-medium text-fg">{repo}</div>
        <div className="text-xs text-fg-muted italic">Configure repo in Settings</div>
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: GitHubRepoWidget,
  defaultSettings: {
    repository: "",
    branch: "main",
  },
  defaultState: {
    commitsCount: 0,
  },
};

export default module;
