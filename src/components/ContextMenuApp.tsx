import {
  ArrowCounterClockwiseIcon,
  ArrowsInCardinalIcon,
  CheckIcon,
  CopySimpleIcon,
  GearIcon,
  NotePencilIcon,
  PushPinIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  duplicateWidget,
  hideContextMenu,
  openSettingsWindow,
  removeWidget,
  setAlwaysOnTop,
  setBounds,
} from "@/core/ipc";
import { useEditMode } from "@/core/use-edit-mode";
import { useInstance } from "@/core/use-instance";
import { getWidgetModule } from "@/widgets/registry";

import { WIDGET_COLOR_OPTIONS } from "./WidgetContextMenu";

const EXTENDED_PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#64748b",
];

function hslToHex(h: number, s: number, l: number): string {
  const lNorm = l / 100;
  const a = (s * Math.min(lNorm, 1 - lNorm)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace("#", "").trim();
  if (c.length === 3) {
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  }
  const num = parseInt(c, 16);
  if (Number.isNaN(num) || c.length !== 6) {
    return { h: 217, s: 91, l: 60 };
  }
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }

  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function ContextMenuApp() {
  const [widgetId, setWidgetId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("w") || "";
  });

  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const showCustomPickerRef = useRef(false);

  useEffect(() => {
    showCustomPickerRef.current = showCustomPicker;
  }, [showCustomPicker]);

  const openTimeRef = useRef(0);
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    openTimeRef.current = Date.now();
    hasFocusedRef.current = false;

    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const INACTIVITY_DELAY_MS = 6000; // 6 seconds without cursor activity

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (showCustomPickerRef.current) return;
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
      setShowCustomPicker(false);
      resetInactivityTimer();
    });

    const handleFocus = () => {
      hasFocusedRef.current = true;
    };

    const handleBlur = (e: FocusEvent) => {
      if (showCustomPickerRef.current) return;
      if (e.relatedTarget && document.contains(e.relatedTarget as Node)) return;
      // Protect from immediate blur right after open (focus transition)
      if (Date.now() - openTimeRef.current < 500) return;
      void hideContextMenu();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCustomPickerRef.current) {
          setShowCustomPicker(false);
        } else {
          void hideContextMenu();
        }
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

  const widgetColor =
    typeof instance?.settings?.widgetColor === "string" && instance.settings.widgetColor
      ? instance.settings.widgetColor
      : "";

  const [prevColor, setPrevColor] = useState(widgetColor);
  const [hue, setHue] = useState(() =>
    widgetColor && widgetColor.startsWith("#") ? hexToHsl(widgetColor).h : 217,
  );
  const [saturation, setSaturation] = useState(() =>
    widgetColor && widgetColor.startsWith("#") ? hexToHsl(widgetColor).s : 91,
  );
  const [lightness, setLightness] = useState(() =>
    widgetColor && widgetColor.startsWith("#") ? hexToHsl(widgetColor).l : 60,
  );
  const [hexInput, setHexInput] = useState(widgetColor || "#3b82f6");

  if (prevColor !== widgetColor) {
    setPrevColor(widgetColor);
    if (widgetColor && widgetColor.startsWith("#")) {
      const hsl = hexToHsl(widgetColor);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
      setHexInput(widgetColor);
    }
  }

  const applyColor = useCallback(
    (hex: string) => {
      patchSettings({ widgetColor: hex });
    },
    [patchSettings],
  );

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

  const isAlwaysOnTop = Boolean(instance.alwaysOnTop ?? instance.always_on_top);

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
              <CheckIcon className="shrink-0 text-accent-500 block-3.5 inline-3.5" weight="bold" />
              <span className="font-medium text-accent-500">Done Editing</span>
            </>
          ) : (
            <>
              <NotePencilIcon className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
              <span>Edit Widget</span>
              <span className="ms-auto font-mono text-3xs text-fg-muted/60">Ctrl+Alt+E</span>
            </>
          )}
        </button>

        {/* Pin Always on Top */}
        <button
          type="button"
          onClick={() => {
            handleClose();
            void setAlwaysOnTop(instance.id, !isAlwaysOnTop);
          }}
          className="
                flex cursor-pointer items-center justify-between rounded-lg
                px-2.5 py-1.5 text-start text-fg-muted transition-colors
                inline-full
                hover:bg-surface-raised hover:text-fg
              "
        >
          <div className="flex items-center gap-2">
            <PushPinIcon
              className={`shrink-0 block-3.5 inline-3.5 ${
                isAlwaysOnTop ? "text-accent-500" : "text-fg-muted"
              }`}
              weight={isAlwaysOnTop ? "fill" : "regular"}
            />
            <span>{isAlwaysOnTop ? "Unpin from Top" : "Pin Always on Top"}</span>
          </div>
          {isAlwaysOnTop && (
            <span className="rounded-xs bg-accent-500/10 px-1 py-0.5 font-mono text-3xs font-medium text-accent-500">
              Pinned
            </span>
          )}
        </button>

        {/* Duplicate Widget */}
        <button
          type="button"
          onClick={() => {
            handleClose();
            void duplicateWidget(instance.id);
          }}
          className="
                flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5
                text-start text-fg-muted transition-colors inline-full
                hover:bg-surface-raised hover:text-fg
              "
        >
          <CopySimpleIcon className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
          <span>Duplicate Widget</span>
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
              <ArrowsInCardinalIcon className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
              <span>Fit Size</span>
            </div>
            <span className="font-mono text-3xs text-fg-muted/60">Compact</span>
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
                <ArrowCounterClockwiseIcon className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
                <span>Reset Default</span>
              </div>
              <span className="font-mono text-3xs text-fg-muted/60">Default</span>
            </button>
          )}
        </div>

        {/* Quick Color Swatches */}
        <div className="flex flex-col gap-1 border-bs border-line/40 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-medium text-fg-muted">Color</span>
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

            {/* Custom Color Swatch Toggle */}
            {(() => {
              const isCustomActive =
                Boolean(widgetColor) && !WIDGET_COLOR_OPTIONS.some((o) => o.value === widgetColor);
              return (
                <button
                  type="button"
                  onClick={() => setShowCustomPicker((prev) => !prev)}
                  title={isCustomActive ? `Custom Color (${widgetColor})` : "Custom color picker"}
                  className={`
                        relative flex shrink-0 cursor-pointer items-center
                        justify-center rounded-full transition-transform
                        block-3.5 inline-3.5
                        hover:scale-125
                        ${
                          isCustomActive || showCustomPicker
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
                />
              );
            })()}
          </div>

          {/* Custom Color Picker Drawer */}
          {showCustomPicker && (
            <div className="mbs-2 flex flex-col gap-2 rounded-lg border border-line/60 bg-surface-raised/80 p-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold text-fg">Custom Color</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="rounded-full border border-white/20 shadow-xs block-3.5 inline-3.5"
                    style={{ backgroundColor: hexInput }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomPicker(false)}
                    className="cursor-pointer text-fg-muted hover:text-fg"
                    title="Close picker"
                  >
                    <XIcon className="block-3 inline-3" />
                  </button>
                </div>
              </div>

              {/* Extended Color Palette */}
              <div className="grid grid-cols-6 gap-1 pbs-0.5">
                {EXTENDED_PALETTE.map((hex) => {
                  const isSelected = hex.toLowerCase() === hexInput.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => {
                        const hsl = hexToHsl(hex);
                        setHue(hsl.h);
                        setSaturation(hsl.s);
                        setLightness(hsl.l);
                        setHexInput(hex);
                        applyColor(hex);
                      }}
                      className={`
                        cursor-pointer rounded-md transition-transform block-3.5 inline-full
                        hover:scale-110
                        ${isSelected ? "shadow-xs ring-2 ring-white ring-offset-1 ring-offset-surface" : ""}
                      `}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>

              {/* Hue Slider */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-3xs text-fg-muted">
                  <span>Hue</span>
                  <span className="font-mono">{hue}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={hue}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setHue(h);
                    const newHex = hslToHex(h, saturation, lightness);
                    setHexInput(newHex);
                    applyColor(newHex);
                  }}
                  className="cursor-pointer appearance-none rounded-full block-2 inline-full"
                  style={{
                    background:
                      "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
                  }}
                />
              </div>

              {/* Lightness Slider */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-3xs text-fg-muted">
                  <span>Lightness</span>
                  <span className="font-mono">{lightness}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="85"
                  value={lightness}
                  onChange={(e) => {
                    const l = Number(e.target.value);
                    setLightness(l);
                    const newHex = hslToHex(hue, saturation, l);
                    setHexInput(newHex);
                    applyColor(newHex);
                  }}
                  className="cursor-pointer appearance-none rounded-full block-2 inline-full"
                  style={{
                    background: `linear-gradient(to right, #111 0%, hsl(${hue}, ${saturation}%, 50%) 50%, #fff 100%)`,
                  }}
                />
              </div>

              {/* Hex Input and Action Buttons */}
              <div className="flex items-center gap-1.5 pbs-0.5">
                <div className="flex flex-1 items-center rounded-md border border-line bg-surface px-1.5 py-0.5">
                  <span className="font-mono text-3xs text-fg-muted">#</span>
                  <input
                    type="text"
                    maxLength={7}
                    value={hexInput.startsWith("#") ? hexInput.slice(1) : hexInput}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                      const formatted = `#${clean}`;
                      setHexInput(formatted);
                      if (clean.length === 6 || clean.length === 3) {
                        const hsl = hexToHsl(formatted);
                        setHue(hsl.h);
                        setSaturation(hsl.s);
                        setLightness(hsl.l);
                        applyColor(formatted);
                      }
                    }}
                    className="flex-1 bg-transparent font-mono text-3xs text-fg outline-hidden select-text min-inline-0"
                    placeholder="3b82f6"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    patchSettings({ widgetColor: "" });
                    setShowCustomPicker(false);
                  }}
                  className="cursor-pointer rounded-md border border-line/60 bg-surface px-1.5 py-0.5 font-mono text-3xs text-fg-muted transition-colors hover:text-fg"
                  title="Reset to default theme accent"
                >
                  Reset
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCustomPicker(false);
                    handleClose();
                  }}
                  className="cursor-pointer rounded-md bg-accent-500 px-2 py-0.5 text-3xs font-medium text-white transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          type="button"
          onClick={async () => {
            await hideContextMenu();
            await openSettingsWindow(instance.id);
          }}
          className="
                flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5
                text-start text-fg-muted transition-colors inline-full
                hover:bg-surface-raised hover:text-fg
              "
        >
          <GearIcon className="shrink-0 text-fg-muted block-3.5 inline-3.5" />
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
          <TrashIcon className="shrink-0 block-3.5 inline-3.5" />
          <span className="font-medium">Delete Widget</span>
        </button>
      </div>
    </div>
  );
}
