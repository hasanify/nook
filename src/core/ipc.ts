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

export async function timerSchedule(
  id: string,
  endsAtMs: number,
  title: string,
  body: string,
): Promise<void> {
  return invoke<void>("timer_schedule", {
    id,
    endsAtMs: Math.round(endsAtMs),
    title,
    body,
  });
}

export async function timerCancel(id: string): Promise<void> {
  return invoke<void>("timer_cancel", { id });
}

export async function saveAccountToken(provider: string, token: string): Promise<void> {
  return invoke<void>("save_account_token", { provider, token });
}

export async function clearAccountToken(provider: string): Promise<void> {
  return invoke<void>("clear_account_token", { provider });
}

export async function hasAccountToken(provider: string): Promise<boolean> {
  return invoke<boolean>("has_account_token", { provider });
}

export interface VercelProjectSummary {
  id: string;
  name: string;
  framework?: string;
}

export async function listVercelProjects(): Promise<VercelProjectSummary[]> {
  return invoke<VercelProjectSummary[]>("list_vercel_projects");
}

export async function getProviderSnapshot<T = unknown>(
  widgetId: string,
): Promise<import("./types").ProviderPayload<T> | null> {
  return invoke<import("./types").ProviderPayload<T> | null>("get_provider_snapshot", { widgetId });
}

export async function refreshWidgetProvider<T = unknown>(
  widgetId: string,
): Promise<import("./types").ProviderPayload<T> | null> {
  return invoke<import("./types").ProviderPayload<T> | null>("refresh_widget_provider", {
    widgetId,
  });
}

export function onProviderData<T = unknown>(
  widgetId: string,
  callback: (payload: import("./types").ProviderPayload<T>) => void,
): Promise<UnlistenFn> {
  return listen<import("./types").ProviderPayload<T>>(`provider-data-${widgetId}`, (event) => {
    callback(event.payload);
  });
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

export interface UpdateCheckResult {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_name: string;
  release_url: string;
  release_notes?: string;
  download_url?: string;
  asset_name?: string;
}

export interface UpdateDownloadProgressPayload {
  percent: number;
}

export async function getAppVersion(): Promise<string> {
  return invoke<string>("get_app_version");
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  return invoke<UpdateCheckResult>("check_for_updates");
}

export async function installUpdate(downloadUrl: string, assetName: string): Promise<void> {
  return invoke<void>("install_update", {
    downloadUrl,
    assetName,
  });
}

export function onUpdateDownloadProgress(
  callback: (payload: UpdateDownloadProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<UpdateDownloadProgressPayload>("update-download-progress", (event) => {
    callback(event.payload);
  });
}
