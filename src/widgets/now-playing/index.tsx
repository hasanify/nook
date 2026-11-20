import { useEffect, useState, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { sendMediaCommand, getMediaStatus, type MediaStatus } from "../../core/ipc";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

export function NowPlayingWidget({ instance, editMode }: WidgetProps) {
  const [media, setMedia] = useState<MediaStatus | null>(null);
  const [isPlayingLocal, setIsPlayingLocal] = useState(false);

  const intervalSec = Math.max(
    1,
    parseInt((instance.settings.refreshInterval as string) || "3", 10),
  );

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getMediaStatus();
      setMedia(status);
      if (status.is_playing) {
        setIsPlayingLocal(true);
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const status = await getMediaStatus();
        if (!active) return;
        setMedia(status);
        if (status.is_playing) {
          setIsPlayingLocal(true);
        }
      } catch {
        // Ignored
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, intervalSec * 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [intervalSec]);

  const handleAction = async (action: string) => {
    if (action === "play_pause") {
      setIsPlayingLocal((prev) => !prev);
    }
    try {
      await sendMediaCommand(action);
      setTimeout(() => {
        void fetchStatus();
      }, 350);
    } catch {
      // Ignored
    }
  };

  const isPlaying = media?.is_playing ?? isPlayingLocal;
  const hasTrack = media && media.title && media.title !== "No Active Track";

  return (
    <WidgetShell instance={instance} editMode={editMode} title="Now Playing">
      <div className="flex min-h-full flex-col justify-between p-1.5 select-none">
        {/* Header / Player Badge */}
        <div className="flex items-center justify-between border-b border-line/40 pb-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-fg">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isPlaying ? "animate-ping bg-accent-400" : "bg-fg-muted"
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isPlaying ? "bg-accent-500" : "bg-fg-muted"
                }`}
              />
            </span>
            <span>{media?.player || "Windows Media"}</span>
          </div>

          {/* Equalizer Wave Bars */}
          <div className="flex h-3 items-end gap-0.5">
            <div
              className={`w-0.5 rounded-full bg-accent-500 transition-all duration-200 ${
                isPlaying ? "h-3 animate-pulse" : "h-1 opacity-40"
              }`}
            />
            <div
              className={`w-0.5 rounded-full bg-accent-500 transition-all duration-300 ${
                isPlaying ? "h-2 animate-bounce" : "h-1 opacity-40"
              }`}
            />
            <div
              className={`w-0.5 rounded-full bg-accent-500 transition-all duration-150 ${
                isPlaying ? "h-3.5 animate-pulse" : "h-1 opacity-40"
              }`}
            />
            <div
              className={`w-0.5 rounded-full bg-accent-500 transition-all duration-250 ${
                isPlaying ? "h-2 animate-bounce" : "h-1 opacity-40"
              }`}
            />
          </div>
        </div>

        {/* Track Info Card */}
        <div className="my-1 flex items-center gap-3 rounded-xl border border-line/40 bg-surface/50 p-2.5">
          {/* Vinyl Disc Icon */}
          <div
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line/60 bg-gradient-to-tr from-surface-raised via-line/40 to-surface shadow-inner ${
              isPlaying ? "animate-spin" : ""
            }`}
            style={{ animationDuration: "6s" }}
          >
            <div className="flex h-4 w-4 items-center justify-center rounded-full border border-accent-500/40 bg-accent-500/20">
              <div className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            </div>
          </div>

          {/* Titles */}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="truncate text-xs font-semibold text-fg select-text">
              {hasTrack ? media.title : "No Track Active"}
            </span>
            <span className="truncate text-[11px] text-fg-muted select-text">
              {hasTrack ? media.artist : "Desktop media controls ready"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pt-1">
          {/* Volume controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleAction("volume_down")}
              title="Volume Down"
              className="cursor-pointer rounded p-1 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => void handleAction("volume_up")}
              title="Volume Up"
              className="cursor-pointer rounded p-1 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            </button>
          </div>

          {/* Transport Main Buttons */}
          <div className="flex items-center gap-2">
            {/* Prev */}
            <button
              type="button"
              onClick={() => void handleAction("previous")}
              title="Previous Track"
              className="cursor-pointer rounded-full p-1.5 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={() => void handleAction("play_pause")}
              title={isPlaying ? "Pause" : "Play"}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent-500 text-white shadow-md transition-all hover:bg-accent-600 active:scale-95"
            >
              {isPlaying ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={() => void handleAction("next")}
              title="Next Track"
              className="cursor-pointer rounded-full p-1.5 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          {/* Mute */}
          <button
            type="button"
            onClick={() => void handleAction("mute")}
            title="Mute / Unmute"
            className="cursor-pointer rounded p-1 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          </button>
        </div>
      </div>
    </WidgetShell>
  );
}

const nowPlayingModule: WidgetModule = {
  manifest,
  component: NowPlayingWidget,
  defaultSettings: {
    refreshInterval: "3",
  },
  defaultState: {},
};

export default nowPlayingModule;
