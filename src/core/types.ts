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

export interface WidgetInstance<
  Settings extends Record<string, unknown> = Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  kind: string;
  rect: Rect;
  opacity: number;
  always_on_top: boolean;
  monitor: MonitorRef;
  settings: Settings;
  state: State;
}

export interface AppConfig {
  version: number;
  theme: "system" | "light" | "dark";
  grid_snap: number;
  edit_mode: boolean;
  default_monitor: string;
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

export interface WidgetProps<
  Settings extends Record<string, unknown> = Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>,
> {
  instance: WidgetInstance<Settings, State>;
  editMode: boolean;
  patchState: (patch: Partial<State>) => void;
  patchSettings: (patch: Partial<Settings>) => void;
}

export interface WidgetModule<
  Settings extends Record<string, unknown> = Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>,
> {
  manifest: Manifest;
  component: React.ComponentType<WidgetProps<Settings, State>>;
  defaultSettings: Settings;
  defaultState: State;
}
