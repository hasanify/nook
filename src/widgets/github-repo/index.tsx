import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { StatusDot } from "../../components/StatusDot";
import { Banner } from "../../components/Banner";
import { useProvider } from "../../core/use-provider";
import { openUrl } from "@tauri-apps/plugin-opener";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

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
      void openUrl(url);
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
      headerSlot={
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-fg-muted" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <StatusDot status={runStatus} title={`CI: ${latestRun?.conclusion || "None"}`} />
        </div>
      }
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
                void handleManualRefresh();
              }}
              disabled={isRefreshing}
              className="flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-raised/80 hover:text-fg disabled:opacity-50"
              title={isRefreshing ? "Refreshing..." : "Refresh repository data"}
              aria-label="Refresh repository data"
            >
              <svg
                className={`h-3 w-3 ${isRefreshing ? "animate-spin text-accent-500" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
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
      <div className="flex h-full flex-col gap-2.5 overflow-hidden select-none">
        {/* Badges / Meta bar (Stars, Release, Forks, Issues) */}
        {((showStars && data?.stars !== undefined) ||
          (showForks && data?.forks !== undefined && data.forks > 0) ||
          (showIssues && data?.open_issues !== undefined) ||
          (showRelease && data?.latest_release)) && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line/40 pb-2 text-[11px]">
            {showStars && data?.stars !== undefined && (
              <button
                type="button"
                onClick={() => handleOpenLink(`https://github.com/${repo}/stargazers`)}
                className="group flex items-center gap-1 rounded-md border border-line/60 bg-surface-raised px-1.5 py-0.5 font-medium text-fg-muted transition-colors hover:border-accent-500/50 hover:bg-surface hover:text-accent-500"
                title="GitHub Stars"
              >
                <svg className="text-amber-500 h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="font-mono text-[10px] text-fg group-hover:text-accent-500">
                  {formatCount(data.stars)}
                </span>
              </button>
            )}

            {showForks && data?.forks !== undefined && data.forks > 0 && (
              <button
                type="button"
                onClick={() => handleOpenLink(`https://github.com/${repo}/network/members`)}
                className="group flex items-center gap-1 rounded-md border border-line/60 bg-surface-raised px-1.5 py-0.5 font-medium text-fg-muted transition-colors hover:border-accent-500/50 hover:bg-surface hover:text-accent-500"
                title="Forks"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
                  <path d="M12 12v3" />
                </svg>
                <span className="font-mono text-[10px] text-fg group-hover:text-accent-500">
                  {formatCount(data.forks)}
                </span>
              </button>
            )}

            {showIssues && data?.open_issues !== undefined && (
              <button
                type="button"
                onClick={() => handleOpenLink(`https://github.com/${repo}/issues`)}
                className="group flex items-center gap-1 rounded-md border border-line/60 bg-surface-raised px-1.5 py-0.5 font-medium text-fg-muted transition-colors hover:border-accent-500/50 hover:bg-surface hover:text-accent-500"
                title="Open Issues"
              >
                <svg
                  className="text-emerald-500 h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
                <span className="font-mono text-[10px] text-fg group-hover:text-accent-500">
                  {formatCount(data.open_issues)} issues
                </span>
              </button>
            )}

            {showRelease && data?.latest_release && (
              <button
                type="button"
                onClick={() => handleOpenLink(data.latest_release!.url)}
                className="group flex max-w-[140px] items-center gap-1 truncate rounded-md border border-accent-500/30 bg-accent-500/10 px-1.5 py-0.5 font-medium text-accent-500 transition-colors hover:bg-accent-500/20"
                title={`Latest Release: ${data.latest_release.name || data.latest_release.tag_name}`}
              >
                <svg
                  className="h-3 w-3 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
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
                    className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-surface-raised/80"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <StatusDot status={s} />
                      <span className="truncate font-medium text-fg group-hover:text-accent-500">
                        {run.name}
                      </span>
                      {run.branch && (
                        <span className="py-0.2 truncate rounded bg-surface-raised px-1 font-mono text-[9px] text-fg-muted">
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
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
              Commits
            </span>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1 pb-2">
              {data?.commits && data.commits.length > 0 ? (
                data.commits.map((c) => (
                  <button
                    key={c.sha}
                    type="button"
                    onClick={() => handleOpenLink(c.url)}
                    className="group flex flex-col rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-raised/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-fg group-hover:text-accent-500">
                        {c.message}
                      </span>
                      <span className="shrink-0 rounded border border-line/50 bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-accent-500">
                        {c.sha}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-fg-muted">
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
