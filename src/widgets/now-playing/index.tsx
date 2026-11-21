import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerLow,
  SpeakerSimpleNone,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import { getMediaStatus, type MediaStatus, sendMediaCommand } from "@/core/ipc";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

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
      <div className="flex flex-col justify-between p-1.5 select-none min-block-full">
        {/* Header / Player Badge */}
        <div className="flex items-center justify-between border-be border-line/40 pbe-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-fg">
            <span className="relative flex block-2 inline-2">
              <span
                className={`
                  absolute inline-flex rounded-full opacity-75 block-full
                  inline-full
                  ${isPlaying ? "animate-ping bg-accent-400" : "bg-fg-muted"}
                `}
              />
              <span
                className={`
                  relative inline-flex rounded-full block-2 inline-2
                  ${isPlaying ? "bg-accent-500" : "bg-fg-muted"}
                `}
              />
            </span>
            <span>{media?.player || "Windows Media"}</span>
          </div>

          {/* Equalizer Wave Bars */}
          <div className="flex items-end gap-0.5 block-3">
            <div
              className={`
                rounded-full bg-accent-500 transition-all duration-200
                inline-0.5
                ${isPlaying ? "animate-pulse block-3" : "opacity-40 block-1"}
              `}
            />
            <div
              className={`
                rounded-full bg-accent-500 transition-all duration-300
                inline-0.5
                ${isPlaying ? "animate-bounce block-2" : "opacity-40 block-1"}
              `}
            />
            <div
              className={`
                rounded-full bg-accent-500 transition-all duration-150
                inline-0.5
                ${isPlaying ? "animate-pulse block-3.5" : "opacity-40 block-1"}
              `}
            />
            <div
              className={`
                rounded-full bg-accent-500 transition-all duration-250
                inline-0.5
                ${isPlaying ? "animate-bounce block-2" : "opacity-40 block-1"}
              `}
            />
          </div>
        </div>

        {/* Track Info Card */}
        <div className="my-1 flex items-center gap-3 rounded-xl border border-line/40 bg-surface/50 p-2.5">
          {/* Vinyl Disc Icon */}
          <div
            className={`
              relative flex shrink-0 items-center justify-center rounded-full
              border border-line/60 bg-linear-to-tr from-surface-raised
              via-line/40 to-surface shadow-inner block-12 inline-12
              ${isPlaying ? "animate-spin" : ""}
            `}
            style={{ animationDuration: "6s" }}
          >
            <div className="flex items-center justify-center rounded-full border border-accent-500/40 bg-accent-500/20 block-4 inline-4">
              <div className="rounded-full bg-accent-500 block-1.5 inline-1.5" />
            </div>
          </div>

          {/* Titles */}
          <div className="flex flex-1 flex-col justify-center min-inline-0">
            <span className="truncate text-xs font-semibold text-fg select-text">
              {hasTrack ? media.title : "No Track Active"}
            </span>
            <span className="truncate text-[11px] text-fg-muted select-text">
              {hasTrack ? media.artist : "Desktop media controls ready"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pbs-1">
          {/* Volume controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleAction("volume_down")}
              title="Volume Down"
              className="
                cursor-pointer rounded-sm p-1 text-fg-muted transition-colors
                hover:bg-surface-raised hover:text-fg
              "
            >
              <SpeakerLow className="block-3.5 inline-3.5" weight="fill" />
            </button>
            <button
              type="button"
              onClick={() => void handleAction("volume_up")}
              title="Volume Up"
              className="
                cursor-pointer rounded-sm p-1 text-fg-muted transition-colors
                hover:bg-surface-raised hover:text-fg
              "
            >
              <SpeakerHigh className="block-3.5 inline-3.5" weight="fill" />
            </button>
          </div>

          {/* Transport Main Buttons */}
          <div className="flex items-center gap-2">
            {/* Prev */}
            <button
              type="button"
              onClick={() => void handleAction("previous")}
              title="Previous Track"
              className="
                cursor-pointer rounded-full p-1.5 text-fg-muted
                transition-colors
                hover:bg-surface-raised hover:text-fg
              "
            >
              <SkipBack className="block-4 inline-4" weight="fill" />
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={() => void handleAction("play_pause")}
              title={isPlaying ? "Pause" : "Play"}
              className="
                flex cursor-pointer items-center justify-center rounded-full
                bg-accent-500 text-white shadow-md transition-all block-8
                inline-8
                hover:bg-accent-600
                active:scale-95
              "
            >
              {isPlaying ? (
                <Pause className="block-4 inline-4" weight="fill" />
              ) : (
                <Play className="translate-x-0.5 block-4 inline-4" weight="fill" />
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={() => void handleAction("next")}
              title="Next Track"
              className="
                cursor-pointer rounded-full p-1.5 text-fg-muted
                transition-colors
                hover:bg-surface-raised hover:text-fg
              "
            >
              <SkipForward className="block-4 inline-4" weight="fill" />
            </button>
          </div>

          {/* Mute */}
          <button
            type="button"
            onClick={() => void handleAction("mute")}
            title="Mute / Unmute"
            className="
              cursor-pointer rounded-sm p-1 text-fg-muted transition-colors
              hover:bg-surface-raised hover:text-fg
            "
          >
            <SpeakerSimpleNone className="block-3.5 inline-3.5" weight="bold" />
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
