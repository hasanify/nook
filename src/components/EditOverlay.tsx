import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Rect } from "../core/types";

const appWindow = getCurrentWindow();

interface EditOverlayProps {
  id: string;
  title: string;
  editMode: boolean;
  resizable?: boolean;
  minSize?: { w: number; h: number };
  currentBounds: Rect;
  onBoundsChange?: (bounds: Rect, commit: boolean) => void;
  onToggleEditMode: () => void;
  headerSlot?: React.ReactNode;
  headerActions?: React.ReactNode;
  widgetColor?: string | undefined;
}

export function EditOverlay({
  title,
  editMode,
  resizable = true,
  onToggleEditMode,
  headerSlot,
  headerActions,
  widgetColor,
}: EditOverlayProps) {
  // Handle Native Dragging
  const handleDragStart = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
      return;
    }
    e.preventDefault();
    try {
      await appWindow.startDragging();
    } catch {
      // Ignore if native dragging cannot be started
    }
  };

  // Handle Native Resizing
  const handleResizeStart = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      await appWindow.startResizeDragging("SouthEast");
    } catch {
      // Ignore if native resizing cannot be started
    }
  };

  return (
    <>
      {/* Top Header / Drag bar */}
      <div
        data-tauri-drag-region
        style={
          widgetColor
            ? {
                backgroundColor: editMode
                  ? `color-mix(in srgb, ${widgetColor} 25%, var(--surface-raised))`
                  : `color-mix(in srgb, ${widgetColor} 18%, var(--surface-raised))`,
                borderBottomColor: `color-mix(in srgb, ${widgetColor} 35%, var(--line))`,
              }
            : undefined
        }
        className={`flex h-8 touch-none items-center justify-between border-b px-3 text-xs transition-colors select-none ${
          editMode
            ? "cursor-grab border-accent-500/40 bg-accent-500/15 text-accent-500 hover:bg-accent-500/20 active:cursor-grabbing"
            : "cursor-grab border-line/40 bg-surface-raised/40 text-fg-muted hover:bg-surface-raised/60 active:cursor-grabbing"
        }`}
        onPointerDown={handleDragStart}
      >
        <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-1.5 font-medium">
          {headerSlot}
          <span className="truncate text-[11px] font-semibold tracking-tight text-fg/80">
            {title}
          </span>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          {editMode ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-mono text-[9px] font-semibold tracking-wider text-accent-500 uppercase">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="8" cy="8" r="2" />
                  <circle cx="16" cy="8" r="2" />
                  <circle cx="8" cy="16" r="2" />
                  <circle cx="16" cy="16" r="2" />
                </svg>
                Drag
              </span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEditMode();
                }}
                className="rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-500 transition-colors hover:bg-accent-500/30"
              >
                Done
              </button>
            </div>
          ) : (
            headerActions
          )}
        </div>
      </div>

      {/* Resize Grip Corner (Visible when in Edit Mode and Resizable) */}
      {editMode && resizable && (
        <div
          className="absolute right-0 bottom-0 z-50 flex h-7 w-7 cursor-se-resize touch-none items-end justify-end rounded-br-2xl p-1.5 text-accent-500 transition-transform select-none hover:scale-110 active:scale-95"
          onPointerDown={handleResizeStart}
          title="Drag to resize"
        >
          <svg
            className="h-3 w-3 opacity-70 hover:opacity-100"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="10" y1="2" x2="2" y2="10" />
            <line x1="10" y1="6" x2="6" y2="10" />
          </svg>
        </div>
      )}
    </>
  );
}
