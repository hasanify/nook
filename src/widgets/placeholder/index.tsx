import { TestWidget } from "@/components/TestWidget";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

const manifest: Manifest = {
  id: "placeholder",
  name: "Spike Widget",
  description: "Test widget for verifying desktop pinning, focus, and drag/resize",
  version: "1.0.0",
  author: "Nook",
  defaultSize: { w: 340, h: 320 },
  minSize: { w: 260, h: 220 },
  resizable: true,
};

export function PlaceholderWidget({ instance }: WidgetProps) {
  return <TestWidget id={instance.id} />;
}

const module: WidgetModule = {
  manifest,
  component: PlaceholderWidget,
  defaultSettings: {},
  defaultState: {},
};

export default module;
