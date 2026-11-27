import type React from "react";

export type PresetFont = "sans" | "mono" | "serif" | "rounded" | "tech";
export type PresetRadius = "none" | "sm" | "md" | "lg" | "xl" | "full";
export type PresetBackdrop = "solid" | "glass" | "sheer" | "oled";
export type PresetBorder = "none" | "hairline" | "solid" | "thick" | "glow";
export type PresetHeader = "hairline" | "seamless" | "tinted" | "bold";
export type PresetShadow = "none" | "soft" | "deep" | "glow";

export interface CustomPresetConfig {
  font: PresetFont;
  radius: PresetRadius;
  backdrop: PresetBackdrop;
  border: PresetBorder;
  header: PresetHeader;
  shadow: PresetShadow;
}

export const DEFAULT_CUSTOM_PRESET: CustomPresetConfig = {
  font: "sans",
  radius: "lg",
  backdrop: "glass",
  border: "hairline",
  header: "hairline",
  shadow: "soft",
};

const CUSTOM_PRESET_STORAGE_KEY = "nook_custom_preset";

export function getCustomPresetConfig(): CustomPresetConfig {
  if (typeof window === "undefined") return DEFAULT_CUSTOM_PRESET;
  try {
    const raw = localStorage.getItem(CUSTOM_PRESET_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_PRESET;
    const parsed = JSON.parse(raw) as Partial<CustomPresetConfig>;
    return { ...DEFAULT_CUSTOM_PRESET, ...parsed };
  } catch {
    return DEFAULT_CUSTOM_PRESET;
  }
}

export function saveCustomPresetConfig(config: CustomPresetConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_PRESET_STORAGE_KEY, JSON.stringify(config));
    // Broadcast change to other windows/widgets
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("nook-appearance");
      // eslint-disable-next-line unicorn/require-post-message-target-origin
      channel.postMessage({ type: "custom-preset-updated", config });
      channel.close();
    }
  } catch {
    // Ignore storage errors
  }
}

export interface WidgetPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  font?: string;
  containerClass: string;
  headerClass: string;
  highlightClass: string;
  getShellStyle: (color?: string, isDark?: boolean, isEditMode?: boolean) => React.CSSProperties;
}

export function buildCustomPreset(config: CustomPresetConfig): WidgetPreset {
  const radiusClass =
    {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-lg",
      lg: "rounded-2xl",
      xl: "rounded-3xl",
      full: "rounded-3xl",
    }[config.radius] ?? "rounded-2xl";

  const fontClass =
    {
      sans: "font-sans",
      mono: "font-mono",
      serif: "font-serif",
      rounded: "font-rounded",
      tech: "font-tech",
    }[config.font] ?? "font-sans";

  const headerClass =
    {
      hairline: "border-b border-line/40 bg-surface-raised/40",
      seamless: "border-b-0 bg-transparent",
      tinted: "border-b border-accent-500/30 bg-accent-500/10",
      bold: "border-b-2 border-line bg-surface-raised/80 font-bold",
    }[config.header] ?? "border-b border-line/40 bg-surface-raised/40";

  return {
    id: "custom",
    name: "Custom Studio",
    tagline: "Your Personal Signature",
    description: "Fully customized appearance tailored to your exact taste and typography.",
    font: fontClass,
    containerClass: `${radiusClass} ${fontClass} ring-1 ring-inset ring-white/10 dark:ring-white/5`,
    headerClass,
    highlightClass: "before:via-white/20",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || "var(--color-accent-500)";

      // Backdrop styling
      let background = "var(--surface)";
      let backdropFilter: string | undefined;

      switch (config.backdrop) {
        case "glass":
          background = isDark ? "rgba(18, 18, 24, 0.75)" : "rgba(255, 255, 255, 0.75)";
          backdropFilter = "blur(24px) saturate(180%)";
          break;
        case "sheer":
          background = isDark ? "rgba(24, 24, 27, 0.42)" : "rgba(255, 255, 255, 0.45)";
          backdropFilter = "blur(12px)";
          break;
        case "oled":
          background = "#09090b";
          break;
        case "solid":
        default:
          background = isDark ? "var(--surface)" : "#ffffff";
          break;
      }

      // Border styling
      let border: string | undefined;
      let borderColor: string | undefined;

      switch (config.border) {
        case "none":
          border = "none";
          break;
        case "thick":
          border = `2px solid ${isEditMode ? accent : isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)"}`;
          break;
        case "glow":
          border = `1px solid ${isEditMode ? accent : `color-mix(in srgb, ${accent} 60%, var(--line))`}`;
          break;
        case "solid":
          border = `1px solid ${isEditMode ? accent : "var(--line)"}`;
          break;
        case "hairline":
        default:
          borderColor = isEditMode
            ? accent
            : color
              ? `color-mix(in srgb, ${color} 30%, var(--line))`
              : "var(--line)";
          border = `1px solid ${borderColor}`;
          break;
      }

      // Shadow styling
      let boxShadow: string | undefined;
      switch (config.shadow) {
        case "none":
          boxShadow = "none";
          break;
        case "deep":
          boxShadow = isDark
            ? "0 20px 40px -8px rgba(0, 0, 0, 0.65)"
            : "0 20px 40px -8px rgba(0, 0, 0, 0.16)";
          break;
        case "glow":
          boxShadow = `0 0 24px -2px color-mix(in srgb, ${accent} 35%, transparent), 0 0 6px -1px color-mix(in srgb, ${accent} 50%, transparent)`;
          break;
        case "soft":
        default:
          boxShadow = isDark
            ? "0 10px 28px -6px rgba(0, 0, 0, 0.4)"
            : "0 10px 28px -6px rgba(0, 0, 0, 0.08)";
          break;
      }

      return {
        background,
        border,
        boxShadow,
        backdropFilter,
      };
    },
  };
}

export const WIDGET_PRESETS: WidgetPreset[] = [
  {
    id: "default",
    name: "Clean Modern",
    tagline: "Solid & Balanced",
    description: "Solid surface, refined hairline borders, and subtle elevation.",
    font: "font-sans",
    containerClass:
      "rounded-2xl border border-line/70 bg-surface ring-1 ring-inset ring-white/10 dark:ring-white/5",
    headerClass: "border-b border-line/40 bg-surface-raised/40",
    highlightClass: "before:via-white/10",
    getShellStyle: (color, _isDark, isEditMode) => {
      const accent = color || "var(--color-accent-500)";
      return {
        borderColor: isEditMode
          ? accent
          : color
            ? `color-mix(in srgb, ${color} 30%, var(--line))`
            : undefined,
        boxShadow: color
          ? `0 10px 28px -6px color-mix(in srgb, ${color} 14%, transparent), 0 2px 6px -1px color-mix(in srgb, ${color} 8%, transparent)`
          : undefined,
        background: color
          ? `radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, ${color} 6%, transparent) 0%, transparent 80%), var(--surface)`
          : undefined,
      };
    },
  },
  {
    id: "glass",
    name: "Frosted Glass",
    tagline: "Refined Translucent",
    description: "Deep translucent backdrop blur with luminous specular edge reflections.",
    font: "font-sans",
    containerClass: "rounded-2xl backdrop-blur-2xl ring-1 ring-inset",
    headerClass:
      "border-b border-white/20 dark:border-white/10 bg-white/25 dark:bg-white/[0.04] backdrop-blur-md",
    highlightClass: "before:via-white/30",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || "var(--color-accent-500)";
      const bg = isDark
        ? color
          ? `radial-gradient(100% 60% at 50% 0%, color-mix(in srgb, ${color} 16%, transparent), transparent 75%), rgba(18, 18, 24, 0.72)`
          : "rgba(18, 18, 24, 0.75)"
        : color
          ? `radial-gradient(100% 60% at 50% 0%, color-mix(in srgb, ${color} 14%, transparent), transparent 75%), rgba(255, 255, 255, 0.72)`
          : "rgba(255, 255, 255, 0.75)";
      const border = isEditMode
        ? accent
        : isDark
          ? color
            ? `color-mix(in srgb, ${color} 40%, rgba(255,255,255,0.2))`
            : "rgba(255, 255, 255, 0.18)"
          : color
            ? `color-mix(in srgb, ${color} 45%, rgba(0,0,0,0.12))`
            : "rgba(255, 255, 255, 0.65)";
      return {
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: isDark
          ? `0 12px 32px -4px rgba(0, 0, 0, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)`
          : `0 12px 32px -4px rgba(0, 0, 0, 0.12), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)`,
        backdropFilter: "blur(24px) saturate(180%)",
      };
    },
  },
  {
    id: "ghost",
    name: "Ghost Minimal",
    tagline: "Ultra-Sheer Float",
    description: "Whisper-thin translucent look that floats naturally on your desktop wallpaper.",
    font: "font-sans",
    containerClass: "rounded-2xl border border-line/35 backdrop-blur-md",
    headerClass: "border-b border-line/20 bg-surface-raised/20",
    highlightClass: "before:via-transparent",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || "var(--color-accent-500)";
      return {
        background: isDark ? "rgba(24, 24, 27, 0.42)" : "rgba(255, 255, 255, 0.45)",
        borderColor: isEditMode
          ? accent
          : color
            ? `color-mix(in srgb, ${color} 25%, var(--line))`
            : undefined,
        boxShadow: "0 8px 24px -6px rgba(0, 0, 0, 0.08)",
        backdropFilter: "blur(12px)",
      };
    },
  },
  {
    id: "editorial",
    name: "Editorial Serif",
    tagline: "Literary Elegance",
    description: "Classic typography with warm paper surface, serif headings, and refined rules.",
    font: "font-serif",
    containerClass: "rounded-2xl border border-line/60 bg-surface ring-1 ring-inset ring-line/20",
    headerClass: "border-b border-line/40 bg-surface-raised/50 font-serif italic",
    highlightClass: "before:via-transparent",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || (isDark ? "#e4e4e7" : "#3f3f46");
      const bg = isDark ? "#121214" : "#fbfaf6";
      return {
        background: bg,
        borderColor: isEditMode ? accent : isDark ? "#27272a" : "#e5e5e0",
        boxShadow: isDark
          ? "0 10px 30px -6px rgba(0,0,0,0.5)"
          : "0 10px 30px -6px rgba(0,0,0,0.06), 0 2px 6px -1px rgba(0,0,0,0.04)",
      };
    },
  },
  {
    id: "minimal-card",
    name: "Floating Card",
    tagline: "Soft Frameless",
    description: "Border-free soft float with generous depth shadow and seamless surface.",
    font: "font-rounded",
    containerClass: "rounded-3xl bg-surface",
    headerClass: "border-b-0 bg-transparent font-medium",
    highlightClass: "before:via-white/20",
    getShellStyle: (color, isDark) => {
      const accent = color || "#3b82f6";
      return {
        background: "var(--surface)",
        boxShadow: isDark
          ? `0 16px 36px -6px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)`
          : `0 16px 36px -6px rgba(0,0,0,0.08), 0 2px 8px -2px rgba(0,0,0,0.04), 0 0 0 1px color-mix(in srgb, ${accent} 15%, transparent)`,
      };
    },
  },
  {
    id: "obsidian",
    name: "Obsidian Glow",
    tagline: "Cyberpunk Aura",
    description: "Pitch-black dark surface with vibrant accent borders and neon glow aura.",
    font: "font-tech",
    containerClass: "rounded-2xl ring-1 ring-inset",
    headerClass: "border-b border-white/10 bg-black/60",
    highlightClass: "before:via-accent-500/40",
    getShellStyle: (color, _isDark, isEditMode) => {
      const accent = color || "#3b82f6";
      return {
        background: "#09090b",
        border: `1px solid ${isEditMode ? accent : `color-mix(in srgb, ${accent} 65%, #27272a)`}`,
        boxShadow: `0 0 24px -2px color-mix(in srgb, ${accent} 35%, transparent), 0 0 6px -1px color-mix(in srgb, ${accent} 50%, transparent), inset 0 1px 1px 0 color-mix(in srgb, ${accent} 30%, transparent)`,
        color: "#f4f4f5",
      };
    },
  },
  {
    id: "paper",
    name: "Warm Paper",
    tagline: "Soft Super-Ellipse",
    description: "Smooth tactile matte cards with generous rounded curves and crisp outlines.",
    font: "font-rounded",
    containerClass: "rounded-3xl border ring-1 ring-inset ring-line/30",
    headerClass: "border-b border-line/30 bg-surface/50",
    highlightClass: "before:via-transparent",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || "var(--color-accent-500)";
      const bg = isDark ? "#18181b" : "#fdfcf7";
      return {
        background: bg,
        borderColor: isEditMode
          ? accent
          : color
            ? `color-mix(in srgb, ${color} 30%, var(--line))`
            : "var(--line)",
        boxShadow: isDark
          ? "0 10px 25px -4px rgba(0, 0, 0, 0.4), 0 4px 10px -2px rgba(0, 0, 0, 0.25)"
          : color
            ? `0 12px 30px -4px color-mix(in srgb, ${color} 12%, rgba(0, 0, 0, 0.08)), 0 4px 10px -2px rgba(0, 0, 0, 0.05)`
            : "0 12px 30px -4px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.05)",
      };
    },
  },
  {
    id: "brutalist",
    name: "Neo-Brutalist",
    tagline: "Bold & High-Contrast",
    description:
      "Sharp 90° corners, thick 2px borders, and solid offset block shadows for maximum punch.",
    font: "font-mono",
    containerClass: "rounded-none",
    headerClass: "border-b-2 border-fg/80 dark:border-fg/70 bg-surface-raised font-bold",
    highlightClass: "before:via-transparent",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || (isDark ? "#38bdf8" : "#2563eb");
      const blockColor = color || (isDark ? "rgba(255,255,255,0.85)" : "#09090b");
      return {
        background: "var(--surface)",
        border: `2px solid ${isEditMode ? accent : isDark ? "#e4e4e7" : "#18181b"}`,
        boxShadow: `4px 4px 0px 0px ${blockColor}`,
      };
    },
  },
  {
    id: "terminal",
    name: "Retro Terminal",
    tagline: "Hacker Console",
    description:
      "Developer console styling with compact corners, scanline accents, and tech grid telemetry.",
    font: "font-mono",
    containerClass: "rounded-sm border-2 font-mono",
    headerClass: "border-b-2 bg-surface-raised/90 font-mono tracking-tight",
    highlightClass: "before:via-transparent",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || (isDark ? "#4ade80" : "#16a34a");
      return {
        background: isDark ? "#090d0b" : "#f4fbf6",
        borderColor: isEditMode ? accent : `color-mix(in srgb, ${accent} 50%, var(--line))`,
        boxShadow: isDark
          ? `0 0 16px -2px color-mix(in srgb, ${accent} 25%, transparent), inset 0 0 8px -2px color-mix(in srgb, ${accent} 10%, transparent)`
          : `0 4px 16px -2px rgba(0, 0, 0, 0.08)`,
      };
    },
  },
  {
    id: "cyber",
    name: "Cyber Deck",
    tagline: "Sci-Fi Telemetry",
    description:
      "High-tech HUD console with dual-tone borders, glowing edge accents, and futuristic telemetry.",
    font: "font-tech",
    containerClass: "rounded-xl ring-1 ring-inset backdrop-blur-xl",
    headerClass:
      "border-b border-accent-500/30 bg-surface-raised/60 tracking-wider text-sub uppercase",
    highlightClass: "before:via-accent-500/40",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || "#06b6d4";
      return {
        background: isDark
          ? `radial-gradient(130% 90% at 100% 0%, color-mix(in srgb, ${accent} 15%, transparent), transparent 70%), #0c1017`
          : `radial-gradient(130% 90% at 100% 0%, color-mix(in srgb, ${accent} 12%, transparent), transparent 70%), #f8fafc`,
        border: `1px solid ${isEditMode ? accent : `color-mix(in srgb, ${accent} 45%, var(--line))`}`,
        boxShadow: `0 8px 30px -4px color-mix(in srgb, ${accent} 22%, transparent), inset 0 0 16px -4px color-mix(in srgb, ${accent} 15%, transparent)`,
      };
    },
  },
  {
    id: "aurora",
    name: "Aurora Prismatic",
    tagline: "Chromatic Shimmer",
    description:
      "Iridescent holographic perimeter glow that gently illuminates surrounding wallpaper.",
    font: "font-sans",
    containerClass: "rounded-2xl ring-1 ring-inset backdrop-blur-xl",
    headerClass: "border-b border-white/20 dark:border-white/10 bg-surface-raised/40",
    highlightClass: "before:via-white/20",
    getShellStyle: (color, isDark, isEditMode) => {
      const accent = color || "#8b5cf6";
      return {
        background: isDark ? "rgba(18, 18, 24, 0.88)" : "rgba(255, 255, 255, 0.88)",
        border: `1px solid ${isEditMode ? accent : `color-mix(in srgb, ${accent} 40%, var(--line))`}`,
        boxShadow: `0 12px 36px -4px color-mix(in srgb, ${accent} 30%, transparent), 0 0 16px -2px color-mix(in srgb, #06b6d4 25%, transparent)`,
      };
    },
  },
  {
    id: "compact",
    name: "Compact Sharp",
    tagline: "Utilitarian Dashboard",
    description:
      "High-density compact corners with sharp hairline outlines, built for multi-monitor setups.",
    font: "font-sans",
    containerClass: "rounded-lg border border-line bg-surface ring-1 ring-inset ring-line/30",
    headerClass: "border-b border-line bg-surface-raised/70",
    highlightClass: "before:via-white/10",
    getShellStyle: (color, _isDark, isEditMode) => {
      const accent = color || "var(--color-accent-500)";
      return {
        borderColor: isEditMode
          ? accent
          : color
            ? `color-mix(in srgb, ${color} 35%, var(--line))`
            : undefined,
        boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.08)",
      };
    },
  },
  {
    id: "custom",
    name: "Custom Studio",
    tagline: "Your Personal Signature",
    description: "Fully customizable typography, corner radius, glass backdrop, and edge glow.",
    font: "font-sans",
    containerClass: "rounded-2xl ring-1 ring-inset backdrop-blur-xl",
    headerClass: "border-b border-line/40 bg-surface-raised/40",
    highlightClass: "before:via-white/20",
    getShellStyle: (color, isDark, isEditMode) => {
      const livePreset = buildCustomPreset(getCustomPresetConfig());
      return livePreset.getShellStyle(color, isDark, isEditMode);
    },
  },
];

export function getWidgetPreset(id?: string): WidgetPreset {
  if (id === "custom") {
    return buildCustomPreset(getCustomPresetConfig());
  }
  return WIDGET_PRESETS.find((p) => p.id === id) ?? WIDGET_PRESETS[0]!;
}

export function getPresetFontFamily(font?: string): string {
  switch (font) {
    case "mono":
    case "font-mono":
      return '"JetBrains Mono", "Cascadia Mono", ui-monospace, monospace';
    case "serif":
    case "font-serif":
      return '"Newsreader", "Charter", "Georgia", "Times New Roman", serif';
    case "rounded":
    case "font-rounded":
      return '"Quicksand", "Nunito", system-ui, sans-serif';
    case "tech":
    case "font-tech":
      return '"Space Mono", "Cascadia Code", "Consolas", monospace';
    case "sans":
    case "font-sans":
    default:
      return '"Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif';
  }
}

export function getPresetRadiusPx(radius?: string): string {
  switch (radius) {
    case "none":
      return "0px";
    case "sm":
      return "6px";
    case "md":
      return "10px";
    case "lg":
      return "16px";
    case "xl":
      return "24px";
    case "full":
      return "32px";
    default:
      return "16px";
  }
}

export function getPresetAppearance(
  presetId?: string,
  customFont?: string,
  _tick?: number,
): {
  fontFamily: string;
  radius: string;
} {
  if (presetId === "custom") {
    const customCfg = getCustomPresetConfig();
    const effectiveFont = customFont || customCfg.font;
    return {
      fontFamily: getPresetFontFamily(effectiveFont),
      radius: getPresetRadiusPx(customCfg.radius),
    };
  }

  const preset = getWidgetPreset(presetId);
  const effectiveFont = customFont || preset.font || "font-sans";

  let radius = "16px";
  if (presetId === "ghost") radius = "0px";
  else if (presetId === "compact") radius = "10px";
  else if (presetId === "retro") radius = "6px";

  return {
    fontFamily: getPresetFontFamily(effectiveFont),
    radius,
  };
}
