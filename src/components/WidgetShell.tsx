import { useState, useRef, useEffect } from "react";
import { EditOverlay } from "./EditOverlay";
import { setBounds, setAlwaysOnTop, duplicateWidget, removeWidget } from "../core/ipc";
import { invoke } from "@tauri-apps/api/core";
import type { WidgetInstance, Rect } from "../core/types";

interface WidgetShellProps {
  instance: WidgetInstance;
  editMode: boolean;
  onToggleEditMode: () => void;
  title: string;
  headerSlot?: React.ReactNode;
  banner?: React.ReactNode;
  resizable?: boolean;
  minSize?: { w: number; h: number };
  children: React.ReactNode;
}

export function WidgetShell({
  instance,
  editMode,
  onToggleEditMode,
  title,
  headerSlot,
  banner,
  resizable = true,
  minSize = { w: 200, h: 160 },
  children,
}: WidgetShellProps) {
  const [activeBounds, setActiveBounds] = useState<Rect | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayedBounds = activeBounds ?? instance.rect;

  const handleBoundsChange = (bounds: Rect, commit: boolean) => {
    if (commit) {
      setActiveBounds(null);
      void setBounds(instance.id, bounds.x, bounds.y, bounds.w, bounds.h, true);
    } else {
      setActiveBounds(bounds);
      void setBounds(instance.id, bounds.x, bounds.y, bounds.w, bounds.h, false);
    }
  };

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Position menu within card boundaries
    const cardWidth = displayedBounds.w;
    const cardHeight = displayedBounds.h;
    const menuWidth = 160;
    const menuHeight = 140;

    const x = Math.min(e.clientX, cardWidth - menuWidth - 8);
    const y = Math.min(e.clientY, cardHeight - menuHeight - 8);

    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y) });
  };

  const handleOpenSettings = () => {
    setContextMenu(null);
    void invoke("open_settings_window", { widgetId: instance.id }).catch(() => {
      // Fallback if command not available
    });
  };

  const handleToggleAlwaysOnTop = () => {
    setContextMenu(null);
    void setAlwaysOnTop(instance.id, !instance.always_on_top);
  };

  const handleDuplicate = () => {
    setContextMenu(null);
    void duplicateWidget(instance.id);
  };

  const handleRemove = () => {
    setContextMenu(null);
    void removeWidget(instance.id);
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-card border bg-surface shadow-card transition-shadow select-none ${
        editMode ? "border-accent-500 ring-2 ring-accent-500/30" : "border-line"
      }`}
    >
      <EditOverlay
        id={instance.id}
        title={title}
        editMode={editMode}
        resizable={resizable}
        minSize={minSize}
        currentBounds={displayedBounds}
        onBoundsChange={handleBoundsChange}
        onToggleEditMode={onToggleEditMode}
        headerSlot={headerSlot}
      />

      {banner && <div className="px-3 pt-2">{banner}</div>}

      <div className="flex flex-1 flex-col overflow-hidden p-3 text-sm select-auto">{children}</div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="animate-in fade-in zoom-in-95 absolute z-50 min-w-36 rounded-md border border-line bg-surface-raised p-1 text-xs text-fg shadow-lg duration-100 select-none"
        >
          <button
            type="button"
            onClick={handleToggleAlwaysOnTop}
            className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-fg hover:bg-surface"
          >
            <span>Always on top</span>
            {instance.always_on_top && <span className="font-bold text-accent-500">✓</span>}
          </button>
          <button
            type="button"
            onClick={handleOpenSettings}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-fg hover:bg-surface"
          >
            Settings...
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            onClick={handleDuplicate}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-fg hover:bg-surface"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="text-error hover:bg-error/10 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
