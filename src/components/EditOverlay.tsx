import { useRef, useEffect } from "react";
import type { Rect } from "../core/types";

interface EditOverlayProps {
  id: string;
  title: string;
  editMode: boolean;
  resizable?: boolean;
  minSize?: { w: number; h: number };
  currentBounds: Rect;
  onBoundsChange: (bounds: Rect, commit: boolean) => void;
  onToggleEditMode: () => void;
  headerSlot?: React.ReactNode;
  headerActions?: React.ReactNode;
  widgetColor?: string | undefined;
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
        if (pendingBounds.current) {
          activeBoundsRef.current = pendingBounds.current;
          onBoundsChange(pendingBounds.current, false);
        }
      });
    }
  };

  // Handle Dragging
  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();

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
      window.removeEventListener("mouseup", onPointerUp);
      if (!isDragging.current) return;
      isDragging.current = false;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      const finalBounds = pendingBounds.current ?? activeBoundsRef.current;
      onBoundsChange(finalBounds, true);
    };

    const onPointerUp = () => {
      cleanup();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("mouseup", onPointerUp);
  };

  // Handle Resizing
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

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
      const nextW = Math.max(minSize.w, origW + deltaW);
      const nextH = Math.max(minSize.h, origH + deltaH);

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
      window.removeEventListener("mouseup", onPointerUp);
      if (!isResizing.current) return;
      isResizing.current = false;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      const finalBounds = pendingBounds.current ?? activeBoundsRef.current;
      onBoundsChange(finalBounds, true);
    };

    const onPointerUp = () => {
      cleanup();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("mouseup", onPointerUp);
  };

  return (
    <>
      {/* Top Header / Drag bar */}
      <div
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
            : "border-line/40 bg-surface-raised/40 text-fg-muted"
        }`}
        onPointerDown={editMode ? handleDragStart : undefined}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
          {headerSlot}
          <span className="truncate text-[11px] font-semibold tracking-tight text-fg/80">
            {title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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
          className="absolute right-0 bottom-0 z-50 flex h-6 w-6 cursor-se-resize items-end justify-end p-1.5 text-accent-500 transition-transform select-none hover:scale-110 active:scale-95"
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
