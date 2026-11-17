import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppConfig, WidgetInstance } from "./types";

export interface ConfigChangedPayload {
  ids: string[];
  app: boolean;
}

export interface EditModePayload {
  on: boolean;
}

export async function getAppConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("get_app_config");
}

export async function getInstance(id: string): Promise<WidgetInstance> {
  return invoke<WidgetInstance>("get_instance", { id });
}

export async function addWidget(kind: string): Promise<WidgetInstance> {
  return invoke<WidgetInstance>("add_widget", { kind });
}

export async function duplicateWidget(id: string): Promise<WidgetInstance> {
  return invoke<WidgetInstance>("duplicate_widget", { id });
}

export async function removeWidget(id: string): Promise<void> {
  return invoke<void>("remove_widget", { id });
}

export async function setBounds(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  commit?: boolean,
): Promise<void> {
  return invoke<void>("set_bounds", { id, x, y, w, h, commit });
}

export async function getEditMode(): Promise<boolean> {
  return invoke<boolean>("get_edit_mode");
}

export async function setEditMode(on: boolean): Promise<void> {
  return invoke<void>("set_edit_mode", { on });
}

export async function setOpacity(id: string, value: number): Promise<void> {
  return invoke<void>("set_opacity", { id, value });
}

export async function setAlwaysOnTop(id: string, on: boolean): Promise<void> {
  return invoke<void>("set_always_on_top", { id, on });
}

export async function updateState(id: string, patch: Record<string, unknown>): Promise<void> {
  return invoke<void>("update_state", { id, patch });
}

export async function updateSettings(id: string, patch: Record<string, unknown>): Promise<void> {
  return invoke<void>("update_settings", { id, patch });
}

export async function verifyDesktopPin(id: string): Promise<boolean> {
  return invoke<boolean>("verify_desktop_pin", { id });
}

export async function updateAppConfig(patch: {
  theme?: string;
  gridSnap?: number;
  autostart?: boolean;
}): Promise<void> {
  return invoke<void>("update_app_config", {
    theme: patch.theme,
    grid_snap: patch.gridSnap,
    autostart: patch.autostart,
  });
}

export async function openSettingsWindow(widgetId?: string): Promise<void> {
  return invoke<void>("open_settings_window", { widgetId });
}

export function onConfigChanged(
  callback: (payload: ConfigChangedPayload) => void,
): Promise<UnlistenFn> {
  return listen<ConfigChangedPayload>("config-changed", (event) => {
    callback(event.payload);
  });
}

export function onEditMode(callback: (payload: EditModePayload) => void): Promise<UnlistenFn> {
  return listen<EditModePayload>("edit-mode", (event) => {
    callback(event.payload);
  });
}
