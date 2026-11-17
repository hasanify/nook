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

interface GitHubData {
  repo: string;
  branch: string;
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

export function GitHubRepoWidget({ instance, editMode }: WidgetProps) {
  const repo =
    typeof instance.settings.repository === "string" && instance.settings.repository
      ? instance.settings.repository
      : "";

  const { payload, loading, refresh } = useProvider<GitHubData>(instance.id);
  const data = payload?.data;

  const handleOpenLink = (url: string) => {
    if (url) {
      void openUrl(url);
    }
  };

  const latestRun = data?.runs?.[0];
  const runStatus = (() => {
    if (!latestRun) return "idle";
    if (latestRun.status === "in_progress" || latestRun.status === "queued") return "syncing";
    if (latestRun.conclusion === "success") return "ok";
    if (latestRun.conclusion === "failure") return "error";
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
      onToggleEditMode={() => {}}
      title={repo || manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      headerSlot={<StatusDot status={runStatus} title={`CI: ${latestRun?.conclusion || "None"}`} />}
      banner={
        bannerInfo ? (
          <Banner
            message={bannerInfo.message}
            type={bannerInfo.type}
            actionText="Refresh"
            onAction={refresh}
          />
        ) : undefined
      }
    >
      <div className="flex h-full flex-col gap-3 overflow-hidden select-none">
        {/* Workflow Runs Section */}
        {data?.runs && data.runs.length > 0 && (
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
                    className="group flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-surface-raised"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <StatusDot status={s} />
                      <span className="truncate font-medium text-fg group-hover:text-accent-500">
                        {run.name}
                      </span>
                      {run.branch && (
                        <span className="truncate text-[10px] text-fg-muted">({run.branch})</span>
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
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
            Commits
          </span>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {data?.commits && data.commits.length > 0 ? (
              data.commits.map((c) => (
                <button
                  key={c.sha}
                  type="button"
                  onClick={() => handleOpenLink(c.url)}
                  className="group flex flex-col rounded px-2 py-1 text-left text-xs transition-colors hover:bg-surface-raised"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium text-fg group-hover:text-accent-500">
                      {c.message}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-accent-500">{c.sha}</span>
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
  },
  defaultState: {},
};

export default module;
