import { useState, useRef, useEffect } from "react";
import { Check, DotsSixVertical } from "@phosphor-icons/react";
import { useInstance } from "../core/use-instance";
import { useEditMode } from "../core/use-edit-mode";
import {
  setBounds,
  verifyDesktopPin,
  setOpacity,
  setAlwaysOnTop,
  removeWidget,
  openSettingsWindow,
} from "../core/ipc";
import { WidgetContextMenu } from "./WidgetContextMenu";
import type { Rect } from "../core/types";

interface TestWidgetProps {
  id: string;
}

const DEFAULT_BOUNDS: Rect = { x: 160, y: 120, w: 340, h: 320 };

export function TestWidget({ id }: TestWidgetProps) {
  const { instance, loading, error, patchState } = useInstance(id);
  const { editMode, toggleEditMode } = useEditMode();

  const [activeBounds, setActiveBounds] = useState<Rect | null>(null);
  const [typedText, setTypedText] = useState<string | null>(null);
  const [isAttached, setIsAttached] = useState<boolean | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const displayedBounds = activeBounds ?? instance?.rect ?? DEFAULT_BOUNDS;
  const currentBoundsRef = useRef<Rect>(displayedBounds);

  useEffect(() => {
    currentBoundsRef.current = displayedBounds;
  }, [displayedBounds]);

  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const pendingBounds = useRef<Rect | null>(null);

  const inFlightRef = useRef(false);
  const queuedBoundsRef = useRef<{ bounds: Rect; commit: boolean } | null>(null);

  const sendBounds = (bounds: Rect, commit: boolean) => {
    queuedBoundsRef.current = { bounds, commit };
    if (inFlightRef.current) return;

    const flush = async () => {
      while (queuedBoundsRef.current) {
        const next = queuedBoundsRef.current;
        queuedBoundsRef.current = null;
        inFlightRef.current = true;
        try {
          await setBounds(
            id,
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
  };

  const scheduleBoundsUpdate = (bounds: Rect, commit = false) => {
    pendingBounds.current = bounds;
    currentBoundsRef.current = bounds;
    setActiveBounds(bounds);
    sendBounds(bounds, commit);
  };

  useEffect(() => {
    let isMounted = true;
    verifyDesktopPin(id)
      .then((verified) => {
        if (isMounted) setIsAttached(verified);
      })
      .catch(() => {
        if (isMounted) setIsAttached(false);
      });

    const timer = setInterval(() => {
      verifyDesktopPin(id)
        .then((verified) => {
          if (isMounted) setIsAttached(verified);
        })
        .catch(() => {
          if (isMounted) setIsAttached(false);
        });
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [id]);

  // Handle Dragging
  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();

    isDragging.current = true;
    const startX = e.screenX;
    const startY = e.screenY;
    const origX = currentBoundsRef.current.x;
    const origY = currentBoundsRef.current.y;
    const origW = currentBoundsRef.current.w;
    const origH = currentBoundsRef.current.h;

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDragging.current) return;
      if (ev.buttons === 0) {
        cleanup();
        return;
      }
      const deltaX = ev.screenX - startX;
      const deltaY = ev.screenY - startY;
      scheduleBoundsUpdate({
        x: origX + deltaX,
        y: origY + deltaY,
        w: origW,
        h: origH,
      });
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      if (!isDragging.current) return;
      isDragging.current = false;
      const final = pendingBounds.current ?? currentBoundsRef.current;
      scheduleBoundsUpdate(final, true);
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
    const origX = currentBoundsRef.current.x;
    const origY = currentBoundsRef.current.y;
    const origW = currentBoundsRef.current.w;
    const origH = currentBoundsRef.current.h;

    const onPointerMove = (ev: PointerEvent) => {
      if (!isResizing.current) return;
      if (ev.buttons === 0) {
        cleanup();
        return;
      }
      const deltaW = ev.screenX - startX;
      const deltaH = ev.screenY - startY;
      const nextW = Math.max(260, origW + deltaW);
      const nextH = Math.max(200, origH + deltaH);

      scheduleBoundsUpdate({
        x: origX,
        y: origY,
        w: nextW,
        h: nextH,
      });
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      if (!isResizing.current) return;
      isResizing.current = false;
      const final = pendingBounds.current ?? currentBoundsRef.current;
      scheduleBoundsUpdate(final, true);
    };

    const onPointerUp = () => {
      cleanup();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("mouseup", onPointerUp);
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-card border border-line bg-surface p-4 text-xs text-fg-muted">
        Loading widget...
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-card border border-error bg-surface p-4 text-xs text-error">
        Error: {error || "Instance not found"}
      </div>
    );
  }

  const clicks = typeof instance.state?.clicks === "number" ? instance.state.clicks : 0;
  const currentText =
    typedText !== null
      ? typedText
      : typeof instance.state?.text === "string"
        ? instance.state.text
        : "";

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-card border bg-surface shadow-card transition-shadow select-none ${
        editMode ? "border-accent-500 ring-2 ring-accent-500/30" : "border-line"
      }`}
    >
      {/* Drag Bar (Active in Edit Mode, or Header in normal mode) */}
      <div
        className={`flex h-7 items-center justify-between border-b border-line px-3 text-xs ${
          editMode
            ? "cursor-grab bg-accent-500/10 text-accent-500 hover:bg-accent-500/20 active:cursor-grabbing"
            : "bg-surface-raised text-fg-muted"
        }`}
        onPointerDown={editMode ? handleDragStart : undefined}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <span
            className={`inline-block h-2 w-2 rounded-full ${isAttached ? "bg-ok" : "bg-warn"}`}
          />
          <span className="truncate">
            {instance.kind} ({instance.id.slice(0, 8)})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <span className="text-[10px] font-semibold tracking-wide text-accent-500 uppercase">
              Drag to Move
            </span>
          ) : null}
        </div>
      </div>

      {/* Main Content & Interactive Gate Verification */}
      <div className="flex flex-1 flex-col gap-3 p-3 text-sm">
        {/* Input Validation (The Critical Test) */}
        <div>
          <label
            htmlFor="focus-test-input"
            className="mb-1 block text-xs font-medium text-fg-muted"
          >
            Keyboard Focus Gate:
          </label>
          <input
            id="focus-test-input"
            type="text"
            className="w-full rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs text-fg outline-none select-text placeholder:text-fg-muted focus:ring-1 focus:ring-focus"
            placeholder="Click here and type to test focus..."
            value={currentText}
            onChange={(e) => {
              const val = e.target.value;
              setTypedText(val);
              patchState({ text: val });
            }}
          />
        </div>

        {/* Mouse Click Counter with persistent state */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-600 active:scale-95"
            onClick={() => {
              patchState({ clicks: clicks + 1 });
            }}
          >
            Clicks: {clicks} (Saved)
          </button>
          <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
            {isAttached ? (
              <>
                <span>Attached to Host</span>
                <Check className="h-3 w-3 text-ok" weight="bold" />
              </>
            ) : (
              "Top-level"
            )}
          </span>
        </div>

        {/* Bounds & Edit Controls */}
        <div className="border-t border-line pt-2 text-[11px] text-fg-muted">
          <div className="flex justify-between">
            <span>
              Pos: {displayedBounds.x}, {displayedBounds.y}
            </span>
            <span>
              Size: {displayedBounds.w} × {displayedBounds.h}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {(() => {
              const isAlwaysOnTop = Boolean(instance.alwaysOnTop ?? instance.always_on_top);
              return (
                <button
                  type="button"
                  className={`rounded border px-2 py-0.5 text-[10px] font-medium ${
                    isAlwaysOnTop
                      ? "border-accent-500 bg-accent-500/10 text-accent-500"
                      : "border-line bg-surface-raised text-fg-muted hover:text-fg"
                  }`}
                  onClick={() => void setAlwaysOnTop(id, !isAlwaysOnTop)}
                >
                  {isAlwaysOnTop ? "Always on top: ON" : "Always on top: OFF"}
                </button>
              );
            })()}
            <button
              type="button"
              className="rounded border border-line bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-fg-muted hover:text-fg"
              onClick={() => {
                const nextOp = instance.opacity < 0.9 ? 0.95 : 0.6;
                void setOpacity(id, nextOp);
              }}
            >
              Opacity: {Math.round(instance.opacity * 100)}%
            </button>
          </div>
        </div>
      </div>

      {/* Resize Grip Corner (Only in Edit Mode) */}
      {editMode && (
        <div
          className="absolute right-0 bottom-0 flex h-5 w-5 cursor-se-resize items-end justify-end p-1 text-[11px] text-accent-500 hover:scale-110"
          onPointerDown={handleResizeStart}
        >
          <DotsSixVertical className="h-3 w-3" />
        </div>
      )}

      <WidgetContextMenu
        isOpen={Boolean(contextMenuPos)}
        position={contextMenuPos ?? { x: 0, y: 0 }}
        isEditMode={editMode}
        onToggleEditMode={toggleEditMode}
        onOpenSettings={() => void openSettingsWindow(id)}
        onDelete={() => void removeWidget(id)}
        onClose={() => setContextMenuPos(null)}
      />
    </div>
  );
}
