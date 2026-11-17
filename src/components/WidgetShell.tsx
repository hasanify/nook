import { useState } from "react";
import { EditOverlay } from "./EditOverlay";
import { setBounds } from "../core/ipc";
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

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-surface shadow-card transition-all duration-200 select-none before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent ${
        editMode ? "border-accent-500/80 shadow-glow ring-2 ring-accent-500/25" : "border-line/70"
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

      <div className="flex flex-1 flex-col overflow-hidden p-3.5 text-sm select-auto">
        {children}
      </div>
    </div>
  );
}
