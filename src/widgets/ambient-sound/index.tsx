import {
  CloudRain,
  Coffee,
  Flower,
  type IconProps,
  Lightning,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerLow,
} from "@phosphor-icons/react";
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

type SoundType = "rain" | "brown" | "pink" | "white";

interface SoundPreset {
  id: SoundType;
  label: string;
  icon: ComponentType<IconProps>;
  desc: string;
}

const PRESETS: SoundPreset[] = [
  { id: "rain", label: "Gentle Rain", icon: CloudRain, desc: "Soothing natural rainfall" },
  { id: "brown", label: "Deep Brown", icon: Coffee, desc: "Warm cozy low-frequency rumble" },
  { id: "pink", label: "Pink Noise", icon: Flower, desc: "Balanced focus & sleep noise" },
  { id: "white", label: "White Noise", icon: Lightning, desc: "Crisp sound masking & privacy" },
];

export function AmbientSoundWidget({ instance, editMode }: WidgetProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSound, setActiveSound] = useState<SoundType>("rain");
  const [volume, setVolume] = useState(0.4);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        if ("stop" in sourceNodeRef.current) {
          (sourceNodeRef.current as AudioBufferSourceNode).stop();
        }
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignored
      }
      sourceNodeRef.current = null;
    }
  }, []);

  const startAudio = useCallback(
    (type: SoundType, vol: number) => {
      stopAudio();

      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }

        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          void ctx.resume();
        }

        // Master Gain
        if (!gainNodeRef.current) {
          gainNodeRef.current = ctx.createGain();
          gainNodeRef.current.connect(ctx.destination);
        }
        gainNodeRef.current.gain.setValueAtTime(vol, ctx.currentTime);

        const sampleRate = ctx.sampleRate;
        const bufferSize = sampleRate * 5; // 5 seconds looped buffer
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);

        if (type === "white") {
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
        } else if (type === "pink") {
          // Paul Kellet's filtered pink noise algorithm
          let b0 = 0;
          let b1 = 0;
          let b2 = 0;
          let b3 = 0;
          let b4 = 0;
          let b5 = 0;
          let b6 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.969 * b2 + white * 0.153852;
            b3 = 0.8665 * b3 + white * 0.3104856;
            b4 = 0.55 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.016898;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
          }
        } else if (type === "brown" || type === "rain") {
          // Brownian random walk
          let lastOut = 0.0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            const val = (lastOut + 0.02 * white) / 1.02;
            lastOut = val;
            data[i] = val * 3.5; // Compensate for volume drop
          }
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        if (type === "rain") {
          // Bandpass filter for gentle rain acoustics
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(1400, ctx.currentTime);
          filter.Q.setValueAtTime(1.0, ctx.currentTime);

          source.connect(filter);
          filter.connect(gainNodeRef.current);
          sourceNodeRef.current = source;
        } else if (type === "brown") {
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(450, ctx.currentTime);
          source.connect(filter);
          filter.connect(gainNodeRef.current);
          sourceNodeRef.current = source;
        } else {
          source.connect(gainNodeRef.current);
          sourceNodeRef.current = source;
        }

        source.start();
      } catch {
        // AudioContext might be blocked until user gesture
      }
    },
    [stopAudio],
  );

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      startAudio(activeSound, volume);
      setIsPlaying(true);
    }
  };

  const selectSound = (type: SoundType) => {
    setActiveSound(type);
    if (isPlaying) {
      startAudio(type, volume);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(newVol, audioCtxRef.current.currentTime);
    }
  };

  useEffect(() => {
    return () => {
      stopAudio();
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
    };
  }, [stopAudio]);

  const activePreset = PRESETS.find((p) => p.id === activeSound);

  return (
    <WidgetShell instance={instance} editMode={editMode} title="Ambient Sound">
      <div className="flex flex-col justify-between p-1.5 select-none min-block-full">
        {/* Header */}
        <div className="flex items-center justify-between border-be border-line/40 pbe-1 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-fg">
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
            <span>Ambient Sound</span>
          </div>

          <span className="font-mono text-[10px] text-fg-muted">100% Offline Synth</span>
        </div>

        {/* Sound Selection Grid */}
        <div className="my-1 grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => {
            const isSelected = activeSound === p.id;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectSound(p.id)}
                className={`
                  flex cursor-pointer items-center gap-2 rounded-lg border p-2
                  text-start transition-all
                  ${
                    isSelected
                      ? "border-accent-500 bg-accent-500/10 text-fg shadow-xs"
                      : `
                      border-line/40 bg-surface/50 text-fg-muted
                      hover:bg-surface-raised
                    `
                  }
                `}
              >
                <Icon className="shrink-0 block-4 inline-4" weight="duotone" />
                <div className="flex-1 min-inline-0">
                  <div className="truncate text-xs/tight font-semibold">{p.label}</div>
                  <div className="truncate text-[9px] leading-tight text-fg-muted/80">{p.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Playback & Volume Control Bar */}
        <div className="flex items-center justify-between gap-3 border-bs border-line/40 pbs-1">
          {/* Main Play / Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className={`
              flex cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs
              font-semibold shadow-sm transition-all block-8
              active:scale-95
              ${
                isPlaying
                  ? `
                  bg-accent-500 text-white
                  hover:bg-accent-600
                `
                  : `
                  border border-line bg-surface-raised text-fg
                  hover:bg-surface-raised/80
                `
              }
            `}
          >
            {isPlaying ? (
              <>
                <Pause className="block-3.5 inline-3.5" weight="fill" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="block-3.5 inline-3.5" weight="fill" />
                <span>Play {activePreset?.label}</span>
              </>
            )}
          </button>

          {/* Volume Slider */}
          <div className="flex flex-1 items-center gap-1.5 max-inline-[120px]">
            <SpeakerLow className="shrink-0 text-fg-muted block-3 inline-3" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="cursor-pointer accent-accent-500 block-1.5 inline-full"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
            <SpeakerHigh className="shrink-0 text-fg-muted block-3 inline-3" />
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

const ambientSoundModule: WidgetModule = {
  manifest,
  component: AmbientSoundWidget,
  defaultSettings: {},
  defaultState: {},
};

export default ambientSoundModule;
