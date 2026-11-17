import { useState, useEffect, useCallback } from "react";
import { useEditMode } from "../core/use-edit-mode";
import {
  getAppConfig,
  updateAppConfig,
  setOpacity,
  setAlwaysOnTop,
  updateSettings,
  removeWidget,
  addWidget,
  onConfigChanged,
} from "../core/ipc";
import { SettingsForm } from "../components/SettingsForm";
import { WIDGET_REGISTRY } from "../widgets/registry";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import type { AppConfig, WidgetInstance } from "../core/types";

export function SettingsApp() {
  const [activeTab, setActiveTab] = useState<"general" | "accounts" | "widgets">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("w") ? "widgets" : "general";
  });
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("w");
  });
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [autostartEnabled, setAutostartEnabled] = useState(false);

  const { editMode, toggleEditMode } = useEditMode();

  // Load config & autostart
  const fetchConfig = useCallback(() => {
    getAppConfig()
      .then((cfg) => {
        setConfig(cfg);
        setSelectedWidgetId((prev) => prev ?? cfg.widgets[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchConfig();

    isEnabled()
      .then((enabled) => setAutostartEnabled(enabled))
      .catch(() => {});

    let unlisten: (() => void) | undefined;
    onConfigChanged(() => {
      fetchConfig();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchConfig]);

  const handleThemeChange = (theme: "system" | "light" | "dark") => {
    if (!config) return;
    setConfig({
      ...config,
      app: { ...config.app, theme },
    });
    void updateAppConfig({ theme });
  };

  const handleGridSnapChange = (gridSnap: number) => {
    if (!config) return;
    setConfig({
      ...config,
      app: { ...config.app, gridSnap },
    });
    void updateAppConfig({ gridSnap });
  };

  const handleAutostartToggle = async () => {
    const next = !autostartEnabled;
    try {
      if (next) {
        await enable();
      } else {
        await disable();
      }
      setAutostartEnabled(next);
      void updateAppConfig({ autostart: next });
    } catch {
      // Autostart plugin error handling
    }
  };

  const handleAddWidget = async (kind: string) => {
    try {
      const instance = await addWidget(kind);
      setSelectedWidgetId(instance.id);
      setActiveTab("widgets");
    } catch {
      // Ignore
    }
  };

  const handleWidgetSettingChange = (widgetId: string, key: string, value: unknown) => {
    void updateSettings(widgetId, { [key]: value });
  };

  const selectedWidget: WidgetInstance | undefined = config?.widgets.find(
    (w) => w.id === selectedWidgetId,
  );
  const selectedModule = selectedWidget ? WIDGET_REGISTRY[selectedWidget.kind] : undefined;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface font-sans text-fg select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-accent-500" />
          <h1 className="text-sm font-semibold text-fg">Nook Settings</h1>
        </div>
        <div className="text-xs text-fg-muted">v0.1.0</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-line px-5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`border-b-2 py-2.5 transition-colors ${
            activeTab === "general"
              ? "border-accent-500 text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={`border-b-2 py-2.5 transition-colors ${
            activeTab === "accounts"
              ? "border-accent-500 text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          Accounts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("widgets")}
          className={`border-b-2 py-2.5 transition-colors ${
            activeTab === "widgets"
              ? "border-accent-500 text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          Widgets ({config?.widgets.length ?? 0})
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 text-xs">
        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <div className="flex max-w-md flex-col gap-6">
            {/* Appearance / Theme */}
            <div className="flex flex-col gap-2">
              <span className="font-medium text-fg">Theme</span>
              <div className="grid grid-cols-3 gap-2">
                {(["system", "light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleThemeChange(t)}
                    className={`rounded-md border p-2.5 text-center capitalize transition-colors ${
                      config?.app?.theme === t
                        ? "border-accent-500 bg-accent-500/10 font-semibold text-accent-500"
                        : "border-line bg-surface-raised text-fg-muted hover:text-fg"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Edit Mode Toggle */}
            <div className="flex items-center justify-between border-t border-line pt-4">
              <div>
                <div className="font-medium text-fg">Edit Layout</div>
                <div className="text-[11px] text-fg-muted">
                  Show drag bars and resize handles on all desktop widgets (Ctrl+Alt+E)
                </div>
              </div>
              <input
                type="checkbox"
                checked={editMode}
                onChange={toggleEditMode}
                className="h-4 w-4 rounded border-line bg-surface-raised accent-accent-500"
              />
            </div>

            {/* Launch on Startup */}
            <div className="flex items-center justify-between border-t border-line pt-4">
              <div>
                <div className="font-medium text-fg">Launch on Startup</div>
                <div className="text-[11px] text-fg-muted">
                  Automatically start Nook when Windows boots
                </div>
              </div>
              <input
                type="checkbox"
                checked={autostartEnabled}
                onChange={() => void handleAutostartToggle()}
                className="h-4 w-4 rounded border-line bg-surface-raised accent-accent-500"
              />
            </div>

            {/* Grid Snap */}
            <div className="flex items-center justify-between border-t border-line pt-4">
              <div>
                <div className="font-medium text-fg">Grid Snap</div>
                <div className="text-[11px] text-fg-muted">
                  Snap widget position and size during drag
                </div>
              </div>
              <select
                value={config?.app?.gridSnap ?? 8}
                onChange={(e) => handleGridSnapChange(Number(e.target.value))}
                className="rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-fg outline-none focus:ring-1 focus:ring-focus"
              >
                <option value={0}>Disabled</option>
                <option value={4}>4 px</option>
                <option value={8}>8 px (Default)</option>
                <option value={16}>16 px</option>
              </select>
            </div>
          </div>
        )}

        {/* ACCOUNTS TAB */}
        {activeTab === "accounts" && (
          <div className="flex max-w-md flex-col gap-6">
            <div className="rounded-md border border-line bg-surface-raised p-3 text-[11px] text-fg-muted">
              Credentials are saved securely in Windows Credential Manager and never logged or
              exported.
            </div>

            {/* GitHub Token */}
            <div className="flex flex-col gap-2">
              <label htmlFor="gh-token-input" className="font-medium text-fg">
                GitHub Personal Access Token
              </label>
              <p className="text-[11px] text-fg-muted">
                Requires read scope for private repos. Public repos do not strictly require a token.
              </p>
              <div className="flex gap-2">
                <input
                  id="gh-token-input"
                  type="password"
                  placeholder="ghp_••••••••••••••••••••••••••••••••••••"
                  className="flex-1 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs text-fg outline-none placeholder:text-fg-muted focus:ring-1 focus:ring-focus"
                />
                <button
                  type="button"
                  className="text-white rounded-md bg-accent-500 px-3 py-1.5 font-medium hover:bg-accent-600"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Vercel Token */}
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <label htmlFor="vercel-token-input" className="font-medium text-fg">
                Vercel API Token
              </label>
              <p className="text-[11px] text-fg-muted">
                Used to fetch deployment states and build health.
              </p>
              <div className="flex gap-2">
                <input
                  id="vercel-token-input"
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                  className="flex-1 rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs text-fg outline-none placeholder:text-fg-muted focus:ring-1 focus:ring-focus"
                />
                <button
                  type="button"
                  className="text-white rounded-md bg-accent-500 px-3 py-1.5 font-medium hover:bg-accent-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WIDGETS TAB */}
        {activeTab === "widgets" && (
          <div className="flex h-full gap-5">
            {/* Left Column: Widget List */}
            <div className="flex w-48 flex-col gap-2 border-r border-line pr-4">
              <div className="flex items-center justify-between font-medium text-fg">
                <span>Active Widgets</span>
              </div>

              <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {config?.widgets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedWidgetId(w.id)}
                    className={`flex items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                      selectedWidgetId === w.id
                        ? "bg-accent-500/10 font-medium text-accent-500"
                        : "text-fg hover:bg-surface-raised"
                    }`}
                  >
                    <span className="truncate">{w.kind}</span>
                    <span className="text-[10px] text-fg-muted">{w.id.slice(0, 5)}</span>
                  </button>
                ))}
                {config?.widgets.length === 0 && (
                  <div className="py-4 text-center text-xs text-fg-muted italic">
                    No active widgets.
                  </div>
                )}
              </div>

              {/* Add Widget Dropdown */}
              <div className="mt-3 border-t border-line pt-3">
                <span className="mb-1 block text-[11px] font-medium text-fg-muted">
                  Add new widget:
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      void handleAddWidget(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="w-full rounded border border-line bg-surface-raised px-2 py-1 text-xs text-fg outline-none"
                >
                  <option value="" disabled>
                    Select widget...
                  </option>
                  <option value="notes">Notes</option>
                  <option value="timer">Timer</option>
                  <option value="github-repo">GitHub Repo</option>
                  <option value="vercel-project">Vercel Project</option>
                  <option value="placeholder">Spike Widget</option>
                </select>
              </div>
            </div>

            {/* Right Column: Widget Inspector */}
            <div className="flex-1 overflow-y-auto pl-2">
              {selectedWidget ? (
                <div className="flex max-w-md flex-col gap-5">
                  <div>
                    <h2 className="text-sm font-semibold text-fg">
                      {selectedModule?.manifest.name ?? selectedWidget.kind}
                    </h2>
                    <p className="text-[11px] text-fg-muted">
                      ID: {selectedWidget.id} • Position: {selectedWidget.rect.x},{" "}
                      {selectedWidget.rect.y} ({selectedWidget.rect.w} × {selectedWidget.rect.h})
                    </p>
                  </div>

                  {/* Always on top */}
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <div>
                      <div className="font-medium text-fg">Always on Top</div>
                      <div className="text-[11px] text-fg-muted">
                        Detach from desktop layer to float above all windows
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedWidget.always_on_top}
                      onChange={() =>
                        void setAlwaysOnTop(selectedWidget.id, !selectedWidget.always_on_top)
                      }
                      className="h-4 w-4 rounded border-line bg-surface-raised accent-accent-500"
                    />
                  </div>

                  {/* Opacity slider */}
                  <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-fg">Window Opacity</span>
                      <span className="text-fg-muted">
                        {Math.round(selectedWidget.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="1.0"
                      step="0.05"
                      value={selectedWidget.opacity}
                      onChange={(e) => void setOpacity(selectedWidget.id, Number(e.target.value))}
                      className="accent-accent-500"
                    />
                  </div>

                  {/* Widget Settings Schema Form */}
                  {selectedModule?.manifest.settingsSchema && (
                    <div className="border-t border-line pt-3">
                      <span className="mb-2 block font-medium text-fg">Configuration</span>
                      <SettingsForm
                        fields={selectedModule.manifest.settingsSchema}
                        values={selectedWidget.settings}
                        onChange={(k, v) => handleWidgetSettingChange(selectedWidget.id, k, v)}
                      />
                    </div>
                  )}

                  {/* Remove Widget */}
                  <div className="border-t border-line pt-4">
                    <button
                      type="button"
                      onClick={() => void removeWidget(selectedWidget.id)}
                      className="border-error/30 bg-error/10 text-error hover:bg-error/20 rounded border px-3 py-1.5 text-xs font-medium"
                    >
                      Remove Widget
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-fg-muted italic">
                  Select a widget to view and edit its settings.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
