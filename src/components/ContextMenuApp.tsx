import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useInstance } from "../core/use-instance";
import { useEditMode } from "../core/use-edit-mode";
import { getWidgetModule } from "../widgets/registry";
import { setBounds, removeWidget, openSettingsWindow, hideContextMenu } from "../core/ipc";
import { WIDGET_COLOR_OPTIONS } from "./WidgetContextMenu";

export function ContextMenuApp() {
  const [widgetId, setWidgetId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("w") || "";
  });

  const isPickingColorRef = useRef(false);

  useEffect(() => {
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const INACTIVITY_DELAY_MS = 3500; // Auto-close after 3.5s of no cursor activity

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (isPickingColorRef.current) return;
      inactivityTimer = setTimeout(() => {
        void hideContextMenu();
      }, INACTIVITY_DELAY_MS);
    };

    // Start timer on initial show
    resetInactivityTimer();

    const unlistenPromise = listen<{ widgetId: string }>("context-menu-open", (event) => {
      if (event.payload?.widgetId) {
        setWidgetId(event.payload.widgetId);
      }
      resetInactivityTimer();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void hideContextMenu();
      } else {
        resetInactivityTimer();
      }
    };

    const handleBlur = () => {
      if (isPickingColorRef.current) return;
      void hideContextMenu();
    };

    const handleActivity = () => {
      resetInactivityTimer();
    };

    window.addEventListener("pointermove", handleActivity, { passive: true });
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      void unlistenPromise.then((unlisten) => unlisten());
      window.removeEventListener("pointermove", handleActivity);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const { instance, patchSettings } = useInstance(widgetId);
  const { editMode, toggleEditMode } = useEditMode();

  const handleClose = useCallback(() => {
    void hideContextMenu();
  }, []);

  const mod = instance ? getWidgetModule(instance.kind || instance.type || "") : undefined;
  const manifest = mod?.manifest;

  const handleResetToFit = useCallback(() => {
    if (!instance) return;
    const minW = manifest?.minSize.w ?? 200;
    const minH = manifest?.minSize.h ?? 160;
    void setBounds(instance.id, instance.rect.x, instance.rect.y, minW, minH, true);
    handleClose();
  }, [instance, manifest, handleClose]);

  const handleResetToDefault = useCallback(() => {
    if (!instance || !manifest?.defaultSize) return;
    void setBounds(
      instance.id,
      instance.rect.x,
      instance.rect.y,
      manifest.defaultSize.w,
      manifest.defaultSize.h,
      true,
    );
    handleClose();
  }, [instance, manifest, handleClose]);

  if (!instance) {
    return null;
  }

  const widgetColor =
    typeof instance.settings.widgetColor === "string" && instance.settings.widgetColor
      ? instance.settings.widgetColor
      : "";

  const hasBlur = Boolean(instance.settings.backgroundBlur);

  return (
    <div className="flex h-full w-full items-start justify-start p-1.5 select-none">
      <div
        className="flex w-full flex-col rounded-xl border border-line/80 bg-surface/95 p-1 text-xs text-fg shadow-card backdrop-blur-md select-none"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Edit Mode Toggle */}
        <button
          type="button"
          onClick={() => {
            handleClose();
            toggleEditMode();
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
        >
          {editMode ? (
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

        {/* Quick Size Reset options */}
        <div className="flex flex-col gap-0.5 border-t border-line/40 pt-1">
          <button
            type="button"
            onClick={handleResetToFit}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-3.5 w-3.5 shrink-0 text-fg-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 14h6m0 0v6m0-6L3 21" />
                <path d="M20 10h-6m0 0V4m0 6l7-7" />
              </svg>
              <span>Fit Size</span>
            </div>
            <span className="font-mono text-[9px] text-fg-muted/60">Compact</span>
          </button>
          {manifest?.defaultSize && (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-fg-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Reset Default</span>
              </div>
              <span className="font-mono text-[9px] text-fg-muted/60">Default</span>
            </button>
          )}
        </div>

        {/* Quick Color Swatches */}
        <div className="flex flex-col gap-1 border-t border-line/40 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-fg-muted">Color</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {WIDGET_COLOR_OPTIONS.map((c) => {
              const active = widgetColor === c.value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    patchSettings({ widgetColor: c.value });
                    handleClose();
                  }}
                  className={`h-3.5 w-3.5 cursor-pointer rounded-full transition-transform hover:scale-125 ${
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
                Boolean(widgetColor) && !WIDGET_COLOR_OPTIONS.some((o) => o.value === widgetColor);
              return (
                <label
                  title={isCustomActive ? `Custom Color (${widgetColor})` : "Pick custom color"}
                  className={`relative flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-125 ${
                    isCustomActive
                      ? "scale-110 ring-2 ring-white ring-offset-1 ring-offset-surface"
                      : "border border-line/60"
                  }`}
                  style={
                    isCustomActive
                      ? { backgroundColor: widgetColor }
                      : {
                          background:
                            "conic-gradient(from 180deg at 50% 50%, #f43f5e, #fbbf24, #10b981, #06b6d4, #6366f1, #d946ef, #f43f5e)",
                        }
                  }
                >
                  <input
                    type="color"
                    value={widgetColor?.startsWith("#") ? widgetColor : "#3b82f6"}
                    onPointerDown={() => {
                      isPickingColorRef.current = true;
                    }}
                    onChange={(e) => {
                      isPickingColorRef.current = false;
                      patchSettings({ widgetColor: e.target.value });
                      handleClose();
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              );
            })()}
          </div>
        </div>

        {/* Background Blur Toggle */}
        <button
          type="button"
          onClick={() => {
            patchSettings({ backgroundBlur: !hasBlur });
            handleClose();
          }}
          className="flex w-full cursor-pointer items-center justify-between border-t border-line/40 px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
        >
          <div className="flex items-center gap-2">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-fg-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            </svg>
            <span>Background Blur</span>
          </div>
          <span
            className={`font-mono text-[9px] font-semibold tracking-wider uppercase ${
              hasBlur ? "text-accent-500" : "text-fg-muted/60"
            }`}
          >
            {hasBlur ? "On" : "Off"}
          </span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => {
            handleClose();
            void openSettingsWindow(instance.id);
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
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

        <div className="my-1 border-t border-line/60" />

        {/* Delete / Remove Widget */}
        <button
          type="button"
          onClick={() => {
            handleClose();
            void removeWidget(instance.id);
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-fg-muted transition-colors hover:bg-error/10 hover:text-error dark:hover:bg-error/20"
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
    </div>
  );
}
