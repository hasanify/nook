import { useRef, useEffect, useLayoutEffect, useState } from "react";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface WidgetContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onOpenSettings?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function WidgetContextMenu({
  isOpen,
  position,
  isEditMode,
  onToggleEditMode,
  onOpenSettings,
  onDelete,
  onClose,
}: WidgetContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>(position);

  // Position adjustment to avoid viewport overflow
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;

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
      style={{ left: `${coords.x}px`, top: `${coords.y}px` }}
      className="fixed z-50 flex min-w-[160px] animate-appear flex-col rounded-xl border border-line/80 bg-surface/95 p-1 text-xs text-fg shadow-card backdrop-blur-md select-none"
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
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
      >
        {isEditMode ? (
          <>
            <svg
              className="h-3.5 w-3.5 shrink-0 text-accent-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="font-medium text-accent-500">Done Editing</span>
          </>
        ) : (
          <>
            <svg
              className="h-3.5 w-3.5 shrink-0 text-fg-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Edit Widget</span>
            <span className="ml-auto font-mono text-[9px] text-fg-muted/60">Ctrl+Alt+E</span>
          </>
        )}
      </button>

      {/* Settings */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
        >
          <svg
            className="h-3.5 w-3.5 shrink-0 text-fg-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
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
        className="text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors"
      >
        <svg
          className="h-3.5 w-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        <span className="font-medium">Delete Widget</span>
      </button>
    </div>
  );
}
