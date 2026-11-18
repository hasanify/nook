export interface WidgetPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  containerClass: string;
  headerClass: string;
  hasBlur: boolean;
  highlightClass: string;
  previewBg: string;
  previewBorder: string;
}

export const WIDGET_PRESETS: WidgetPreset[] = [
  {
    id: "default",
    name: "Clean Modern",
    tagline: "Solid & Balanced",
    description: "Solid surface, refined hairline borders, and subtle elevation.",
    containerClass: "rounded-2xl border border-line/70 bg-surface shadow-card",
    headerClass: "border-b border-line/40 bg-surface-raised/40",
    hasBlur: false,
    highlightClass: "before:via-white/10",
    previewBg: "bg-surface",
    previewBorder: "border-line/70",
  },
  {
    id: "glass",
    name: "Frosted Glass",
    tagline: "Mica & Aero Blur",
    description: "Translucent frosted glass with real-time blur and luminous specular edges.",
    containerClass: "rounded-2xl border border-white/20 bg-surface/65 backdrop-blur-xl shadow-lg",
    headerClass: "border-b border-white/10 bg-surface-raised/30 backdrop-blur-md",
    hasBlur: true,
    highlightClass: "before:via-white/30",
    previewBg: "bg-surface/60 backdrop-blur-md",
    previewBorder: "border-white/25",
  },
  {
    id: "ghost",
    name: "Ghost Minimal",
    tagline: "Ultra-Sheer Float",
    description: "Whisper-thin translucent look that floats naturally on your desktop wallpaper.",
    containerClass: "rounded-2xl border border-line/30 bg-surface/35 backdrop-blur-md shadow-sm",
    headerClass: "border-b border-line/20 bg-surface-raised/20",
    hasBlur: true,
    highlightClass: "before:via-transparent",
    previewBg: "bg-surface/30 backdrop-blur-sm",
    previewBorder: "border-line/30",
  },
  {
    id: "obsidian",
    name: "Obsidian Glow",
    tagline: "Cyberpunk Aura",
    description: "Pitch-black dark surface with vibrant accent borders and neon glow aura.",
    containerClass:
      "rounded-2xl border border-accent-500/50 bg-neutral-950/90 shadow-[0_0_24px_-4px_color-mix(in_srgb,var(--color-accent-500)_30%,transparent)]",
    headerClass: "border-b border-accent-500/30 bg-neutral-900/60",
    hasBlur: false,
    highlightClass: "before:via-accent-500/40",
    previewBg: "bg-neutral-950",
    previewBorder: "border-accent-500/50",
  },
  {
    id: "paper",
    name: "Warm Paper",
    tagline: "Soft Super-Ellipse",
    description: "Smooth tactile matte cards with generous rounded curves and crisp outlines.",
    containerClass: "rounded-3xl border border-line/80 bg-surface-raised shadow-md",
    headerClass: "border-b border-line/40 bg-surface/50",
    hasBlur: false,
    highlightClass: "before:via-transparent",
    previewBg: "bg-surface-raised",
    previewBorder: "border-line/80",
  },
  {
    id: "compact",
    name: "Compact Sharp",
    tagline: "Utilitarian Dashboard",
    description: "Sharp compact corners with high-contrast outlines for dense desktop setups.",
    containerClass: "rounded-lg border border-line bg-surface shadow-xs",
    headerClass: "border-b border-line bg-surface-raised/60",
    hasBlur: false,
    highlightClass: "before:via-white/10",
    previewBg: "bg-surface",
    previewBorder: "border-line",
  },
];

export function getWidgetPreset(id?: string): WidgetPreset {
  return WIDGET_PRESETS.find((p) => p.id === id) ?? WIDGET_PRESETS[0]!;
}
