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
    name: "Right Dock Bento",
    description: "Multi-column workstation flush against the right screen edge",
  },
  {
    name: "Left Dock Bento",
    description: "Multi-column workstation flush against the left screen edge",
  },
  {
    name: "Flanked Wings",
    description: "Split wings flush against left and right edges, center desktop clear",
  },
  {
    name: "Full-Width Wall",
    description: "Edge-to-edge balanced bento matrix spanning the entire display",
  },
  {
    name: "Top Ribbon Bento",
    description: "Horizontal command strip flush along the top monitor edge",
  },
  {
    name: "Corner Matrix",
    description: "Compact multi-tile command grid flush in the top-right corner",
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
 * Mathematically budgets widget heights in a single vertical column so that
 * the column strictly fits within `maxTotalH` without overflowing or clipping.
 */
function budgetColumnHeights(items: WidgetInstance[], maxTotalH: number, gap: number): number[] {
  const k = items.length;
  if (k === 0) return [];

  const dims = items.map(getWidgetDims);
  if (k === 1) {
    const d = dims[0]!;
    return [Math.min(maxTotalH, Math.max(d.minH, d.defH))];
  }

  const totalGap = (k - 1) * gap;
  const usableH = Math.max(k * 80, maxTotalH - totalGap);

  const sumMin = dims.reduce((acc, d) => acc + d.minH, 0);
  const sumDef = dims.reduce((acc, d) => acc + d.defH, 0);

  const heights: number[] = [];

  if (usableH <= sumMin) {
    // Highly constrained screen: shrink proportionally down to usableH
    const ratio = usableH / sumMin;
    for (const d of dims) {
      heights.push(Math.max(80, Math.floor(d.minH * ratio)));
    }
  } else if (usableH < sumDef) {
    // Intermediate: interpolate between minH and defH
    const t = (usableH - sumMin) / Math.max(1, sumDef - sumMin);
    for (const d of dims) {
      heights.push(Math.round(d.minH + (d.defH - d.minH) * t));
    }
  } else {
    // Ample space: scale up from defH to fill column neatly
    const ratio = usableH / Math.max(1, sumDef);
    for (const d of dims) {
      heights.push(Math.round(d.defH * ratio));
    }
  }

  // Adjust rounding delta onto the last element
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

  const normalizedIdx = Math.abs(layoutIndex) % BENTO_LAYOUT_NAMES.length;
  const layoutMeta = BENTO_LAYOUT_NAMES[normalizedIdx] ?? BENTO_LAYOUT_NAMES[0]!;

  const updated: WidgetInstance[] = [];

  switch (normalizedIdx) {
    // 0: Right Dock Bento (Multi-column flush against right edge)
    case 0: {
      const colCount = widgets.length <= 3 ? 1 : widgets.length <= 7 ? 2 : 3;
      const maxColW = Math.min(380, Math.floor((availW - (colCount - 1) * GAP) / colCount));
      const colW = Math.max(260, maxColW);
      const totalDockW = colCount * colW + (colCount - 1) * GAP;
      const startX = area.x + area.w - EDGE - totalDockW;

      const cols = partitionIntoColumns(widgets, colCount);

      cols.forEach((colWidgets, colIdx) => {
        const colX = startX + colIdx * (colW + GAP);
        const heights = budgetColumnHeights(colWidgets, availH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? getWidgetDims(w).defH;
          updated.push({
            ...w,
            rect: {
              x: colX,
              y: curY,
              w: colW,
              h,
            },
          });
          curY += h + GAP;
        });
      });
      break;
    }

    // 1: Left Dock Bento (Multi-column flush against left edge)
    case 1: {
      const colCount = widgets.length <= 3 ? 1 : widgets.length <= 7 ? 2 : 3;
      const maxColW = Math.min(380, Math.floor((availW - (colCount - 1) * GAP) / colCount));
      const colW = Math.max(260, maxColW);
      const startX = area.x + EDGE;

      const cols = partitionIntoColumns(widgets, colCount);

      cols.forEach((colWidgets, colIdx) => {
        const colX = startX + colIdx * (colW + GAP);
        const heights = budgetColumnHeights(colWidgets, availH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? getWidgetDims(w).defH;
          updated.push({
            ...w,
            rect: {
              x: colX,
              y: curY,
              w: colW,
              h,
            },
          });
          curY += h + GAP;
        });
      });
      break;
    }

    // 2: Flanked Wings (Split wings flush against left and right edges)
    case 2: {
      const half = Math.ceil(widgets.length / 2);
      const leftWidgets = widgets.slice(0, half);
      const rightWidgets = widgets.slice(half);

      const leftColCount = leftWidgets.length > 4 ? 2 : 1;
      const rightColCount = rightWidgets.length > 4 ? 2 : 1;

      const maxWingW = Math.floor(availW * 0.42);
      const leftColW = Math.min(
        360,
        Math.floor((maxWingW - (leftColCount - 1) * GAP) / leftColCount),
      );
      const rightColW = Math.min(
        360,
        Math.floor((maxWingW - (rightColCount - 1) * GAP) / rightColCount),
      );

      // Left wing flush against left edge
      const leftCols = partitionIntoColumns(leftWidgets, leftColCount);
      leftCols.forEach((colWidgets, colIdx) => {
        const colX = area.x + EDGE + colIdx * (leftColW + GAP);
        const heights = budgetColumnHeights(colWidgets, availH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? getWidgetDims(w).defH;
          updated.push({
            ...w,
            rect: {
              x: colX,
              y: curY,
              w: leftColW,
              h,
            },
          });
          curY += h + GAP;
        });
      });

      // Right wing flush against right edge
      const totalRightW = rightColCount * rightColW + (rightColCount - 1) * GAP;
      const rightStartX = area.x + area.w - EDGE - totalRightW;
      const rightCols = partitionIntoColumns(rightWidgets, rightColCount);
      rightCols.forEach((colWidgets, colIdx) => {
        const colX = rightStartX + colIdx * (rightColW + GAP);
        const heights = budgetColumnHeights(colWidgets, availH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? getWidgetDims(w).defH;
          updated.push({
            ...w,
            rect: {
              x: colX,
              y: curY,
              w: rightColW,
              h,
            },
          });
          curY += h + GAP;
        });
      });
      break;
    }

    // 3: Full-Width Wall (Edge-to-edge balanced bento matrix)
    case 3: {
      const colCount = Math.max(2, Math.min(Math.floor(availW / 320), Math.min(widgets.length, 5)));
      const colW = Math.floor((availW - (colCount - 1) * GAP) / colCount);
      const cols = partitionIntoColumns(widgets, colCount);

      cols.forEach((colWidgets, colIdx) => {
        // Last column absorbs any remaining rounding pixels so it's precisely flush with right edge
        const colWidth =
          colIdx === colCount - 1
            ? area.x + area.w - EDGE - (area.x + EDGE + colIdx * (colW + GAP))
            : colW;
        const colX = area.x + EDGE + colIdx * (colW + GAP);
        const heights = budgetColumnHeights(colWidgets, availH, GAP);
        let curY = area.y + EDGE;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? getWidgetDims(w).defH;
          updated.push({
            ...w,
            rect: {
              x: colX,
              y: curY,
              w: colWidth,
              h,
            },
          });
          curY += h + GAP;
        });
      });
      break;
    }

    // 4: Top Ribbon Bento (Horizontal command strip flush along top edge)
    case 4: {
      const startY = area.y + EDGE;
      if (widgets.length <= 5) {
        // Single row spanning from left edge to right edge
        const colCount = widgets.length;
        const colW = Math.floor((availW - (colCount - 1) * GAP) / colCount);
        const maxRibbonH = Math.min(availH * 0.45, 320);

        widgets.forEach((w, idx) => {
          const colWidth =
            idx === colCount - 1
              ? area.x + area.w - EDGE - (area.x + EDGE + idx * (colW + GAP))
              : colW;
          const { minH, defH } = getWidgetDims(w);
          const h = Math.min(maxRibbonH, Math.max(minH, defH));
          updated.push({
            ...w,
            rect: {
              x: area.x + EDGE + idx * (colW + GAP),
              y: startY,
              w: colWidth,
              h,
            },
          });
        });
      } else {
        // Dual row flush to top edge
        const row0Count = Math.ceil(widgets.length / 2);
        const row1Count = Math.floor(widgets.length / 2);
        const row0Items = widgets.slice(0, row0Count);
        const row1Items = widgets.slice(row0Count);

        const rowH = Math.min(Math.floor((availH * 0.6 - GAP) / 2), 260);

        const colW0 = Math.floor((availW - (row0Count - 1) * GAP) / row0Count);
        row0Items.forEach((w, idx) => {
          const colWidth =
            idx === row0Count - 1
              ? area.x + area.w - EDGE - (area.x + EDGE + idx * (colW0 + GAP))
              : colW0;
          updated.push({
            ...w,
            rect: {
              x: area.x + EDGE + idx * (colW0 + GAP),
              y: startY,
              w: colWidth,
              h: rowH,
            },
          });
        });

        const colW1 = Math.floor((availW - (row1Count - 1) * GAP) / row1Count);
        row1Items.forEach((w, idx) => {
          const colWidth =
            idx === row1Count - 1
              ? area.x + area.w - EDGE - (area.x + EDGE + idx * (colW1 + GAP))
              : colW1;
          updated.push({
            ...w,
            rect: {
              x: area.x + EDGE + idx * (colW1 + GAP),
              y: startY + rowH + GAP,
              w: colWidth,
              h: rowH,
            },
          });
        });
      }
      break;
    }

    // 5: Corner Matrix (Flush in top-right corner)
    case 5:
    default: {
      const colCount = widgets.length <= 2 ? 1 : widgets.length <= 6 ? 2 : 3;
      const maxColW = Math.min(380, Math.floor((availW - (colCount - 1) * GAP) / colCount));
      const colW = Math.max(260, maxColW);
      const totalW = colCount * colW + (colCount - 1) * GAP;
      const startX = area.x + area.w - EDGE - totalW;
      const startY = area.y + EDGE;
      const maxMatrixH = Math.min(availH, 680);

      const cols = partitionIntoColumns(widgets, colCount);

      cols.forEach((colWidgets, colIdx) => {
        const colX = startX + colIdx * (colW + GAP);
        const heights = budgetColumnHeights(colWidgets, maxMatrixH, GAP);
        let curY = startY;

        colWidgets.forEach((w, rowIdx) => {
          const h = heights[rowIdx] ?? getWidgetDims(w).defH;
          updated.push({
            ...w,
            rect: {
              x: colX,
              y: curY,
              w: colW,
              h,
            },
          });
          curY += h + GAP;
        });
      });
      break;
    }
  }

  return {
    index: normalizedIdx,
    name: layoutMeta.name,
    description: layoutMeta.description,
    widgets: updated,
  };
}
