/**
 * Color utility for WCAG-compliant contrast and dynamic theme tints.
 * Ensures all text and widget accents remain 100% legible across light and dark modes.
 */

function parseHex(hexStr: string): [number, number, number] {
  let hex = hexStr.replace("#", "").trim();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(hex, 16);
  if (isNaN(num)) {
    return [59, 130, 246]; // default blue
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function toLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Calculates WCAG 2.1 relative luminance for an sRGB color.
 * Range: 0 (black) to 1 (pure white).
 */
export function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Returns contrast-safe accent variants for any chosen color.
 * In light mode, light colors (lime, yellow, light cyan) are deepened for text so contrast >= 4.5:1.
 * In dark mode, dark colors (deep navy, purple) are brightened for text so contrast >= 4.5:1.
 */
export function getContrastSafeAccent(
  colorHex: string | undefined,
  isDark: boolean,
): {
  accent: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
} {
  if (!colorHex || !colorHex.startsWith("#")) {
    const defaultAccent = isDark ? "oklch(0.68 0.16 255)" : "oklch(0.50 0.18 255)";
    return {
      accent: defaultAccent,
      accentText: defaultAccent,
      accentBg: "color-mix(in srgb, var(--color-accent-500) 14%, transparent)",
      accentBorder: "color-mix(in srgb, var(--color-accent-500) 25%, transparent)",
    };
  }

  const [r, g, b] = parseHex(colorHex);
  const lum = getLuminance(r, g, b);

  let accentText: string;

  if (!isDark) {
    // Light mode: background is light (white / near-white).
    // WCAG AA contrast (4.5:1) against white requires luminance <= 0.18.
    if (lum > 0.4) {
      // Very bright colors like lime, yellow, bright cyan, amber
      accentText = `color-mix(in srgb, ${colorHex} 38%, #000000)`;
    } else if (lum > 0.25) {
      // Medium bright colors
      accentText = `color-mix(in srgb, ${colorHex} 55%, #000000)`;
    } else if (lum > 0.18) {
      accentText = `color-mix(in srgb, ${colorHex} 75%, #000000)`;
    } else {
      // Already dark enough
      accentText = colorHex;
    }
  } else {
    // Dark mode: background is dark (#09090b / #18181b).
    // WCAG AA contrast (4.5:1) against dark requires luminance >= 0.24.
    if (lum < 0.1) {
      accentText = `color-mix(in srgb, ${colorHex} 45%, #ffffff)`;
    } else if (lum < 0.22) {
      accentText = `color-mix(in srgb, ${colorHex} 65%, #ffffff)`;
    } else {
      accentText = colorHex;
    }
  }

  return {
    accent: colorHex,
    accentText,
    accentBg: `color-mix(in srgb, ${colorHex} 14%, transparent)`,
    accentBorder: `color-mix(in srgb, ${colorHex} 28%, transparent)`,
  };
}
