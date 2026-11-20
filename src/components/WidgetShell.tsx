import { useState, useRef, useCallback } from "react";
import { EditOverlay } from "./EditOverlay";
import { setBounds, openContextMenu } from "../core/ipc";
import { useEditMode } from "../core/use-edit-mode";
import { useTheme } from "../core/use-theme";
import { getWidgetPreset } from "../core/presets";
import type { WidgetInstance, Rect } from "../core/types";

function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

interface WidgetShellProps {
  instance: WidgetInstance;
  editMode?: boolean | undefined;
  onToggleEditMode?: (() => void) | undefined;
  title: string;
  headerSlot?: React.ReactNode | undefined;
  headerActions?: React.ReactNode | undefined;
  banner?: React.ReactNode | undefined;
  resizable?: boolean | undefined;
  minSize?: { w: number; h: number } | undefined;
  defaultSize?: { w: number; h: number } | undefined;
  children: React.ReactNode;
}

export function WidgetShell({
  instance,
  editMode: propEditMode,
  onToggleEditMode: propToggle,
  title,
  headerSlot,
  headerActions,
  banner,
  resizable = true,
  minSize = { w: 200, h: 160 },
  defaultSize,
  children,
}: WidgetShellProps) {
  const { editMode: hookEditMode, toggleEditMode: hookToggleEditMode } = useEditMode(instance.id);
  const effectiveEditMode = propEditMode ?? hookEditMode;
  const effectiveToggle =
    propToggle && propToggle.toString() !== "() => {}" ? propToggle : hookToggleEditMode;

  const [isInteracting, setIsInteracting] = useState(false);
  const [prevInstanceRect, setPrevInstanceRect] = useState(instance.rect);
  const [localBounds, setLocalBounds] = useState<Rect>(instance.rect);

  if (!isInteracting && !rectsEqual(prevInstanceRect, instance.rect)) {
    setPrevInstanceRect(instance.rect);
    setLocalBounds(instance.rect);
  }

  const inFlightRef = useRef(false);
  const queuedBoundsRef = useRef<{ bounds: Rect; commit: boolean } | null>(null);

  const sendBounds = useCallback(
    (bounds: Rect, commit: boolean) => {
      const prevCommit = queuedBoundsRef.current?.commit ?? false;
      queuedBoundsRef.current = { bounds, commit: commit || prevCommit };
      if (inFlightRef.current) return;

      const flush = async () => {
        while (queuedBoundsRef.current) {
          const next = queuedBoundsRef.current;
          queuedBoundsRef.current = null;
          inFlightRef.current = true;
          try {
            await setBounds(
              instance.id,
              next.bounds.x,
              next.bounds.y,
              next.bounds.w,
              next.bounds.h,
              next.commit,
            );
          } catch {
            // Silently catch IPC errors during bounds updates
          } finally {
            inFlightRef.current = false;
          }
        }
      };

      void flush();
    },
    [instance.id],
  );

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void openContextMenu(instance.id, e.screenX, e.screenY);
  };

  const handleBoundsChange = (bounds: Rect, commit: boolean) => {
    setIsInteracting(!commit);
    if (commit) {
      setLocalBounds(bounds);
      setPrevInstanceRect(bounds);
    }
    sendBounds(bounds, commit);
  };

  const handleResetToDefault = () => {
    if (!defaultSize) return;
    handleBoundsChange({ ...localBounds, w: defaultSize.w, h: defaultSize.h }, true);
  };

  const handleResetToFit = () => {
    const targetW = minSize?.w ?? 200;
    const targetH = minSize?.h ?? 160;
    handleBoundsChange({ ...localBounds, w: targetW, h: targetH }, true);
  };

  const widgetOpacity =
    typeof instance.opacity === "number" ? Math.max(0.1, Math.min(1.0, instance.opacity)) : 0.95;

  const widgetColor =
    typeof instance.settings.widgetColor === "string" && instance.settings.widgetColor
      ? instance.settings.widgetColor
      : undefined;

  const { preset: globalPresetId } = useTheme();
  const preset = getWidgetPreset(globalPresetId);

  const colorStyle: React.CSSProperties = widgetColor
    ? ({
        "--widget-accent": widgetColor,
        "--color-accent-500": widgetColor,
        "--color-accent-400": `color-mix(in srgb, ${widgetColor} 80%, white)`,
        "--color-accent-600": `color-mix(in srgb, ${widgetColor} 80%, black)`,
        "--focus": widgetColor,
        borderColor: effectiveEditMode
          ? widgetColor
          : `color-mix(in srgb, ${widgetColor} 32%, var(--line))`,
        background: `radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, ${widgetColor} 8%, transparent) 0%, transparent 85%), var(--surface)`,
        boxShadow: `0 8px 24px -4px color-mix(in srgb, ${widgetColor} 16%, transparent), 0 2px 6px -1px color-mix(in srgb, ${widgetColor} 8%, transparent)`,
      } as React.CSSProperties)
    : {};

  return (
    <div
      onContextMenu={handleContextMenu}
      style={{
        ...colorStyle,
        opacity: widgetOpacity,
      }}
      className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden transition-[border-color,opacity,box-shadow] duration-150 select-none before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px ${
        widgetColor
          ? ""
          : `before:bg-gradient-to-r before:from-transparent ${preset.highlightClass} before:to-transparent`
      } ${preset.containerClass} ${
        effectiveEditMode ? "!border-accent-500/80 ring-2 ring-accent-500/80 ring-inset" : ""
      }`}
    >
      {widgetColor && (
        <span
          className="pointer-events-none absolute inset-x-6 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${widgetColor} 70%, transparent), transparent)`,
          }}
        />
      )}
      <EditOverlay
        id={instance.id}
        title={title}
        kind={instance.kind}
        editMode={effectiveEditMode}
        resizable={resizable}
        minSize={minSize}
        defaultSize={defaultSize}
        currentBounds={localBounds}
        onBoundsChange={handleBoundsChange}
        onToggleEditMode={effectiveToggle}
        headerSlot={headerSlot}
        headerActions={headerActions}
        widgetColor={widgetColor}
        onContextMenu={handleContextMenu}
        headerClass={preset.headerClass}
        onResetToDefault={defaultSize ? handleResetToDefault : undefined}
        onResetToFit={handleResetToFit}
      />

      {banner && <div className="px-3 pt-2">{banner}</div>}

      <div className="widget-content-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-3.5 pt-2 pb-2.5 text-sm select-auto [&>*]:h-auto [&>*]:min-h-full">
        {children}
      </div>
    </div>
  );
}
