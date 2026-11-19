import { useState, useEffect, useCallback, useRef } from "react";
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
  showSettingsWindow,
  type UpdateCheckResult,
} from "../core/ipc";
import { listen } from "@tauri-apps/api/event";
import { SettingsForm } from "../components/SettingsForm";
import { Toggle } from "../components/Toggle";
import { WIDGET_COLOR_OPTIONS } from "../components/WidgetContextMenu";
import { WIDGET_REGISTRY, getWidgetModule } from "../widgets/registry";
import { WIDGET_PRESETS } from "../core/presets";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AppConfig, WidgetInstance } from "../core/types";

export function SettingsApp() {
  const [activeTab, setActiveTab] = useState<
    "general" | "appearance" | "widgets" | "accounts" | "about"
  >(() => {
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
  const [aiConfigured, setAiConfigured] = useState(false);
  const [githubInput, setGithubInput] = useState("");
  const [vercelInput, setVercelInput] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [widgetToAdd, setWidgetToAdd] = useState("notes");
  const hasShownWindowRef = useRef(false);
  const opacityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSlidingOpacityRef = useRef(false);

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
    hasAccountToken("ai")
      .then(async (has) => {
        if (has) {
          setAiConfigured(true);
        } else {
          const hasOpenAi = await hasAccountToken("openai").catch(() => false);
          setAiConfigured(hasOpenAi);
        }
      })
      .catch(() => {});
  }, []);

  // Load config & autostart
  const fetchConfig = useCallback(() => {
    getAppConfig()
      .then((cfg) => {
        setConfig((prev) => {
          if (!prev || !isSlidingOpacityRef.current) return cfg;
          return {
            ...cfg,
            widgets: cfg.widgets.map((w) => {
              if (w.id === selectedWidgetId) {
                const cur = prev.widgets.find((p) => p.id === w.id);
                return cur ? { ...w, opacity: cur.opacity } : w;
              }
              return w;
            }),
          };
        });
        setSelectedWidgetId((prev) => prev ?? cfg.widgets[0]?.id ?? null);
      })
      .catch(() => {});
  }, [selectedWidgetId]);

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

    let unlistenFocus: (() => void) | undefined;
    listen<{ id: string }>("focus-widget", (event) => {
      if (event.payload?.id) {
        setSelectedWidgetId(event.payload.id);
        setActiveTab("widgets");
      }
    }).then((fn) => {
      unlistenFocus = fn;
    });

    return () => {
      if (unlisten) unlisten();
      if (unlistenProgress) unlistenProgress();
      if (unlistenFocus) unlistenFocus();
      if (opacityDebounceRef.current) clearTimeout(opacityDebounceRef.current);
    };
  }, [fetchConfig, refreshAccountStatus]);

  // Reveal settings window smoothly only after initial config is loaded and rendered
  useEffect(() => {
    if (config && !hasShownWindowRef.current) {
      hasShownWindowRef.current = true;
      requestAnimationFrame(() => {
        void showSettingsWindow();
      });
    }
  }, [config]);

  // Fallback timer so window is guaranteed to show even if config fetch is slow
  useEffect(() => {
    const timer = setTimeout(() => {
      void showSettingsWindow();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

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

  const handleSaveAiToken = async () => {
    if (!aiInput.trim()) return;
    await saveAccountToken("ai", aiInput.trim());
    setAiInput("");
    refreshAccountStatus();
  };

  const handleClearAiToken = async () => {
    await clearAccountToken("ai");
    await clearAccountToken("openai");
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

  const handlePresetChange = (presetId: string) => {
    if (!config) return;
    setConfig({
      ...config,
      app: { ...config.app, widgetPreset: presetId },
    });
    void updateAppConfig({ widgetPreset: presetId });
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

  const handleToggleAlwaysOnTop = async (widgetId: string, current: boolean) => {
    const next = !current;
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === widgetId ? { ...w, alwaysOnTop: next, always_on_top: next } : w,
        ),
      };
    });
    try {
      await setAlwaysOnTop(widgetId, next);
    } catch {
      fetchConfig();
    }
  };

  const selectedWidget: WidgetInstance | undefined = config?.widgets.find(
    (w) => w.id === selectedWidgetId,
  );
  const isAlwaysOnTop = Boolean(selectedWidget?.alwaysOnTop ?? selectedWidget?.always_on_top);
  const selectedKind = selectedWidget
    ? selectedWidget.kind || (selectedWidget as unknown as { type?: string }).type || ""
    : "";
  const selectedModule = selectedKind ? getWidgetModule(selectedKind) : undefined;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden overscroll-none bg-surface font-sans text-fg select-none">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-line/60 bg-surface-raised/40 px-5 pt-1.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 transition-all ${
            activeTab === "general"
              ? "border-accent-500 font-semibold text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>General</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("widgets")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 transition-all ${
            activeTab === "widgets"
              ? "border-accent-500 font-semibold text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="7" height="7" x="3" y="3" rx="1.5" />
            <rect width="7" height="7" x="14" y="3" rx="1.5" />
            <rect width="7" height="7" x="14" y="14" rx="1.5" />
            <rect width="7" height="7" x="3" y="14" rx="1.5" />
          </svg>
          <span>Widgets</span>
          <span className="py-0.2 rounded-full bg-surface-raised px-1.5 font-mono text-[10px] text-fg-muted">
            {config?.widgets.length ?? 0}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 transition-all ${
            activeTab === "accounts"
              ? "border-accent-500 font-semibold text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Accounts</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 transition-all ${
            activeTab === "appearance"
              ? "border-accent-500 font-semibold text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
          <span>Appearance</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("about")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 transition-all ${
            activeTab === "about"
              ? "border-accent-500 font-semibold text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>About</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-xs">
        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-6 py-0">
            <div className="my-3 flex w-full flex-col gap-5 pb-4">
              {/* Desktop & Interaction Settings */}
              <div className="flex flex-col gap-4 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <span className="font-semibold text-fg">Desktop & Interaction</span>

                {/* Edit Mode Toggle */}
                <div className="flex items-center justify-between border-t border-line/40 pt-4">
                  <div>
                    <div className="font-medium text-fg">Edit Layout</div>
                    <div className="text-[11px] text-fg-muted">
                      Show drag bars and resize handles on all desktop widgets (Ctrl+Alt+E)
                    </div>
                  </div>
                  <Toggle
                    checked={editMode}
                    onChange={toggleEditMode}
                    ariaLabel="Toggle edit mode"
                  />
                </div>

                {/* Launch on Startup */}
                <div className="flex items-center justify-between border-t border-line/40 pt-4">
                  <div>
                    <div className="font-medium text-fg">Launch on Startup</div>
                    <div className="text-[11px] text-fg-muted">
                      Automatically start Nook when Windows boots
                    </div>
                  </div>
                  <Toggle
                    checked={autostartEnabled}
                    onChange={() => void handleAutostartToggle()}
                    ariaLabel="Toggle launch on startup"
                  />
                </div>

                {/* Grid Snap */}
                <div className="flex items-center justify-between border-t border-line/40 pt-4">
                  <div>
                    <div className="font-medium text-fg">Grid Snap</div>
                    <div className="text-[11px] text-fg-muted">
                      Snap widget position and size during drag (0 for free movement)
                    </div>
                  </div>
                  <select
                    value={config?.app?.gridSnap ?? 0}
                    onChange={(e) => handleGridSnapChange(Number(e.target.value))}
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  >
                    <option value={0}>Disabled (Free Movement)</option>
                    <option value={4}>4 px (Fine)</option>
                    <option value={8}>8 px (Default)</option>
                    <option value={16}>16 px (Coarse)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* APPEARANCE TAB */}
        {activeTab === "appearance" && (
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-6 py-0">
            <div className="my-3 flex w-full flex-col gap-5 pb-4">
              {/* Color Theme */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <div>
                  <div className="font-semibold text-fg">Color Theme</div>
                  <div className="text-[11px] text-fg-muted">
                    Choose whether Nook follows your system color scheme or stays light / dark
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      id: "system" as const,
                      label: "System",
                      icon: (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect width="20" height="14" x="2" y="3" rx="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      ),
                    },
                    {
                      id: "light" as const,
                      label: "Light",
                      icon: (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="4" />
                          <path d="M12 2v2" />
                          <path d="M12 20v2" />
                          <path d="m4.93 4.93 1.41 1.41" />
                          <path d="m17.66 17.66 1.41 1.41" />
                          <path d="M2 12h2" />
                          <path d="M20 12h2" />
                          <path d="m6.34 17.66-1.41 1.41" />
                          <path d="m19.07 4.93-1.41 1.41" />
                        </svg>
                      ),
                    },
                    {
                      id: "dark" as const,
                      label: "Dark",
                      icon: (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                        </svg>
                      ),
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleThemeChange(item.id)}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-center transition-all ${
                        config?.app?.theme === item.id
                          ? "border-accent-500 bg-accent-500/15 font-semibold text-accent-500 shadow-xs"
                          : "border-line/60 bg-surface text-fg-muted hover:border-line hover:text-fg"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Widget Style Presets */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <div>
                  <div className="font-semibold text-fg">Widget Style Presets</div>
                  <div className="text-[11px] text-fg-muted">
                    Apply a cohesive visual styling across all active desktop widgets
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  {WIDGET_PRESETS.map((preset) => {
                    const isSelected = (config?.app?.widgetPreset || "default") === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handlePresetChange(preset.id)}
                        className={`group relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-accent-500 bg-accent-500/[0.08] shadow-xs ring-1 ring-accent-500/40"
                            : "border-line/70 bg-surface/80 hover:border-line hover:bg-surface"
                        }`}
                      >
                        {/* Mini Widget Preview Mockup */}
                        <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-line/40 bg-surface-raised/60 p-2.5">
                          {/* Simulated mini desktop wallpaper texture */}
                          <div className="absolute inset-0 bg-radial from-accent-500/5 via-transparent to-transparent opacity-50" />

                          {/* The Mini Widget Box */}
                          <div
                            className={`relative flex h-full w-full flex-col overflow-hidden transition-all duration-200 ${preset.containerClass}`}
                          >
                            {/* Mini Header Bar */}
                            <div
                              className={`flex items-center justify-between px-2 py-1 ${preset.headerClass}`}
                            >
                              <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                                <span className="font-mono text-[9px] font-medium text-fg/80">
                                  Widget
                                </span>
                              </div>
                              <div className="h-1 w-3 rounded-full bg-fg-muted/40" />
                            </div>

                            {/* Mini Content Skeleton */}
                            <div className="flex flex-1 flex-col justify-center gap-1.5 px-2.5 py-1.5">
                              <div className="h-1.5 w-3/4 rounded-full bg-fg-muted/20" />
                              <div className="h-1.5 w-1/2 rounded-full bg-fg-muted/15" />
                            </div>
                          </div>
                        </div>

                        {/* Text and Selection Meta */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-fg">{preset.name}</span>
                              <span className="rounded-md bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                                {preset.tagline}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                              {preset.description}
                            </div>
                          </div>

                          {/* Active Indicator Icon */}
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                              isSelected
                                ? "bg-accent-500 text-white"
                                : "border border-line/60 bg-surface-raised text-transparent group-hover:border-line"
                            }`}
                          >
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WIDGETS TAB */}
        {activeTab === "widgets" && (
          <div className="flex min-h-0 flex-1 gap-5 overflow-hidden px-6 py-0">
            {/* Left Column: Widget List */}
            <div className="my-3 flex w-56 shrink-0 flex-col gap-2.5 border-r border-line/60 pr-4">
              <div className="flex items-center justify-between font-medium text-fg">
                <span>Active Widgets</span>
                <span className="font-mono text-[11px] text-fg-muted">
                  {config?.widgets.length ?? 0}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto overscroll-none pr-1">
                {config?.widgets.map((w) => {
                  const widgetKind = w.kind || (w as unknown as { type?: string }).type || "";
                  const title =
                    getWidgetModule(widgetKind)?.manifest.name ??
                    (widgetKind ? widgetKind : "Widget");
                  const isSelected = selectedWidgetId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWidgetId(w.id)}
                      className={`group flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                        isSelected
                          ? "border-accent-500/60 bg-accent-500/15 font-semibold text-fg shadow-sm"
                          : "border-transparent bg-surface-raised text-fg hover:border-line hover:bg-surface"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2 truncate">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            isSelected ? "bg-accent-500" : "bg-fg-muted/40"
                          }`}
                        />
                        <span className="truncate font-medium text-fg">{title}</span>
                      </div>
                      <span
                        className={`ml-2 shrink-0 font-mono text-[10px] ${
                          isSelected ? "text-accent-500" : "text-fg-muted"
                        }`}
                      >
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
              <div className="mt-auto flex shrink-0 flex-col gap-1.5 border-t border-line/60 pt-3 pb-2">
                <span className="text-[11px] font-medium text-fg-muted">Add new widget:</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={widgetToAdd}
                    onChange={(e) => setWidgetToAdd(e.target.value)}
                    className="h-8 min-w-0 flex-1 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-xs text-fg transition-colors outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
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
                    className="flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg bg-accent-500 px-2.5 text-xs font-semibold whitespace-nowrap text-white shadow-xs transition-colors hover:bg-accent-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Widget Inspector */}
            <div className="my-3 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-none pr-2 pl-2">
              {selectedWidget ? (
                <div className="flex w-full flex-col gap-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-fg">
                        {selectedModule?.manifest.name ?? (selectedKind ? selectedKind : "Widget")}
                      </h2>
                    </div>
                  </div>

                  {/* Always on top */}
                  <div className="flex items-center justify-between border-t border-line/60 pt-3">
                    <div>
                      <div className="font-medium text-fg">Always on Top</div>
                      <div className="text-[11px] text-fg-muted">
                        Detach from desktop layer to float above all windows
                      </div>
                    </div>
                    <Toggle
                      checked={isAlwaysOnTop}
                      onChange={() =>
                        void handleToggleAlwaysOnTop(selectedWidget.id, isAlwaysOnTop)
                      }
                      ariaLabel="Always on top"
                    />
                  </div>

                  {/* Opacity slider */}
                  <div className="flex flex-col gap-2 border-t border-line/60 pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-fg">Window Opacity</span>
                      <span className="font-mono font-medium text-accent-500">
                        {Math.round(selectedWidget.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="1.0"
                      step="0.05"
                      value={selectedWidget.opacity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        isSlidingOpacityRef.current = true;
                        setConfig((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            widgets: prev.widgets.map((w) =>
                              w.id === selectedWidget.id ? { ...w, opacity: val } : w,
                            ),
                          };
                        });
                        if (opacityDebounceRef.current) {
                          clearTimeout(opacityDebounceRef.current);
                        }
                        opacityDebounceRef.current = setTimeout(async () => {
                          try {
                            await setOpacity(selectedWidget.id, val);
                          } finally {
                            setTimeout(() => {
                              isSlidingOpacityRef.current = false;
                            }, 150);
                          }
                        }, 40);
                      }}
                      className="cursor-pointer accent-accent-500"
                    />
                  </div>

                  {/* Widget Accent Color */}
                  <div className="flex flex-col gap-2 border-t border-line/60 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-fg">Widget Accent Color</span>
                      <span className="text-[11px] text-fg-muted">
                        Customize badge, highlight, and focus tint
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 pt-1">
                      {WIDGET_COLOR_OPTIONS.map((c) => {
                        const isSelected = (selectedWidget.settings.widgetColor || "") === c.value;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              handleWidgetSettingChange(selectedWidget.id, "widgetColor", c.value);
                            }}
                            title={c.label}
                            aria-label={c.label}
                            className={`group relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 ${
                              isSelected
                                ? "scale-105 ring-2 ring-accent-500 ring-offset-2 ring-offset-surface"
                                : "hover:ring-1 hover:ring-line"
                            }`}
                            style={{ backgroundColor: c.hex }}
                          >
                            {isSelected && (
                              <svg
                                className="pointer-events-none h-3.5 w-3.5 text-white drop-shadow-sm"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        );
                      })}

                      {/* Native Custom Color Picker Swatch */}
                      {(() => {
                        const customVal =
                          typeof selectedWidget.settings.widgetColor === "string" &&
                          selectedWidget.settings.widgetColor.startsWith("#")
                            ? selectedWidget.settings.widgetColor
                            : "";
                        const isCustomSelected =
                          customVal !== "" &&
                          !WIDGET_COLOR_OPTIONS.some((o) => o.value === customVal);

                        return (
                          <label
                            title={
                              isCustomSelected ? `Custom Color (${customVal})` : "Pick custom color"
                            }
                            className={`group relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 ${
                              isCustomSelected
                                ? "scale-105 ring-2 ring-accent-500 ring-offset-2 ring-offset-surface"
                                : "border border-line/80 hover:border-fg-muted"
                            }`}
                            style={
                              isCustomSelected
                                ? { backgroundColor: customVal }
                                : {
                                    background:
                                      "conic-gradient(from 180deg at 50% 50%, #f43f5e, #fbbf24, #10b981, #06b6d4, #6366f1, #d946ef, #f43f5e)",
                                  }
                            }
                          >
                            <input
                              type="color"
                              value={customVal || "#3b82f6"}
                              onChange={(e) => {
                                handleWidgetSettingChange(
                                  selectedWidget.id,
                                  "widgetColor",
                                  e.target.value,
                                );
                              }}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                            {isCustomSelected ? (
                              <svg
                                className="pointer-events-none h-3.5 w-3.5 text-white drop-shadow-sm"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg
                                className="pointer-events-none h-3 w-3 text-white drop-shadow-sm"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            )}
                          </label>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Widget Settings Schema Form */}
                  {selectedModule?.manifest.settingsSchema && (
                    <div className="border-t border-line/60 pt-3">
                      <span className="mb-2 block font-medium text-fg">Configuration</span>
                      <SettingsForm
                        fields={selectedModule.manifest.settingsSchema}
                        values={selectedWidget.settings}
                        onChange={(k, v) => handleWidgetSettingChange(selectedWidget.id, k, v)}
                      />
                    </div>
                  )}

                  {/* Remove Widget */}
                  <div className="border-t border-line/60 pt-4 pb-6">
                    <button
                      type="button"
                      onClick={() => void removeWidget(selectedWidget.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-error/40 bg-error/10 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/20"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>Remove Widget</span>
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
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-6 py-0">
            <div className="my-3 flex w-full flex-col gap-5 pb-4">
              <div className="flex items-center gap-2.5 rounded-2xl border border-line/60 bg-surface-raised/40 p-4 text-[11px] text-fg-muted backdrop-blur-xs">
                <svg
                  className="h-4 w-4 shrink-0 text-accent-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>
                  Tokens are stored securely in Windows Credential Manager and never logged or
                  exported.
                </span>
              </div>

              {/* GitHub Token */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-fg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <label htmlFor="gh-token-input" className="font-semibold text-fg">
                      GitHub Personal Access Token
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        githubConfigured ? "bg-ok" : "bg-fg-muted/30"
                      }`}
                    />
                    <span className={githubConfigured ? "text-ok" : "text-fg-muted/60"}>
                      {githubConfigured ? "Active" : "Not set"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-fg-muted">
                  Required for private repository commits and CI workflow runs. Public repos do not
                  strictly require a token.
                </p>
                <div className="flex gap-2 pt-1">
                  <input
                    id="gh-token-input"
                    type="password"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={githubInput}
                    onChange={(e) => setGithubInput(e.target.value)}
                    placeholder="ghp_••••••••••••••••••••••••••••••••••••"
                    className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none placeholder:text-fg-muted/40 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveGithubToken()}
                    className="cursor-pointer rounded-lg bg-accent-500 px-3.5 py-1.5 font-medium text-white shadow-xs transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save
                  </button>
                  {githubConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleClearGithubToken()}
                      className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-fg-muted transition-colors hover:bg-surface-raised hover:text-error"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Vercel Token */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 text-fg" viewBox="0 0 76 65" fill="currentColor">
                      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                    </svg>
                    <label htmlFor="vercel-token-input" className="font-semibold text-fg">
                      Vercel API Token
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        vercelConfigured ? "bg-ok" : "bg-fg-muted/30"
                      }`}
                    />
                    <span className={vercelConfigured ? "text-ok" : "text-fg-muted/60"}>
                      {vercelConfigured ? "Active" : "Not set"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-fg-muted">
                  Used to query deployment pipeline states and build status.
                </p>
                <div className="flex gap-2 pt-1">
                  <input
                    id="vercel-token-input"
                    type="password"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={vercelInput}
                    onChange={(e) => setVercelInput(e.target.value)}
                    placeholder="••••••••••••••••••••••••"
                    className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none placeholder:text-fg-muted/40 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveVercelToken()}
                    className="cursor-pointer rounded-lg bg-accent-500 px-3.5 py-1.5 font-medium text-white shadow-xs transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save
                  </button>
                  {vercelConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleClearVercelToken()}
                      className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-fg-muted transition-colors hover:bg-surface-raised hover:text-error"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* AI / OpenAI Token */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-3.5 w-3.5 text-accent-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    <label htmlFor="ai-token-input" className="font-semibold text-fg">
                      AI / OpenAI API Key
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        aiConfigured ? "bg-ok" : "bg-fg-muted/30"
                      }`}
                    />
                    <span className={aiConfigured ? "text-ok" : "text-fg-muted/60"}>
                      {aiConfigured ? "Active" : "Not set"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-fg-muted">
                  Powers AI widgets (OpenAI, OpenRouter, Groq, or compatible endpoints).
                </p>
                <div className="flex gap-2 pt-1">
                  <input
                    id="ai-token-input"
                    type="password"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="sk-••••••••••••••••••••••••"
                    className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none placeholder:text-fg-muted/40 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveAiToken()}
                    className="cursor-pointer rounded-lg bg-accent-500 px-3.5 py-1.5 font-medium text-white shadow-xs transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save
                  </button>
                  {aiConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleClearAiToken()}
                      className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-fg-muted transition-colors hover:bg-surface-raised hover:text-error"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABOUT TAB */}
        {activeTab === "about" && (
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-6 py-0">
            <div className="my-3 flex w-full flex-col gap-5 pb-4">
              {/* Hero Section */}
              <div className="flex items-center gap-5 px-1 py-2">
                <img
                  src="/icon.png"
                  alt="Nook"
                  width={80}
                  height={80}
                  className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                />
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-xl font-bold tracking-tight text-fg">Nook</h2>
                  <p className="text-xs leading-relaxed text-fg-muted">
                    Lightweight, distraction-free desktop widgets
                    <br />
                    pinned directly to your Windows desktop.
                  </p>
                </div>
              </div>

              {/* Developer & Project Info */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                  <span className="font-semibold text-fg">Developer</span>
                  <p className="text-[11px] leading-relaxed text-fg-muted">
                    Crafted with care by <span className="font-medium text-fg">Hasan</span> (
                    <button
                      type="button"
                      onClick={() => void openUrl("https://github.com/hasanify")}
                      className="cursor-pointer text-accent-500 underline underline-offset-2 hover:text-accent-600"
                    >
                      @hasanify
                    </button>
                    ).
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => void openUrl("https://github.com/hasanify/nook")}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-accent-500 hover:text-accent-600"
                    >
                      <span>Visit GitHub Repository</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                  <span className="font-semibold text-fg">Links & Support</span>
                  <div className="flex flex-col items-start gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => void openUrl("https://github.com/hasanify/nook/issues")}
                      className="w-fit cursor-pointer text-left text-fg-muted transition-colors hover:text-accent-500"
                    >
                      • Report a Bug or Request Feature
                    </button>
                    <button
                      type="button"
                      onClick={() => void openUrl("https://github.com/hasanify/nook/releases")}
                      className="w-fit cursor-pointer text-left text-fg-muted transition-colors hover:text-accent-500"
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
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-fg">Software Updates</div>
                    <div className="text-[11px] text-fg-muted">
                      Installed version:{" "}
                      <span className="font-mono font-medium text-fg">
                        {appVersion ? `v${appVersion}` : "..."}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={checkingUpdate || downloadingUpdate}
                    onClick={() => void handleCheckUpdates()}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-1.5 font-medium text-fg shadow-xs transition-colors hover:border-accent-500 hover:text-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg
                      className={`h-3.5 w-3.5 ${checkingUpdate ? "animate-spin" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.5 2v6h-6" />
                      <path d="M2.5 22v-6h6" />
                      <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8" />
                      <path d="M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16" />
                    </svg>
                    <span>{checkingUpdate ? "Checking..." : "Check for Updates"}</span>
                  </button>
                </div>

                {/* Status messages */}
                {updateError && (
                  <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-[11px] text-error">
                    {updateError}
                  </div>
                )}

                {updateResult && !updateResult.has_update && !updateError && (
                  <div className="flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 p-3 text-[11px] text-ok">
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-ok"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>You are running the latest version of Nook.</span>
                  </div>
                )}

                {updateResult && updateResult.has_update && (
                  <div className="flex flex-col gap-2.5 rounded-xl border border-accent-500/30 bg-accent-500/10 p-4">
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
                          className="cursor-pointer text-[11px] text-accent-500 underline underline-offset-2 hover:text-accent-600"
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
                            className="cursor-pointer rounded-lg bg-accent-500 px-3.5 py-1.5 font-medium text-white shadow-xs transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Download & Install Update
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void openUrl(updateResult.release_url)}
                            className="cursor-pointer rounded-lg bg-accent-500 px-3.5 py-1.5 font-medium text-white shadow-xs transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Download from GitHub
                          </button>
                        )}
                      </div>
                    )}

                    {installError && (
                      <div className="text-[11px] text-error">Install error: {installError}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
