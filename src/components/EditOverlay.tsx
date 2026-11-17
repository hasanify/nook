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
}: EditOverlayProps) {
  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, origX: 0, origY: 0 });

  const isResizing = useRef(false);
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, origW: 0, origH: 0 });

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
    dragStart.current = {
      mouseX: e.screenX,
      mouseY: e.screenY,
      origX: activeBoundsRef.current.x,
      origY: activeBoundsRef.current.y,
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDragging.current) return;
      if (ev.buttons === 0) {
        onPointerUp();
        return;
      }
      const deltaX = ev.screenX - dragStart.current.mouseX;
      const deltaY = ev.screenY - dragStart.current.mouseY;
      const nextBounds: Rect = {
        ...activeBoundsRef.current,
        x: dragStart.current.origX + deltaX,
        y: dragStart.current.origY + deltaY,
      };
      scheduleBoundsUpdate(nextBounds);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (!isDragging.current) return;
      isDragging.current = false;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      const finalBounds = pendingBounds.current ?? activeBoundsRef.current;
      onBoundsChange(finalBounds, true);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Handle Resizing
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeStart.current = {
      mouseX: e.screenX,
      mouseY: e.screenY,
      origW: activeBoundsRef.current.w,
      origH: activeBoundsRef.current.h,
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!isResizing.current) return;
      if (ev.buttons === 0) {
        onPointerUp();
        return;
      }
      const deltaW = ev.screenX - resizeStart.current.mouseX;
      const deltaH = ev.screenY - resizeStart.current.mouseY;
      const nextW = Math.max(minSize.w, resizeStart.current.origW + deltaW);
      const nextH = Math.max(minSize.h, resizeStart.current.origH + deltaH);

      const nextBounds: Rect = {
        ...activeBoundsRef.current,
        w: nextW,
        h: nextH,
      };
      scheduleBoundsUpdate(nextBounds);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (!isResizing.current) return;
      isResizing.current = false;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      const finalBounds = pendingBounds.current ?? activeBoundsRef.current;
      onBoundsChange(finalBounds, true);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <>
      {/* Top Header / Drag bar */}
      <div
        className={`flex h-8 items-center justify-between border-b px-3 text-xs transition-colors select-none ${
          editMode
            ? "cursor-grab border-accent-500/40 bg-accent-500/15 text-accent-500 hover:bg-accent-500/20 active:cursor-grabbing"
            : "border-line/40 bg-surface-raised/40 text-fg-muted"
        }`}
        onPointerDown={editMode ? handleDragStart : undefined}
      >
        <div className="flex items-center gap-1.5 truncate font-medium">
          {headerSlot}
          <span className="truncate text-[11px] font-semibold tracking-tight text-fg/80">
            {title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
                onClick={onToggleEditMode}
                className="rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-500 transition-colors hover:bg-accent-500/30"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleEditMode}
              className="rounded px-1.5 py-0.5 text-[10px] text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
              title="Toggle Edit Mode (Ctrl+Alt+E)"
            >
              Edit
            </button>
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
