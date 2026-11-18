import { useRef, useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Rect } from "../core/types";

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
  minSize = { w: 200, h: 160 },
  currentBounds,
  onBoundsChange,
  onToggleEditMode,
  headerSlot,
  headerActions,
  widgetColor,
  onContextMenu,
  headerClass,
  onResetToDefault,
  onResetToFit,
}: EditOverlayProps) {
  const isDragging = useRef(false);
  const isResizing = useRef(false);

  const activeBoundsRef = useRef<Rect>(currentBounds);
  const rafId = useRef<number | null>(null);
  const pendingBounds = useRef<Rect | null>(null);

  useEffect(() => {
    activeBoundsRef.current = currentBounds;
  }, [currentBounds]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const scheduleBoundsUpdate = (bounds: Rect) => {
    pendingBounds.current = bounds;
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        if (pendingBounds.current && onBoundsChange) {
          activeBoundsRef.current = pendingBounds.current;
          onBoundsChange(pendingBounds.current, false);
        }
      });
    }
  };

  // Handle Dragging
  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
      return;
    }

    try {
      const appWindow = getCurrentWebviewWindow();
      void appWindow.startDragging();
      return;
    } catch {
      // Fallback to manual dragging if native startDragging is unavailable
    }

    const currentTarget = e.currentTarget;
    try {
      currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    isDragging.current = true;
    const startX = e.screenX;
    const startY = e.screenY;
    const origX = activeBoundsRef.current.x;
    const origY = activeBoundsRef.current.y;
    const origW = activeBoundsRef.current.w;
    const origH = activeBoundsRef.current.h;

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDragging.current) return;
      if (ev.buttons === 0) {
        cleanup();
        return;
      }
      const deltaX = ev.screenX - startX;
      const deltaY = ev.screenY - startY;
      const nextBounds: Rect = {
        x: origX + deltaX,
        y: origY + deltaY,
        w: origW,
        h: origH,
      };
      scheduleBoundsUpdate(nextBounds);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      try {
        if (currentTarget.hasPointerCapture(e.pointerId)) {
          currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}

      if (!isDragging.current) return;
      isDragging.current = false;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      const finalBounds = pendingBounds.current ?? activeBoundsRef.current;
      onBoundsChange?.(finalBounds, true);
    };

    const onPointerUp = () => {
      cleanup();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("mouseup", onPointerUp);
  };

  // Handle Resizing
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    isResizing.current = true;
    const startX = e.screenX;
    const startY = e.screenY;
    const origX = activeBoundsRef.current.x;
    const origY = activeBoundsRef.current.y;
    const origW = activeBoundsRef.current.w;
    const origH = activeBoundsRef.current.h;

    const onPointerMove = (ev: PointerEvent) => {
      if (!isResizing.current) return;
      if (ev.buttons === 0) {
        cleanup();
        return;
      }
      const deltaW = ev.screenX - startX;
      const deltaH = ev.screenY - startY;
      const minW = minSize?.w ?? 200;
      const minH = minSize?.h ?? 160;
      const nextW = Math.max(minW, origW + deltaW);
      const nextH = Math.max(minH, origH + deltaH);

      const nextBounds: Rect = {
        x: origX,
        y: origY,
        w: nextW,
        h: nextH,
      };
      scheduleBoundsUpdate(nextBounds);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      try {
        if (target.hasPointerCapture(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
        }
      } catch {}

      if (!isResizing.current) return;
      isResizing.current = false;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      const finalBounds = pendingBounds.current ?? activeBoundsRef.current;
      onBoundsChange?.(finalBounds, true);
    };

    const onPointerUp = () => {
      cleanup();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("mouseup", onPointerUp);
  };

  return (
    <>
      {/* Top Header / Drag bar */}
      <div
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
        className={`flex h-8 touch-none items-center justify-between rounded-t-[inherit] border-b px-3 text-xs transition-colors select-none ${
          editMode
            ? "cursor-grab border-accent-500/40 bg-accent-500/15 text-accent-500 hover:bg-accent-500/20 active:cursor-grabbing"
            : `cursor-default text-fg-muted ${headerClass ?? "border-line/40 bg-surface-raised/40"}`
        }`}
        onPointerDown={editMode ? handleDragStart : undefined}
      >
        <div
          className={`flex min-w-0 flex-1 items-center gap-1.5 font-medium ${
            editMode ? "pointer-events-none" : ""
          }`}
        >
          {headerSlot}
          <span className="truncate text-[11px] font-semibold tracking-tight text-fg/80">
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
          className="absolute right-0 bottom-0 z-50 flex h-7 w-7 cursor-se-resize touch-none items-end justify-end rounded-br-[inherit] p-1.5 text-accent-500 transition-transform select-none hover:scale-110 active:scale-95"
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
