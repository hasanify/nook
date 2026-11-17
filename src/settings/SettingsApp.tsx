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
  hasAccountToken,
  saveAccountToken,
  clearAccountToken,
  getAppVersion,
  checkForUpdates,
  installUpdate,
  onUpdateDownloadProgress,
  type UpdateCheckResult,
} from "../core/ipc";
import { SettingsForm } from "../components/SettingsForm";
import { WIDGET_REGISTRY, getWidgetModule } from "../widgets/registry";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AppConfig, WidgetInstance } from "../core/types";

export function SettingsApp() {
  const [activeTab, setActiveTab] = useState<"general" | "widgets" | "accounts" | "about">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("w") ? "widgets" : "general";
  });
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("w");
  });
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [vercelConfigured, setVercelConfigured] = useState(false);
  const [githubInput, setGithubInput] = useState("");
  const [vercelInput, setVercelInput] = useState("");
  const [widgetToAdd, setWidgetToAdd] = useState("notes");

  const [appVersion, setAppVersion] = useState<string>("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [installError, setInstallError] = useState<string | null>(null);

  const { editMode, toggleEditMode } = useEditMode();

  const refreshAccountStatus = useCallback(() => {
    hasAccountToken("github")
      .then((has) => setGithubConfigured(has))
      .catch(() => {});
    hasAccountToken("vercel")
      .then((has) => setVercelConfigured(has))
      .catch(() => {});
  }, []);

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
    refreshAccountStatus();

    getAppVersion()
      .then((ver) => setAppVersion(ver))
      .catch(() => {});

    isEnabled()
      .then((enabled) => setAutostartEnabled(enabled))
      .catch(() => {});

    let unlisten: (() => void) | undefined;
    onConfigChanged(() => {
      fetchConfig();
    }).then((fn) => {
      unlisten = fn;
    });

    let unlistenProgress: (() => void) | undefined;
    onUpdateDownloadProgress((payload) => {
      setDownloadPercent(payload.percent);
    }).then((fn) => {
      unlistenProgress = fn;
    });

    return () => {
      if (unlisten) unlisten();
      if (unlistenProgress) unlistenProgress();
    };
  }, [fetchConfig, refreshAccountStatus]);

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    setInstallError(null);
    try {
      const res = await checkForUpdates();
      setUpdateResult(res);
      if (res.current_version) {
        setAppVersion(res.current_version);
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateResult?.download_url) return;
    setDownloadingUpdate(true);
    setInstallError(null);
    setDownloadPercent(0);
    try {
      await installUpdate(updateResult.download_url, updateResult.asset_name ?? "");
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
      setDownloadingUpdate(false);
    }
  };

  const handleSaveGithubToken = async () => {
    if (!githubInput.trim()) return;
    await saveAccountToken("github", githubInput.trim());
    setGithubInput("");
    refreshAccountStatus();
  };

  const handleClearGithubToken = async () => {
    await clearAccountToken("github");
    refreshAccountStatus();
  };

  const handleSaveVercelToken = async () => {
    if (!vercelInput.trim()) return;
    await saveAccountToken("vercel", vercelInput.trim());
    setVercelInput("");
    refreshAccountStatus();
  };

  const handleClearVercelToken = async () => {
    await clearAccountToken("vercel");
    refreshAccountStatus();
  };

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
  const selectedModule = selectedWidget ? getWidgetModule(selectedWidget.kind) : undefined;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface font-sans text-fg select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-accent-500/30 bg-accent-500/15 text-accent-500">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="4" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-fg">Nook Settings</h1>
        </div>
        <div className="font-mono text-xs text-fg-muted">{appVersion ? `v${appVersion}` : ""}</div>
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
          onClick={() => setActiveTab("widgets")}
          className={`border-b-2 py-2.5 transition-colors ${
            activeTab === "widgets"
              ? "border-accent-500 text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          Widgets ({config?.widgets.length ?? 0})
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
          onClick={() => setActiveTab("about")}
          className={`border-b-2 py-2.5 transition-colors ${
            activeTab === "about"
              ? "border-accent-500 text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          About
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 text-xs">
        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <div className="flex w-full flex-col gap-6">
            {/* Appearance / Theme */}
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4">
              <span className="font-medium text-fg">Appearance</span>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(["system", "light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleThemeChange(t)}
                    className={`rounded-md border p-2.5 text-center capitalize transition-colors ${
                      config?.app?.theme === t
                        ? "border-accent-500 bg-accent-500/10 font-semibold text-accent-500"
                        : "border-line bg-surface text-fg-muted hover:text-fg"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop & Interaction Settings */}
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-raised p-4">
              <span className="font-medium text-fg">Desktop & Interaction</span>

              {/* Edit Mode Toggle */}
              <div className="flex items-center justify-between border-t border-line/60 pt-3">
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
                  className="h-4 w-4 rounded border-line bg-surface accent-accent-500"
                />
              </div>

              {/* Launch on Startup */}
              <div className="flex items-center justify-between border-t border-line/60 pt-3">
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
                  className="h-4 w-4 rounded border-line bg-surface accent-accent-500"
                />
              </div>

              {/* Grid Snap */}
              <div className="flex items-center justify-between border-t border-line/60 pt-3">
                <div>
                  <div className="font-medium text-fg">Grid Snap</div>
                  <div className="text-[11px] text-fg-muted">
                    Snap widget position and size during drag (0 for free movement)
                  </div>
                </div>
                <select
                  value={config?.app?.gridSnap ?? 0}
                  onChange={(e) => handleGridSnapChange(Number(e.target.value))}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-fg outline-none focus:ring-1 focus:ring-focus"
                >
                  <option value={0}>Disabled (Free Movement)</option>
                  <option value={4}>4 px</option>
                  <option value={8}>8 px</option>
                  <option value={16}>16 px</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* WIDGETS TAB */}
        {activeTab === "widgets" && (
          <div className="flex h-full gap-5">
            {/* Left Column: Widget List */}
            <div className="flex w-52 shrink-0 flex-col gap-2 border-r border-line pr-4">
              <div className="flex items-center justify-between font-medium text-fg">
                <span>Active Widgets</span>
                <span className="font-mono text-[11px] text-fg-muted">
                  {config?.widgets.length ?? 0}
                </span>
              </div>

              <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                {config?.widgets.map((w) => {
                  const title = getWidgetModule(w.kind)?.manifest.name ?? w.kind;
                  const isSelected = selectedWidgetId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWidgetId(w.id)}
                      className={`group flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                        isSelected
                          ? "border-accent-500/60 bg-accent-500/15 font-semibold text-fg shadow-sm"
                          : "border-transparent bg-surface-raised text-fg hover:border-line hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            isSelected ? "bg-accent-500" : "bg-fg-muted/40"
                          }`}
                        />
                        <span className="truncate font-medium text-fg">{title}</span>
                      </div>
                      <span className="ml-1 font-mono text-[10px] text-fg-muted">
                        {w.id.slice(0, 5)}
                      </span>
                    </button>
                  );
                })}
                {config?.widgets.length === 0 && (
                  <div className="py-6 text-center text-xs text-fg-muted italic">
                    No active widgets.
                  </div>
                )}
              </div>

              {/* Add Widget */}
              <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3">
                <span className="text-[11px] font-medium text-fg-muted">Add new widget:</span>
                <div className="flex gap-1.5">
                  <select
                    value={widgetToAdd}
                    onChange={(e) => setWidgetToAdd(e.target.value)}
                    className="flex-1 rounded-md border border-line bg-surface-raised px-2 py-1.5 text-xs text-fg outline-none focus:ring-1 focus:ring-focus"
                  >
                    {Object.entries(WIDGET_REGISTRY).map(([kind, mod]) => (
                      <option key={kind} value={kind}>
                        {mod.manifest.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (widgetToAdd) {
                        void handleAddWidget(widgetToAdd);
                      }
                    }}
                    className="text-white rounded-md bg-accent-500 px-3 py-1.5 font-medium transition-colors hover:bg-accent-600"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Widget Inspector */}
            <div className="flex-1 overflow-y-auto pl-2">
              {selectedWidget ? (
                <div className="flex w-full flex-col gap-5">
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

        {/* ACCOUNTS TAB */}
        {activeTab === "accounts" && (
          <div className="flex w-full flex-col gap-6">
            <div className="rounded-xl border border-line bg-surface-raised p-4 text-[11px] text-fg-muted">
              Credentials are saved securely in Windows Credential Manager and never logged or
              exported.
            </div>

            {/* GitHub Token */}
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4">
              <div className="flex items-center justify-between">
                <label htmlFor="gh-token-input" className="font-medium text-fg">
                  GitHub Personal Access Token
                </label>
                <span
                  className={`text-[10px] font-medium ${
                    githubConfigured ? "text-ok" : "text-fg-muted"
                  }`}
                >
                  {githubConfigured ? "Configured ✓" : "Not configured"}
                </span>
              </div>
              <p className="text-[11px] text-fg-muted">
                Requires read scope for private repos. Public repos do not strictly require a token.
              </p>
              <div className="flex gap-2 pt-1">
                <input
                  id="gh-token-input"
                  type="password"
                  value={githubInput}
                  onChange={(e) => setGithubInput(e.target.value)}
                  placeholder="ghp_••••••••••••••••••••••••••••••••••••"
                  className="flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-fg outline-none placeholder:text-fg-muted focus:ring-1 focus:ring-focus"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveGithubToken()}
                  className="text-white rounded-md bg-accent-500 px-3 py-1.5 font-medium transition-colors hover:bg-accent-600"
                >
                  Save
                </button>
                {githubConfigured && (
                  <button
                    type="button"
                    onClick={() => void handleClearGithubToken()}
                    className="hover:text-error rounded-md border border-line bg-surface px-2.5 py-1.5 font-medium text-fg-muted transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Vercel Token */}
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4">
              <div className="flex items-center justify-between">
                <label htmlFor="vercel-token-input" className="font-medium text-fg">
                  Vercel API Token
                </label>
                <span
                  className={`text-[10px] font-medium ${
                    vercelConfigured ? "text-ok" : "text-fg-muted"
                  }`}
                >
                  {vercelConfigured ? "Configured ✓" : "Not configured"}
                </span>
              </div>
              <p className="text-[11px] text-fg-muted">
                Used to fetch deployment states and build health.
              </p>
              <div className="flex gap-2 pt-1">
                <input
                  id="vercel-token-input"
                  type="password"
                  value={vercelInput}
                  onChange={(e) => setVercelInput(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-fg outline-none placeholder:text-fg-muted focus:ring-1 focus:ring-focus"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveVercelToken()}
                  className="text-white rounded-md bg-accent-500 px-3 py-1.5 font-medium transition-colors hover:bg-accent-600"
                >
                  Save
                </button>
                {vercelConfigured && (
                  <button
                    type="button"
                    onClick={() => void handleClearVercelToken()}
                    className="hover:text-error rounded-md border border-line bg-surface px-2.5 py-1.5 font-medium text-fg-muted transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABOUT TAB */}
        {activeTab === "about" && (
          <div className="flex w-full flex-col gap-6">
            {/* Hero Card */}
            <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-raised p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-accent-500/30 bg-accent-500/15 text-accent-500">
                <svg
                  className="h-7 w-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="4" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold tracking-tight text-fg">Nook</h2>
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted">
                    v{appVersion || "0.3.0"}
                  </span>
                </div>
                <p className="text-xs text-fg-muted">
                  Lightweight, distraction-free desktop widgets pinned directly to your Windows
                  desktop.
                </p>
              </div>
            </div>

            {/* Developer & Project Info */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4">
                <span className="font-semibold text-fg">Developer</span>
                <p className="text-[11px] leading-relaxed text-fg-muted">
                  Crafted with care by <span className="font-medium text-fg">Hasan</span> (
                  <button
                    type="button"
                    onClick={() => void openUrl("https://github.com/hasanify")}
                    className="text-accent-500 underline hover:text-accent-600"
                  >
                    @hasanify
                  </button>
                  ). Built with Tauri v2, Rust, and React.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => void openUrl("https://github.com/hasanify/nook")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-500 hover:text-accent-600"
                  >
                    <span>Visit GitHub Repository</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4">
                <span className="font-semibold text-fg">Links & Support</span>
                <div className="flex flex-col gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => void openUrl("https://github.com/hasanify/nook/issues")}
                    className="text-left text-fg-muted transition-colors hover:text-accent-500"
                  >
                    • Report a Bug or Request Feature
                  </button>
                  <button
                    type="button"
                    onClick={() => void openUrl("https://github.com/hasanify/nook/releases")}
                    className="text-left text-fg-muted transition-colors hover:text-accent-500"
                  >
                    • View Release Changelog
                  </button>
                  <span className="text-fg-muted">
                    • License: <span className="font-mono text-fg">MIT</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Software Updates Section */}
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-fg">Software Updates</div>
                  <div className="text-[11px] text-fg-muted">
                    Installed version:{" "}
                    <span className="font-mono text-fg">
                      {appVersion ? `v${appVersion}` : "..."}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={checkingUpdate || downloadingUpdate}
                  onClick={() => void handleCheckUpdates()}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 font-medium text-fg transition-colors hover:border-accent-500 hover:text-accent-500 disabled:opacity-50"
                >
                  {checkingUpdate ? "Checking..." : "Check for Updates"}
                </button>
              </div>

              {/* Status messages */}
              {updateError && (
                <div className="border-red-500/30 bg-red-500/10 text-red-400 rounded-md border p-2.5 text-[11px]">
                  {updateError}
                </div>
              )}

              {updateResult && !updateResult.has_update && !updateError && (
                <div className="flex items-center gap-2 rounded-md border border-ok/30 bg-ok/10 p-2.5 text-[11px] text-ok">
                  <span>✓</span>
                  <span>You are running the latest version of Nook.</span>
                </div>
              )}

              {updateResult && updateResult.has_update && (
                <div className="flex flex-col gap-2.5 rounded-md border border-accent-500/30 bg-accent-500/10 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-accent-500">Update Available: </span>
                      <span className="font-mono font-medium text-fg">
                        v{updateResult.latest_version}
                      </span>
                    </div>
                    {updateResult.release_url && (
                      <button
                        type="button"
                        onClick={() => void openUrl(updateResult.release_url)}
                        className="text-[11px] text-accent-500 underline underline-offset-2 hover:text-accent-600"
                      >
                        Release Notes
                      </button>
                    )}
                  </div>

                  {downloadingUpdate ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[11px] text-fg-muted">
                        <span>Downloading update...</span>
                        <span>{downloadPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full bg-accent-500 transition-all duration-150"
                          style={{ width: `${downloadPercent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-fg-muted">
                        Nook will restart once installation begins.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      {updateResult.download_url ? (
                        <button
                          type="button"
                          onClick={() => void handleInstallUpdate()}
                          className="text-white rounded-md bg-accent-500 px-3 py-1.5 font-medium transition-colors hover:bg-accent-600"
                        >
                          Download & Install Update
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void openUrl(updateResult.release_url)}
                          className="text-white rounded-md bg-accent-500 px-3 py-1.5 font-medium transition-colors hover:bg-accent-600"
                        >
                          Download from GitHub
                        </button>
                      )}
                    </div>
                  )}

                  {installError && (
                    <div className="text-red-400 text-[11px]">Install error: {installError}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
