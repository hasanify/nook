import type React from "react";

export interface WidgetPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  containerClass: string;
  headerClass: string;
  highlightClass: string;
  getShellStyle: (color?: string, isDark?: boolean, isEditMode?: boolean) => React.CSSProperties;
}

export const WIDGET_PRESETS: WidgetPreset[] = [
  {
    id: "default",
    name: "Clean Modern",
    tagline: "Solid & Balanced",
    description: "Solid surface, refined hairline borders, and subtle elevation.",
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
    id: "obsidian",
    name: "Obsidian Glow",
    tagline: "Cyberpunk Aura",
    description: "Pitch-black dark surface with vibrant accent borders and neon glow aura.",
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
    containerClass: "rounded-xl ring-1 ring-inset backdrop-blur-xl",
    headerClass:
      "border-b border-accent-500/30 bg-surface-raised/60 tracking-wider text-[11px] uppercase",
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
];

export function getWidgetPreset(id?: string): WidgetPreset {
  return WIDGET_PRESETS.find((p) => p.id === id) ?? WIDGET_PRESETS[0]!;
}
