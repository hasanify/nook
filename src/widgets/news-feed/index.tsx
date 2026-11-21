import { ArrowClockwiseIcon, ArrowUpIcon, ChatCircleIcon } from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner } from "@/components/Banner";
import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

interface StoryItem {
  id: number;
  title: string;
  by: string;
  score: number;
  time: number;
  url?: string;
  comments: number;
  domain: string;
}

const SAMPLE_STORIES: StoryItem[] = [
  {
    id: 1,
    title: "Show HN: Nook – Fast, Minimal, Native Windows Desktop Widgets",
    by: "hasanify",
    score: 342,
    time: Math.floor(Date.now() / 1000) - 3600 * 2,
    url: "https://github.com/hasanify/nook",
    comments: 88,
    domain: "github.com",
  },
  {
    id: 2,
    title: "Why SQLite is so great for modern distributed architectures",
    by: "antigravity",
    score: 215,
    time: Math.floor(Date.now() / 1000) - 3600 * 5,
    url: "https://sqlite.org",
    comments: 54,
    domain: "sqlite.org",
  },
  {
    id: 3,
    title: "WebAssembly 2.0 specification reaches W3C candidate recommendation",
    by: "wasm_fan",
    score: 189,
    time: Math.floor(Date.now() / 1000) - 3600 * 8,
    url: "https://w3.org",
    comments: 31,
    domain: "w3.org",
  },
];

function getDomain(url?: string): string {
  if (!url) return "ycombinator.com";
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return "ycombinator.com";
  }
}

export function NewsFeedWidget({ instance, editMode, patchState }: WidgetProps) {
  const cachedStories = useMemo(() => {
    const raw = instance.state.stories;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as StoryItem[];
    }
    return SAMPLE_STORIES;
  }, [instance.state.stories]);

  const [stories, setStories] = useState<StoryItem[]>(cachedStories);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: "info" | "warn" | "error" } | null>(
    null,
  );

  const feedType = (instance.settings.feedType as string) || "top";
  const count = parseInt((instance.settings.storyCount as string) || "5", 10);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setBanner(null);

    try {
      const endpointMap: Record<string, string> = {
        top: "topstories",
        best: "beststories",
        new: "newstories",
        show: "showstories",
      };
      const cat = endpointMap[feedType] || "topstories";
      const listRes = await fetch(`https://hacker-news.firebaseio.com/v0/${cat}.json`);
      if (!listRes.ok) {
        throw new Error(`HN API responded with ${listRes.status}`);
      }

      const idList = (await listRes.json()) as number[];
      const targetIds = idList.slice(0, Math.min(10, Math.max(3, count)));

      const items = await Promise.all(
        targetIds.map(async (id) => {
          const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!res.ok) return null;
          const data = (await res.json()) as {
            id: number;
            title: string;
            by: string;
            score?: number;
            time: number;
            url?: string;
            descendants?: number;
          };
          return {
            id: data.id,
            title: data.title,
            by: data.by || "anon",
            score: data.score || 0,
            time: data.time || Math.floor(Date.now() / 1000),
            url: data.url,
            comments: data.descendants || 0,
            domain: getDomain(data.url),
          } as StoryItem;
        }),
      );

      const validStories = items.filter((s): s is StoryItem => s !== null);
      if (validStories.length > 0) {
        setStories(validStories);
        patchState({ stories: validStories });
      }
    } catch (err) {
      setBanner({
        text: err instanceof Error ? err.message : "Failed to fetch stories",
        type: "warn",
      });
    } finally {
      setLoading(false);
    }
  }, [count, feedType, patchState]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const endpointMap: Record<string, string> = {
          top: "topstories",
          best: "beststories",
          new: "newstories",
          show: "showstories",
        };
        const cat = endpointMap[feedType] || "topstories";
        const listRes = await fetch(`https://hacker-news.firebaseio.com/v0/${cat}.json`);
        if (!listRes.ok || !active) return;

        const idList = (await listRes.json()) as number[];
        const targetIds = idList.slice(0, Math.min(10, Math.max(3, count)));

        const items = await Promise.all(
          targetIds.map(async (id) => {
            const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            if (!res.ok) return null;
            const data = (await res.json()) as {
              id: number;
              title: string;
              by: string;
              score?: number;
              time: number;
              url?: string;
              descendants?: number;
            };
            return {
              id: data.id,
              title: data.title,
              by: data.by || "anon",
              score: data.score || 0,
              time: data.time || Math.floor(Date.now() / 1000),
              url: data.url,
              comments: data.descendants || 0,
              domain: getDomain(data.url),
            } as StoryItem;
          }),
        );

        if (!active) return;
        const valid = items.filter((s): s is StoryItem => s !== null);
        if (valid.length > 0) {
          setStories(valid);
          patchState({ stories: valid });
        }
      } catch {
        // Ignored
      }
    };

    void load();

    // Auto-refresh every 15 minutes
    const interval = setInterval(
      () => {
        void load();
      },
      15 * 60 * 1000,
    );

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [count, feedType, patchState]);

  const handleOpenStory = (story: StoryItem) => {
    const targetUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
    void openUrl(targetUrl);
  };

  const handleOpenComments = (e: React.MouseEvent, storyId: number) => {
    e.stopPropagation();
    void openUrl(`https://news.ycombinator.com/item?id=${storyId}`);
  };

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title="Tech News Feed"
      footer={
        <div className="flex items-center justify-between text-2xs text-fg-muted inline-full">
          <span>{stories.length} stories</span>
          <span>Click story to open</span>
        </div>
      }
    >
      <div className="flex flex-col justify-between p-1.5 select-none min-block-full">
        {/* Header */}
        <div className="flex items-center justify-between border-be border-line/40 pbe-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-fg">
            <span className="flex items-center justify-center rounded-sm bg-amber-500 text-2xs font-bold text-white block-4 inline-4">
              Y
            </span>
            <span>Hacker News</span>
            <span className="font-mono text-2xs tracking-wider text-fg-muted uppercase">
              {feedType}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchFeed()}
              disabled={loading}
              title="Refresh stories"
              className="
                flex cursor-pointer items-center gap-1 text-sub font-medium
                text-accent-500 transition-colors
                hover:text-accent-400
                disabled:opacity-40
              "
            >
              <ArrowClockwiseIcon
                className={`
                block-3 inline-3
                ${loading ? "animate-spin" : ""}
              `}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {banner && (
          <div className="my-1">
            <Banner message={banner.text} type={banner.type} />
          </div>
        )}

        {/* Stories list */}
        <div className="my-1.5 space-y-1.5 pe-0.5">
          {stories.map((story, idx) => (
            <div
              key={story.id}
              onClick={() => handleOpenStory(story)}
              className="
                group cursor-pointer rounded-lg border border-line/40
                bg-surface/50 p-2 transition-colors
                hover:border-accent-500/40 hover:bg-surface-raised/60
              "
            >
              <div className="flex items-start gap-2">
                <span className="mbs-0.5 font-mono text-sub font-bold text-fg-muted/60">
                  #{idx + 1}
                </span>

                <div className="flex-1 min-inline-0">
                  <h4
                    className="
                    text-xs/snug font-semibold text-fg transition-colors
                    group-hover:text-accent-400
                  "
                  >
                    {story.title}
                  </h4>

                  {/* Metadata Row */}
                  <div className="mbs-1 flex items-center gap-2 text-2xs text-fg-muted">
                    <span className="truncate rounded-sm bg-surface-raised px-1 py-0.5 font-mono text-3xs text-fg-muted/90 max-inline-badge-max">
                      {story.domain}
                    </span>
                    <span className="flex items-center gap-0.5 font-mono font-medium text-amber-400">
                      <ArrowUpIcon className="block-2.5 inline-2.5" weight="bold" />
                      {story.score}
                    </span>
                    <span>by {story.by}</span>
                    <button
                      type="button"
                      onClick={(e) => handleOpenComments(e, story.id)}
                      title="View discussion on HN"
                      className="
                        ms-auto flex cursor-pointer items-center gap-1 font-mono
                        transition-colors
                        hover:text-accent-500
                      "
                    >
                      <ChatCircleIcon className="block-3 inline-3" />
                      <span>{story.comments}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}

const newsFeedModule: WidgetModule = {
  manifest,
  component: NewsFeedWidget,
  defaultSettings: {
    feedType: "top",
    storyCount: "5",
  },
  defaultState: {
    stories: SAMPLE_STORIES,
  },
};

export default newsFeedModule;
