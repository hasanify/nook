import { ArrowClockwiseIcon, ChatCircleIcon } from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { formatDistanceToNowStrict } from "date-fns";
import { useCallback, useEffect, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import { getAccountToken } from "@/core/ipc";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

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
  try {
    return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true });
  } catch {
    return "";
  }
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
          className="
            flex cursor-pointer items-center justify-center rounded-sm
            text-fg-muted block-5 inline-5
            hover:bg-surface-raised hover:text-fg
            disabled:opacity-40
          "
        >
          <ArrowClockwiseIcon
            className={`
            block-3 inline-3
            ${loading ? "animate-spin" : ""}
          `}
          />
        </button>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-between text-2xs text-fg-muted inline-full">
          <span>{prs.length} pull requests</span>
          <button
            type="button"
            className="
              cursor-pointer text-accent-500
              hover:underline
            "
            onClick={() => void fetchPRs()}
          >
            Refresh
          </button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col justify-between gap-1.5 p-1 select-none min-block-full">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-be border-line/40 pbe-1 text-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("review-requested")}
            className={`
              cursor-pointer rounded-sm px-2 py-0.5 font-medium
              transition-colors
              ${
                activeTab === "review-requested"
                  ? "bg-accent-500/15 font-semibold text-accent-500"
                  : `
                  text-fg-muted
                  hover:text-fg
                `
              }
            `}
          >
            Review Queue
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("authored")}
            className={`
              cursor-pointer rounded-sm px-2 py-0.5 font-medium
              transition-colors
              ${
                activeTab === "authored"
                  ? "bg-accent-500/15 font-semibold text-accent-500"
                  : `
                  text-fg-muted
                  hover:text-fg
                `
              }
            `}
          >
            My PRs
          </button>
          {repository && (
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`
                cursor-pointer rounded-sm px-2 py-0.5 font-medium
                transition-colors
                ${
                  activeTab === "all"
                    ? "bg-accent-500/15 font-semibold text-accent-500"
                    : `
                    text-fg-muted
                    hover:text-fg
                  `
                }
              `}
            >
              {repository.split("/")[1] || "Repo"}
            </button>
          )}
        </div>

        {/* PR List */}
        <div className="flex flex-col gap-1.5">
          {prs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-xs text-fg-muted">
              {loading ? "Fetching PRs…" : "No open pull requests found"}
            </div>
          ) : (
            prs.map((pr) => (
              <div
                key={pr.id}
                onClick={() => void openUrl(pr.html_url)}
                className="
                  group flex cursor-pointer flex-col gap-1 rounded-lg border
                  border-line bg-surface-raised/40 p-2 transition-all
                  hover:border-accent-500/40 hover:bg-surface-raised
                "
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 font-mono text-2xs font-bold text-accent-500">
                      #{pr.number}
                    </span>
                    <span
                      className="
                      line-clamp-1 text-xs font-medium text-fg
                      group-hover:text-accent-500
                    "
                    >
                      {pr.title}
                    </span>
                  </div>
                  {pr.draft ? (
                    <span className="shrink-0 rounded-sm bg-fg-muted/15 px-1 py-0.5 font-mono text-3xs text-fg-muted">
                      Draft
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-sm bg-ok/15 px-1 py-0.5 font-mono text-3xs font-semibold text-ok">
                      Open
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-2xs text-fg-muted">
                  <div className="flex items-center gap-2">
                    <span className="truncate rounded-sm bg-surface px-1.5 py-0.5 font-mono text-3xs font-medium text-fg-muted">
                      {pr.repo}
                    </span>
                    <span>by {pr.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pr.comments > 0 && (
                      <span className="flex items-center gap-0.5">
                        <ChatCircleIcon className="block-3 inline-3" /> {pr.comments}
                      </span>
                    )}
                    <span>{formatRelativeTime(pr.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
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
