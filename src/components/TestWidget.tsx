import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function TestWidget() {
  const [clickCount, setClickCount] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [currentStrategy, setCurrentStrategy] = useState("AboveIcons");
  const [isAttached, setIsAttached] = useState<boolean | null>(null);
  const [bounds, setBounds] = useState({ x: 160, y: 120, w: 340, h: 320 });

  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, origX: 0, origY: 0 });

  const isResizing = useRef(false);
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, origW: 0, origH: 0 });

  useEffect(() => {
    let isMounted = true;
    invoke<boolean>("verify_desktop_pin", { label: "widget-placeholder" })
      .then((verified) => {
        if (isMounted) setIsAttached(verified);
      })
      .catch(() => {
        if (isMounted) setIsAttached(false);
      });

    const timer = setInterval(() => {
      invoke<boolean>("verify_desktop_pin", { label: "widget-placeholder" })
        .then((verified) => {
          if (isMounted) setIsAttached(verified);
        })
        .catch(() => {
          if (isMounted) setIsAttached(false);
        });
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Handle Dragging
  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStart.current = {
      mouseX: e.screenX,
      mouseY: e.screenY,
      origX: bounds.x,
      origY: bounds.y,
    };
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const deltaX = e.screenX - dragStart.current.mouseX;
    const deltaY = e.screenY - dragStart.current.mouseY;
    const nextX = dragStart.current.origX + deltaX;
    const nextY = dragStart.current.origY + deltaY;

    setBounds((prev) => ({ ...prev, x: nextX, y: nextY }));
    void invoke("set_bounds", {
      label: "widget-placeholder",
      x: nextX,
      y: nextY,
      w: bounds.w,
      h: bounds.h,
    });
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  // Handle Resizing
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isResizing.current = true;
    resizeStart.current = {
      mouseX: e.screenX,
      mouseY: e.screenY,
      origW: bounds.w,
      origH: bounds.h,
    };
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    const deltaW = e.screenX - resizeStart.current.mouseX;
    const deltaH = e.screenY - resizeStart.current.mouseY;
    const nextW = Math.max(260, resizeStart.current.origW + deltaW);
    const nextH = Math.max(220, resizeStart.current.origH + deltaH);

    setBounds((prev) => ({ ...prev, w: nextW, h: nextH }));
    void invoke("set_bounds", {
      label: "widget-placeholder",
      x: bounds.x,
      y: bounds.y,
      w: nextW,
      h: nextH,
    });
  };

  const handleResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    isResizing.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const switchStrategy = async (strat: string) => {
    try {
      const result = await invoke<string>("switch_pin_strategy", {
        label: "widget-placeholder",
        strategy: strat,
      });
      setCurrentStrategy(result);
      const verified = await invoke<boolean>("verify_desktop_pin", {
        label: "widget-placeholder",
      });
      setIsAttached(verified);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card select-none">
      {/* Drag Bar */}
      <div
        className="flex h-7 cursor-grab items-center justify-between border-b border-line bg-surface-raised px-3 text-xs text-fg-muted hover:text-fg active:cursor-grabbing"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div className="flex items-center gap-1.5 font-medium">
          <span
            className={`inline-block h-2 w-2 rounded-full ${isAttached ? "bg-ok" : "bg-warn"}`}
          />
          <span>Nook Spike — {currentStrategy}</span>
        </div>
        <span className="text-[10px] opacity-75">Drag here</span>
      </div>

      {/* Main Content & Interactive Gate Verification */}
      <div className="flex flex-1 flex-col gap-3 p-3 text-sm">
        <div className="text-xs text-fg-muted">
          Phase 1 Decision Gate: test typing and clicks while pinned below windows.
        </div>

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
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
          />
        </div>

        {/* Mouse Click Counter */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-white rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent-600"
            onClick={() => setClickCount((c) => c + 1)}
          >
            Test Button ({clickCount} clicks)
          </button>
          <span className="text-xs text-fg-muted">
            {isAttached ? "Attached to Host ✓" : "Top-level"}
          </span>
        </div>

        {/* Strategy Switcher for Instant Gate Comparison */}
        <div className="border-t border-line pt-2">
          <div className="mb-1.5 text-[11px] font-medium text-fg-muted">Test Strategy:</div>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                currentStrategy === "AboveIcons"
                  ? "text-white bg-accent-500"
                  : "border border-line bg-surface-raised text-fg-muted hover:text-fg"
              }`}
              onClick={() => void switchStrategy("above-icons")}
            >
              AboveIcons
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                currentStrategy === "BottomToplevel"
                  ? "text-white bg-accent-500"
                  : "border border-line bg-surface-raised text-fg-muted hover:text-fg"
              }`}
              onClick={() => void switchStrategy("bottom")}
            >
              Bottom
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                currentStrategy === "Topmost"
                  ? "text-white bg-accent-500"
                  : "border border-line bg-surface-raised text-fg-muted hover:text-fg"
              }`}
              onClick={() => void switchStrategy("topmost")}
            >
              Topmost
            </button>
          </div>
        </div>
      </div>

      {/* Resize Grip Corner */}
      <div
        className="absolute right-0 bottom-0 flex h-4 w-4 cursor-se-resize items-end justify-end p-0.5 text-[10px] text-fg-muted hover:text-accent-500"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
      >
        ◢
      </div>
    </div>
  );
}
