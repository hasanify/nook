import {
  BookmarkSimpleIcon,
  CodeIcon,
  FolderIcon,
  GlobeIcon,
  PlusIcon,
  RocketLaunchIcon,
  StarIcon,
  TerminalWindowIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { type FormEvent, useMemo, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

export interface ShortcutItem {
  id: string;
  label: string;
  target: string;
  icon?: string;
}

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: "1", label: "GitHub", target: "https://github.com", icon: "code" },
  { id: "2", label: "Google", target: "https://google.com", icon: "globe" },
  { id: "3", label: "Terminal", target: "wt.exe", icon: "terminal" },
  { id: "4", label: "Localhost", target: "http://localhost:3000", icon: "rocket" },
];

function renderShortcutIcon(iconName?: string) {
  const cls = "block-4 inline-4 shrink-0";
  switch (iconName) {
    case "folder":
      return <FolderIcon className={cls} />;
    case "terminal":
      return <TerminalWindowIcon className={cls} />;
    case "code":
      return <CodeIcon className={cls} />;
    case "rocket":
      return <RocketLaunchIcon className={cls} />;
    case "star":
      return <StarIcon className={cls} />;
    case "bookmark":
      return <BookmarkSimpleIcon className={cls} />;
    case "globe":
    default:
      return <GlobeIcon className={cls} />;
  }
}

export function ShortcutsWidget({ instance, editMode, patchState }: WidgetProps) {
  const rawShortcuts = instance.state.items;
  const shortcuts: ShortcutItem[] = useMemo(() => {
    if (Array.isArray(rawShortcuts)) {
      return rawShortcuts as ShortcutItem[];
    }
    return DEFAULT_SHORTCUTS;
  }, [rawShortcuts]);

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newIcon, setNewIcon] = useState("globe");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const columns = (instance.settings.columns as string) || "2";
  const showLabels = instance.settings.showLabels !== false;

  const gridColsClass = useMemo(() => {
    switch (columns) {
      case "3":
        return "grid-cols-3";
      case "4":
        return "grid-cols-4";
      case "2":
      default:
        return "grid-cols-2";
    }
  }, [columns]);

  const handleLaunch = async (target: string) => {
    setErrorBanner(null);
    try {
      const trimmed = target.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        await openUrl(trimmed);
      } else {
        try {
          await openPath(trimmed);
        } catch {
          await openUrl(trimmed);
        }
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to open shortcut target");
    }
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newTarget.trim()) return;

    const newItem: ShortcutItem = {
      id: Date.now().toString(),
      label: newLabel.trim(),
      target: newTarget.trim(),
      icon: newIcon,
    };

    const next = [...shortcuts, newItem];
    patchState({ items: next });
    setNewLabel("");
    setNewTarget("");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const next = shortcuts.filter((s) => s.id !== id);
    patchState({ items: next });
  };

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      headerActions={
        <button
          type="button"
          onClick={() => setIsAdding((prev) => !prev)}
          className="
            flex cursor-pointer items-center justify-center rounded-md
            text-fg-muted transition-colors block-5 inline-5
            hover:bg-surface-raised hover:text-fg
          "
          title={isAdding ? "Cancel" : "Add shortcut"}
        >
          <PlusIcon
            className={`transition-transform block-3 inline-3 ${isAdding ? "rotate-45" : ""}`}
            weight="bold"
          />
        </button>
      }
    >
      <div className="flex flex-col gap-2 p-1 text-xs block-full inline-full">
        {errorBanner && (
          <Banner
            message={errorBanner}
            type="warn"
            actionText="Dismiss"
            onAction={() => setErrorBanner(null)}
          />
        )}

        {isAdding && (
          <form
            onSubmit={handleAddSubmit}
            className="flex flex-col gap-1.5 rounded-lg border border-line/60 bg-surface-raised/80 p-2 shadow-xs"
          >
            <input
              type="text"
              placeholder="Label (e.g. GitHub)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="
                rounded-sm border border-line bg-surface px-2 py-1 text-2xs text-fg
                outline-none placeholder:text-fg-muted/60
                focus:border-accent-500
              "
              autoFocus
            />
            <input
              type="text"
              placeholder="Target URL or Path (e.g. https://github.com)"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="
                rounded-sm border border-line bg-surface px-2 py-1 text-2xs text-fg
                outline-none placeholder:text-fg-muted/60
                focus:border-accent-500
              "
            />
            <div className="flex items-center justify-between gap-1 pbs-1">
              <div className="flex items-center gap-1">
                {(["globe", "code", "terminal", "folder", "rocket", "star"] as const).map(
                  (iconKey) => (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setNewIcon(iconKey)}
                      className={`
                        flex cursor-pointer items-center justify-center rounded-sm p-1 transition-colors block-5 inline-5
                        ${
                          newIcon === iconKey
                            ? "bg-accent-500 text-white"
                            : "bg-surface text-fg-muted hover:bg-surface-raised hover:text-fg"
                        }
                      `}
                    >
                      {renderShortcutIcon(iconKey)}
                    </button>
                  ),
                )}
              </div>
              <button
                type="submit"
                disabled={!newLabel.trim() || !newTarget.trim()}
                className="
                  cursor-pointer rounded-sm bg-accent-500 px-2 py-0.5 text-2xs
                  font-medium text-white transition-opacity
                  hover:opacity-90 disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                Save
              </button>
            </div>
          </form>
        )}

        <div className={`grid ${gridColsClass} gap-1.5 overflow-y-auto block-full`}>
          {shortcuts.map((sc) => (
            <div
              key={sc.id}
              className="
                group relative flex cursor-pointer items-center gap-2 rounded-lg
                border border-line/60 bg-surface-raised/40 p-2 text-start
                transition-all
                hover:border-accent-500/40 hover:bg-surface-raised
              "
              onClick={() => void handleLaunch(sc.target)}
              title={sc.target}
            >
              <div className="flex shrink-0 items-center justify-center rounded-md bg-surface p-1.5 text-accent-500 shadow-xs block-7 inline-7">
                {renderShortcutIcon(sc.icon)}
              </div>

              {showLabels && (
                <div className="flex flex-1 flex-col min-inline-0">
                  <span className="truncate font-medium text-fg">{sc.label}</span>
                  <span className="truncate font-mono text-3xs text-fg-muted/70">{sc.target}</span>
                </div>
              )}

              {editMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(sc.id);
                  }}
                  className="
                    absolute inset-e-1 inset-bs-1 flex cursor-pointer items-center
                    justify-center rounded-sm p-0.5 text-fg-muted opacity-0
                    transition-opacity block-4 inline-4
                    group-hover:opacity-100
                    hover:bg-error/20 hover:text-error
                  "
                  title="Delete shortcut"
                >
                  <TrashIcon className="block-3 inline-3" />
                </button>
              )}
            </div>
          ))}

          {shortcuts.length === 0 && !isAdding && (
            <div className="col-span-full flex flex-col items-center justify-center p-4 text-center text-fg-muted">
              <span className="text-2xs">No shortcuts pinned yet</span>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="
                  cursor-pointer pbs-1 text-2xs font-medium text-accent-500
                  hover:underline
                "
              >
                Add your first shortcut
              </button>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const shortcutsModule: WidgetModule = {
  manifest,
  component: ShortcutsWidget,
  defaultSettings: {
    columns: "2",
    showLabels: true,
  },
  defaultState: {
    items: DEFAULT_SHORTCUTS,
  },
};

export default shortcutsModule;
