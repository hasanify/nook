import {
  ArrowClockwise,
  Brain,
  Check,
  Cloud,
  Desktop,
  GithubLogo,
  Globe,
  Info,
  Lightning,
  LockKey,
  Moon,
  PaintBrush,
  Plus,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
  Sun,
  Trash,
  Triangle,
  User,
} from "@phosphor-icons/react";
import { listen } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CustomSelect } from "@/components/CustomSelect";
import { SettingsForm } from "@/components/SettingsForm";
import { Toggle } from "@/components/Toggle";
import { WIDGET_COLOR_OPTIONS } from "@/components/WidgetContextMenu";
import { applyBentoLayout, computeBentoLayout } from "@/core/bento";
import {
  addWidget,
  checkForUpdates,
  clearAccountToken,
  getAccountToken,
  getAppConfig,
  getAppVersion,
  getDesktopWorkArea,
  hasAccountToken,
  installUpdate,
  onConfigChanged,
  onUpdateDownloadProgress,
  removeWidget,
  saveAccountToken,
  setAlwaysOnTop,
  setOpacity,
  showSettingsWindow,
  updateAppConfig,
  type UpdateCheckResult,
  updateSettings,
} from "@/core/ipc";
import {
  buildCustomPreset,
  type CustomPresetConfig,
  getCustomPresetConfig,
  type PresetBackdrop,
  type PresetBorder,
  type PresetFont,
  type PresetHeader,
  type PresetRadius,
  saveCustomPresetConfig,
  WIDGET_PRESETS,
} from "@/core/presets";
import type { AppConfig, WidgetInstance } from "@/core/types";
import { useEditMode } from "@/core/use-edit-mode";
import { getWidgetModule, WIDGET_REGISTRY } from "@/widgets/registry";

interface AIProviderItem {
  id: string;
  name: string;
  placeholder: string;
  desc: string;
  defaultModel: string;
  icon: React.ReactNode;
}

const AI_PROVIDER_LIST: AIProviderItem[] = [
  {
    id: "openai",
    name: "OpenAI",
    placeholder: "sk-proj-••••••••••••••••••••••••",
    desc: "Powers GPT-4o, GPT-4o-mini, and OpenAI models.",
    defaultModel: "gpt-4o-mini",
    icon: <Sparkle className="text-accent-500 block-4 inline-4" weight="fill" />,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    placeholder: "sk-or-v1-••••••••••••••••••••••••",
    desc: "Single unified API to 100+ AI models (Claude, Llama, DeepSeek, Gemini).",
    defaultModel: "openai/gpt-4o-mini",
    icon: <Globe className="text-accent-500 block-4 inline-4" />,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    placeholder: "AIzaSy••••••••••••••••••••••••",
    desc: "Generous free tier powering ultra-fast Gemini 2.0 Flash.",
    defaultModel: "gemini-2.0-flash",
    icon: <Sparkle className="text-accent-500 block-4 inline-4" />,
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    placeholder: "sk-ant-api••••••••••••••••••••••••",
    desc: "Direct access to Claude 3.5 Sonnet and Claude 3.5 Haiku.",
    defaultModel: "claude-3-5-haiku-20241022",
    icon: <Brain className="text-accent-500 block-4 inline-4" />,
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    placeholder: "Bedrock API key or Bearer token...",
    desc: "AWS Bedrock runtime or custom OpenAI-compatible gateway.",
    defaultModel: "anthropic.claude-3-5-haiku-20241022-v1:0",
    icon: <Cloud className="text-accent-500 block-4 inline-4" />,
  },
  {
    id: "groq",
    name: "Groq",
    placeholder: "gsk_••••••••••••••••••••••••",
    desc: "Near-instant LPU inference powering Llama 3.3 70B.",
    defaultModel: "llama-3.3-70b-versatile",
    icon: <Lightning className="text-accent-500 block-4 inline-4" weight="fill" />,
  },
];

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
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [vercelConfigured, setVercelConfigured] = useState(false);
  const [aiTokensConfigured, setAiTokensConfigured] = useState<Record<string, boolean>>({});
  const [githubInput, setGithubInput] = useState("");
  const [vercelInput, setVercelInput] = useState("");
  const [aiInputs, setAiInputs] = useState<Record<string, string>>({});
  const [bedrockEndpointInput, setBedrockEndpointInput] = useState("");
  const [bedrockEndpointConfigured, setBedrockEndpointConfigured] = useState(false);
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

    const aiKeys = ["openai", "openrouter", "gemini", "anthropic", "bedrock", "groq", "ai"];
    Promise.all(aiKeys.map(async (k) => [k, await hasAccountToken(k).catch(() => false)] as const))
      .then((pairs) => {
        const map: Record<string, boolean> = {};
        for (const [k, v] of pairs) {
          map[k] = v;
        }
        setAiTokensConfigured(map);
      })
      .catch(() => {});

    getAccountToken("bedrock_endpoint")
      .then((ep) => {
        if (ep) {
          setBedrockEndpointInput(ep);
          setBedrockEndpointConfigured(true);
        } else {
          setBedrockEndpointConfigured(false);
        }
      })
      .catch(() => {});
  }, []);

  const preferredAi = config?.app?.defaultAiProvider || "auto";
  const activeAiProvider = useMemo(() => {
    if (
      preferredAi !== "auto" &&
      (aiTokensConfigured[preferredAi] || (preferredAi === "openai" && aiTokensConfigured.ai))
    ) {
      return preferredAi;
    }
    const order = ["openai", "openrouter", "gemini", "anthropic", "groq", "bedrock"];
    for (const key of order) {
      if (aiTokensConfigured[key] || (key === "openai" && aiTokensConfigured.ai)) {
        return key;
      }
    }
    return null;
  }, [preferredAi, aiTokensConfigured]);

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
        if (typeof cfg.app?.autostart === "boolean") {
          setAutostartEnabled(cfg.app.autostart);
        }
        const autoUp =
          cfg.app?.auto_update ?? (cfg.app as unknown as { autoUpdate?: boolean })?.autoUpdate;
        if (typeof autoUp === "boolean") {
          setAutoUpdateEnabled(autoUp);
        }
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
      .then(async (osEnabled) => {
        const cfg = await getAppConfig().catch(() => null);
        const wanted = cfg?.app?.autostart;
        if (typeof wanted === "boolean") {
          if (wanted && !osEnabled) {
            await enable().catch(() => {});
            setAutostartEnabled(true);
          } else if (!wanted && osEnabled) {
            await disable().catch(() => {});
            setAutostartEnabled(false);
          } else {
            setAutostartEnabled(osEnabled);
          }
        } else {
          setAutostartEnabled(osEnabled);
        }
      })
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

    let unlistenUpdate: (() => void) | undefined;
    listen<UpdateCheckResult>("update-available", (event) => {
      if (event.payload?.has_update) {
        setUpdateResult(event.payload);
      }
    }).then((fn) => {
      unlistenUpdate = fn;
    });

    return () => {
      if (unlisten) unlisten();
      if (unlistenProgress) unlistenProgress();
      if (unlistenFocus) unlistenFocus();
      if (unlistenUpdate) unlistenUpdate();
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

  const handleSaveAiProviderToken = async (provider: string) => {
    const val = (aiInputs[provider] || "").trim();
    if (!val) return;
    await saveAccountToken(provider, val);
    setAiInputs((prev) => ({ ...prev, [provider]: "" }));
    refreshAccountStatus();
  };

  const handleClearAiProviderToken = async (provider: string) => {
    await clearAccountToken(provider);
    if (provider === "openai") {
      await clearAccountToken("ai");
    }
    refreshAccountStatus();
  };

  const handleSaveBedrockEndpoint = async () => {
    const val = bedrockEndpointInput.trim();
    if (val) {
      await saveAccountToken("bedrock_endpoint", val);
      setBedrockEndpointConfigured(true);
    } else {
      await clearAccountToken("bedrock_endpoint");
      setBedrockEndpointConfigured(false);
    }
    refreshAccountStatus();
  };

  const handleClearBedrockEndpoint = async () => {
    await clearAccountToken("bedrock_endpoint");
    setBedrockEndpointInput("");
    setBedrockEndpointConfigured(false);
    refreshAccountStatus();
  };

  const handlePreferredAiProviderChange = (provider: string) => {
    if (!config) return;
    setConfig({
      ...config,
      app: { ...config.app, defaultAiProvider: provider },
    });
    void updateAppConfig({ defaultAiProvider: provider });
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

  const [customPreset, setCustomPreset] = useState<CustomPresetConfig>(() =>
    getCustomPresetConfig(),
  );

  const handleCustomPresetFieldChange = <K extends keyof CustomPresetConfig>(
    field: K,
    value: CustomPresetConfig[K],
  ) => {
    const updated = { ...customPreset, [field]: value };
    setCustomPreset(updated);
    saveCustomPresetConfig(updated);
    if ((config?.app?.widgetPreset || "default") !== "custom") {
      handlePresetChange("custom");
    }
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

  const handleToggleAutoUpdate = async () => {
    const next = !autoUpdateEnabled;
    setAutoUpdateEnabled(next);
    try {
      await updateAppConfig({ autoUpdate: next });
      if (next) {
        void handleCheckUpdates();
      }
    } catch {
      setAutoUpdateEnabled(!next);
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
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === widgetId ? { ...w, settings: { ...w.settings, [key]: value } } : w,
        ),
      };
    });
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

  const [bentoLayoutIdx, setBentoLayoutIdx] = useState(0);
  const [isBentoPreviewing, setIsBentoPreviewing] = useState(false);
  const originalBentoWidgetsRef = useRef<WidgetInstance[] | null>(null);

  const handleCycleSettingsBento = useCallback(async () => {
    if (!config?.widgets || config.widgets.length === 0) return;
    if (!originalBentoWidgetsRef.current) {
      originalBentoWidgetsRef.current = config.widgets;
    }
    const nextIdx = isBentoPreviewing ? bentoLayoutIdx + 1 : 0;
    setBentoLayoutIdx(nextIdx);
    setIsBentoPreviewing(true);
    let workArea = {
      x: 0,
      y: 0,
      w: window.screen.availWidth || 1920,
      h: window.screen.availHeight || 1080,
    };
    try {
      const area = await getDesktopWorkArea();
      if (area && area.w > 0 && area.h > 0) {
        workArea = area;
      }
    } catch {
      // Ignore
    }
    const layout = computeBentoLayout(originalBentoWidgetsRef.current, nextIdx, workArea);
    await applyBentoLayout(layout.widgets);
  }, [config, isBentoPreviewing, bentoLayoutIdx]);

  const handleDoneSettingsBento = useCallback(() => {
    originalBentoWidgetsRef.current = null;
    setIsBentoPreviewing(false);
  }, []);

  const handleRevertSettingsBento = useCallback(async () => {
    if (originalBentoWidgetsRef.current) {
      await applyBentoLayout(originalBentoWidgetsRef.current);
      originalBentoWidgetsRef.current = null;
    }
    setIsBentoPreviewing(false);
  }, []);

  const selectedWidget: WidgetInstance | undefined = config?.widgets.find(
    (w) => w.id === selectedWidgetId,
  );
  const isAlwaysOnTop = Boolean(selectedWidget?.alwaysOnTop ?? selectedWidget?.always_on_top);
  const selectedKind = selectedWidget
    ? selectedWidget.kind || (selectedWidget as unknown as { type?: string }).type || ""
    : "";
  const selectedModule = selectedKind ? getWidgetModule(selectedKind) : undefined;
  const selectedWidgetColor =
    selectedWidget &&
    typeof selectedWidget.settings?.widgetColor === "string" &&
    selectedWidget.settings.widgetColor.trim() !== ""
      ? selectedWidget.settings.widgetColor.trim()
      : undefined;

  return (
    <div className="flex flex-col overflow-hidden overscroll-none bg-surface font-sans text-fg select-none block-full inline-full">
      {/* Tabs */}
      <div className="flex gap-1 border-be border-line/60 bg-surface-raised/40 px-5 pbs-1.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`
            flex cursor-pointer items-center gap-2 border-be-2 px-3 py-2.5
            transition-all
            ${
              activeTab === "general"
                ? "border-accent-500 font-semibold text-fg"
                : `
                border-transparent text-fg-muted
                hover:text-fg
              `
            }
          `}
        >
          <SlidersHorizontal className="block-3.5 inline-3.5" />
          <span>General</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("widgets")}
          className={`
            flex cursor-pointer items-center gap-2 border-be-2 px-3 py-2.5
            transition-all
            ${
              activeTab === "widgets"
                ? "border-accent-500 font-semibold text-fg"
                : `
                border-transparent text-fg-muted
                hover:text-fg
              `
            }
          `}
        >
          <SquaresFour className="block-3.5 inline-3.5" />
          <span>Widgets</span>
          <span className="rounded-full bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
            {config?.widgets.length ?? 0}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={`
            flex cursor-pointer items-center gap-2 border-be-2 px-3 py-2.5
            transition-all
            ${
              activeTab === "accounts"
                ? "border-accent-500 font-semibold text-fg"
                : `
                border-transparent text-fg-muted
                hover:text-fg
              `
            }
          `}
        >
          <User className="block-3.5 inline-3.5" />
          <span>Accounts</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={`
            flex cursor-pointer items-center gap-2 border-be-2 px-3 py-2.5
            transition-all
            ${
              activeTab === "appearance"
                ? "border-accent-500 font-semibold text-fg"
                : `
                border-transparent text-fg-muted
                hover:text-fg
              `
            }
          `}
        >
          <PaintBrush className="block-3.5 inline-3.5" />
          <span>Appearance</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("about")}
          className={`
            flex cursor-pointer items-center gap-2 border-be-2 px-3 py-2.5
            transition-all
            ${
              activeTab === "about"
                ? "border-accent-500 font-semibold text-fg"
                : `
                border-transparent text-fg-muted
                hover:text-fg
              `
            }
          `}
        >
          <div className="relative">
            <Info className="block-3.5 inline-3.5" />
            {updateResult?.has_update && (
              <span className="absolute -inset-e-1 -inset-bs-1 rounded-full bg-accent-500 block-2 inline-2" />
            )}
          </div>
          <span>About</span>
          {updateResult?.has_update && (
            <span className="rounded-full bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-500">
              Update
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden text-xs min-block-0">
        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-6 py-0">
            <div className="my-3 flex flex-col gap-5 pbe-4 inline-full">
              {/* Desktop & Interaction Settings */}
              <div className="flex flex-col gap-4 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <span className="font-semibold text-fg">Desktop & Interaction</span>

                {/* Edit Mode Toggle */}
                <div className="flex items-center justify-between border-bs border-line/40 pbs-4">
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
                <div className="flex items-center justify-between border-bs border-line/40 pbs-4">
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

                {/* Automatic Updates */}
                <div className="flex items-center justify-between border-bs border-line/40 pbs-4">
                  <div>
                    <div className="font-medium text-fg">Automatic Updates</div>
                    <div className="text-[11px] text-fg-muted">
                      Automatically check, download, and install new releases in the background
                    </div>
                  </div>
                  <Toggle
                    checked={autoUpdateEnabled}
                    onChange={() => void handleToggleAutoUpdate()}
                    ariaLabel="Toggle automatic updates"
                  />
                </div>

                {/* Grid Snap */}
                <div className="flex items-center justify-between border-bs border-line/40 pbs-4">
                  <div>
                    <div className="font-medium text-fg">Grid Snap</div>
                    <div className="text-[11px] text-fg-muted">
                      Snap widget position and size during drag (0 for free movement)
                    </div>
                  </div>
                  <CustomSelect<number>
                    value={config?.app?.gridSnap ?? 0}
                    onChange={(val) => handleGridSnapChange(val)}
                    options={[
                      { value: 0, label: "Disabled (Free Movement)" },
                      { value: 4, label: "4 px (Fine)" },
                      { value: 8, label: "8 px (Default)" },
                      { value: 16, label: "16 px (Coarse)" },
                    ]}
                    className="inline-48"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* APPEARANCE TAB */}
        {activeTab === "appearance" && (
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-6 py-0">
            <div className="my-3 flex flex-col gap-5 pbe-6 inline-full">
              {/* Color Theme */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-4 backdrop-blur-xs">
                <div>
                  <div className="font-semibold text-fg">Color Theme</div>
                  <div className="text-[11px] text-fg-muted">
                    Choose whether Nook follows your system color scheme or stays light / dark
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    {
                      id: "system" as const,
                      label: "System",
                      icon: <Desktop className="block-4" />,
                    },
                    {
                      id: "light" as const,
                      label: "Light",
                      icon: <Sun className="block-4 inline-4" />,
                    },
                    {
                      id: "dark" as const,
                      label: "Dark",
                      icon: <Moon className="block-4 inline-4" />,
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleThemeChange(item.id)}
                      className={`
                        flex cursor-pointer items-center justify-center gap-2
                        rounded-xl border p-2.5 text-center text-xs font-medium
                        transition-all
                        ${
                          config?.app?.theme === item.id
                            ? `border-accent-500 bg-accent-500/15 font-semibold text-accent-500 shadow-xs`
                            : `
                            border-line/60 bg-surface text-fg-muted
                            hover:border-line hover:text-fg
                          `
                        }
                      `}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Widget Style Presets */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-4 backdrop-blur-xs">
                <div>
                  <div className="font-semibold text-fg">Widget Style Presets</div>
                  <div className="text-[11px] text-fg-muted">
                    Apply a cohesive visual styling across all active desktop widgets
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pbs-1">
                  {WIDGET_PRESETS.map((preset) => {
                    const isSelected = (config?.app?.widgetPreset || "default") === preset.id;
                    const isDarkTheme =
                      config?.app?.theme === "dark" ||
                      (config?.app?.theme === "system" &&
                        typeof window !== "undefined" &&
                        window.matchMedia("(prefers-color-scheme: dark)").matches);
                    const previewStyle = preset.getShellStyle(undefined, isDarkTheme, false);

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handlePresetChange(preset.id)}
                        className={`
                          group relative flex cursor-pointer flex-col gap-2.5
                          rounded-xl border p-3.5 text-start transition-all
                          ${
                            isSelected
                              ? `border-accent-500 bg-accent-500/8 shadow-xs ring-1 ring-accent-500/40`
                              : `
                              border-line/70 bg-surface/80
                              hover:border-line hover:bg-surface
                            `
                          }
                        `}
                      >
                        {/* Mini Widget Preview Mockup */}
                        <div className="relative flex items-center justify-center overflow-hidden rounded-lg border border-line/40 bg-surface-raised/60 p-2.5 block-24 inline-full">
                          {/* Simulated mini desktop wallpaper texture */}
                          <div className="absolute inset-0 bg-radial from-accent-500/5 via-transparent to-transparent opacity-50" />

                          {/* The Mini Widget Box */}
                          <div
                            className={`
                              relative flex flex-col overflow-hidden
                              transition-all duration-200 block-full inline-full
                              ${preset.containerClass}
                            `}
                            style={previewStyle}
                          >
                            {/* Mini Header Bar */}
                            <div
                              className={`
                                flex items-center justify-between px-2 py-1
                                ${preset.headerClass}
                              `}
                            >
                              <div className="flex items-center gap-1">
                                <div className="rounded-full bg-accent-500 block-1.5" />
                                <span className="font-mono text-[9px] font-medium text-fg/80">
                                  Widget
                                </span>
                              </div>
                              <div className="rounded-full bg-fg-muted/40 block-1 inline-3" />
                            </div>

                            {/* Mini Content Skeleton */}
                            <div className="flex flex-1 flex-col justify-center gap-1.5 px-2.5 py-1.5">
                              <div className="rounded-full bg-fg-muted/20 block-1.5 inline-3/4" />
                              <div className="rounded-full bg-fg-muted/15 block-1.5 inline-1/2" />
                            </div>
                          </div>
                        </div>

                        {/* Text and Selection Meta */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-inline-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-fg">
                                {preset.name}
                              </span>
                              <span className="shrink-0 rounded-md bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-fg-muted">
                                {preset.tagline}
                              </span>
                            </div>
                            <div className="mbs-1 line-clamp-2 text-[11px] leading-relaxed text-fg-muted">
                              {preset.description}
                            </div>
                          </div>

                          {/* Active Indicator Icon */}
                          <div
                            className={`
                              flex shrink-0 items-center justify-center
                              rounded-full transition-colors block-4.5
                              inline-4.5
                              ${
                                isSelected
                                  ? "bg-accent-500 text-white"
                                  : `
                                  border border-line/60 bg-surface-raised
                                  text-transparent
                                  group-hover:border-line
                                `
                              }
                            `}
                          >
                            <Check className="block-2.5 inline-2.5" weight="bold" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Appearance Studio */}
                <div className="rounded-2xl border border-line/60 bg-surface/70 p-5 shadow-xs">
                  <div className="mbe-4 flex items-center justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
                        <PaintBrush className="text-accent-500 block-4 inline-4" />
                        Custom Appearance Studio
                      </h4>
                      <p className="mbs-0.5 text-xs text-fg-muted">
                        Customize typography, corner radius, glass materials, and border styles.
                      </p>
                    </div>
                    {(config?.app?.widgetPreset || "default") === "custom" ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-accent-500/15 px-2.5 py-1 text-[11px] font-semibold text-accent-500">
                        <Check className="block-3 inline-3" weight="bold" /> Active Profile
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePresetChange("custom")}
                        className="cursor-pointer rounded-lg bg-surface-raised px-3 py-1 text-xs font-medium text-fg transition-colors hover:bg-accent-500 hover:text-white"
                      >
                        Apply Custom
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Controls Column 1: Typography & Radius */}
                    <div className="flex flex-col gap-4">
                      {/* Font selector */}
                      <div>
                        <span className="text-xs font-semibold text-fg">Typography (Font)</span>
                        <div className="mbs-2 grid grid-cols-2 gap-1.5">
                          {[
                            { id: "sans", label: "Sans", sub: "Inter" },
                            { id: "mono", label: "Mono", sub: "JetBrains" },
                            { id: "serif", label: "Serif", sub: "Newsreader" },
                            { id: "rounded", label: "Rounded", sub: "Quicksand" },
                            { id: "tech", label: "Tech", sub: "Space Mono" },
                          ].map((f) => {
                            const isCur = customPreset.font === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() =>
                                  handleCustomPresetFieldChange("font", f.id as PresetFont)
                                }
                                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-start transition-all ${
                                  isCur
                                    ? "border-accent-500 bg-accent-500/10 text-accent-500 ring-1 ring-accent-500"
                                    : "border-line/60 bg-surface-raised/40 text-fg-muted hover:border-line hover:text-fg"
                                }`}
                              >
                                <div className="text-xs font-medium">{f.label}</div>
                                <div className="font-mono text-[10px] opacity-75">{f.sub}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Corner Radius */}
                      <div>
                        <span className="text-xs font-semibold text-fg">Corner Radius</span>
                        <div className="mbs-2 flex flex-wrap gap-1.5">
                          {[
                            { id: "none", label: "0px" },
                            { id: "sm", label: "6px" },
                            { id: "md", label: "10px" },
                            { id: "lg", label: "16px" },
                            { id: "xl", label: "24px" },
                            { id: "full", label: "32px" },
                          ].map((r) => {
                            const isCur = customPreset.radius === r.id;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() =>
                                  handleCustomPresetFieldChange("radius", r.id as PresetRadius)
                                }
                                className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                                  isCur
                                    ? "border-accent-500 bg-accent-500 text-white shadow-xs"
                                    : "border-line/60 bg-surface-raised/50 text-fg-muted hover:text-fg"
                                }`}
                              >
                                {r.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Controls Column 2: Material & Borders */}
                    <div className="flex flex-col gap-4">
                      {/* Material / Backdrop */}
                      <div>
                        <span className="text-xs font-semibold text-fg">Surface Material</span>
                        <div className="mbs-2 grid grid-cols-2 gap-1.5">
                          {[
                            { id: "glass", label: "Frosted Glass", sub: "Deep blur" },
                            { id: "sheer", label: "Floating Sheer", sub: "12px blur" },
                            { id: "solid", label: "Solid Surface", sub: "Opaque card" },
                            { id: "oled", label: "OLED Black", sub: "Pitch-black" },
                          ].map((b) => {
                            const isCur = customPreset.backdrop === b.id;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() =>
                                  handleCustomPresetFieldChange("backdrop", b.id as PresetBackdrop)
                                }
                                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-start transition-all ${
                                  isCur
                                    ? "border-accent-500 bg-accent-500/10 text-accent-500 ring-1 ring-accent-500"
                                    : "border-line/60 bg-surface-raised/40 text-fg-muted hover:border-line hover:text-fg"
                                }`}
                              >
                                <div className="text-xs font-medium">{b.label}</div>
                                <div className="text-[10px] opacity-75">{b.sub}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Border & Shadow */}
                      <div>
                        <span className="text-xs font-semibold text-fg">Border & Glow</span>
                        <div className="mbs-2 grid grid-cols-3 gap-1.5">
                          {[
                            { id: "hairline", label: "Hairline" },
                            { id: "solid", label: "Solid" },
                            { id: "thick", label: "Thick 2px" },
                            { id: "glow", label: "Neon Glow" },
                            { id: "none", label: "None" },
                          ].map((b) => {
                            const isCur = customPreset.border === b.id;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() =>
                                  handleCustomPresetFieldChange("border", b.id as PresetBorder)
                                }
                                className={`cursor-pointer rounded-lg border px-2 py-1 text-center text-xs font-medium transition-all ${
                                  isCur
                                    ? "border-accent-500 bg-accent-500 text-white"
                                    : "border-line/60 bg-surface-raised/50 text-fg-muted hover:text-fg"
                                }`}
                              >
                                {b.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Header & Live Interactive Preview */}
                    <div className="flex flex-col gap-3">
                      <div>
                        <span className="text-xs font-semibold text-fg">Header Divider</span>
                        <div className="mbs-1.5 flex flex-wrap gap-1.5">
                          {[
                            { id: "hairline", label: "Hairline" },
                            { id: "seamless", label: "Seamless" },
                            { id: "tinted", label: "Tinted" },
                            { id: "bold", label: "Bold" },
                          ].map((h) => {
                            const isCur = customPreset.header === h.id;
                            return (
                              <button
                                key={h.id}
                                type="button"
                                onClick={() =>
                                  handleCustomPresetFieldChange("header", h.id as PresetHeader)
                                }
                                className={`cursor-pointer rounded-lg border px-2.5 py-0.5 text-xs font-medium transition-all ${
                                  isCur
                                    ? "border-accent-500 bg-accent-500 text-white"
                                    : "border-line/60 bg-surface-raised/50 text-fg-muted hover:text-fg"
                                }`}
                              >
                                {h.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Live Interactive Preview Card */}
                      <div className="mbs-1">
                        <span className="mbe-1.5 block text-xs font-semibold text-fg">
                          Live Interactive Preview
                        </span>
                        {(() => {
                          const previewPreset = buildCustomPreset(customPreset);
                          const currentAppTheme = config?.app?.theme ?? "system";
                          const isDark =
                            currentAppTheme === "dark" ||
                            (currentAppTheme === "system" &&
                              typeof window !== "undefined" &&
                              window.matchMedia("(prefers-color-scheme: dark)").matches);
                          const shellStyle = previewPreset.getShellStyle(undefined, isDark, false);
                          return (
                            <div
                              className={`overflow-hidden transition-all ${previewPreset.containerClass}`}
                              style={shellStyle}
                            >
                              {/* Header */}
                              <div
                                className={`flex items-center justify-between px-3 py-2 ${previewPreset.headerClass}`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Sparkle
                                    className="text-accent-500 block-3.5 inline-3.5"
                                    weight="fill"
                                  />
                                  <span className="text-xs font-semibold text-fg">
                                    Preview Widget
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-fg-muted">Active</span>
                              </div>
                              {/* Content */}
                              <div className="flex flex-col gap-2 p-3 text-xs">
                                <p className="text-fg-muted">
                                  This is how widgets render with your custom appearance preset.
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <span className="rounded-full border border-accent-500/30 bg-accent-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-500">
                                    {customPreset.font}
                                  </span>
                                  <span className="text-[11px] text-fg-muted">
                                    {customPreset.radius} • {customPreset.backdrop}
                                  </span>
                                </div>
                              </div>
                              {/* Sticky Footer */}
                              <div className="flex items-center justify-between border-bs border-line/40 bg-surface/85 px-3 py-1.5 text-[10px] text-fg-muted">
                                <span>Sticky footer</span>
                                <span className="font-mono text-ok">100% OK</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WIDGETS TAB */}
        {activeTab === "widgets" && (
          <div className="flex flex-1 gap-5 overflow-hidden px-6 py-0 min-block-0">
            {/* Left Column: Widget List */}
            <div className="my-3 flex shrink-0 flex-col gap-2.5 border-e border-line/60 pe-4 inline-56">
              <div className="flex items-center justify-between font-medium text-fg">
                <span>Active Widgets</span>
                <span className="font-mono text-[11px] text-fg-muted">
                  {config?.widgets.length ?? 0}
                </span>
              </div>

              {/* Bento Grid Arranger Option */}
              {(config?.widgets.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1.5 rounded-lg border border-line/60 bg-surface-raised/60 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-fg">
                      <SquaresFour className="text-accent-500 block-3.5 inline-3.5" />
                      Bento Grid
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 pbs-0.5">
                    <button
                      type="button"
                      onClick={() => void handleCycleSettingsBento()}
                      className="
                        flex-1 cursor-pointer rounded-md bg-accent-500 px-2 py-1
                        text-center text-[11px] font-semibold text-white
                        shadow-xs transition-colors
                        hover:bg-accent-600
                        active:scale-95
                      "
                    >
                      Cycle Layout
                    </button>
                    {isBentoPreviewing && (
                      <>
                        <button
                          type="button"
                          onClick={handleDoneSettingsBento}
                          className="
                            cursor-pointer rounded-md bg-accent-500/20 px-2.5
                            py-1 text-[11px] font-semibold text-accent-500
                            transition-colors
                            hover:bg-accent-500/30
                            active:scale-95
                          "
                          title="Save this layout"
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRevertSettingsBento()}
                          className="
                            cursor-pointer rounded-md border border-line
                            bg-surface px-2 py-1 text-[11px] font-medium
                            text-fg-muted
                            hover:text-fg
                            active:scale-95
                          "
                          title="Restore previous layout"
                        >
                          Revert
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto overscroll-none pe-1 min-block-0">
                {config?.widgets.map((w) => {
                  const widgetKind = w.kind || (w as unknown as { type?: string }).type || "";
                  const title =
                    getWidgetModule(widgetKind)?.manifest.name ??
                    (widgetKind ? widgetKind : "Widget");
                  const isSelected = selectedWidgetId === w.id;
                  const wColor =
                    typeof w.settings?.widgetColor === "string" &&
                    w.settings.widgetColor.trim() !== ""
                      ? w.settings.widgetColor.trim()
                      : undefined;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWidgetId(w.id)}
                      className={`
                        group flex cursor-pointer items-center justify-between
                        rounded-lg border px-3 py-2 text-start text-xs
                        transition-all
                        ${
                          isSelected
                            ? `
                            font-semibold text-fg shadow-xs
                            ${!wColor ? `border-accent-500/60 bg-accent-500/15` : ""}
                          `
                            : `
                            border-transparent bg-surface-raised text-fg
                            hover:border-line hover:bg-surface
                          `
                        }
                      `}
                      style={
                        isSelected && wColor
                          ? {
                              borderColor: `color-mix(in srgb, ${wColor} 60%, transparent)`,
                              backgroundColor: `color-mix(in srgb, ${wColor} 16%, var(--surface))`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2 truncate min-inline-0">
                        <span
                          className={`
                            shrink-0 rounded-full transition-colors block-2
                            inline-2
                            ${
                              isSelected && !wColor
                                ? "bg-accent-500"
                                : !isSelected && !wColor
                                  ? "bg-fg-muted/40"
                                  : ""
                            }
                          `}
                          style={
                            wColor
                              ? {
                                  backgroundColor: wColor,
                                  opacity: isSelected ? 1 : 0.65,
                                  boxShadow: isSelected ? `0 0 6px ${wColor}` : undefined,
                                }
                              : undefined
                          }
                        />
                        <span className="truncate font-medium text-fg">{title}</span>
                      </div>
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
              <div className="mbs-auto flex shrink-0 flex-col gap-1.5 border-bs border-line/60 pbs-3 pbe-2">
                <span className="text-[11px] font-medium text-fg-muted">Add new widget:</span>
                <div className="flex items-center gap-1.5">
                  <CustomSelect<string>
                    value={widgetToAdd}
                    onChange={(val) => setWidgetToAdd(val)}
                    options={Object.entries(WIDGET_REGISTRY).map(([kind, mod]) => ({
                      value: kind,
                      label: mod.manifest.name,
                      description: mod.manifest.description,
                    }))}
                    placeholder="Choose widget..."
                    searchPlaceholder="Search widgets..."
                    searchable={true}
                    direction="up"
                    className="flex-1 block-8 min-inline-0"
                    buttonClassName="h-8"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (widgetToAdd) {
                        void handleAddWidget(widgetToAdd);
                      }
                    }}
                    className="
                      flex shrink-0 cursor-pointer items-center justify-center
                      gap-1 rounded-lg bg-accent-500 px-2.5 text-xs
                      font-semibold whitespace-nowrap text-white shadow-xs
                      transition-colors block-8
                      hover:bg-accent-600
                      active:scale-95
                      disabled:cursor-not-allowed disabled:opacity-50
                    "
                  >
                    <Plus className="block-3.5 inline-3.5" weight="bold" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Widget Inspector */}
            <div className="my-3 flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-2 min-block-0">
              {selectedWidget ? (
                <div className="flex flex-col gap-5 pbe-4 inline-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-fg">
                        {selectedModule?.manifest.name ?? (selectedKind ? selectedKind : "Widget")}
                      </h2>
                    </div>
                  </div>

                  {/* Always on top */}
                  <div className="flex items-center justify-between border-bs border-line/60 pbs-3">
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
                  <div className="flex flex-col gap-2 border-bs border-line/60 pbs-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-fg">Window Opacity</span>
                      <span
                        className={`
                          font-mono font-medium
                          ${!selectedWidgetColor ? `text-accent-500` : ""}
                        `}
                        style={selectedWidgetColor ? { color: selectedWidgetColor } : undefined}
                      >
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
                      className={`
                        cursor-pointer
                        ${!selectedWidgetColor ? `accent-accent-500` : ""}
                      `}
                      style={selectedWidgetColor ? { accentColor: selectedWidgetColor } : undefined}
                    />
                  </div>

                  {/* Widget Accent Color */}
                  <div className="flex flex-col gap-2 border-bs border-line/60 pbs-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-fg">Widget Accent Color</span>
                      <span className="text-[11px] text-fg-muted">
                        Customize badge, highlight, and focus tint
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 pbs-1">
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
                            className={`
                              group relative flex cursor-pointer items-center
                              justify-center rounded-full transition-transform
                              block-6 inline-6
                              hover:scale-110
                              active:scale-95
                              ${
                                isSelected
                                  ? `scale-105 ring-2 ring-accent-500 ring-offset-2 ring-offset-surface`
                                  : "hover:ring-1 hover:ring-line"
                              }
                            `}
                            style={{ backgroundColor: c.hex }}
                          >
                            {isSelected && (
                              <Check
                                className="pointer-events-none text-white drop-shadow-sm block-3.5 inline-3.5"
                                weight="bold"
                              />
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
                            className={`
                              group relative flex cursor-pointer items-center
                              justify-center rounded-full transition-transform
                              block-6 inline-6
                              hover:scale-110
                              active:scale-95
                              ${
                                isCustomSelected
                                  ? `scale-105 ring-2 ring-accent-500 ring-offset-2 ring-offset-surface`
                                  : `
                                  border border-line/80
                                  hover:border-fg-muted
                                `
                              }
                            `}
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
                              className="absolute inset-0 cursor-pointer opacity-0 block-full inline-full"
                            />
                            {isCustomSelected ? (
                              <Check
                                className="pointer-events-none text-white drop-shadow-sm block-3.5 inline-3.5"
                                weight="bold"
                              />
                            ) : (
                              <Plus
                                className="pointer-events-none text-white drop-shadow-sm block-3 inline-3"
                                weight="bold"
                              />
                            )}
                          </label>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Widget Settings Schema Form */}
                  {selectedModule?.manifest.settingsSchema && (
                    <div className="border-bs border-line/60 pbs-3">
                      <span className="mbe-2 block font-medium text-fg">Configuration</span>
                      <SettingsForm
                        fields={selectedModule.manifest.settingsSchema}
                        values={selectedWidget.settings}
                        onChange={(k, v) => handleWidgetSettingChange(selectedWidget.id, k, v)}
                      />
                    </div>
                  )}

                  {/* Remove Widget */}
                  <div className="border-bs border-line/60 pbs-4 pbe-6">
                    <button
                      type="button"
                      onClick={() => void removeWidget(selectedWidget.id)}
                      className="
                        inline-flex cursor-pointer items-center gap-1.5
                        rounded-lg border border-error/40 bg-error/10 px-3
                        py-1.5 text-xs font-medium text-error transition-colors
                        hover:bg-error/20
                      "
                    >
                      <Trash className="block-3.5 inline-3.5" />
                      <span>Remove Widget</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center text-xs text-fg-muted italic block-full">
                  Select a widget to view and edit its settings.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACCOUNTS TAB */}
        {activeTab === "accounts" && (
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-6 py-0">
            <div className="my-3 flex flex-col gap-5 pbe-4 inline-full">
              <div className="flex items-center gap-2.5 rounded-2xl border border-line/60 bg-surface-raised/40 p-4 text-[11px] text-fg-muted backdrop-blur-xs">
                <LockKey className="shrink-0 text-accent-500 block-4 inline-4" />
                <span>
                  Tokens are stored securely in Windows Credential Manager and never logged or
                  exported.
                </span>
              </div>

              {/* GitHub Token */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GithubLogo className="text-fg block-4 inline-4" weight="fill" />
                    <label htmlFor="gh-token-input" className="font-semibold text-fg">
                      GitHub Personal Access Token
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`
                        rounded-full block-2 inline-2
                        ${githubConfigured ? "bg-ok" : "bg-fg-muted/30"}
                      `}
                    />
                    <span className={githubConfigured ? "text-ok" : `text-fg-muted/60`}>
                      {githubConfigured ? "Active" : "Not set"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-fg-muted">
                  Required for private repository commits and CI workflow runs. Public repos do not
                  strictly require a token.
                </p>
                <div className="flex gap-2 pbs-1">
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
                    className="
                      flex-1 rounded-lg border border-line bg-surface px-3
                      py-1.5 text-xs text-fg transition-colors outline-none
                      placeholder:text-fg-muted/40
                      focus:border-accent-500 focus:ring-2
                      focus:ring-accent-500/20
                    "
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveGithubToken()}
                    className="
                      cursor-pointer rounded-lg bg-accent-500 px-3.5 py-1.5
                      font-medium text-white shadow-xs transition-colors
                      hover:bg-accent-600
                      disabled:cursor-not-allowed disabled:opacity-50
                    "
                  >
                    Save
                  </button>
                  {githubConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleClearGithubToken()}
                      className="
                        cursor-pointer rounded-lg border border-line bg-surface
                        px-3 py-1.5 font-medium text-fg-muted transition-colors
                        hover:bg-surface-raised hover:text-error
                      "
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
                    <Triangle className="text-fg block-3.5 inline-3.5" weight="fill" />
                    <label htmlFor="vercel-token-input" className="font-semibold text-fg">
                      Vercel API Token
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`
                        rounded-full block-2 inline-2
                        ${vercelConfigured ? "bg-ok" : "bg-fg-muted/30"}
                      `}
                    />
                    <span className={vercelConfigured ? "text-ok" : `text-fg-muted/60`}>
                      {vercelConfigured ? "Active" : "Not set"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-fg-muted">
                  Used to query deployment pipeline states and build status.
                </p>
                <div className="flex gap-2 pbs-1">
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
                    className="
                      flex-1 rounded-lg border border-line bg-surface px-3
                      py-1.5 text-xs text-fg transition-colors outline-none
                      placeholder:text-fg-muted/40
                      focus:border-accent-500 focus:ring-2
                      focus:ring-accent-500/20
                    "
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveVercelToken()}
                    className="
                      cursor-pointer rounded-lg bg-accent-500 px-3.5 py-1.5
                      font-medium text-white shadow-xs transition-colors
                      hover:bg-accent-600
                      disabled:cursor-not-allowed disabled:opacity-50
                    "
                  >
                    Save
                  </button>
                  {vercelConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleClearVercelToken()}
                      className="
                        cursor-pointer rounded-lg border border-line bg-surface
                        px-3 py-1.5 font-medium text-fg-muted transition-colors
                        hover:bg-surface-raised hover:text-error
                      "
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* AI Header & Active Status Banner */}
              <div className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center rounded-lg bg-accent-500/15 text-accent-500 block-7 inline-7">
                      <Sparkle className="block-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-fg">AI Models & API Keys</h3>
                      <p className="text-[11px] text-fg-muted">
                        Powers all 10 desktop AI widgets. Nook auto-detects and connects to
                        whichever provider is configured.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-fg-muted">Provider Priority:</span>
                    <CustomSelect<string>
                      value={config?.app?.defaultAiProvider || "auto"}
                      onChange={(val) => handlePreferredAiProviderChange(val)}
                      options={[
                        { value: "auto", label: "Auto-detect (Recommended)" },
                        { value: "openai", label: "OpenAI" },
                        { value: "openrouter", label: "OpenRouter" },
                        { value: "gemini", label: "Google Gemini" },
                        { value: "anthropic", label: "Anthropic Claude" },
                        { value: "bedrock", label: "AWS Bedrock" },
                        { value: "groq", label: "Groq" },
                      ]}
                      className="inline-52"
                      buttonClassName="py-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 border-bs border-line/40 pbs-2 text-[11px]">
                  <span className="text-fg-muted">Active Endpoint:</span>
                  {activeAiProvider ? (
                    <span className="flex items-center gap-1.5 font-semibold text-ok">
                      <span className="rounded-full bg-ok block-2 inline-2" />
                      {AI_PROVIDER_LIST.find((p) => p.id === activeAiProvider)?.name ||
                        activeAiProvider}
                      {preferredAi === "auto" ? " (Auto-picked)" : " (Pinned)"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="rounded-full bg-amber-400 block-2 inline-2" />
                      None configured yet – add any API key below to activate
                    </span>
                  )}
                </div>
              </div>

              {/* Individual Provider Cards */}
              <div className="grid grid-cols-1 gap-4">
                {AI_PROVIDER_LIST.map((provider) => {
                  const isConfigured = Boolean(
                    aiTokensConfigured[provider.id] ||
                    (provider.id === "openai" && aiTokensConfigured.ai),
                  );
                  const isCurrentActive = activeAiProvider === provider.id;

                  return (
                    <div
                      key={provider.id}
                      className={`
                        flex flex-col gap-3 rounded-2xl border p-4.5
                        backdrop-blur-xs transition-all
                        ${
                          isCurrentActive
                            ? "border-accent-500/60 bg-accent-500/5 shadow-xs"
                            : "border-line/70 bg-surface-raised/40"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {provider.icon}
                          <label
                            htmlFor={`ai-input-${provider.id}`}
                            className="text-xs font-semibold text-fg"
                          >
                            {provider.name}
                          </label>
                          {isCurrentActive && (
                            <span className="rounded-sm bg-accent-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent-500 uppercase">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <span
                            className={`
                              rounded-full block-2 inline-2
                              ${isConfigured ? "bg-ok" : "bg-fg-muted/30"}
                            `}
                          />
                          <span className={isConfigured ? "text-ok" : `text-fg-muted/60`}>
                            {isConfigured ? "Configured" : "Not set"}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-fg-muted">{provider.desc}</p>

                      <div className="flex gap-2 pbs-0.5">
                        <input
                          id={`ai-input-${provider.id}`}
                          type="password"
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          value={aiInputs[provider.id] || ""}
                          onChange={(e) =>
                            setAiInputs((prev) => ({
                              ...prev,
                              [provider.id]: e.target.value,
                            }))
                          }
                          placeholder={provider.placeholder}
                          className="
                            flex-1 rounded-lg border border-line bg-surface px-3
                            py-1.5 text-xs text-fg transition-colors
                            outline-none
                            placeholder:text-fg-muted/40
                            focus:border-accent-500 focus:ring-2
                            focus:ring-accent-500/20
                          "
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveAiProviderToken(provider.id)}
                          className="
                            cursor-pointer rounded-lg bg-accent-500 px-3.5
                            py-1.5 text-xs font-medium text-white shadow-xs
                            transition-colors
                            hover:bg-accent-600
                            active:scale-95
                            disabled:cursor-not-allowed disabled:opacity-50
                          "
                        >
                          Save
                        </button>
                        {isConfigured && (
                          <button
                            type="button"
                            onClick={() => void handleClearAiProviderToken(provider.id)}
                            className="
                              cursor-pointer rounded-lg border border-line
                              bg-surface px-3 py-1.5 text-xs font-medium
                              text-fg-muted transition-colors
                              hover:bg-surface-raised hover:text-error
                            "
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Special custom endpoint for Bedrock */}
                      {provider.id === "bedrock" && (
                        <div className="flex flex-col gap-1.5 border-bs border-line/30 pbs-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <label
                              htmlFor="bedrock-endpoint-input"
                              className="font-medium text-fg-muted"
                            >
                              Custom Gateway / Endpoint (Optional)
                            </label>
                            <span className="font-mono text-[10px] text-fg-muted">
                              {bedrockEndpointConfigured
                                ? "Custom Endpoint Active"
                                : "Default AWS Runtime"}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              id="bedrock-endpoint-input"
                              type="text"
                              value={bedrockEndpointInput}
                              onChange={(e) => setBedrockEndpointInput(e.target.value)}
                              placeholder="https://your-bedrock-gateway.com/v1"
                              className="
                                flex-1 rounded-lg border border-line bg-surface
                                px-3 py-1.5 text-xs text-fg transition-colors
                                outline-none
                                placeholder:text-fg-muted/40
                                focus:border-accent-500 focus:ring-2
                                focus:ring-accent-500/20
                              "
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveBedrockEndpoint()}
                              className="
                                cursor-pointer rounded-lg border border-line
                                bg-surface-raised px-3 py-1.5 text-xs
                                font-medium text-fg transition-colors
                                hover:border-accent-500
                              "
                            >
                              Save Endpoint
                            </button>
                            {bedrockEndpointConfigured && (
                              <button
                                type="button"
                                onClick={() => void handleClearBedrockEndpoint()}
                                className="
                                  cursor-pointer rounded-lg border border-line
                                  bg-surface px-3 py-1.5 text-xs font-medium
                                  text-fg-muted transition-colors
                                  hover:text-error
                                "
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ABOUT TAB */}
        {activeTab === "about" && (
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-6 py-0">
            <div className="my-3 flex flex-col gap-5 pbe-4 inline-full">
              {/* Hero Section */}
              <div className="flex items-center gap-5 px-1 py-2">
                <img
                  src="/icon.png"
                  alt="Nook"
                  width={80}
                  height={80}
                  className="shrink-0 rounded-2xl object-cover block-20"
                />
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-xl font-bold tracking-tight text-fg">Nook</h2>
                  <p className="text-xs/relaxed text-fg-muted">
                    Lightweight, distraction-free desktop widgets
                    <br />
                    pinned directly to your Windows desktop.
                  </p>
                </div>
              </div>

              {/* Developer & Project Info */}
              <div
                className="
                grid grid-cols-1 gap-4
                md:grid-cols-2
              "
              >
                <div className="flex flex-col gap-2 rounded-2xl border border-line/70 bg-surface-raised/40 p-5 backdrop-blur-xs">
                  <span className="font-semibold text-fg">Developer</span>
                  <p className="text-[11px] leading-relaxed text-fg-muted">
                    Crafted with care by <span className="font-medium text-fg">Hasan</span> (
                    <button
                      type="button"
                      onClick={() => void openUrl("https://github.com/hasanify")}
                      className="
                        cursor-pointer text-accent-500 underline
                        underline-offset-2
                        hover:text-accent-600
                      "
                    >
                      @hasanify
                    </button>
                    ).
                  </p>
                  <div className="pbs-2">
                    <button
                      type="button"
                      onClick={() => void openUrl("https://github.com/hasanify/nook")}
                      className="
                        inline-flex cursor-pointer items-center gap-1.5 text-xs
                        font-medium text-accent-500
                        hover:text-accent-600
                      "
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
                      className="
                        cursor-pointer text-start text-fg-muted
                        transition-colors inline-fit
                        hover:text-accent-500
                      "
                    >
                      • Report a Bug or Request Feature
                    </button>
                    <button
                      type="button"
                      onClick={() => void openUrl("https://github.com/hasanify/nook/releases")}
                      className="
                        cursor-pointer text-start text-fg-muted
                        transition-colors inline-fit
                        hover:text-accent-500
                      "
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
                    className="
                      inline-flex cursor-pointer items-center gap-1.5 rounded-lg
                      border border-line bg-surface px-3.5 py-1.5 font-medium
                      text-fg shadow-xs transition-colors
                      hover:border-accent-500 hover:text-accent-500
                      disabled:cursor-not-allowed disabled:opacity-50
                    "
                  >
                    <ArrowClockwise
                      className={`
                        block-3.5 inline-3.5
                        ${checkingUpdate ? "animate-spin" : ""}
                      `}
                    />
                    <span>{checkingUpdate ? "Checking..." : "Check for Updates"}</span>
                  </button>
                </div>

                {/* Auto Update Setting */}
                <div className="flex items-center justify-between border-bs border-line/40 pbs-3">
                  <div>
                    <div className="font-medium text-fg">Automatic Updates</div>
                    <div className="text-[11px] text-fg-muted">
                      Automatically download and install new releases in the background
                    </div>
                  </div>
                  <Toggle
                    checked={autoUpdateEnabled}
                    onChange={() => void handleToggleAutoUpdate()}
                    ariaLabel="Toggle automatic updates"
                  />
                </div>

                {/* Status messages */}
                {updateError && (
                  <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-[11px] text-error">
                    {updateError}
                  </div>
                )}

                {updateResult && !updateResult.has_update && !updateError && (
                  <div className="flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 p-3 text-[11px] text-ok">
                    <Check className="shrink-0 text-ok block-3.5 inline-3.5" weight="bold" />
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
                          className="
                            cursor-pointer text-[11px] text-accent-500 underline
                            underline-offset-2
                            hover:text-accent-600
                          "
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
                        <div className="overflow-hidden rounded-full bg-surface block-1.5 inline-full">
                          <div
                            className="bg-accent-500 transition-all duration-150 block-full"
                            style={{ width: `${downloadPercent}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-fg-muted">
                          Nook will restart once installation begins.
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pbs-1">
                        {updateResult.download_url ? (
                          <button
                            type="button"
                            onClick={() => void handleInstallUpdate()}
                            className="
                              cursor-pointer rounded-lg bg-accent-500 px-3.5
                              py-1.5 font-medium text-white shadow-xs
                              transition-colors
                              hover:bg-accent-600
                              disabled:cursor-not-allowed disabled:opacity-50
                            "
                          >
                            Download & Install Update
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void openUrl(updateResult.release_url)}
                            className="
                              cursor-pointer rounded-lg bg-accent-500 px-3.5
                              py-1.5 font-medium text-white shadow-xs
                              transition-colors
                              hover:bg-accent-600
                              disabled:cursor-not-allowed disabled:opacity-50
                            "
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
