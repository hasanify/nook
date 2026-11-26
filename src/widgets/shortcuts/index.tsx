import {
  AppWindowIcon,
  BookmarkSimpleIcon,
  CalculatorIcon,
  CircleNotchIcon,
  CodeIcon,
  DiscordLogoIcon,
  FigmaLogoIcon,
  FileIcon,
  FolderIcon,
  GithubLogoIcon,
  GlobeIcon,
  GoogleLogoIcon,
  MagnifyingGlassIcon,
  OpenAiLogoIcon,
  PlusIcon,
  RedditLogoIcon,
  RocketLaunchIcon,
  SlackLogoIcon,
  SparkleIcon,
  SpotifyLogoIcon,
  StarIcon,
  TerminalWindowIcon,
  TrashIcon,
  TwitterLogoIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { type FormEvent, useMemo, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import { getInstalledApps, type InstalledAppItem, pickFilePath, pickFolderPath } from "@/core/ipc";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

export interface ShortcutItem {
  id: string;
  label: string;
  target: string;
  icon?: string;
}

export interface PresetApp {
  id: string;
  label: string;
  target: string;
  icon: string;
  category: string;
  description: string;
}

export const PRESET_APPS: PresetApp[] = [
  // Web & Productivity
  {
    id: "github",
    label: "GitHub",
    target: "https://github.com",
    icon: "github",
    category: "Web Bookmarks",
    description: "Code Repositories",
  },
  {
    id: "google",
    label: "Google",
    target: "https://google.com",
    icon: "google",
    category: "Web Bookmarks",
    description: "Search Engine",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    target: "https://chatgpt.com",
    icon: "chatgpt",
    category: "Web Bookmarks",
    description: "OpenAI Assistant",
  },
  {
    id: "notion",
    label: "Notion",
    target: "https://notion.so",
    icon: "globe",
    category: "Web Bookmarks",
    description: "Notes & Docs",
  },
  {
    id: "figma",
    label: "Figma",
    target: "https://figma.com",
    icon: "figma",
    category: "Web Bookmarks",
    description: "Collaborative Design",
  },
  {
    id: "vercel",
    label: "Vercel",
    target: "https://vercel.com",
    icon: "rocket",
    category: "Web Bookmarks",
    description: "Deployment Dashboard",
  },
  {
    id: "localhost3000",
    label: "Localhost :3000",
    target: "http://localhost:3000",
    icon: "rocket",
    category: "Development",
    description: "Local Dev Server",
  },
  {
    id: "localhost5173",
    label: "Localhost :5173",
    target: "http://localhost:5173",
    icon: "rocket",
    category: "Development",
    description: "Vite Dev Server",
  },

  // Media & Social
  {
    id: "youtube",
    label: "YouTube",
    target: "https://youtube.com",
    icon: "youtube",
    category: "Media & Social",
    description: "Videos & Music",
  },
  {
    id: "discord",
    label: "Discord",
    target: "https://discord.com/app",
    icon: "discord",
    category: "Media & Social",
    description: "Voice & Text Chat",
  },
  {
    id: "spotify",
    label: "Spotify",
    target: "https://open.spotify.com",
    icon: "spotify",
    category: "Media & Social",
    description: "Music & Podcasts",
  },
  {
    id: "twitter",
    label: "X / Twitter",
    target: "https://x.com",
    icon: "twitter",
    category: "Media & Social",
    description: "Social Feed",
  },
  {
    id: "reddit",
    label: "Reddit",
    target: "https://reddit.com",
    icon: "reddit",
    category: "Media & Social",
    description: "Internet Communities",
  },
  {
    id: "slack",
    label: "Slack",
    target: "https://slack.com",
    icon: "slack",
    category: "Media & Social",
    description: "Team Messaging",
  },
];

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: "1", label: "Google", target: "https://google.com", icon: "google" },
  { id: "2", label: "Terminal", target: "wt.exe", icon: "terminal" },
  { id: "3", label: "Localhost", target: "http://localhost:3000", icon: "rocket" },
  { id: "4", label: "ChatGPT", target: "https://chatgpt.com", icon: "chatgpt" },
];

/**
 * Extracts a favicon URL from a web address if valid HTTP/HTTPS URL or domain.
 */
export function getFaviconUrl(target: string, size = 64): string | null {
  try {
    let clean = target.trim();
    if (!clean) return null;
    if (!/^https?:\/\//i.test(clean)) {
      if (clean.includes(".") || clean.startsWith("localhost")) {
        clean = "https://" + clean;
      } else {
        return null;
      }
    }
    const url = new URL(clean);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=${size}`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Clean human-readable target display (e.g. "github.com" instead of "https://github.com/foo/bar").
 */
export function formatShortcutSubtitle(target: string): string {
  try {
    let clean = target.trim();
    if (!/^https?:\/\//i.test(clean) && (clean.includes(".") || clean.startsWith("localhost"))) {
      clean = "https://" + clean;
    }
    const url = new URL(clean);
    const host = url.hostname.replace(/^www\./, "");
    const port = url.port ? `:${url.port}` : "";
    return `${host}${port}`;
  } catch {
    // If local file path, show only file name or clean path
    if (target.includes("\\") || target.includes("/")) {
      const parts = target.split(/[\\/]/);
      return parts[parts.length - 1] || target;
    }
    return target;
  }
}

/**
 * Auto-detects recommended label and icon from target string.
 */
function autoDetectTargetMetadata(target: string): { label?: string; icon?: string } {
  const norm = target.toLowerCase().trim();
  if (!norm) return {};

  if (norm.includes("github.com")) return { label: "GitHub", icon: "github" };
  if (norm.includes("google.com")) return { label: "Google", icon: "google" };
  if (norm.includes("youtube.com")) return { label: "YouTube", icon: "youtube" };
  if (norm.includes("discord")) return { label: "Discord", icon: "discord" };
  if (norm.includes("spotify")) return { label: "Spotify", icon: "spotify" };
  if (norm.includes("x.com") || norm.includes("twitter.com"))
    return { label: "X / Twitter", icon: "twitter" };
  if (norm.includes("reddit.com")) return { label: "Reddit", icon: "reddit" };
  if (norm.includes("figma.com")) return { label: "Figma", icon: "figma" };
  if (norm.includes("slack.com")) return { label: "Slack", icon: "slack" };
  if (norm.includes("notion.so")) return { label: "Notion", icon: "globe" };
  if (norm.includes("chatgpt.com") || norm.includes("openai.com"))
    return { label: "ChatGPT", icon: "chatgpt" };
  if (norm.includes("localhost") || norm.includes("127.0.0.1"))
    return { label: "Localhost", icon: "rocket" };

  if (norm.includes("wt.exe") || norm === "wt")
    return { label: "Windows Terminal", icon: "terminal" };
  if (norm.includes("powershell.exe") || norm === "powershell")
    return { label: "PowerShell", icon: "terminal" };
  if (norm.includes("cmd.exe") || norm === "cmd")
    return { label: "Command Prompt", icon: "terminal" };
  if (norm.includes("code.exe") || norm === "code") return { label: "VS Code", icon: "code" };
  if (norm.includes("explorer.exe") || norm === "explorer")
    return { label: "File Explorer", icon: "folder" };
  if (norm.includes("calc.exe") || norm === "calc")
    return { label: "Calculator", icon: "calculator" };
  if (norm.includes("notepad.exe") || norm === "notepad") return { label: "Notepad", icon: "code" };

  return {};
}

interface ShortcutIconViewProps {
  icon?: string | undefined;
  target: string;
  label: string;
  className?: string | undefined;
}

function ShortcutIconView({
  icon,
  target,
  label,
  className = "block-5 inline-5",
}: ShortcutIconViewProps) {
  const [imgError, setImgError] = useState(false);
  const faviconUrl = useMemo(() => getFaviconUrl(target), [target]);

  // Determine effective icon key
  const effectiveIconKey = useMemo(() => {
    if (icon && icon !== "globe" && icon !== "code" && icon !== "app") return icon;
    const detected = autoDetectTargetMetadata(target);
    if (detected.icon) return detected.icon;
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("github")) return "github";
    if (lowerLabel.includes("google")) return "google";
    if (lowerLabel.includes("terminal")) return "terminal";
    if (lowerLabel.includes("localhost")) return "rocket";
    if (lowerLabel.includes("discord")) return "discord";
    if (lowerLabel.includes("spotify")) return "spotify";
    if (lowerLabel.includes("youtube")) return "youtube";
    return icon || "globe";
  }, [icon, target, label]);

  // If web target and favicon hasn't failed, render real favicon from web address
  if (faviconUrl && !imgError) {
    return (
      <img
        src={faviconUrl}
        alt={label}
        className={`${className} rounded-xs object-contain select-none`}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  switch (effectiveIconKey) {
    case "github":
      return <GithubLogoIcon className={className} weight="bold" />;
    case "google":
      return <GoogleLogoIcon className={className} weight="bold" />;
    case "youtube":
      return <YoutubeLogoIcon className={className} weight="fill" />;
    case "discord":
      return <DiscordLogoIcon className={className} weight="fill" />;
    case "spotify":
      return <SpotifyLogoIcon className={className} weight="fill" />;
    case "twitter":
      return <TwitterLogoIcon className={className} weight="fill" />;
    case "reddit":
      return <RedditLogoIcon className={className} weight="fill" />;
    case "slack":
      return <SlackLogoIcon className={className} weight="bold" />;
    case "figma":
      return <FigmaLogoIcon className={className} weight="bold" />;
    case "chatgpt":
      return <OpenAiLogoIcon className={className} weight="bold" />;
    case "terminal":
      return <TerminalWindowIcon className={className} weight="bold" />;
    case "code":
      return <CodeIcon className={className} weight="bold" />;
    case "folder":
      return <FolderIcon className={className} weight="fill" />;
    case "rocket":
      return <RocketLaunchIcon className={className} weight="fill" />;
    case "calculator":
      return <CalculatorIcon className={className} weight="bold" />;
    case "app":
      return <AppWindowIcon className={className} weight="bold" />;
    case "star":
      return <StarIcon className={className} weight="fill" />;
    case "bookmark":
      return <BookmarkSimpleIcon className={className} weight="fill" />;
    case "globe":
    default:
      return <GlobeIcon className={className} />;
  }
}

export function ShortcutsWidget({ instance, editMode, patchState }: WidgetProps) {
  const rawShortcuts = instance.state.items;
  const shortcuts: ShortcutItem[] = useMemo(() => {
    if (Array.isArray(rawShortcuts)) {
      return rawShortcuts as ShortcutItem[];
    }
    return DEFAULT_SHORTCUTS;
  }, [rawShortcuts]);

  const [isAdding, setIsAdding] = useState(false);
  const [activeAddTab, setActiveAddTab] = useState<"preset" | "custom">("preset");
  const [presetSearch, setPresetSearch] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newIcon, setNewIcon] = useState("globe");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Installed apps from OS
  const [installedApps, setInstalledApps] = useState<InstalledAppItem[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const openLauncher = () => {
    setIsAdding((prev) => {
      const next = !prev;
      if (next && installedApps.length === 0) {
        setIsLoadingApps(true);
        getInstalledApps()
          .then((apps) => {
            setInstalledApps(apps);
          })
          .catch(() => {})
          .finally(() => {
            setIsLoadingApps(false);
          });
      }
      return next;
    });
  };

  const columns = (instance.settings.columns as string) || "2";
  const layout = (instance.settings.layout as string) || "grid";
  const showLabels = instance.settings.showLabels !== false;
  const showSubtitles = instance.settings.showSubtitles !== false;

  const gridColsClass = useMemo(() => {
    switch (columns) {
      case "3":
        return "grid-cols-3";
      case "4":
        return "grid-cols-4";
      case "2":
      default:
        return "grid-cols-2";
    }
  }, [columns]);

  // Combine actual installed applications with popular curated web presets
  const allPickOptions: PresetApp[] = useMemo(() => {
    const installed: PresetApp[] = installedApps.map((app) => ({
      id: app.id,
      label: app.name,
      target: app.path,
      icon: app.icon || "app",
      category: app.category || "Installed Software",
      description: app.description || "Installed Application",
    }));

    return [...installed, ...PRESET_APPS];
  }, [installedApps]);

  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const opt of allPickOptions) {
      counts.set(opt.category, (counts.get(opt.category) || 0) + 1);
    }
    const cats = ["All", ...Array.from(counts.keys())];
    return cats.map((cat) => ({
      name: cat,
      count: cat === "All" ? allPickOptions.length : counts.get(cat) || 0,
    }));
  }, [allPickOptions]);

  const filteredPickOptions = useMemo(() => {
    let list = allPickOptions;
    if (selectedCategory !== "All") {
      list = list.filter((p) => p.category === selectedCategory);
    }
    const q = presetSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          p.target.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allPickOptions, selectedCategory, presetSearch]);

  const handleLaunch = async (target: string) => {
    setErrorBanner(null);
    try {
      const trimmed = target.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        await openUrl(trimmed);
      } else {
        try {
          await openPath(trimmed);
        } catch {
          await openUrl(trimmed);
        }
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to open shortcut target");
    }
  };

  const handleSelectPreset = (preset: PresetApp) => {
    const newItem: ShortcutItem = {
      id: Date.now().toString(),
      label: preset.label,
      target: preset.target,
      icon: preset.icon,
    };
    patchState({ items: [...shortcuts, newItem] });
    setIsAdding(false);
    setPresetSearch("");
  };

  const handleTargetChange = (val: string) => {
    setNewTarget(val);
    const detected = autoDetectTargetMetadata(val);
    if (detected.label && !newLabel.trim()) {
      setNewLabel(detected.label);
    }
    if (detected.icon) {
      setNewIcon(detected.icon);
    }
  };

  const handlePickFile = async () => {
    try {
      const res = await pickFilePath();
      if (res) {
        setNewTarget(res.path);
        if (!newLabel.trim()) {
          setNewLabel(res.name);
        }
        const lower = res.path.toLowerCase();
        if (lower.endsWith(".exe") || lower.endsWith(".lnk")) {
          setNewIcon("app");
        } else if (lower.endsWith(".html") || lower.endsWith(".url")) {
          setNewIcon("globe");
        } else if (lower.endsWith(".bat") || lower.endsWith(".cmd") || lower.endsWith(".ps1")) {
          setNewIcon("terminal");
        } else {
          setNewIcon("folder");
        }
      }
    } catch {
      setErrorBanner("Could not open file picker dialog");
    }
  };

  const handlePickFolder = async () => {
    try {
      const res = await pickFolderPath();
      if (res) {
        setNewTarget(res.path);
        if (!newLabel.trim()) {
          setNewLabel(res.name);
        }
        setNewIcon("folder");
      }
    } catch {
      setErrorBanner("Could not open folder picker dialog");
    }
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newTarget.trim()) return;

    const newItem: ShortcutItem = {
      id: Date.now().toString(),
      label: newLabel.trim(),
      target: newTarget.trim(),
      icon: newIcon,
    };

    patchState({ items: [...shortcuts, newItem] });
    setNewLabel("");
    setNewTarget("");
    setNewIcon("globe");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const next = shortcuts.filter((s) => s.id !== id);
    patchState({ items: next });
  };

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      headerActions={
        <button
          type="button"
          onClick={openLauncher}
          className={`
            flex cursor-pointer items-center justify-center rounded-md
            transition-all block-5 inline-5
            ${
              isAdding
                ? "bg-accent-500 text-white"
                : "text-fg-muted hover:bg-surface-raised hover:text-fg"
            }
          `}
          title={isAdding ? "Close launcher" : "Add shortcut"}
          aria-label={isAdding ? "Close launcher" : "Add shortcut"}
        >
          <PlusIcon
            className={`transition-transform block-3.5 inline-3.5 ${isAdding ? "rotate-45" : ""}`}
            weight="bold"
          />
        </button>
      }
    >
      <div className="flex flex-col gap-2 p-1 text-xs block-full inline-full min-block-0">
        {errorBanner && (
          <Banner
            message={errorBanner}
            type="warn"
            actionText="Dismiss"
            onAction={() => setErrorBanner(null)}
          />
        )}

        {/* Quick App Launcher / Add Modal Drawer */}
        {isAdding && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent-500/30 bg-surface-raised/95 p-3 shadow-md backdrop-blur-md">
            {/* Tabs for Presets vs Custom */}
            <div className="flex items-center justify-between border-be border-line/60 pbe-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveAddTab("preset")}
                  className={`
                    cursor-pointer rounded-md px-2.5 py-1 text-2xs font-medium transition-colors
                    ${
                      activeAddTab === "preset"
                        ? "bg-accent-500 text-white shadow-2xs"
                        : "text-fg-muted hover:bg-surface hover:text-fg"
                    }
                  `}
                >
                  <span className="flex items-center gap-1.5">
                    <SparkleIcon className="block-3 inline-3" weight="fill" />
                    Quick Pick Apps
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAddTab("custom")}
                  className={`
                    cursor-pointer rounded-md px-2.5 py-1 text-2xs font-medium transition-colors
                    ${
                      activeAddTab === "custom"
                        ? "bg-accent-500 text-white shadow-2xs"
                        : "text-fg-muted hover:bg-surface hover:text-fg"
                    }
                  `}
                >
                  Custom URL / App
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="cursor-pointer text-3xs font-medium text-fg-muted hover:text-fg"
              >
                Cancel
              </button>
            </div>

            {/* TAB 1: Searchable Curated & Installed Software Picker */}
            {activeAddTab === "preset" && (
              <div className="flex flex-col gap-2">
                {/* Search Bar */}
                <div className="relative flex items-center">
                  <MagnifyingGlassIcon className="absolute inset-s-2 text-fg-muted block-3.5 inline-3.5" />
                  <input
                    type="text"
                    placeholder="Search installed software, apps, web bookmarks..."
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    className="
                      rounded-lg border border-line bg-surface/90 py-1 ps-7 pe-2.5 text-2xs text-fg
                      outline-none inline-full placeholder:text-fg-muted/60
                      focus:border-accent-500
                    "
                    autoFocus
                  />
                  {isLoadingApps && (
                    <CircleNotchIcon className="absolute inset-e-2.5 animate-spin text-accent-500 block-3 inline-3" />
                  )}
                </div>

                {/* Category Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto pbs-0.5 pbe-1">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`
                        shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-3xs font-medium transition-all
                        ${
                          selectedCategory === cat.name
                            ? "bg-accent-500 text-white shadow-2xs"
                            : "border border-line/60 bg-surface/60 text-fg-muted hover:border-line hover:text-fg"
                        }
                      `}
                    >
                      {cat.name} ({cat.count})
                    </button>
                  ))}
                </div>

                {/* Apps Grid */}
                <div className="grid grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain pbs-0.5 max-block-52">
                  {filteredPickOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectPreset(item)}
                      className="
                        group flex cursor-pointer items-center gap-2 rounded-lg border
                        border-line/60 bg-surface/80 p-1.5 text-start transition-all
                        hover:border-accent-500/60 hover:bg-surface hover:shadow-2xs
                      "
                      title={`Add ${item.label} (${item.target})`}
                    >
                      <div className="flex shrink-0 items-center justify-center rounded-md bg-surface-raised p-1 text-accent-500 transition-transform block-6 inline-6 group-hover:scale-105">
                        <ShortcutIconView
                          icon={item.icon}
                          target={item.target}
                          label={item.label}
                          className="block-3.5 inline-3.5"
                        />
                      </div>
                      <div className="flex flex-1 flex-col min-inline-0">
                        <span className="truncate text-2xs font-semibold text-fg">
                          {item.label}
                        </span>
                        <span className="truncate font-mono text-3xs text-fg-muted">
                          {item.description}
                        </span>
                      </div>
                      <PlusIcon className="shrink-0 text-fg-muted opacity-0 transition-opacity block-3 inline-3 group-hover:opacity-100" />
                    </button>
                  ))}

                  {filteredPickOptions.length === 0 && (
                    <div className="col-span-2 py-6 text-center text-3xs text-fg-muted">
                      No software or presets match your search.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Custom URL, Executable, or File Picker */}
            {activeAddTab === "custom" && (
              <form onSubmit={handleAddSubmit} className="flex flex-col gap-2.5">
                {/* File / Folder Picker Buttons */}
                <div className="flex items-center gap-1.5 border-be border-line/40 pbe-2">
                  <button
                    type="button"
                    onClick={handlePickFile}
                    className="
                      flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg
                      border border-line/80 bg-surface/80 px-2 py-1.5 text-2xs
                      font-medium text-fg transition-all
                      hover:border-accent-500/60 hover:bg-surface hover:text-accent-500
                    "
                    title="Browse local executable, script, or document file"
                  >
                    <FileIcon className="text-accent-500 block-3.5 inline-3.5" weight="bold" />
                    <span>Browse File / App...</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePickFolder}
                    className="
                      flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg
                      border border-line/80 bg-surface/80 px-2 py-1.5 text-2xs
                      font-medium text-fg transition-all
                      hover:border-accent-500/60 hover:bg-surface hover:text-accent-500
                    "
                    title="Browse local folder or directory"
                  >
                    <FolderIcon className="text-accent-500 block-3.5 inline-3.5" weight="bold" />
                    <span>Browse Folder...</span>
                  </button>
                </div>

                {/* Target Web Address or Command */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-3xs font-medium text-fg-muted">
                      Target Web Address, Executable, or File Path
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. https://github.com or C:\App\tool.exe"
                    value={newTarget}
                    onChange={(e) => handleTargetChange(e.target.value)}
                    className="
                      rounded-lg border border-line bg-surface/90 px-2 py-1 text-2xs text-fg
                      outline-none placeholder:text-fg-muted/60
                      focus:border-accent-500
                    "
                    autoFocus
                  />

                  {/* Quick Website & Port Fill Chips */}
                  <div className="flex flex-wrap items-center gap-1 pbs-1">
                    <span className="text-3xs text-fg-muted/60">Quick pick:</span>
                    {[
                      { label: "https://", val: "https://" },
                      { label: ":3000", val: "http://localhost:3000" },
                      { label: ":5173", val: "http://localhost:5173" },
                      { label: ":8080", val: "http://localhost:8080" },
                      { label: "GitHub", val: "https://github.com" },
                      { label: "ChatGPT", val: "https://chatgpt.com" },
                      { label: "YouTube", val: "https://youtube.com" },
                      { label: "Google", val: "https://google.com" },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => handleTargetChange(chip.val)}
                        className="
                          cursor-pointer rounded-md border border-line/60 bg-surface/50
                          px-1.5 py-0.5 text-3xs text-fg-muted transition-colors
                          hover:border-accent-500/50 hover:bg-surface hover:text-fg
                        "
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display Label */}
                <div className="flex flex-col gap-1">
                  <label className="text-3xs font-medium text-fg-muted">Display Label</label>
                  <input
                    type="text"
                    placeholder="e.g. My Project"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="
                      rounded-lg border border-line bg-surface/90 px-2 py-1 text-2xs text-fg
                      outline-none placeholder:text-fg-muted/60
                      focus:border-accent-500
                    "
                  />
                </div>

                {/* Live Preview & Icon Selection */}
                <div className="flex flex-col gap-2 border-bs border-line/50 pbs-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-3xs text-fg-muted">Icon:</span>
                      <div className="flex items-center gap-1">
                        {[
                          { key: "globe", label: "Globe" },
                          { key: "terminal", label: "Terminal" },
                          { key: "code", label: "Code" },
                          { key: "folder", label: "Folder" },
                          { key: "rocket", label: "Rocket" },
                          { key: "app", label: "App" },
                          { key: "star", label: "Star" },
                          { key: "github", label: "GitHub" },
                          { key: "google", label: "Google" },
                          { key: "youtube", label: "YouTube" },
                          { key: "discord", label: "Discord" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setNewIcon(item.key)}
                            className={`
                              flex cursor-pointer items-center justify-center rounded-md p-1 transition-colors block-5 inline-5
                              ${
                                newIcon === item.key
                                  ? "bg-accent-500 text-white"
                                  : "bg-surface text-fg-muted hover:bg-surface-raised hover:text-fg"
                              }
                            `}
                            title={item.label}
                          >
                            <ShortcutIconView
                              icon={item.key}
                              target={newTarget}
                              label={newLabel || item.label}
                              className="block-3 inline-3"
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!newLabel.trim() || !newTarget.trim()}
                      className="
                        cursor-pointer rounded-lg bg-accent-500 px-3 py-1 text-2xs
                        font-medium text-white shadow-2xs transition-all
                        hover:bg-accent-600 disabled:cursor-not-allowed
                        disabled:opacity-50
                      "
                    >
                      Add Shortcut
                    </button>
                  </div>

                  {/* Card Preview */}
                  {newTarget.trim() && (
                    <div className="flex items-center gap-2 rounded-lg border border-line/40 bg-surface/40 p-1.5">
                      <span className="text-3xs text-fg-muted">Preview:</span>
                      <div className="flex items-center gap-2 rounded-md bg-surface-raised px-2 py-1">
                        <ShortcutIconView
                          icon={newIcon}
                          target={newTarget}
                          label={newLabel || "Shortcut"}
                          className="block-3.5 inline-3.5"
                        />
                        <span className="text-2xs font-semibold text-fg">
                          {newLabel || "Shortcut"}
                        </span>
                        <span className="font-mono text-3xs text-fg-muted">
                          {formatShortcutSubtitle(newTarget)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* Shortcuts View: App Tiles (Grid) or Compact Rows (List) */}
        {layout === "list" ? (
          /* List Mode: Sleek Compact Cards with adequate top clearance */
          <div className="flex flex-col gap-2 overflow-y-auto px-1 pbs-2 pbe-2.5 block-full">
            {shortcuts.map((sc) => (
              <div
                key={sc.id}
                className="
                  group relative flex cursor-pointer items-center gap-2.5 rounded-xl
                  border border-line/60 bg-surface-raised/40 p-2 text-start
                  transition-all duration-150
                  hover:-translate-y-0.5 hover:border-accent-500/60 hover:bg-surface-raised hover:shadow-xs
                  active:scale-95
                "
                onClick={() => void handleLaunch(sc.target)}
                title={sc.target}
              >
                <div className="flex shrink-0 items-center justify-center rounded-lg bg-surface/90 p-1.5 text-accent-500 shadow-2xs ring-1 ring-line/40 transition-transform block-8 inline-8 group-hover:scale-105">
                  <ShortcutIconView
                    icon={sc.icon}
                    target={sc.target}
                    label={sc.label}
                    className="block-4.5 inline-4.5"
                  />
                </div>

                {showLabels && (
                  <div className="flex flex-1 flex-col min-inline-0">
                    <span className="truncate font-semibold tracking-tight text-fg">
                      {sc.label}
                    </span>
                    {showSubtitles && (
                      <span className="truncate font-mono text-3xs text-fg-muted/70">
                        {formatShortcutSubtitle(sc.target)}
                      </span>
                    )}
                  </div>
                )}

                {editMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(sc.id);
                    }}
                    className="
                      flex cursor-pointer items-center justify-center rounded-md
                      p-1 text-fg-muted opacity-0 transition-all block-5 inline-5
                      group-hover:opacity-100
                      hover:bg-error/20 hover:text-error
                    "
                    title="Delete shortcut"
                  >
                    <TrashIcon className="block-3.5 inline-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Grid Mode: Beautiful App Tiles with generous top breathing room so hover never clips */
          <div
            className={`grid ${gridColsClass} auto-rows-max content-start gap-2.5 overflow-y-auto px-1 pbs-2 pbe-2.5 block-full`}
          >
            {shortcuts.map((sc) => (
              <div
                key={sc.id}
                className="
                  group relative flex cursor-pointer flex-col items-center justify-center
                  rounded-xl border border-line/50 bg-surface-raised/40 p-2.5 text-center
                  transition-all duration-150
                  hover:-translate-y-0.5 hover:border-accent-500/60 hover:bg-surface-raised
                  hover:shadow-xs active:scale-95
                "
                onClick={() => void handleLaunch(sc.target)}
                title={sc.target}
              >
                {/* Modern App Icon Squircle */}
                <div
                  className="
                    flex shrink-0 items-center justify-center rounded-xl bg-surface/90
                    p-2 text-accent-500 shadow-2xs ring-1 ring-line/50
                    transition-all duration-200 block-10 inline-10
                    group-hover:scale-105 group-hover:shadow-xs group-hover:ring-accent-500/30
                  "
                >
                  <ShortcutIconView
                    icon={sc.icon}
                    target={sc.target}
                    label={sc.label}
                    className="block-5 inline-5"
                  />
                </div>

                {/* Label and Subtitle */}
                {showLabels && (
                  <div className="mbs-2 flex flex-col items-center inline-full min-inline-0">
                    <span className="truncate text-xs font-medium text-fg inline-full">
                      {sc.label}
                    </span>
                    {showSubtitles && (
                      <span className="truncate font-mono text-3xs text-fg-muted/70 inline-full">
                        {formatShortcutSubtitle(sc.target)}
                      </span>
                    )}
                  </div>
                )}

                {editMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(sc.id);
                    }}
                    className="
                      absolute inset-e-1 inset-bs-1 flex cursor-pointer items-center
                      justify-center rounded-md p-1 text-fg-muted opacity-0
                      transition-all block-4.5 inline-4.5
                      group-hover:opacity-100
                      hover:bg-error/20 hover:text-error
                    "
                    title="Delete shortcut"
                  >
                    <TrashIcon className="block-3 inline-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {shortcuts.length === 0 && !isAdding && (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-fg-muted">
            <RocketLaunchIcon className="mbe-2 text-fg-muted/40 block-8 inline-8" />
            <span className="text-xs font-medium text-fg">No shortcuts pinned yet</span>
            <span className="mbs-0.5 text-3xs text-fg-muted">
              Add your favorite apps, tools, and websites for instant 1-click launch.
            </span>
            <button
              type="button"
              onClick={openLauncher}
              className="
                mbs-3 flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent-500
                px-3 py-1.5 text-2xs font-semibold text-white shadow-xs
                transition-all hover:bg-accent-600 active:scale-95
              "
            >
              <PlusIcon className="block-3 inline-3" weight="bold" />
              Pick an App or Shortcut
            </button>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

const shortcutsModule: WidgetModule = {
  manifest,
  component: ShortcutsWidget,
  defaultSettings: {
    layout: "grid",
    columns: "2",
    showLabels: true,
    showSubtitles: true,
  },
  defaultState: {
    items: DEFAULT_SHORTCUTS,
  },
};

export default shortcutsModule;
