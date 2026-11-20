import { useEffect, useState, useRef, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

type SoundType = "rain" | "brown" | "pink" | "white";

interface SoundPreset {
  id: SoundType;
  label: string;
  icon: string;
  desc: string;
}

const PRESETS: SoundPreset[] = [
  { id: "rain", label: "Gentle Rain", icon: "🌧️", desc: "Soothing natural rainfall" },
  { id: "brown", label: "Deep Brown", icon: "☕", desc: "Warm cozy low-frequency rumble" },
  { id: "pink", label: "Pink Noise", icon: "🌸", desc: "Balanced focus & sleep noise" },
  { id: "white", label: "White Noise", icon: "⚡", desc: "Crisp sound masking & privacy" },
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
      <div className="flex min-h-full flex-col justify-between p-1.5 select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/40 pb-1 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-fg">
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
            <span>Ambient Sound</span>
          </div>

          <span className="font-mono text-[10px] text-fg-muted">100% Offline Synth</span>
        </div>

        {/* Sound Selection Grid */}
        <div className="my-1 grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => {
            const isSelected = activeSound === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectSound(p.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-left transition-all ${
                  isSelected
                    ? "border-accent-500 bg-accent-500/10 text-fg shadow-xs"
                    : "border-line/40 bg-surface/50 text-fg-muted hover:bg-surface-raised"
                }`}
              >
                <span className="text-base">{p.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs leading-tight font-semibold">{p.label}</div>
                  <div className="truncate text-[9px] leading-tight text-fg-muted/80">{p.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Playback & Volume Control Bar */}
        <div className="flex items-center justify-between gap-3 border-t border-line/40 pt-1">
          {/* Main Play / Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-sm transition-all active:scale-95 ${
              isPlaying
                ? "bg-accent-500 text-white hover:bg-accent-600"
                : "border border-line bg-surface-raised text-fg hover:bg-surface-raised/80"
            }`}
          >
            {isPlaying ? (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                <span>Pause</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Play {activePreset?.label}</span>
              </>
            )}
          </button>

          {/* Volume Slider */}
          <div className="flex max-w-[120px] flex-1 items-center gap-1.5">
            <span className="text-[10px] text-fg-muted">🔈</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-accent-500"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
            <span className="text-[10px] text-fg-muted">🔊</span>
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
