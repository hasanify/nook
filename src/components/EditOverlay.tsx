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
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStart.current = {
      mouseX: e.screenX,
      mouseY: e.screenY,
      origX: activeBoundsRef.current.x,
      origY: activeBoundsRef.current.y,
    };
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const deltaX = e.screenX - dragStart.current.mouseX;
    const deltaY = e.screenY - dragStart.current.mouseY;
    const nextBounds: Rect = {
      ...activeBoundsRef.current,
      x: dragStart.current.origX + deltaX,
      y: dragStart.current.origY + deltaY,
    };
    scheduleBoundsUpdate(nextBounds);
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const finalBounds = pendingBounds.current ?? activeBoundsRef.current;
    onBoundsChange(finalBounds, true);
  };

  // Handle Resizing
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isResizing.current = true;
    resizeStart.current = {
      mouseX: e.screenX,
      mouseY: e.screenY,
      origW: activeBoundsRef.current.w,
      origH: activeBoundsRef.current.h,
    };
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    const deltaW = e.screenX - resizeStart.current.mouseX;
    const deltaH = e.screenY - resizeStart.current.mouseY;
    const nextW = Math.max(minSize.w, resizeStart.current.origW + deltaW);
    const nextH = Math.max(minSize.h, resizeStart.current.origH + deltaH);

    const nextBounds: Rect = {
      ...activeBoundsRef.current,
      w: nextW,
      h: nextH,
    };
    scheduleBoundsUpdate(nextBounds);
  };

  const handleResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    isResizing.current = false;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const finalBounds = pendingBounds.current ?? activeBoundsRef.current;
    onBoundsChange(finalBounds, true);
  };

  return (
    <>
      {/* Top Header / Drag bar */}
      <div
        className={`flex h-7 items-center justify-between border-b border-line px-3 text-xs select-none ${
          editMode
            ? "cursor-grab bg-accent-500/10 text-accent-500 hover:bg-accent-500/20 active:cursor-grabbing"
            : "bg-surface-raised text-fg-muted"
        }`}
        onPointerDown={editMode ? handleDragStart : undefined}
        onPointerMove={editMode ? handleDragMove : undefined}
        onPointerUp={editMode ? handleDragEnd : undefined}
        onPointerCancel={editMode ? handleDragEnd : undefined}
      >
        <div className="flex items-center gap-1.5 truncate font-medium">
          {headerSlot}
          <span className="truncate">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editMode ? (
            <span className="text-[10px] font-semibold tracking-wide text-accent-500 uppercase">
              Drag to Move
            </span>
          ) : (
            <button
              type="button"
              onClick={onToggleEditMode}
              className="text-[10px] text-fg-muted transition-colors hover:text-fg"
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
          className="absolute right-0 bottom-0 z-50 flex h-5 w-5 cursor-se-resize items-end justify-end p-1 text-[11px] text-accent-500 select-none hover:scale-110"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          title="Drag to resize"
        >
          ◢
        </div>
      )}
    </>
  );
}
