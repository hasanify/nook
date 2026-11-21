import {
  ArrowCounterClockwise,
  ArrowsInCardinal,
  Check,
  Gear,
  NotePencil,
  Trash,
} from "@phosphor-icons/react";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

import { hideContextMenu, openSettingsWindow, removeWidget, setBounds } from "@/core/ipc";
import { useEditMode } from "@/core/use-edit-mode";
import { useInstance } from "@/core/use-instance";
import { getWidgetModule } from "@/widgets/registry";

import { WIDGET_COLOR_OPTIONS } from "./WidgetContextMenu";

export function ContextMenuApp() {
  const [widgetId, setWidgetId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("w") || "";
  });

  const isPickingColorRef = useRef(false);
  const openTimeRef = useRef(0);
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    openTimeRef.current = Date.now();
    hasFocusedRef.current = false;

    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const INACTIVITY_DELAY_MS = 6000; // 6 seconds without cursor activity

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (isPickingColorRef.current) return;
      inactivityTimer = setTimeout(() => {
        void hideContextMenu();
      }, INACTIVITY_DELAY_MS);
    };

    const unlistenPromise = listen<{ widgetId: string }>("context-menu-open", (event) => {
      if (event.payload?.widgetId) {
        setWidgetId(event.payload.widgetId);
      }
      openTimeRef.current = Date.now();
      hasFocusedRef.current = false;
      resetInactivityTimer();
    });

    const handleFocus = () => {
      hasFocusedRef.current = true;
    };

    const handleBlur = () => {
      if (isPickingColorRef.current) return;
      // Protect from immediate blur right after open (focus transition)
      if (Date.now() - openTimeRef.current < 500) return;
      void hideContextMenu();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void hideContextMenu();
      } else {
        resetInactivityTimer();
      }
    };

    const handleActivity = () => {
      resetInactivityTimer();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pointermove", handleActivity, { passive: true });
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      void unlistenPromise.then((unlisten) => unlisten());
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pointermove", handleActivity);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const { instance, patchSettings } = useInstance(widgetId);
  const { editMode, toggleEditMode } = useEditMode(widgetId || undefined);

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
    return (
      <div className="flex items-start justify-start p-1.5 select-none block-full inline-full">
        <div className="flex flex-col rounded-xl border border-line/80 bg-surface/95 p-3 text-xs text-fg-muted shadow-card backdrop-blur-md select-none inline-full">
          Loading menu...
        </div>
      </div>
    );
  }

  const widgetColor =
    typeof instance.settings.widgetColor === "string" && instance.settings.widgetColor
      ? instance.settings.widgetColor
      : "";

  return (
    <div className="flex items-start justify-start p-1.5 select-none block-full inline-full">
      <div
        className="flex flex-col rounded-xl border border-line/80 bg-surface/95 p-1 text-xs text-fg shadow-card backdrop-blur-md select-none inline-full"
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
          className="
                flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5
                text-start text-fg-muted transition-colors inline-full
                hover:bg-surface-raised hover:text-fg
              "
        >
          {editMode ? (
            <>
              <Check className="shrink-0 text-accent-500 block-3.5 inline-3.5" weight="bold" />
              <span className="font-medium text-accent-500">Done Editing</span>
            </>
          ) : (
            <>
              <NotePencil className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
              <span>Edit Widget</span>
              <span className="ms-auto font-mono text-[9px] text-fg-muted/60">Ctrl+Alt+E</span>
            </>
          )}
        </button>

        {/* Quick Size Reset options */}
        <div className="flex flex-col gap-0.5 border-bs border-line/40 pbs-1">
          <button
            type="button"
            onClick={handleResetToFit}
            className="
                  flex cursor-pointer items-center justify-between rounded-lg
                  px-2.5 py-1 text-start text-fg-muted transition-colors
                  inline-full
                  hover:bg-surface-raised hover:text-fg
                "
          >
            <div className="flex items-center gap-2">
              <ArrowsInCardinal className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
              <span>Fit Size</span>
            </div>
            <span className="font-mono text-[9px] text-fg-muted/60">Compact</span>
          </button>
          {manifest?.defaultSize && (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="
                    flex cursor-pointer items-center justify-between rounded-lg
                    px-2.5 py-1 text-start text-fg-muted transition-colors
                    inline-full
                    hover:bg-surface-raised hover:text-fg
                  "
            >
              <div className="flex items-center gap-2">
                <ArrowCounterClockwise className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
                <span>Reset Default</span>
              </div>
              <span className="font-mono text-[9px] text-fg-muted/60">Default</span>
            </button>
          )}
        </div>

        {/* Quick Color Swatches */}
        <div className="flex flex-col gap-1 border-bs border-line/40 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-fg-muted">Color</span>
          </div>
          <div className="flex items-center justify-between pbs-0.5">
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
                  className={`
                        shrink-0 cursor-pointer rounded-full
                        transition-transform block-3.5 inline-3.5
                        hover:scale-125
                        ${
                          active
                            ? `scale-110 ring-2 ring-white ring-offset-1 ring-offset-surface`
                            : ""
                        }
                      `}
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
                  className={`
                        relative flex shrink-0 cursor-pointer items-center
                        justify-center rounded-full transition-transform
                        block-3.5 inline-3.5
                        hover:scale-125
                        ${
                          isCustomActive
                            ? `scale-110 ring-2 ring-white ring-offset-1 ring-offset-surface`
                            : "border border-line/60"
                        }
                      `}
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
                    className="absolute inset-0 cursor-pointer opacity-0 block-full inline-full"
                  />
                </label>
              );
            })()}
          </div>
        </div>

        {/* Settings */}
        <button
          type="button"
          onClick={() => {
            handleClose();
            void openSettingsWindow(instance.id);
          }}
          className="
                flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5
                text-start text-fg-muted transition-colors inline-full
                hover:bg-surface-raised hover:text-fg
              "
        >
          <Gear className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
          <span>Settings...</span>
        </button>

        <div className="my-1 border-bs border-line/60" />

        {/* Delete / Remove Widget */}
        <button
          type="button"
          onClick={() => {
            handleClose();
            void removeWidget(instance.id);
          }}
          className="
                flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5
                text-start text-fg-muted transition-colors inline-full
                hover:bg-error/10 hover:text-error
                dark:hover:bg-error/20
              "
        >
          <Trash className="shrink-0 block-3.5 inline-3.5" />
          <span className="font-medium">Delete Widget</span>
        </button>
      </div>
    </div>
  );
}
