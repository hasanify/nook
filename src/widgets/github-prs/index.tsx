import { useState, useEffect, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getAccountToken } from "../../core/ipc";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

interface PullRequestItem {
  id: number;
  number: number;
  title: string;
  html_url: string;
  repo: string;
  author: string;
  author_avatar?: string;
  updated_at: string;
  draft: boolean;
  comments: number;
}

const DEFAULT_SAMPLE_PRS: PullRequestItem[] = [
  {
    id: 101,
    number: 42,
    title: "feat(widgets): add system vitals and battery monitor sparklines",
    html_url: "https://github.com/hasanify/nook/pull/42",
    repo: "nook",
    author: "alex",
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    draft: false,
    comments: 3,
  },
  {
    id: 102,
    number: 43,
    title: "fix(pin): prevent window clipping on multi-monitor DPI scaling",
    html_url: "https://github.com/hasanify/nook/pull/43",
    repo: "nook",
    author: "sarah",
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    draft: false,
    comments: 1,
  },
  {
    id: 103,
    number: 44,
    title: "refactor(core): optimize IPC poller event debounce buffer",
    html_url: "https://github.com/hasanify/nook/pull/44",
    repo: "nook",
    author: "david",
    updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    draft: true,
    comments: 0,
  },
];

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

export function GithubPrsWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedFilter =
    typeof instance.settings.filter === "string" ? instance.settings.filter : "review-requested";
  const [activeTab, setActiveTab] = useState<string>(savedFilter);
  const [prs, setPrs] = useState<PullRequestItem[]>(DEFAULT_SAMPLE_PRS);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const repository =
    typeof instance.settings.repository === "string" ? instance.settings.repository.trim() : "";
  const tokenOverride =
    typeof instance.settings.tokenOverride === "string"
      ? instance.settings.tokenOverride.trim()
      : "";

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);

    const token = tokenOverride || (await getAccountToken("github").catch(() => null));

    try {
      let queryUrl = "";
      if (repository && activeTab === "all") {
        queryUrl = `https://api.github.com/repos/${repository}/pulls?state=open&per_page=10`;
      } else if (token) {
        if (activeTab === "authored") {
          queryUrl = `https://api.github.com/search/issues?q=is:pr+is:open+author:@me&per_page=10`;
        } else {
          queryUrl = `https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10`;
        }
      } else if (repository) {
        queryUrl = `https://api.github.com/repos/${repository}/pulls?state=open&per_page=10`;
      }

      if (!queryUrl) {
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(queryUrl, { headers });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("GitHub token missing or rate limited. Check Accounts in Settings.");
        }
        throw new Error(`GitHub API error (${res.status})`);
      }

      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data.items || [];

      // Parse PRs
      const parsed: PullRequestItem[] = rawList.map(
        (item: {
          id: number;
          number: number;
          title: string;
          html_url: string;
          repository_url?: string;
          user?: { login: string; avatar_url?: string };
          updated_at: string;
          draft?: boolean;
          comments?: number;
        }) => {
          let repoName = repository;
          if (item.repository_url) {
            const parts = item.repository_url.split("/");
            repoName = parts[parts.length - 1] ?? "";
          }
          return {
            id: item.id,
            number: item.number,
            title: item.title,
            html_url: item.html_url,
            repo: repoName || "repo",
            author: item.user?.login || "user",
            author_avatar: item.user?.avatar_url,
            updated_at: item.updated_at,
            draft: Boolean(item.draft),
            comments: item.comments || 0,
          };
        },
      );

      setPrs(parsed);
      patchState({ prCount: parsed.length });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repository, tokenOverride, activeTab, patchState]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const token = tokenOverride || (await getAccountToken("github").catch(() => null));
      if (!active) return;
      if (!token && !repository) {
        // Keep default sample if neither token nor public repo is set
        return;
      }
      void fetchPRs();
    };

    void run();

    return () => {
      active = false;
    };
  }, [fetchPRs, repository, tokenOverride]);

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}

      headerActions={
        <button
          type="button"
          onClick={() => void fetchPRs()}
          disabled={loading}
          title="Refresh PRs"
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-raised hover:text-fg disabled:opacity-40"
        >
          <svg
            className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
    >
      <div className="flex min-h-full flex-1 flex-col justify-between gap-1.5 p-1 select-none">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-line/40 pb-1 text-[10px]">
          <button
            type="button"
            onClick={() => setActiveTab("review-requested")}
            className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
              activeTab === "review-requested"
                ? "bg-accent-500/15 font-semibold text-accent-500"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            Review Queue
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("authored")}
            className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
              activeTab === "authored"
                ? "bg-accent-500/15 font-semibold text-accent-500"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            My PRs
          </button>
          {repository && (
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`cursor-pointer rounded px-2 py-0.5 font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-accent-500/15 font-semibold text-accent-500"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {repository.split("/")[1] || "Repo"}
            </button>
          )}
        </div>

        {/* PR List */}
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {prs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-xs text-fg-muted">
              {loading ? "Fetching PRs…" : "No open pull requests found"}
            </div>
          ) : (
            prs.map((pr) => (
              <div
                key={pr.id}
                onClick={() => void openUrl(pr.html_url)}
                className="group flex cursor-pointer flex-col gap-1 rounded-lg border border-line bg-surface-raised/40 p-2 transition-all hover:border-accent-500/40 hover:bg-surface-raised"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 font-mono text-[10px] font-bold text-accent-500">
                      #{pr.number}
                    </span>
                    <span className="line-clamp-1 text-xs font-medium text-fg group-hover:text-accent-500">
                      {pr.title}
                    </span>
                  </div>
                  {pr.draft ? (
                    <span className="py-0.2 shrink-0 rounded bg-fg-muted/15 px-1 font-mono text-[9px] text-fg-muted">
                      Draft
                    </span>
                  ) : (
                    <span className="py-0.2 shrink-0 rounded bg-ok/15 px-1 font-mono text-[9px] font-semibold text-ok">
                      Open
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-fg-muted">
                  <div className="flex items-center gap-2">
                    <span className="py-0.2 truncate rounded bg-surface px-1.5 font-mono text-[9px] font-medium text-fg-muted">
                      {pr.repo}
                    </span>
                    <span>by {pr.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pr.comments > 0 && (
                      <span className="flex items-center gap-0.5">💬 {pr.comments}</span>
                    )}
                    <span>{formatRelativeTime(pr.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[10px] text-fg-muted">
          <span>{prs.length} pull requests</span>
          <span
            className="cursor-pointer text-accent-500 hover:underline"
            onClick={() => void fetchPRs()}
          >
            Refresh
          </span>
        </div>
      </div>
    </WidgetShell>
  );
}

const githubPrsModule: WidgetModule = {
  manifest,
  component: GithubPrsWidget,
  defaultSettings: {
    repository: "",
    filter: "review-requested",
    tokenOverride: "",
  },
  defaultState: {
    prCount: DEFAULT_SAMPLE_PRS.length,
  },
};

export default githubPrsModule;
