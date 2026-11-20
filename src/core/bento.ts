import type { WidgetInstance } from "./types";
import { getWidgetModule } from "../widgets/registry";
import { setBounds, batchSetBounds } from "./ipc";

export interface BentoLayoutResult {
  index: number;
  name: string;
  description: string;
  widgets: WidgetInstance[];
}

export interface WorkArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function applyBentoLayout(widgets: WidgetInstance[]): Promise<void> {
  if (widgets.length === 0) return;
  try {
    await batchSetBounds(
      widgets.map((w) => ({
        id: w.id,
        x: w.rect.x,
        y: w.rect.y,
        w: w.rect.w,
        h: w.rect.h,
      })),
    );
  } catch {
    for (const w of widgets) {
      try {
        await setBounds(w.id, w.rect.x, w.rect.y, w.rect.w, w.rect.h, true);
      } catch {
        // Ignore fallback errors
      }
    }
  }
}

export const BENTO_LAYOUT_NAMES = [
  {
    name: "Full-Width Wall",
    description: "Edge-to-edge multi-column bento matrix spanning the entire monitor",
  },
  {
    name: "Top Panoramic Hero",
    description: "Full-width top hero with balanced companion columns below",
  },
  {
    name: "Bottom Anchor Banner",
    description: "Multi-column wall anchored by a full-width panoramic base",
  },
  {
    name: "Left Feature Pillar",
    description: "Full-height left showcase with edge-to-edge companion grid",
  },
  {
    name: "Right Feature Pillar",
    description: "Full-height right showcase with edge-to-edge companion grid",
  },
  {
    name: "Dual-Tier Horizontal",
    description: "Stacked horizontal bands spanning edge-to-edge across the screen",
  },
];

function getWidgetDims(w: WidgetInstance): {
  minW: number;
  minH: number;
  defW: number;
  defH: number;
} {
  const mod = getWidgetModule(w.kind || (w as unknown as { type?: string }).type || "");
  const minW = Math.max(mod?.manifest.minSize.w ?? 220, 160);
  const minH = Math.max(mod?.manifest.minSize.h ?? 140, 100);
  const defW = Math.max(mod?.manifest.defaultSize?.w ?? minW, minW);
  const defH = Math.max(mod?.manifest.defaultSize?.h ?? minH, minH);
  return { minW, minH, defW, defH };
}

/**
 * Deterministically shuffles the widgets array based on a cycle seed.
 * Ensures infinite variation while maintaining repeatability for the same cycle index.
 */
function permuteWidgets(widgets: WidgetInstance[], cycle: number): WidgetInstance[] {
  if (widgets.length <= 1 || cycle === 0) return [...widgets];
  const copy = [...widgets];
  let s = (cycle * 1664525 + 1013904223) >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((s / 4294967296) * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Mathematically budgets column widths so that columns fill the total available width
 * precisely from left to right edge, with zero rounding gaps or overflow.
 */
function budgetColumnWidths(colWeights: number[], totalAvailW: number, gap: number): number[] {
  const c = colWeights.length;
  if (c === 0) return [];
  if (c === 1) return [totalAvailW];

  const totalGap = (c - 1) * gap;
  const usableW = Math.max(c * 160, totalAvailW - totalGap);
  const sumWeights = colWeights.reduce((acc, w) => acc + w, 0);

  const widths: number[] = [];
  for (const w of colWeights) {
    widths.push(Math.max(160, Math.floor((w / sumWeights) * usableW)));
  }

  // Adjust rounding delta onto the last column so it hits the right edge precisely
  const currentSum = widths.reduce((acc, w) => acc + w, 0);
  const delta = usableW - currentSum;
  if (widths.length > 0) {
    const lastIdx = widths.length - 1;
    widths[lastIdx] = Math.max(160, (widths[lastIdx] ?? 160) + delta);
  }

  return widths;
}

/**
 * Mathematically budgets widget heights in a single vertical column so that
 * the column strictly fits within `maxTotalH` without overflowing or clipping.
 */
function budgetColumnHeights(items: WidgetInstance[], maxTotalH: number, gap: number): number[] {
  const k = items.length;
  if (k === 0) return [];

  const dims = items.map(getWidgetDims);
  if (k === 1) {
    return [maxTotalH];
  }

  const totalGap = (k - 1) * gap;
  const usableH = Math.max(k * 80, maxTotalH - totalGap);

  const sumMin = dims.reduce((acc, d) => acc + d.minH, 0);
  const sumDef = dims.reduce((acc, d) => acc + d.defH, 0);

  const heights: number[] = [];

  if (usableH <= sumMin) {
    const ratio = usableH / sumMin;
    for (const d of dims) {
      heights.push(Math.max(80, Math.floor(d.minH * ratio)));
    }
  } else if (usableH < sumDef) {
    const t = (usableH - sumMin) / Math.max(1, sumDef - sumMin);
    for (const d of dims) {
      heights.push(Math.round(d.minH + (d.defH - d.minH) * t));
    }
  } else {
    const ratio = usableH / Math.max(1, sumDef);
    for (const d of dims) {
      heights.push(Math.round(d.defH * ratio));
    }
  }

  // Adjust rounding delta onto the last element so total height equals maxTotalH exactly
  const currentSum = heights.reduce((acc, h) => acc + h, 0);
  const delta = usableH - currentSum;
  if (heights.length > 0) {
    const lastIdx = heights.length - 1;
    heights[lastIdx] = Math.max(80, (heights[lastIdx] ?? 80) + delta);
  }

  return heights;
}

/**
 * Greedily partitions widgets into columns to achieve the most balanced vertical weight.
 */
function partitionIntoColumns(items: WidgetInstance[], columnCount: number): WidgetInstance[][] {
  const cols: WidgetInstance[][] = Array.from({ length: columnCount }, () => []);
  const colHeights: number[] = new Array(columnCount).fill(0);

  items.forEach((item) => {
    let minCol = 0;
    let minH = colHeights[0] ?? 0;
    for (let c = 1; c < columnCount; c++) {
      const h = colHeights[c] ?? 0;
      if (h < minH) {
        minH = h;
        minCol = c;
      }
    }
    cols[minCol]!.push(item);
    const { defH } = getWidgetDims(item);
    colHeights[minCol] = (colHeights[minCol] ?? 0) + defH;
  });

  return cols;
}

export function computeBentoLayout(
  widgets: WidgetInstance[],
  layoutIndex: number,
  workAreaOrWidth?: WorkArea | number,
  screenHeight?: number,
): BentoLayoutResult {
  if (widgets.length === 0) {
    return {
      index: 0,
      name: "Empty",
      description: "No active widgets to arrange",
      widgets: [],
    };
  }

  let area: WorkArea;
  if (typeof workAreaOrWidth === "object" && workAreaOrWidth !== null) {
    area = workAreaOrWidth;
  } else {
    area = {
      x: 0,
      y: 0,
      w: typeof workAreaOrWidth === "number" ? workAreaOrWidth : 1920,
      h: typeof screenHeight === "number" ? screenHeight : 1080,
    };
  }

  const EDGE = 12;
  const GAP = 12;
  const availW = Math.max(area.w - EDGE * 2, 400);
  const availH = Math.max(area.h - EDGE * 2, 300);

  const cycle = Math.max(0, layoutIndex);
  const updated: WidgetInstance[] = [];

  // Single widget fills the entire available work area
  if (widgets.length === 1) {
    const w = widgets[0]!;
    return {
      index: cycle,
      name: "Full Display",
      description: "Single widget expanded to full monitor work area",
      widgets: [
        {
          ...w,
          rect: {
            x: area.x + EDGE,
            y: area.y + EDGE,
            w: availW,
            h: availH,
          },
        },
      ],
    };
  }

  // Permute widgets order on each cycle for infinite variety
  const permuted = permuteWidgets(widgets, cycle);
  const N = permuted.length;

  // Determine structural strategy (6 procedural archetypes)
  const strategyIdx = cycle % 6;

  let layoutName = "Full-Width Bento Wall";
  let layoutDesc = "Edge-to-edge multi-column bento matrix spanning the entire monitor";

  switch (strategyIdx) {
    // 0: Full-Width Multi-Column Wall (Masonry with variable widths)
    case 0: {
      const maxCols = Math.max(2, Math.min(N, Math.floor(availW / 260)));
      const minCols = Math.max(2, Math.min(N, Math.floor(availW / 460)));
      const colRange = Math.max(1, maxCols - minCols + 1);
      const colCount = minCols + (Math.floor(cycle / 6) % colRange);

      const weights: number[] = new Array(colCount).fill(1.0);
      const variant = (cycle + Math.floor(cycle / 3)) % 4;
      if (variant === 1) {
        // Left column wider
        weights[0] = 1.45;
      } else if (variant === 2) {
        // Right column wider
        weights[colCount - 1] = 1.45;
      } else if (variant === 3 && colCount >= 3) {
        // Center column wider
        const mid = Math.floor(colCount / 2);
        weights[mid] = 1.5;
      }

      const colWidths = budgetColumnWidths(weights, availW, GAP);
      const cols = partitionIntoColumns(permuted, colCount);

      let curX = area.x + EDGE;
      cols.forEach((colWidgets, colIdx) => {
        const cWidth = colWidths[colIdx] ?? Math.floor(availW / colCount);
        const heights = budgetColumnHeights(colWidgets, availH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? Math.floor(availH / colWidgets.length);
          updated.push({
            ...w,
            rect: {
              x: curX,
              y: curY,
              w: cWidth,
              h,
            },
          });
          curY += h + GAP;
        });

        curX += cWidth + GAP;
      });

      layoutName = `Full-Width Wall (${colCount} Columns)`;
      layoutDesc = "Edge-to-edge multi-column bento matrix spanning the entire monitor";
      break;
    }

    // 1: Top Panoramic Hero + Edge-to-Edge Grid
    case 1: {
      if (N < 3) {
        // 2 widgets: split 50/50 vertically edge-to-edge
        const colWidths = budgetColumnWidths([1, 1], availW, GAP);
        permuted.forEach((w, idx) => {
          const cWidth = colWidths[idx] ?? Math.floor((availW - GAP) / 2);
          const x = area.x + EDGE + idx * ((colWidths[0] ?? 0) + GAP);
          updated.push({
            ...w,
            rect: { x, y: area.y + EDGE, w: cWidth, h: availH },
          });
        });
        layoutName = "Dual Pillar Split";
        layoutDesc = "Two equal columns spanning edge-to-edge across the monitor";
        break;
      }

      const heroCount = N >= 6 && cycle % 2 === 1 ? 2 : 1;
      const heroWidgets = permuted.slice(0, heroCount);
      const bodyWidgets = permuted.slice(heroCount);

      const heroH = Math.min(Math.max(Math.round(availH * 0.32), 160), 280);
      const bodyH = availH - heroH - GAP;

      // Top Hero row (spans edge-to-edge)
      const heroWidths = budgetColumnWidths(new Array(heroCount).fill(1), availW, GAP);
      let heroX = area.x + EDGE;
      heroWidgets.forEach((w, idx) => {
        const hW = heroWidths[idx] ?? availW;
        updated.push({
          ...w,
          rect: {
            x: heroX,
            y: area.y + EDGE,
            w: hW,
            h: heroH,
          },
        });
        heroX += hW + GAP;
      });

      // Bottom section columns (spans edge-to-edge)
      const colCount = Math.max(2, Math.min(bodyWidgets.length, Math.floor(availW / 300)));
      const colWidths = budgetColumnWidths(new Array(colCount).fill(1), availW, GAP);
      const cols = partitionIntoColumns(bodyWidgets, colCount);

      let curX = area.x + EDGE;
      cols.forEach((colWidgets, colIdx) => {
        const cWidth = colWidths[colIdx] ?? Math.floor(availW / colCount);
        const heights = budgetColumnHeights(colWidgets, bodyH, GAP);
        let curY = area.y + EDGE + heroH + GAP;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? Math.floor(bodyH / colWidgets.length);
          updated.push({
            ...w,
            rect: {
              x: curX,
              y: curY,
              w: cWidth,
              h,
            },
          });
          curY += h + GAP;
        });

        curX += cWidth + GAP;
      });

      layoutName = heroCount === 1 ? "Top Panoramic Hero + Grid" : "Top Dual Heroes + Grid";
      layoutDesc = "Full-width top hero banner with balanced companion columns below";
      break;
    }

    // 2: Bottom Anchor Banner + Edge-to-Edge Grid
    case 2: {
      if (N < 3) {
        // 2 widgets: split 50/50 horizontally edge-to-edge
        const heights = budgetColumnHeights(permuted, availH, GAP);
        let curY = area.y + EDGE;
        permuted.forEach((w, idx) => {
          const h = heights[idx] ?? Math.floor((availH - GAP) / 2);
          updated.push({
            ...w,
            rect: { x: area.x + EDGE, y: curY, w: availW, h },
          });
          curY += h + GAP;
        });
        layoutName = "Dual Row Stack";
        layoutDesc = "Two stacked horizontal rows spanning edge-to-edge";
        break;
      }

      const anchorCount = N >= 6 && cycle % 2 === 1 ? 2 : 1;
      const anchorWidgets = permuted.slice(N - anchorCount);
      const bodyWidgets = permuted.slice(0, N - anchorCount);

      const anchorH = Math.min(Math.max(Math.round(availH * 0.32), 160), 280);
      const bodyH = availH - anchorH - GAP;

      // Top section columns (spans edge-to-edge)
      const colCount = Math.max(2, Math.min(bodyWidgets.length, Math.floor(availW / 300)));
      const colWidths = budgetColumnWidths(new Array(colCount).fill(1), availW, GAP);
      const cols = partitionIntoColumns(bodyWidgets, colCount);

      let curX = area.x + EDGE;
      cols.forEach((colWidgets, colIdx) => {
        const cWidth = colWidths[colIdx] ?? Math.floor(availW / colCount);
        const heights = budgetColumnHeights(colWidgets, bodyH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? Math.floor(bodyH / colWidgets.length);
          updated.push({
            ...w,
            rect: {
              x: curX,
              y: curY,
              w: cWidth,
              h,
            },
          });
          curY += h + GAP;
        });

        curX += cWidth + GAP;
      });

      // Bottom anchor banner (spans edge-to-edge)
      const anchorWidths = budgetColumnWidths(new Array(anchorCount).fill(1), availW, GAP);
      let anchorX = area.x + EDGE;
      anchorWidgets.forEach((w, idx) => {
        const aW = anchorWidths[idx] ?? availW;
        updated.push({
          ...w,
          rect: {
            x: anchorX,
            y: area.y + EDGE + bodyH + GAP,
            w: aW,
            h: anchorH,
          },
        });
        anchorX += aW + GAP;
      });

      layoutName = anchorCount === 1 ? "Bottom Anchor Banner + Grid" : "Bottom Dual Anchors + Grid";
      layoutDesc = "Multi-column wall anchored by a full-width panoramic base";
      break;
    }

    // 3: Left Feature Pillar + Edge-to-Edge Right Wall
    case 3: {
      if (N < 3) {
        // Fallback to 2-column wall
        const colWidths = budgetColumnWidths([1.4, 1], availW, GAP);
        permuted.forEach((w, idx) => {
          const cWidth = colWidths[idx] ?? Math.floor((availW - GAP) / 2);
          const x = area.x + EDGE + idx * ((colWidths[0] ?? 0) + GAP);
          updated.push({
            ...w,
            rect: { x, y: area.y + EDGE, w: cWidth, h: availH },
          });
        });
        layoutName = "Left Dominant Split";
        layoutDesc = "Prominent left feature column with edge-to-edge right companion";
        break;
      }

      const pillarCount = N >= 5 && cycle % 2 === 1 ? 2 : 1;
      const pillarWidgets = permuted.slice(0, pillarCount);
      const rightWidgets = permuted.slice(pillarCount);

      const pillarW = Math.min(Math.max(Math.round(availW * 0.36), 280), 500);
      const rightAvailW = availW - pillarW - GAP;

      // Left Pillar (touches left edge, fills full height)
      const pillarHeights = budgetColumnHeights(pillarWidgets, availH, GAP);
      let pillarY = area.y + EDGE;
      pillarWidgets.forEach((w, idx) => {
        const h = pillarHeights[idx] ?? Math.floor(availH / pillarCount);
        updated.push({
          ...w,
          rect: {
            x: area.x + EDGE,
            y: pillarY,
            w: pillarW,
            h,
          },
        });
        pillarY += h + GAP;
      });

      // Right Wall (touches right edge, fills full height)
      const rightColCount = Math.max(
        1,
        Math.min(rightWidgets.length, Math.floor(rightAvailW / 260)),
      );
      const rightColWidths = budgetColumnWidths(new Array(rightColCount).fill(1), rightAvailW, GAP);
      const rightCols = partitionIntoColumns(rightWidgets, rightColCount);

      let curX = area.x + EDGE + pillarW + GAP;
      rightCols.forEach((colWidgets, colIdx) => {
        const cWidth = rightColWidths[colIdx] ?? Math.floor(rightAvailW / rightColCount);
        const heights = budgetColumnHeights(colWidgets, availH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? Math.floor(availH / colWidgets.length);
          updated.push({
            ...w,
            rect: {
              x: curX,
              y: curY,
              w: cWidth,
              h,
            },
          });
          curY += h + GAP;
        });

        curX += cWidth + GAP;
      });

      layoutName = "Left Feature Pillar + Wall";
      layoutDesc = "Full-height left showcase with edge-to-edge companion grid";
      break;
    }

    // 4: Right Feature Pillar + Edge-to-Edge Left Wall
    case 4: {
      if (N < 3) {
        // Fallback to 2-column wall
        const colWidths = budgetColumnWidths([1, 1.4], availW, GAP);
        permuted.forEach((w, idx) => {
          const cWidth = colWidths[idx] ?? Math.floor((availW - GAP) / 2);
          const x = area.x + EDGE + idx * ((colWidths[0] ?? 0) + GAP);
          updated.push({
            ...w,
            rect: { x, y: area.y + EDGE, w: cWidth, h: availH },
          });
        });
        layoutName = "Right Dominant Split";
        layoutDesc = "Prominent right feature column with edge-to-edge left companion";
        break;
      }

      const pillarCount = N >= 5 && cycle % 2 === 1 ? 2 : 1;
      const pillarWidgets = permuted.slice(N - pillarCount);
      const leftWidgets = permuted.slice(0, N - pillarCount);

      const pillarW = Math.min(Math.max(Math.round(availW * 0.36), 280), 500);
      const leftAvailW = availW - pillarW - GAP;

      // Left Wall (touches left edge, fills full height)
      const leftColCount = Math.max(1, Math.min(leftWidgets.length, Math.floor(leftAvailW / 260)));
      const leftColWidths = budgetColumnWidths(new Array(leftColCount).fill(1), leftAvailW, GAP);
      const leftCols = partitionIntoColumns(leftWidgets, leftColCount);

      let curX = area.x + EDGE;
      leftCols.forEach((colWidgets, colIdx) => {
        const cWidth = leftColWidths[colIdx] ?? Math.floor(leftAvailW / leftColCount);
        const heights = budgetColumnHeights(colWidgets, availH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? Math.floor(availH / colWidgets.length);
          updated.push({
            ...w,
            rect: {
              x: curX,
              y: curY,
              w: cWidth,
              h,
            },
          });
          curY += h + GAP;
        });

        curX += cWidth + GAP;
      });

      // Right Pillar (touches right edge, fills full height)
      const pillarHeights = budgetColumnHeights(pillarWidgets, availH, GAP);
      let pillarY = area.y + EDGE;
      const pillarStartX = area.x + EDGE + leftAvailW + GAP;
      pillarWidgets.forEach((w, idx) => {
        const h = pillarHeights[idx] ?? Math.floor(availH / pillarCount);
        updated.push({
          ...w,
          rect: {
            x: pillarStartX,
            y: pillarY,
            w: pillarW,
            h,
          },
        });
        pillarY += h + GAP;
      });

      layoutName = "Right Feature Pillar + Wall";
      layoutDesc = "Full-height right showcase with edge-to-edge companion grid";
      break;
    }

    // 5: Dual-Tier Horizontal Bento (2 full-width rows)
    case 5:
    default: {
      if (N < 4) {
        // Fallback to multi-column
        const colCount = Math.max(2, Math.min(N, 3));
        const colWidths = budgetColumnWidths(new Array(colCount).fill(1), availW, GAP);
        const cols = partitionIntoColumns(permuted, colCount);

        let curX = area.x + EDGE;
        cols.forEach((colWidgets, colIdx) => {
          const cWidth = colWidths[colIdx] ?? Math.floor(availW / colCount);
          const heights = budgetColumnHeights(colWidgets, availH, GAP);
          let curY = area.y + EDGE;

          colWidgets.forEach((w, rowIdx) => {
            const h = heights[rowIdx] ?? Math.floor(availH / colWidgets.length);
            updated.push({
              ...w,
              rect: {
                x: curX,
                y: curY,
                w: cWidth,
                h,
              },
            });
            curY += h + GAP;
          });

          curX += cWidth + GAP;
        });
        layoutName = `Full-Width Wall (${colCount} Columns)`;
        layoutDesc = "Edge-to-edge multi-column bento matrix spanning the entire monitor";
        break;
      }

      const row0Count = Math.ceil(N / 2);
      const row0Widgets = permuted.slice(0, row0Count);
      const row1Widgets = permuted.slice(row0Count);

      const rowRatio = cycle % 3 === 0 ? 0.5 : cycle % 3 === 1 ? 0.44 : 0.56;
      const row0H = Math.floor((availH - GAP) * rowRatio);
      const row1H = availH - row0H - GAP;

      // Row 0 columns (touches left and right edges)
      const colWidths0 = budgetColumnWidths(new Array(row0Count).fill(1), availW, GAP);
      let curX0 = area.x + EDGE;
      row0Widgets.forEach((w, idx) => {
        const cWidth = colWidths0[idx] ?? Math.floor(availW / row0Count);
        updated.push({
          ...w,
          rect: {
            x: curX0,
            y: area.y + EDGE,
            w: cWidth,
            h: row0H,
          },
        });
        curX0 += cWidth + GAP;
      });

      // Row 1 columns (touches left and right edges)
      const colWidths1 = budgetColumnWidths(new Array(row1Widgets.length).fill(1), availW, GAP);
      let curX1 = area.x + EDGE;
      row1Widgets.forEach((w, idx) => {
        const cWidth = colWidths1[idx] ?? Math.floor(availW / row1Widgets.length);
        updated.push({
          ...w,
          rect: {
            x: curX1,
            y: area.y + EDGE + row0H + GAP,
            w: cWidth,
            h: row1H,
          },
        });
        curX1 += cWidth + GAP;
      });

      layoutName = "Dual-Tier Horizontal Bento";
      layoutDesc = "Stacked horizontal bands spanning edge-to-edge across the screen";
      break;
    }
  }

  return {
    index: cycle,
    name: layoutName,
    description: layoutDesc,
    widgets: updated,
  };
}
