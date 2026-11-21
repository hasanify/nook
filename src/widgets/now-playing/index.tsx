import { useEffect, useState, useCallback } from "react";
import {
  SpeakerLow,
  SpeakerHigh,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  SpeakerSimpleNone,
} from "@phosphor-icons/react";
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
              <SpeakerLow className="h-3.5 w-3.5" weight="fill" />
            </button>
            <button
              type="button"
              onClick={() => void handleAction("volume_up")}
              title="Volume Up"
              className="cursor-pointer rounded p-1 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <SpeakerHigh className="h-3.5 w-3.5" weight="fill" />
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
              <SkipBack className="h-4 w-4" weight="fill" />
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={() => void handleAction("play_pause")}
              title={isPlaying ? "Pause" : "Play"}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent-500 text-white shadow-md transition-all hover:bg-accent-600 active:scale-95"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" weight="fill" />
              ) : (
                <Play className="h-4 w-4 translate-x-0.5" weight="fill" />
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={() => void handleAction("next")}
              title="Next Track"
              className="cursor-pointer rounded-full p-1.5 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
            >
              <SkipForward className="h-4 w-4" weight="fill" />
            </button>
          </div>

          {/* Mute */}
          <button
            type="button"
            onClick={() => void handleAction("mute")}
            title="Mute / Unmute"
            className="cursor-pointer rounded p-1 text-fg-muted transition-colors hover:bg-surface-raised hover:text-fg"
          >
            <SpeakerSimpleNone className="h-3.5 w-3.5" weight="bold" />
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
