export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MonitorRef {
  id?: string;
  name?: string;
  bounds: Rect;
}

export interface WidgetInstance {
  id: string;
  kind: string;
  type?: string;
  rect: Rect;
  opacity: number;
  alwaysOnTop?: boolean;
  always_on_top?: boolean;
  monitor: MonitorRef;
  settings: Record<string, unknown>;
  state: Record<string, unknown>;
}

export interface AppConfig {
  version: number;
  app: {
    theme: "system" | "light" | "dark";
    autostart: boolean;
    editHotkey: string;
    gridSnap: number;
    pinStrategy: string;
    widgetPreset?: string;
  };
  widgets: WidgetInstance[];
}

export interface SettingsField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "secret";
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
  autocomplete?: string;
}

export interface Manifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  resizable: boolean;
  settingsSchema?: SettingsField[];
}

export interface WidgetProps {
  instance: WidgetInstance;
  editMode: boolean;
  onToggleEditMode?: () => void;
  patchState: (patch: Record<string, unknown>) => void;
  patchSettings: (patch: Record<string, unknown>) => void;
}

export interface WidgetModule {
  manifest: Manifest;
  component: React.ComponentType<WidgetProps>;
  defaultSettings: Record<string, unknown>;
  defaultState: Record<string, unknown>;
}

export type ProviderStatus =
  "ok" | "syncing" | "offline" | "bad-token" | "rate-limited" | "not-found" | "error";

export interface ProviderPayload<T = unknown> {
  status: ProviderStatus;
  message?: string;
  data?: T;
  updated_at: number;
}
