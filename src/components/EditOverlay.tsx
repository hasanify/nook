import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Rect } from "../core/types";

const appWindow = getCurrentWindow();

interface EditOverlayProps {
  id: string;
  title: string;
  editMode: boolean;
  resizable?: boolean | undefined;
  minSize?: { w: number; h: number } | undefined;
  defaultSize?: { w: number; h: number } | undefined;
  currentBounds: Rect;
  onBoundsChange?: ((bounds: Rect, commit: boolean) => void) | undefined;
  onToggleEditMode: () => void;
  headerSlot?: React.ReactNode | undefined;
  headerActions?: React.ReactNode | undefined;
  widgetColor?: string | undefined;
  onContextMenu?: ((e: React.MouseEvent) => void) | undefined;
  headerClass?: string | undefined;
  onResetToDefault?: (() => void) | undefined;
  onResetToFit?: (() => void) | undefined;
}

export function EditOverlay({
  title,
  editMode,
  resizable = true,
  onToggleEditMode,
  headerSlot,
  headerActions,
  widgetColor,
  onContextMenu,
  headerClass,
  onResetToDefault,
  onResetToFit,
}: EditOverlayProps) {
  // Handle Native Dragging (only when editMode is active)
  const handleDragStart = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
      return;
    }
    try {
      await appWindow.startDragging();
    } catch {
      // Ignore if native dragging cannot be started
    }
  };

  // Handle Native Resizing (only when editMode is active)
  const handleResizeStart = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || e.button !== 0) return;
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
        {...(editMode ? { "data-tauri-drag-region": "" } : {})}
        onContextMenu={onContextMenu}
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
        className={`flex h-8 items-center justify-between border-b px-3 text-xs transition-colors select-none ${
          editMode
            ? "cursor-grab border-accent-500/40 bg-accent-500/15 text-accent-500 hover:bg-accent-500/20 active:cursor-grabbing"
            : `cursor-default text-fg-muted ${headerClass ?? "border-line/40 bg-surface-raised/40"}`
        }`}
        onPointerDown={editMode ? handleDragStart : undefined}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div
          {...(editMode ? { "data-tauri-drag-region": "" } : {})}
          className={`flex min-w-0 flex-1 items-center gap-1.5 font-medium ${
            editMode ? "pointer-events-none" : ""
          }`}
        >
          {headerSlot}
          <span
            {...(editMode ? { "data-tauri-drag-region": "" } : {})}
            className="truncate text-[11px] font-semibold tracking-tight text-fg/80"
          >
            {title}
          </span>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {editMode ? (
            <div className="flex items-center gap-1.5">
              {/* Fit & Default quick resize buttons */}
              {resizable && onResetToFit && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetToFit();
                  }}
                  className="cursor-pointer rounded px-1.5 py-0.5 font-mono text-[9px] font-medium text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
                  title="Fit to minimum compact size"
                >
                  Fit
                </button>
              )}
              {resizable && onResetToDefault && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResetToDefault();
                  }}
                  className="cursor-pointer rounded px-1.5 py-0.5 font-mono text-[9px] font-medium text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
                  title="Reset to default manifest size"
                >
                  Default
                </button>
              )}
              <div className="mx-0.5 h-3 w-px bg-line/60" />
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEditMode();
                }}
                className="cursor-pointer rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-500 transition-colors hover:bg-accent-500/30"
              >
                Done
              </button>
            </div>
          ) : (
            headerActions
          )}
        </div>
      </div>

      {/* Resize Grip Corner (ONLY rendered when in Edit Mode and Resizable) */}
      {editMode && resizable && (
        <div
          className="absolute right-0 bottom-0 z-50 flex h-7 w-7 cursor-se-resize touch-none items-end justify-end rounded-br-2xl p-1.5 text-accent-500 transition-transform select-none hover:scale-110 active:scale-95"
          onPointerDown={handleResizeStart}
          title="Drag to resize"
        >
          <svg
            className="h-3 w-3"
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
