/**
 * Centralized Tauri IPC bridge for Nook desktop operations.
 *
 * Encapsulates window lifecycle, Win32 desktop reparenting bounds, credential storage,
 * native hardware monitor telemetry, and real-time event subscriptions between the Rust backend
 * and React widgets.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { AppConfig, Manifest, ProviderPayload, WidgetInstance } from "./types";

export interface ConfigChangedPayload {
  ids: string[];
  app: boolean;
}

export interface EditModePayload {
  on: boolean;
}

export interface WidgetEditModePayload {
  id: string;
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

export interface DesktopWorkArea {
  x: number;
  y: number;
  w: number;
  h: number;
  scaleFactor: number;
}

export async function getDesktopWorkArea(): Promise<DesktopWorkArea> {
  return invoke<DesktopWorkArea>("get_desktop_work_area");
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

export async function batchSetBounds(
  bounds: Array<{ id: string; x: number; y: number; w: number; h: number }>,
): Promise<void> {
  return invoke<void>("batch_set_bounds", { bounds });
}

export async function getEditMode(): Promise<boolean> {
  return invoke<boolean>("get_edit_mode");
}

export async function setEditMode(on: boolean): Promise<void> {
  return invoke<void>("set_edit_mode", { on });
}

export async function getWidgetEditMode(id: string): Promise<boolean> {
  return invoke<boolean>("get_widget_edit_mode", { id });
}

export async function setWidgetEditMode(id: string, on: boolean): Promise<void> {
  return invoke<void>("set_widget_edit_mode", { id, on });
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
  widgetPreset?: string;
  defaultAiProvider?: string;
  autoUpdate?: boolean;
  auto_update?: boolean;
}): Promise<void> {
  const autoUpdate = patch.autoUpdate ?? patch.auto_update;
  return invoke<void>("update_app_config", {
    theme: patch.theme,
    gridSnap: patch.gridSnap,
    grid_snap: patch.gridSnap,
    autostart: patch.autostart,
    widgetPreset: patch.widgetPreset,
    widget_preset: patch.widgetPreset,
    defaultAiProvider: patch.defaultAiProvider,
    default_ai_provider: patch.defaultAiProvider,
    autoUpdate,
    auto_update: autoUpdate,
  });
}

export async function openSettingsWindow(widgetId?: string): Promise<void> {
  return invoke<void>("open_settings_window", { widgetId });
}

export async function openContextMenu(
  widgetId: string,
  screenX?: number,
  screenY?: number,
): Promise<void> {
  return invoke<void>("open_context_menu", {
    widgetId,
    screenX: screenX !== undefined ? Math.round(screenX) : null,
    screenY: screenY !== undefined ? Math.round(screenY) : null,
  });
}

export async function hideContextMenu(): Promise<void> {
  return invoke<void>("hide_context_menu");
}

export async function showSettingsWindow(): Promise<void> {
  return invoke<void>("show_settings_window");
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

export async function getAccountToken(provider: string): Promise<string | null> {
  return invoke<string | null>("get_account_token", { provider });
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

export interface PortInfo {
  port: number;
  pid: number;
  process_name: string;
  protocol: string;
}

export async function getListeningPorts(): Promise<PortInfo[]> {
  return invoke<PortInfo[]>("get_listening_ports");
}

export async function killPortProcess(pid: number): Promise<void> {
  return invoke<void>("kill_port_process", { pid });
}

export interface PingResult {
  status: number;
  latency_ms: number;
  ok: boolean;
  error?: string | null;
}

export async function pingEndpoint(url: string, method?: string): Promise<PingResult> {
  return invoke<PingResult>("ping_endpoint", { url, method });
}

export interface SystemVitals {
  cpu_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number;
  memory_percent: number;
  disk_used_bytes: number;
  disk_total_bytes: number;
  disk_percent: number;
}

export async function getSystemVitals(): Promise<SystemVitals> {
  return invoke<SystemVitals>("get_system_vitals");
}

export interface MediaStatus {
  title: string;
  artist: string;
  player: string;
  is_playing: boolean;
}

export async function sendMediaCommand(action: string): Promise<void> {
  return invoke<void>("send_media_command", { action });
}

export async function getMediaStatus(): Promise<MediaStatus> {
  return invoke<MediaStatus>("get_media_status");
}

export interface BatteryStatus {
  has_battery: boolean;
  is_charging: boolean;
  is_ac_plugged: boolean;
  percent: number;
  time_remaining_seconds?: number | null;
  battery_saver: boolean;
}

export async function getBatteryStatus(): Promise<BatteryStatus> {
  return invoke<BatteryStatus>("get_battery_status");
}

export async function getProviderSnapshot<T = unknown>(
  widgetId: string,
): Promise<ProviderPayload<T> | null> {
  return invoke<ProviderPayload<T> | null>("get_provider_snapshot", { widgetId });
}

export async function refreshWidgetProvider<T = unknown>(
  widgetId: string,
): Promise<ProviderPayload<T> | null> {
  return invoke<ProviderPayload<T> | null>("refresh_widget_provider", {
    widgetId,
  });
}

export function onProviderData<T = unknown>(
  widgetId: string,
  callback: (payload: ProviderPayload<T>) => void,
): Promise<UnlistenFn> {
  return listen<ProviderPayload<T>>(`provider-data-${widgetId}`, (event) => {
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

export function onWidgetEditMode(
  callback: (payload: WidgetEditModePayload) => void,
): Promise<UnlistenFn> {
  return listen<WidgetEditModePayload>("widget-edit-mode", (event) => {
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

export async function listCustomWidgets(): Promise<Manifest[]> {
  return invoke<Manifest[]>("list_custom_widgets");
}

export async function importCustomWidget(
  fileBytes: number[] | Uint8Array,
  fileName: string,
): Promise<Manifest> {
  const bytes = fileBytes instanceof Uint8Array ? Array.from(fileBytes) : fileBytes;
  return invoke<Manifest>("import_custom_widget", { fileBytes: bytes, fileName });
}

export async function deleteCustomWidget(id: string): Promise<void> {
  return invoke<void>("delete_custom_widget", { id });
}

export async function getCustomWidgetContent(id: string): Promise<string> {
  return invoke<string>("get_custom_widget_content", { id });
}
