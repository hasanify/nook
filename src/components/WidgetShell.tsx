import { useState, useRef, useCallback } from "react";
import { EditOverlay } from "./EditOverlay";
import { WidgetContextMenu } from "./WidgetContextMenu";
import { setBounds, removeWidget, openSettingsWindow, updateSettings } from "../core/ipc";
import { useEditMode } from "../core/use-edit-mode";
import type { WidgetInstance, Rect } from "../core/types";

interface WidgetShellProps {
  instance: WidgetInstance;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  title: string;
  headerSlot?: React.ReactNode;
  headerActions?: React.ReactNode;
  banner?: React.ReactNode;
  resizable?: boolean;
  minSize?: { w: number; h: number };
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
  children,
}: WidgetShellProps) {
  const { editMode: hookEditMode, toggleEditMode: hookToggleEditMode } = useEditMode();
  const effectiveEditMode = propEditMode ?? hookEditMode;
  const effectiveToggle =
    propToggle && propToggle.toString() !== "() => {}" ? propToggle : hookToggleEditMode;

  const [prevInstanceRect, setPrevInstanceRect] = useState(instance.rect);
  const [localBounds, setLocalBounds] = useState<Rect>(instance.rect);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  if (prevInstanceRect !== instance.rect) {
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
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleBoundsChange = (bounds: Rect, commit: boolean) => {
    setLocalBounds(bounds);
    sendBounds(bounds, commit);
  };

  const widgetColor =
    typeof instance.settings.widgetColor === "string" && instance.settings.widgetColor
      ? instance.settings.widgetColor
      : undefined;

  const colorStyle: React.CSSProperties = widgetColor
    ? ({
        "--color-accent-500": widgetColor,
        "--color-accent-400": widgetColor,
        "--color-accent-600": widgetColor,
        "--focus": widgetColor,
        borderColor: effectiveEditMode
          ? widgetColor
          : `color-mix(in srgb, ${widgetColor} 50%, var(--line))`,
        backgroundColor: `color-mix(in srgb, ${widgetColor} 14%, var(--surface))`,
        boxShadow: effectiveEditMode
          ? `0 0 24px -2px color-mix(in srgb, ${widgetColor} 40%, transparent)`
          : undefined,
      } as React.CSSProperties)
    : {};

  return (
    <div
      onContextMenu={handleContextMenu}
      style={colorStyle}
      className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border bg-surface shadow-card transition-all duration-200 select-none before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent ${
        effectiveEditMode
          ? "border-accent-500/80 shadow-glow ring-2 ring-accent-500/25"
          : "border-line/70"
      }`}
    >
      <EditOverlay
        id={instance.id}
        title={title}
        editMode={effectiveEditMode}
        resizable={resizable}
        minSize={minSize}
        currentBounds={localBounds}
        onBoundsChange={handleBoundsChange}
        onToggleEditMode={effectiveToggle}
        headerSlot={headerSlot}
        headerActions={headerActions}
        widgetColor={widgetColor}
      />

      {banner && <div className="px-3 pt-2">{banner}</div>}

      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-b-2xl p-3 pb-3.5 text-sm select-auto">
        {children}
      </div>

      <WidgetContextMenu
        isOpen={Boolean(contextMenuPos)}
        position={contextMenuPos ?? { x: 0, y: 0 }}
        isEditMode={effectiveEditMode}
        currentColor={widgetColor || ""}
        onToggleEditMode={effectiveToggle}
        onSelectColor={(color) => void updateSettings(instance.id, { widgetColor: color })}
        onOpenSettings={() => void openSettingsWindow(instance.id)}
        onDelete={() => void removeWidget(instance.id)}
        onClose={() => setContextMenuPos(null)}
      />
    </div>
  );
}
