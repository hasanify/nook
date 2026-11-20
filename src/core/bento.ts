import type { WidgetInstance } from "./types";
import { getWidgetModule } from "../widgets/registry";
import { setBounds } from "./ipc";

export interface BentoLayoutResult {
  index: number;
  name: string;
  description: string;
  widgets: WidgetInstance[];
}

export async function applyBentoLayout(widgets: WidgetInstance[]): Promise<void> {
  for (const w of widgets) {
    try {
      await setBounds(w.id, w.rect.x, w.rect.y, w.rect.w, w.rect.h, true);
    } catch {
      // Ignore IPC errors during bulk rearrangement
    }
  }
}

export const BENTO_LAYOUT_NAMES = [
  {
    name: "Modern Bento",
    description: "Asymmetric hero banner with modular balanced companion tiles",
  },
  {
    name: "Triple Column Masonry",
    description: "Evenly balanced 3-column dashboard across the desktop",
  },
  {
    name: "Right Sidebar Dock",
    description: "Compact dual-column workstation anchored on the right edge",
  },
  {
    name: "Panoramic Grid",
    description: "Full-width multi-column matrix with uniform spacing",
  },
  {
    name: "Twin Cockpit (Split)",
    description: "Balanced left and right wings leaving center wallpaper clear",
  },
  {
    name: "Centered Studio",
    description: "Harmonious cluster centered directly in the main view",
  },
];

function getWidgetDims(w: WidgetInstance): {
  minW: number;
  minH: number;
  defW: number;
  defH: number;
} {
  const mod = getWidgetModule(w.kind || w.type || "");
  const minW = Math.max(mod?.manifest.minSize.w ?? 220, 180);
  const minH = Math.max(mod?.manifest.minSize.h ?? 160, 120);
  const defW = Math.max(mod?.manifest.defaultSize?.w ?? minW, minW);
  const defH = Math.max(mod?.manifest.defaultSize?.h ?? minH, minH);
  return { minW, minH, defW, defH };
}

export function computeBentoLayout(
  widgets: WidgetInstance[],
  layoutIndex: number,
  screenWidth = 1920,
  screenHeight = 1080,
): BentoLayoutResult {
  if (widgets.length === 0) {
    return {
      index: 0,
      name: "Empty",
      description: "No active widgets to arrange",
      widgets: [],
    };
  }

  const normalizedIdx = Math.abs(layoutIndex) % BENTO_LAYOUT_NAMES.length;
  const layoutMeta = BENTO_LAYOUT_NAMES[normalizedIdx] ?? BENTO_LAYOUT_NAMES[0]!;

  const GAP = 16;
  const MARGIN_X = 40;
  const MARGIN_Y = 40;
  const availW = Math.max(screenWidth - MARGIN_X * 2, 600);

  const updated: WidgetInstance[] = [];

  switch (normalizedIdx) {
    // 0: Modern Bento (Hero + 2-3 companion columns)
    case 0: {
      const colCount = availW >= 1400 ? 3 : 2;
      const colWidth = Math.floor((availW - (colCount - 1) * GAP) / colCount);

      // Hero takes 2 columns if colCount >= 3, else 1
      const heroSpan = colCount >= 3 ? 2 : 1;
      const heroW = heroSpan * colWidth + (heroSpan - 1) * GAP;

      const colHeights: number[] = new Array<number>(colCount).fill(MARGIN_Y);

      widgets.forEach((widget, idx) => {
        const { minW, minH, defH } = getWidgetDims(widget);

        if (idx === 0 && heroSpan > 1) {
          // Place hero across cols 0 and 1
          const heroH = Math.max(defH, 220);
          updated.push({
            ...widget,
            rect: {
              x: MARGIN_X,
              y: MARGIN_Y,
              w: Math.max(heroW, minW),
              h: Math.max(heroH, minH),
            },
          });
          colHeights[0] = (colHeights[0] ?? MARGIN_Y) + heroH + GAP;
          colHeights[1] = (colHeights[1] ?? MARGIN_Y) + heroH + GAP;
        } else {
          // Find shortest available column
          let targetCol = 0;
          let minColH = colHeights[0] ?? MARGIN_Y;
          for (let c = 1; c < colCount; c++) {
            const currentH = colHeights[c] ?? MARGIN_Y;
            if (currentH < minColH) {
              minColH = currentH;
              targetCol = c;
            }
          }

          const targetX = MARGIN_X + targetCol * (colWidth + GAP);
          const targetY = colHeights[targetCol] ?? MARGIN_Y;
          const targetH = Math.max(defH, minH);

          updated.push({
            ...widget,
            rect: {
              x: targetX,
              y: targetY,
              w: Math.max(colWidth, minW),
              h: targetH,
            },
          });

          colHeights[targetCol] = targetY + targetH + GAP;
        }
      });
      break;
    }

    // 1: Triple Column Masonry
    case 1: {
      const colCount = Math.min(Math.max(Math.floor(availW / 340), 2), 4);
      const colWidth = Math.floor((availW - (colCount - 1) * GAP) / colCount);
      const colHeights: number[] = new Array<number>(colCount).fill(MARGIN_Y);

      widgets.forEach((widget) => {
        const { minW, minH, defH } = getWidgetDims(widget);

        // Find column with least height
        let targetCol = 0;
        let minHCol = colHeights[0] ?? MARGIN_Y;
        for (let c = 1; c < colCount; c++) {
          const currentH = colHeights[c] ?? MARGIN_Y;
          if (currentH < minHCol) {
            minHCol = currentH;
            targetCol = c;
          }
        }

        const targetX = MARGIN_X + targetCol * (colWidth + GAP);
        const targetY = colHeights[targetCol] ?? MARGIN_Y;
        const targetH = Math.max(defH, minH);

        updated.push({
          ...widget,
          rect: {
            x: targetX,
            y: targetY,
            w: Math.max(colWidth, minW),
            h: targetH,
          },
        });

        colHeights[targetCol] = targetY + targetH + GAP;
      });
      break;
    }

    // 2: Right Sidebar Dock (Dual Columns on Right edge)
    case 2: {
      const colWidth = Math.min(340, Math.floor((availW - GAP) / 2));
      const startX = screenWidth - MARGIN_X - (colWidth * 2 + GAP);
      const colHeights: [number, number] = [MARGIN_Y, MARGIN_Y];

      widgets.forEach((widget) => {
        const { minW, minH, defH } = getWidgetDims(widget);
        const targetCol: 0 | 1 = colHeights[0] <= colHeights[1] ? 0 : 1;
        const targetX = startX + targetCol * (colWidth + GAP);
        const targetY = colHeights[targetCol];
        const targetH = Math.max(defH, minH);

        updated.push({
          ...widget,
          rect: {
            x: Math.max(targetX, 0),
            y: targetY,
            w: Math.max(colWidth, minW),
            h: targetH,
          },
        });

        colHeights[targetCol] = targetY + targetH + GAP;
      });
      break;
    }

    // 3: Panoramic Grid (Wide matrix)
    case 3: {
      const colCount = Math.min(Math.max(Math.floor(availW / 360), 2), 5);
      const colWidth = Math.floor((availW - (colCount - 1) * GAP) / colCount);

      let currentX = MARGIN_X;
      let currentY = MARGIN_Y;
      let rowMaxH = 0;

      widgets.forEach((widget, idx) => {
        const { minW, minH, defH } = getWidgetDims(widget);
        const colIdx = idx % colCount;

        if (colIdx === 0 && idx > 0) {
          currentX = MARGIN_X;
          currentY += rowMaxH + GAP;
          rowMaxH = 0;
        }

        const targetH = Math.max(defH, minH);
        rowMaxH = Math.max(rowMaxH, targetH);

        updated.push({
          ...widget,
          rect: {
            x: currentX,
            y: currentY,
            w: Math.max(colWidth, minW),
            h: targetH,
          },
        });

        currentX += colWidth + GAP;
      });
      break;
    }

    // 4: Twin Cockpit (Split Left & Right wings)
    case 4: {
      const wingWidth = Math.min(360, Math.floor(availW * 0.32));
      const rightStartX = screenWidth - MARGIN_X - wingWidth;

      let leftY = MARGIN_Y;
      let rightY = MARGIN_Y;

      widgets.forEach((widget, idx) => {
        const { minW, minH, defH } = getWidgetDims(widget);
        const isLeft = idx % 2 === 0;
        const targetX = isLeft ? MARGIN_X : rightStartX;
        const targetY = isLeft ? leftY : rightY;
        const targetH = Math.max(defH, minH);

        updated.push({
          ...widget,
          rect: {
            x: targetX,
            y: targetY,
            w: Math.max(wingWidth, minW),
            h: targetH,
          },
        });

        if (isLeft) {
          leftY += targetH + GAP;
        } else {
          rightY += targetH + GAP;
        }
      });
      break;
    }

    // 5: Centered Studio Cluster
    case 5:
    default: {
      const colCount = Math.min(Math.max(Math.floor(availW / 320), 2), 3);
      const colWidth = Math.min(360, Math.floor((availW - (colCount - 1) * GAP) / colCount));
      const totalClusterW = colCount * colWidth + (colCount - 1) * GAP;
      const startX = Math.max(Math.floor((screenWidth - totalClusterW) / 2), MARGIN_X);

      const startY = Math.max(MARGIN_Y, Math.floor((screenHeight - 500) / 4));
      const colHeights: number[] = new Array<number>(colCount).fill(startY);

      widgets.forEach((widget) => {
        const { minW, minH, defH } = getWidgetDims(widget);

        let targetCol = 0;
        let minColH = colHeights[0] ?? startY;
        for (let c = 1; c < colCount; c++) {
          const currentH = colHeights[c] ?? startY;
          if (currentH < minColH) {
            minColH = currentH;
            targetCol = c;
          }
        }

        const targetX = startX + targetCol * (colWidth + GAP);
        const targetY = colHeights[targetCol] ?? startY;
        const targetH = Math.max(defH, minH);

        updated.push({
          ...widget,
          rect: {
            x: targetX,
            y: targetY,
            w: Math.max(colWidth, minW),
            h: targetH,
          },
        });

        colHeights[targetCol] = targetY + targetH + GAP;
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
