import {
  ArrowClockwise,
  ArrowSquareOut,
  GitFork,
  Star,
  Tag,
  WarningCircle,
} from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Banner } from "@/components/Banner";
import { StatusDot } from "@/components/StatusDot";
import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";
import { useProvider } from "@/core/use-provider";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

interface CommitItem {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface WorkflowRunItem {
  id: number;
  name: string;
  status: string;
  conclusion?: string;
  branch: string;
  updated_at: string;
  url: string;
}

interface ReleaseItem {
  tag_name: string;
  name?: string;
  published_at?: string;
  url: string;
}

interface GitHubData {
  repo: string;
  branch: string;
  stars?: number;
  forks?: number;
  open_issues?: number;
  latest_release?: ReleaseItem;
  commits: CommitItem[];
  runs: WorkflowRunItem[];
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatLastUpdated(updatedAt: number, now: number): string {
  if (!updatedAt) return "";
  const ms = updatedAt > 1e11 ? updatedAt : updatedAt * 1000;
  const diffSecs = Math.max(0, Math.floor((now - ms) / 1000));
  if (diffSecs < 10) return "just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatCount(num?: number): string {
  if (num === undefined || num === null) return "";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

export function GitHubRepoWidget({ instance, editMode }: WidgetProps) {
  const repo =
    typeof instance.settings.repository === "string" && instance.settings.repository
      ? instance.settings.repository
      : "";

  const showStars = instance.settings.showStars !== false;
  const showForks = instance.settings.showForks !== false;
  const showIssues = instance.settings.showIssues !== false;
  const showRelease = instance.settings.showRelease !== false;
  const showRuns = instance.settings.showRuns !== false;
  const showCommits = instance.settings.showCommits !== false;

  const { payload, loading, refresh } = useProvider<GitHubData>(instance.id);
  const data = payload?.data;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refresh();
      setNow(Date.now());
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refresh]);

  // Initial fetch if cache is empty on mount
  const initialFetchAttempted = useRef(false);
  useEffect(() => {
    if (!loading && !payload && repo && !initialFetchAttempted.current) {
      initialFetchAttempted.current = true;
      void handleManualRefresh();
    }
  }, [loading, payload, repo, handleManualRefresh]);

  const updatedAt = payload?.updated_at;

  const lastUpdatedText = useMemo(() => {
    if (!updatedAt) return "";
    return formatLastUpdated(updatedAt, now);
  }, [updatedAt, now]);

  const exactUpdatedTime = useMemo(() => {
    if (!updatedAt) return undefined;
    const ms = updatedAt > 1e11 ? updatedAt : updatedAt * 1000;
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [updatedAt]);

  const handleOpenLink = (url: string) => {
    if (url) {
      const fullUrl =
        url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
      openUrl(fullUrl).catch(() => {
        window.open(fullUrl, "_blank");
      });
    }
  };

  const latestRun = data?.runs && data.runs.length > 0 ? data.runs[0] : null;

  const runStatus = (() => {
    if (!latestRun) return "idle";
    if (latestRun.conclusion === "success") return "ok";
    if (latestRun.conclusion === "failure") return "error";
    if (latestRun.status === "in_progress") return "syncing";
    return "warn";
  })();

  const bannerInfo = (() => {
    if (!repo) {
      return {
        message: "Configure repository in Settings",
        type: "info" as const,
      };
    }
    if (!payload) return null;
    if (payload.status === "bad-token") {
      return {
        message: payload.message || "Invalid GitHub token",
        type: "warn" as const,
      };
    }
    if (payload.status === "rate-limited") {
      return {
        message: payload.message || "Rate limit reached",
        type: "warn" as const,
      };
    }
    if (payload.status === "not-found") {
      return {
        message: payload.message || "Repository not found",
        type: "error" as const,
      };
    }
    if (payload.status === "offline") {
      return {
        message: "Offline — showing cached data",
        type: "warn" as const,
      };
    }
    if (payload.status === "error") {
      return {
        message: payload.message || "Error fetching data",
        type: "error" as const,
      };
    }
    return null;
  })();

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={repo || manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
      headerSlot={<StatusDot status={runStatus} title={`CI: ${latestRun?.conclusion || "None"}`} />}
      headerActions={
        repo ? (
          <div className="flex items-center gap-1.5 text-fg-muted">
            {lastUpdatedText && (
              <span
                className="cursor-default font-mono text-[10px] text-fg-muted/70 select-none"
                title={exactUpdatedTime ? `Updated at ${exactUpdatedTime}` : undefined}
              >
                {lastUpdatedText}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenLink(`https://github.com/${repo}`);
              }}
              className="
                flex cursor-pointer items-center justify-center rounded-sm
                text-fg-muted transition-colors block-5 inline-5
                hover:bg-surface-raised/80 hover:text-accent-500
              "
              title={`Open ${repo} on GitHub`}
              aria-label={`Open ${repo} on GitHub`}
            >
              <ArrowSquareOut className="block-3 inline-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleManualRefresh();
              }}
              disabled={isRefreshing}
              className="
                flex cursor-pointer items-center justify-center rounded-sm
                text-fg-muted transition-colors block-5 inline-5
                hover:bg-surface-raised/80 hover:text-fg
                disabled:opacity-50
              "
              title={isRefreshing ? "Refreshing..." : "Refresh repository data"}
              aria-label="Refresh repository data"
            >
              <ArrowClockwise
                className={`
                  block-3 inline-3
                  ${isRefreshing ? `animate-spin text-accent-500` : ""}
                `}
              />
            </button>
          </div>
        ) : undefined
      }
      banner={
        bannerInfo ? (
          <Banner
            message={bannerInfo.message}
            type={bannerInfo.type}
            actionText="Refresh"
            onAction={() => void handleManualRefresh()}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2.5 select-none min-block-full">
        {/* Badges / Meta bar (Stars, Release, Forks, Issues) */}
        {((showStars && data?.stars !== undefined) ||
          (showForks && data?.forks !== undefined && data.forks > 0) ||
          (showIssues && data?.open_issues !== undefined) ||
          (showRelease && data?.latest_release)) && (
          <div className="flex flex-wrap items-center gap-1.5 border-be border-line/40 pbe-2 text-[11px]">
            {showStars && data?.stars !== undefined && (
              <button
                type="button"
                onClick={() => handleOpenLink(`https://github.com/${repo}/stargazers`)}
                className="
                  group flex cursor-pointer items-center gap-1 rounded-md border
                  border-line/60 bg-surface-raised px-1.5 py-0.5 font-medium
                  text-fg-muted transition-colors
                  hover:border-accent-500/50 hover:bg-surface
                  hover:text-accent-500
                "
                title="GitHub Stars"
              >
                <Star className="text-amber-500 block-3 inline-3" weight="fill" />
                <span
                  className="
                  font-mono text-[10px] text-fg
                  group-hover:text-accent-500
                "
                >
                  {formatCount(data.stars)}
                </span>
              </button>
            )}

            {showForks && data?.forks !== undefined && data.forks > 0 && (
              <button
                type="button"
                onClick={() => handleOpenLink(`https://github.com/${repo}/network/members`)}
                className="
                  group flex cursor-pointer items-center gap-1 rounded-md border
                  border-line/60 bg-surface-raised px-1.5 py-0.5 font-medium
                  text-fg-muted transition-colors
                  hover:border-accent-500/50 hover:bg-surface
                  hover:text-accent-500
                "
                title="Forks"
              >
                <GitFork className="block-3 inline-3" />
                <span
                  className="
                  font-mono text-[10px] text-fg
                  group-hover:text-accent-500
                "
                >
                  {formatCount(data.forks)}
                </span>
              </button>
            )}

            {showIssues && data?.open_issues !== undefined && (
              <button
                type="button"
                onClick={() => handleOpenLink(`https://github.com/${repo}/issues`)}
                className="
                  group flex cursor-pointer items-center gap-1 rounded-md border
                  border-line/60 bg-surface-raised px-1.5 py-0.5 font-medium
                  text-fg-muted transition-colors
                  hover:border-accent-500/50 hover:bg-surface
                  hover:text-accent-500
                "
                title="Open Issues"
              >
                <WarningCircle className="text-emerald-500 block-3 inline-3" />
                <span
                  className="
                  font-mono text-[10px] text-fg
                  group-hover:text-accent-500
                "
                >
                  {formatCount(data.open_issues)} issues
                </span>
              </button>
            )}

            {showRelease && data?.latest_release && (
              <button
                type="button"
                onClick={() => handleOpenLink(data.latest_release!.url)}
                className="
                  group flex cursor-pointer items-center gap-1 truncate
                  rounded-md border border-accent-500/30 bg-accent-500/10 px-1.5
                  py-0.5 font-medium text-accent-500 transition-colors
                  max-inline-[140px]
                  hover:bg-accent-500/20
                "
                title={`Latest Release: ${data.latest_release.name || data.latest_release.tag_name}`}
              >
                <Tag className="shrink-0 block-3 inline-3" />
                <span className="truncate font-mono text-[10px]">
                  {data.latest_release.tag_name}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Workflow Runs Section */}
        {showRuns && data?.runs && data.runs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
              Actions
            </span>
            <div className="flex flex-col gap-1">
              {data.runs.map((run) => {
                const s =
                  run.conclusion === "success"
                    ? "ok"
                    : run.conclusion === "failure"
                      ? "error"
                      : run.status === "in_progress"
                        ? "syncing"
                        : "warn";

                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => handleOpenLink(run.url)}
                    className="
                      group flex cursor-pointer items-center justify-between
                      gap-2 rounded-lg px-2 py-1 text-start text-xs
                      transition-colors
                      hover:bg-surface-raised/80
                    "
                  >
                    <div className="flex items-center gap-1.5 min-inline-0">
                      <StatusDot status={s} />
                      <span
                        className="
                        truncate font-medium text-fg
                        group-hover:text-accent-500
                      "
                      >
                        {run.name}
                      </span>
                      {run.branch && (
                        <span className="truncate rounded-sm bg-surface-raised px-1 py-0.5 font-mono text-[9px] text-fg-muted">
                          {run.branch}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-fg-muted">
                      {formatRelativeTime(run.updated_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Commits Section */}
        {showCommits && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
              Commits
            </span>
            <div className="flex flex-col gap-1 pe-1 pbe-2">
              {data?.commits && data.commits.length > 0 ? (
                data.commits.map((c) => (
                  <button
                    key={c.sha}
                    type="button"
                    onClick={() => handleOpenLink(c.url)}
                    className="
                      group flex cursor-pointer flex-col rounded-lg px-2 py-1.5
                      text-start text-xs transition-colors
                      hover:bg-surface-raised/80
                    "
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="
                        truncate font-medium text-fg
                        group-hover:text-accent-500
                      "
                      >
                        {c.message}
                      </span>
                      <span className="shrink-0 rounded-sm border border-line/50 bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-accent-500">
                        {c.sha}
                      </span>
                    </div>
                    <div className="mbs-0.5 flex items-center justify-between text-[10px] text-fg-muted">
                      <span>{c.author}</span>
                      <span>{formatRelativeTime(c.date)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-fg-muted italic">
                  {loading ? "Loading repository data..." : "No commit history found."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: GitHubRepoWidget,
  defaultSettings: {
    repository: "",
    branch: "main",
    showStars: true,
    showForks: true,
    showIssues: true,
    showRelease: true,
    showRuns: true,
    showCommits: true,
    commitCount: 5,
    pollInterval: 0,
  },
  defaultState: {},
};

export default module;
