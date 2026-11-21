import { useCallback, useEffect, useRef, useState } from "react";

import { getContrastSafeAccent } from "@/core/color";
import { openContextMenu, setBounds } from "@/core/ipc";
import { getWidgetPreset } from "@/core/presets";
import type { Rect, WidgetInstance } from "@/core/types";
import { useEditMode } from "@/core/use-edit-mode";
import { useTheme } from "@/core/use-theme";

import { EditOverlay } from "./EditOverlay";

function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export interface WidgetShellProps {
  instance: WidgetInstance;
  editMode?: boolean | undefined;
  onToggleEditMode?: (() => void) | undefined;
  title: string;
  headerSlot?: React.ReactNode | undefined;
  headerActions?: React.ReactNode | undefined;
  banner?: React.ReactNode | undefined;
  footer?: React.ReactNode | undefined;
  resizable?: boolean | undefined;
  minSize?: { w: number; h: number } | undefined;
  defaultSize?: { w: number; h: number } | undefined;
  children: React.ReactNode;
}

export function WidgetShell({
  instance,
  editMode: propEditMode,
  onToggleEditMode: propToggle,
  title,
  headerSlot,
  headerActions,
  banner,
  footer,
  resizable = true,
  minSize = { w: 200, h: 160 },
  defaultSize,
  children,
}: WidgetShellProps) {
  const { editMode: hookEditMode, toggleEditMode: hookToggleEditMode } = useEditMode(instance.id);
  const effectiveEditMode = propEditMode ?? hookEditMode;
  const effectiveToggle =
    propToggle && propToggle.toString() !== "() => {}" ? propToggle : hookToggleEditMode;

  const [isInteracting, setIsInteracting] = useState(false);
  const [prevInstanceRect, setPrevInstanceRect] = useState(instance.rect);
  const [localBounds, setLocalBounds] = useState<Rect>(instance.rect);
  const [, setAppearanceTick] = useState(0);

  // Sync with appearance custom preset broadcasts
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("nook-appearance");
    const handleMessage = () => {
      setAppearanceTick((t) => t + 1);
    };
    channel.addEventListener("message", handleMessage);
    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, []);

  if (!isInteracting && !rectsEqual(prevInstanceRect, instance.rect)) {
    setPrevInstanceRect(instance.rect);
    setLocalBounds(instance.rect);
  }

  const inFlightRef = useRef(false);
  const queuedBoundsRef = useRef<{ bounds: Rect; commit: boolean } | null>(null);

  const sendBounds = useCallback(
    (bounds: Rect, commit: boolean) => {
      const prevCommit = queuedBoundsRef.current?.commit ?? false;
      queuedBoundsRef.current = { bounds, commit: commit || prevCommit };
      if (inFlightRef.current) return;

      const flush = async () => {
        while (queuedBoundsRef.current) {
          const next = queuedBoundsRef.current;
          queuedBoundsRef.current = null;
          inFlightRef.current = true;
          try {
            await setBounds(
              instance.id,
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
    },
    [instance.id],
  );

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void openContextMenu(instance.id, e.screenX, e.screenY);
  };

  const handleBoundsChange = (bounds: Rect, commit: boolean) => {
    setIsInteracting(!commit);
    if (commit) {
      setLocalBounds(bounds);
      setPrevInstanceRect(bounds);
    }
    sendBounds(bounds, commit);
  };

  const handleResetToDefault = () => {
    if (!defaultSize) return;
    handleBoundsChange({ ...localBounds, w: defaultSize.w, h: defaultSize.h }, true);
  };

  const handleResetToFit = () => {
    const targetW = minSize?.w ?? 200;
    const targetH = minSize?.h ?? 160;
    handleBoundsChange({ ...localBounds, w: targetW, h: targetH }, true);
  };

  const widgetOpacity =
    typeof instance.opacity === "number" ? Math.max(0.1, Math.min(1.0, instance.opacity)) : 0.95;

  const widgetColor =
    typeof instance.settings.widgetColor === "string" && instance.settings.widgetColor
      ? instance.settings.widgetColor
      : undefined;

  const { theme, preset: globalPresetId } = useTheme();
  const effectivePresetId =
    (typeof instance.settings.widgetPreset === "string" && instance.settings.widgetPreset) ||
    globalPresetId;
  const preset = getWidgetPreset(effectivePresetId);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const { accent, accentText, accentBg, accentBorder } = getContrastSafeAccent(widgetColor, isDark);
  const presetStyle = preset.getShellStyle(accent, isDark, effectiveEditMode);

  const fontClass =
    (typeof instance.settings.widgetFont === "string" && instance.settings.widgetFont) ||
    preset.font ||
    "font-sans";

  const mergedStyle: React.CSSProperties = {
    "--widget-accent": accent,
    "--widget-accent-raw": accent,
    "--color-accent-500": accentText,
    "--color-accent-400": isDark
      ? `color-mix(in srgb, ${accentText} 85%, white)`
      : `color-mix(in srgb, ${accentText} 70%, black)`,
    "--color-accent-600": isDark
      ? `color-mix(in srgb, ${accentText} 70%, white)`
      : `color-mix(in srgb, ${accentText} 85%, black)`,
    "--widget-accent-bg": accentBg,
    "--widget-accent-border": accentBorder,
    "--focus": accentText,
    ...presetStyle,
    opacity: widgetOpacity,
  } as React.CSSProperties;

  return (
    <div
      onContextMenu={handleContextMenu}
      style={mergedStyle}
      className={`
        relative flex flex-col overflow-hidden
        transition-widget duration-150 select-none
        block-full inline-full min-block-0
        before:pointer-events-none before:absolute before:inset-x-6
        before:inset-bs-0 before:block-px
        ${fontClass}
        ${
          widgetColor
            ? ""
            : `
            before:bg-linear-to-r before:from-transparent
            ${preset.highlightClass}
            before:to-transparent
          `
        }
        ${preset.containerClass}
        ${effectiveEditMode ? `border-accent-500/80! ring-2 ring-accent-500/80 ring-inset` : ""}
      `}
    >
      {widgetColor && (
        <span
          className="pointer-events-none absolute inset-x-6 inset-bs-0 block-px"
          style={{
            background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accent} 70%, transparent), transparent)`,
          }}
        />
      )}
      <EditOverlay
        id={instance.id}
        title={title}
        kind={instance.kind}
        editMode={effectiveEditMode}
        resizable={resizable}
        minSize={minSize}
        defaultSize={defaultSize}
        currentBounds={localBounds}
        onBoundsChange={handleBoundsChange}
        onToggleEditMode={effectiveToggle}
        headerSlot={headerSlot}
        headerActions={headerActions}
        widgetColor={accentText}
        onContextMenu={handleContextMenu}
        headerClass={preset.headerClass}
        onResetToDefault={defaultSize ? handleResetToDefault : undefined}
        onResetToFit={handleResetToFit}
      />

      {banner && <div className="shrink-0 px-3.5 pbs-2">{banner}</div>}

      {/* Scrollable Content Body with adequate bottom breathing room */}
      <div
        className="
        flex flex-1 flex-col overflow-x-hidden overflow-y-auto
        overscroll-y-contain px-3.5 pbs-2 pbe-3 text-sm select-auto
        min-block-0
        *:block-auto *:min-block-full
      "
      >
        {children}
      </div>

      {/* Sticky Bottom Footer */}
      {footer && (
        <div className="shrink-0 border-bs border-line/40 bg-surface/85 px-3.5 py-1.5 text-2xs text-fg-muted backdrop-blur-md">
          {footer}
        </div>
      )}
    </div>
  );
}
