import { useRef, useEffect, useLayoutEffect, useState } from "react";
import {
  Check,
  NotePencil,
  ArrowsInCardinal,
  ArrowCounterClockwise,
  Gear,
  Trash,
} from "@phosphor-icons/react";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export const WIDGET_COLOR_OPTIONS = [
  { id: "default", label: "Default Accent", value: "", hex: "#3b82f6" },
  { id: "emerald", label: "Emerald Green", value: "#10b981", hex: "#10b981" },
  { id: "amber", label: "Sunset Amber", value: "#f59e0b", hex: "#f59e0b" },
  { id: "rose", label: "Rose Coral", value: "#f43f5e", hex: "#f43f5e" },
  { id: "violet", label: "Royal Violet", value: "#8b5cf6", hex: "#8b5cf6" },
  { id: "cyan", label: "Cyan Blue", value: "#06b6d4", hex: "#06b6d4" },
  { id: "mono", label: "Zinc Slate", value: "#71717a", hex: "#71717a" },
] as const;

interface WidgetContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  isEditMode: boolean;
  currentColor?: string | undefined;
  onToggleEditMode: () => void;
  onSelectColor?: ((color: string) => void) | undefined;
  onResetToDefault?: (() => void) | undefined;
  onResetToFit?: (() => void) | undefined;
  onOpenSettings?: (() => void) | undefined;
  onDelete: () => void;
  onClose: () => void;
}

export function WidgetContextMenu({
  isOpen,
  position,
  isEditMode,
  currentColor,
  onToggleEditMode,
  onSelectColor,
  onResetToDefault,
  onResetToFit,
  onOpenSettings,
  onDelete,
  onClose,
}: WidgetContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(
      6,
      Math.min(position.x, (typeof window !== "undefined" ? window.innerWidth : 300) - 160),
    ),
    y: Math.max(
      6,
      Math.min(position.y, (typeof window !== "undefined" ? window.innerHeight : 300) - 200),
    ),
  }));

  // Position adjustment to avoid viewport overflow
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 6;

    let adjX = position.x;
    let adjY = position.y;

    if (adjX + rect.width > window.innerWidth - pad) {
      adjX = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (adjY + rect.height > window.innerHeight - pad) {
      adjY = Math.max(pad, window.innerHeight - rect.height - pad);
    }

    setCoords({ x: Math.max(pad, adjX), y: Math.max(pad, adjY) });
  }, [isOpen, position]);

  // Click outside and keydown listeners to dismiss menu
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", onClose);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", onClose);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        maxWidth: "calc(100vw - 12px)",
        maxHeight: "calc(100vh - 12px)",
      }}
      className="fixed z-[999999] flex max-w-[calc(100vw-12px)] min-w-[204px] animate-appear flex-col overflow-y-auto rounded-xl border border-line/80 bg-surface/95 p-1 text-xs text-fg shadow-card backdrop-blur-md select-none"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Edit Mode Toggle */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onToggleEditMode();
        }}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
      >
        {isEditMode ? (
          <>
            <Check className="h-3.5 w-3.5 shrink-0 text-accent-500" weight="bold" />
            <span className="font-medium text-accent-500">Done Editing</span>
          </>
        ) : (
          <>
            <NotePencil className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
            <span>Edit Widget</span>
            <span className="ml-auto font-mono text-[9px] text-fg-muted/60">Ctrl+Alt+E</span>
          </>
        )}
      </button>

      {/* Quick Size Reset options */}
      {(onResetToFit || onResetToDefault) && (
        <div className="flex flex-col gap-0.5 border-t border-line/40 pt-1">
          {onResetToFit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onResetToFit();
              }}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <div className="flex items-center gap-2">
                <ArrowsInCardinal className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                <span>Fit Size</span>
              </div>
              <span className="font-mono text-[9px] text-fg-muted/60">Compact</span>
            </button>
          )}
          {onResetToDefault && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onResetToDefault();
              }}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <div className="flex items-center gap-2">
                <ArrowCounterClockwise className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                <span>Reset Default</span>
              </div>
              <span className="font-mono text-[9px] text-fg-muted/60">Default</span>
            </button>
          )}
        </div>
      )}

      {/* Quick Color Swatches */}
      {onSelectColor && (
        <div className="flex flex-col gap-1 border-t border-line/40 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-fg-muted">Color</span>
          </div>
          <div className="flex items-center justify-between pt-0.5">
            {WIDGET_COLOR_OPTIONS.map((c) => {
              const active = (currentColor || "") === c.value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectColor(c.value);
                    onClose();
                  }}
                  className={`h-3.5 w-3.5 shrink-0 cursor-pointer rounded-full transition-transform hover:scale-125 ${
                    active ? "scale-110 ring-2 ring-white ring-offset-1 ring-offset-surface" : ""
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              );
            })}

            {/* Custom Color Swatch */}
            {(() => {
              const isCustomActive =
                Boolean(currentColor) &&
                !WIDGET_COLOR_OPTIONS.some((o) => o.value === currentColor);
              return (
                <label
                  title={isCustomActive ? `Custom Color (${currentColor})` : "Pick custom color"}
                  className={`relative flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-125 ${
                    isCustomActive
                      ? "scale-110 ring-2 ring-white ring-offset-1 ring-offset-surface"
                      : "border border-line/60"
                  }`}
                  style={
                    isCustomActive
                      ? { backgroundColor: currentColor }
                      : {
                          background:
                            "conic-gradient(from 180deg at 50% 50%, #f43f5e, #fbbf24, #10b981, #06b6d4, #6366f1, #d946ef, #f43f5e)",
                        }
                  }
                >
                  <input
                    type="color"
                    value={currentColor?.startsWith("#") ? currentColor : "#3b82f6"}
                    onChange={(e) => {
                      onSelectColor(e.target.value);
                      onClose();
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              );
            })()}
          </div>
        </div>
      )}

      {/* Settings */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
        >
          <Gear className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
          <span>Settings...</span>
        </button>
      )}

      <div className="my-1 border-t border-line/60" />

      {/* Delete / Remove Widget */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onDelete();
        }}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-error/10 hover:text-error dark:hover:bg-error/20"
      >
        <Trash className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">Delete Widget</span>
      </button>
    </div>
  );
}
