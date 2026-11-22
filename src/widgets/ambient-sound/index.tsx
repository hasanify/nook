import {
  BellRingingIcon,
  CloudRainIcon,
  CoffeeIcon,
  DropIcon,
  FlameIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  SparkleIcon,
  SpeakerHighIcon,
  SpeakerLowIcon,
  TimerIcon,
  WavesIcon,
} from "@phosphor-icons/react";
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

type SoundType = "zen" | "rain" | "ocean" | "bowl" | "night" | "brown" | "fire" | "stream";
type AtmosphereLayer = "none" | "chimes" | "alpha" | "drops";
type TimerMinutes = 0 | 15 | 30 | 45 | 60;
type ViewMode = "sounds" | "breathe";

interface SoundPreset {
  id: SoundType;
  label: string;
  icon: ComponentType<{ className?: string; weight?: "regular" | "bold" | "fill" | "duotone" }>;
  desc: string;
}

const PRESETS: SoundPreset[] = [
  { id: "zen", label: "Zen Harmonic", icon: SparkleIcon, desc: "Peaceful 432Hz ambient chord" },
  { id: "rain", label: "Gentle Rain", icon: CloudRainIcon, desc: "Soft drops & quiet distance" },
  { id: "ocean", label: "Calm Ocean", icon: WavesIcon, desc: "Slow hypnotic surf wash" },
  {
    id: "bowl",
    label: "Singing Bowl",
    icon: BellRingingIcon,
    desc: "Bronze bell chime & long sustain",
  },
  { id: "night", label: "Summer Night", icon: MoonIcon, desc: "Peaceful stereo crickets & breeze" },
  { id: "brown", label: "Velvet Brown", icon: CoffeeIcon, desc: "Whisper-quiet cozy deep warmth" },
  { id: "fire", label: "Quiet Hearth", icon: FlameIcon, desc: "Warm fireplace with soft pops" },
  { id: "stream", label: "Mountain Brook", icon: DropIcon, desc: "Serene fresh water trickles" },
];

const LAYERS: { id: AtmosphereLayer; label: string }[] = [
  { id: "none", label: "None" },
  { id: "chimes", label: "+ Chimes" },
  { id: "alpha", label: "+ 10Hz Alpha" },
  { id: "drops", label: "+ Soft Drops" },
];

const TIMERS: { minutes: TimerMinutes; label: string }[] = [
  { minutes: 0, label: "Off" },
  { minutes: 15, label: "15m" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
  { minutes: 60, label: "60m" },
];

// Helper: Soft filtered pink noise
function generateSoftPink(channel: Float32Array, len: number, scale = 0.05) {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + white * 0.05;
    b1 = 0.985 * b1 + white * 0.08;
    b2 = 0.95 * b2 + white * 0.12;
    channel[i] = (b0 + b1 + b2) * scale;
  }
  // Low-pass smoothing filter (remove any harsh sibilance)
  for (let i = 1; i < len; i++) {
    const prev = channel[i - 1] ?? 0;
    const curr = channel[i] ?? 0;
    channel[i] = prev * 0.6 + curr * 0.4;
  }
}

// Generate organic, soothing stereo AudioBuffers
function generateAudioBuffer(ctx: AudioContext, type: SoundType): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const durationSec = 6;
  const len = sampleRate * durationSec;
  const buffer = ctx.createBuffer(2, len, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (type === "zen") {
    // Zen Harmonic: Pure peaceful ambient pad (D major chord tuned to A=432Hz)
    // Harmonics: D2 (72.2Hz), A2 (108.3Hz), D3 (144.5Hz), F#3 (182Hz), A3 (216.5Hz)
    const freqs = [72.2, 108.3, 144.5, 182.0, 216.5];
    const amps = [0.035, 0.025, 0.022, 0.015, 0.012];

    for (let i = 0; i < len; i++) {
      const breath = 0.8 + 0.2 * Math.sin((2 * Math.PI * i) / len);
      let sampleL = 0;
      let sampleR = 0;

      for (let f = 0; f < freqs.length; f++) {
        const freq = freqs[f] ?? 100;
        const amp = amps[f] ?? 0.01;
        // Detune by 0.25Hz between ears for lush spatial stereo width
        sampleL += Math.sin((2 * Math.PI * freq * i) / sampleRate) * amp;
        sampleR += Math.sin((2 * Math.PI * (freq + 0.25) * i) / sampleRate) * amp;
      }

      left[i] = sampleL * breath;
      right[i] = sampleR * breath;
    }
  } else if (type === "bowl") {
    // Tibetan Singing Bowl: Bronze bell strike at 216Hz with 432Hz harmonic & slow shimmering decay
    const f0 = 216.0;
    const f1 = 432.4;
    const f2 = 648.8;

    for (let i = 0; i < len; i++) {
      // Strike at 0s and 3.5s
      const t1 = (i / sampleRate) % 3.5;
      const env = Math.exp(-t1 / 1.8);
      const shimmer = 0.85 + 0.15 * Math.sin(2 * Math.PI * 2.2 * t1);

      const toneL =
        (Math.sin(2 * Math.PI * f0 * t1) * 0.05 +
          Math.sin(2 * Math.PI * f1 * t1) * 0.025 +
          Math.sin(2 * Math.PI * f2 * t1) * 0.01) *
        env *
        shimmer;

      const toneR =
        (Math.sin(2 * Math.PI * (f0 + 0.3) * t1) * 0.05 +
          Math.sin(2 * Math.PI * (f1 + 0.5) * t1) * 0.025 +
          Math.sin(2 * Math.PI * (f2 + 0.7) * t1) * 0.01) *
        env *
        shimmer;

      left[i] = toneL;
      right[i] = toneR;
    }
  } else if (type === "rain") {
    // Gentle Rain: Quiet low-passed patter with delicate individual soft droplets
    generateSoftPink(left, len, 0.028);
    generateSoftPink(right, len, 0.028);

    // Add quiet droplets
    let dropIdx = Math.floor(Math.random() * 2000) + 1000;
    while (dropIdx < len - 400) {
      const isLeft = Math.random() > 0.5;
      const target = isLeft ? left : right;
      const dropFreq = 1600 + Math.random() * 800;
      const dropDuration = 120 + Math.random() * 100;
      for (let d = 0; d < dropDuration && dropIdx + d < len; d++) {
        const env = Math.exp(-d / 28);
        const prev = target[dropIdx + d] ?? 0;
        target[dropIdx + d] =
          prev + Math.sin((2 * Math.PI * dropFreq * d) / sampleRate) * env * 0.025;
      }
      dropIdx += Math.floor(Math.random() * 4000) + 2000;
    }
  } else if (type === "ocean") {
    // Calm Ocean Surf: Smooth, deep low-pass swells without harsh static
    generateSoftPink(left, len, 0.04);
    generateSoftPink(right, len, 0.04);

    for (let i = 0; i < len; i++) {
      const phase = (i / len) * Math.PI * 2;
      // Gentle swell cycle (period = 6s)
      const swellL = Math.pow(Math.sin(phase) * 0.5 + 0.5, 2.8);
      const swellR = Math.pow(Math.sin(phase + 0.25) * 0.5 + 0.5, 2.8);
      const currL = left[i] ?? 0;
      const currR = right[i] ?? 0;
      left[i] = currL * (0.15 + swellL * 0.85);
      right[i] = currR * (0.15 + swellR * 0.85);
    }
  } else if (type === "night") {
    // Summer Night: Soft nocturnal breeze + delicate distant stereo crickets
    generateSoftPink(left, len, 0.012);
    generateSoftPink(right, len, 0.012);

    // Chirp bursts every ~1.5s
    const chirpFreq = 4400;
    for (let chirpStart = 8000; chirpStart < len - 2000; chirpStart += 32000) {
      const target = chirpStart % 64000 === 0 ? left : right;
      // 3 pulses per chirp
      for (let p = 0; p < 3; p++) {
        const offset = chirpStart + p * 1200;
        for (let d = 0; d < 500 && offset + d < len; d++) {
          const env = Math.sin((Math.PI * d) / 500);
          const prev = target[offset + d] ?? 0;
          target[offset + d] =
            prev + Math.sin((2 * Math.PI * chirpFreq * d) / sampleRate) * env * 0.018;
        }
      }
    }
  } else if (type === "brown") {
    // Velvet Brown: Extremely warm, low-frequency rumble, ultra quiet (< 180Hz)
    let lastL = 0;
    let lastR = 0;
    for (let i = 0; i < len; i++) {
      lastL = (lastL + 0.015 * (Math.random() * 2 - 1)) / 1.02;
      lastR = (lastR + 0.015 * (Math.random() * 2 - 1)) / 1.02;
      left[i] = lastL * 0.08;
      right[i] = lastR * 0.08;
    }
    // Heavy lowpass filtering for pillow-soft warmth
    for (let i = 1; i < len; i++) {
      const prevL = left[i - 1] ?? 0;
      const currL = left[i] ?? 0;
      const prevR = right[i - 1] ?? 0;
      const currR = right[i] ?? 0;
      left[i] = prevL * 0.8 + currL * 0.2;
      right[i] = prevR * 0.8 + currR * 0.2;
    }
  } else if (type === "fire") {
    // Quiet Hearth: Soft warm log bed + rare, gentle crackle pops
    let lastL = 0;
    let lastR = 0;
    for (let i = 0; i < len; i++) {
      lastL = (lastL + 0.012 * (Math.random() * 2 - 1)) / 1.025;
      lastR = (lastR + 0.012 * (Math.random() * 2 - 1)) / 1.025;
      left[i] = lastL * 0.05;
      right[i] = lastR * 0.05;

      // Rare soft crackle
      if (Math.random() < 0.00035 && i < len - 120) {
        const target = Math.random() > 0.5 ? left : right;
        const popDur = 40 + Math.floor(Math.random() * 80);
        const popFreq = 1400 + Math.random() * 1200;
        for (let p = 0; p < popDur; p++) {
          const env = Math.exp(-p / 12);
          const prev = target[i + p] ?? 0;
          target[i + p] = prev + Math.sin((2 * Math.PI * popFreq * p) / sampleRate) * env * 0.035;
        }
        i += popDur;
      }
    }
  } else if (type === "stream") {
    // Mountain Brook: Serene water trickling over river stones
    generateSoftPink(left, len, 0.022);
    generateSoftPink(right, len, 0.022);
    for (let i = 0; i < len; i++) {
      const bubble = 0.8 + 0.2 * Math.sin((12 * Math.PI * i) / len);
      left[i] = (left[i] ?? 0) * bubble;
      right[i] = (right[i] ?? 0) * bubble;
    }
  }

  return buffer;
}

// Generate atmosphere layer buffer
function generateLayerBuffer(ctx: AudioContext, layer: AtmosphereLayer): AudioBuffer | null {
  if (layer === "none") return null;
  const sampleRate = ctx.sampleRate;
  const len = sampleRate * 4;
  const buffer = ctx.createBuffer(2, len, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (layer === "chimes") {
    // Gentle wind chime strike
    const freqs = [528.0, 792.0, 1056.0];
    const f0 = freqs[0] ?? 528.0;
    const f1 = freqs[1] ?? 792.0;
    const f2 = freqs[2] ?? 1056.0;

    for (let i = 0; i < len; i++) {
      const t = (i / sampleRate) % 4;
      const env = Math.exp(-t / 1.2);
      const chimeL =
        (Math.sin(2 * Math.PI * f0 * t) + Math.sin(2 * Math.PI * f1 * t) * 0.5) * env * 0.025;
      const chimeR =
        (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t) * 0.5) * env * 0.025;
      left[i] = chimeL;
      right[i] = chimeR;
    }
  } else if (layer === "alpha") {
    // 10Hz Alpha tone drone (Left 196Hz, Right 206Hz)
    for (let i = 0; i < len; i++) {
      left[i] = Math.sin((2 * Math.PI * 196 * i) / sampleRate) * 0.03;
      right[i] = Math.sin((2 * Math.PI * 206 * i) / sampleRate) * 0.03;
    }
  } else if (layer === "drops") {
    generateSoftPink(left, len, 0.015);
    generateSoftPink(right, len, 0.015);
  }

  return buffer;
}

// Compute filter frequency based on tone (0-100) -> (350Hz - 4500Hz)
function getFilterCutoff(t: number): number {
  return Math.round(350 + (t / 100) * 4150);
}

export function AmbientSoundWidget({ instance, editMode }: WidgetProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSound, setActiveSound] = useState<SoundType>("zen");
  const [activeLayer, setActiveLayer] = useState<AtmosphereLayer>("none");
  const [volume, setVolume] = useState(0.3);
  const [tone, setTone] = useState(40); // 0 (Warm/Mellow) to 100 (Bright)
  const [showToneSlider, setShowToneSlider] = useState(false);
  const [timerPreset, setTimerPreset] = useState<TimerMinutes>(0);
  const [timerRemainingSec, setTimerRemainingSec] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("sounds");

  // Box Breathing cycle state: 0-3 (Inhale), 4-7 (Hold), 8-11 (Exhale), 12-15 (Rest)
  const [breatheSeconds, setBreatheSeconds] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const toneFilterRef = useRef<BiquadFilterNode | null>(null);
  const mainSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const layerSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const layerGainRef = useRef<GainNode | null>(null);

  // Stop current audio sources cleanly with smooth fade-out
  const stopAudio = useCallback((instant = false) => {
    if (masterGainRef.current && audioCtxRef.current && !instant) {
      const ctx = audioCtxRef.current;
      masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime);
      masterGainRef.current.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    }

    setTimeout(
      () => {
        if (mainSourceRef.current) {
          try {
            mainSourceRef.current.stop();
            mainSourceRef.current.disconnect();
          } catch {
            // Ignored
          }
          mainSourceRef.current = null;
        }

        if (layerSourceRef.current) {
          try {
            layerSourceRef.current.stop();
            layerSourceRef.current.disconnect();
          } catch {
            // Ignored
          }
          layerSourceRef.current = null;
        }
      },
      instant ? 0 : 160,
    );
  }, []);

  const startAudio = useCallback(
    (sound: SoundType, layer: AtmosphereLayer, vol: number, toneVal: number) => {
      stopAudio(true);

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
        if (!masterGainRef.current) {
          masterGainRef.current = ctx.createGain();
          masterGainRef.current.connect(ctx.destination);
        }
        masterGainRef.current.gain.setValueAtTime(0.0001, ctx.currentTime);
        masterGainRef.current.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.25);

        // Master Tone Filter (Warm lowpass filter)
        if (!toneFilterRef.current) {
          toneFilterRef.current = ctx.createBiquadFilter();
          toneFilterRef.current.type = "lowpass";
          toneFilterRef.current.connect(masterGainRef.current);
        }
        toneFilterRef.current.frequency.setValueAtTime(getFilterCutoff(toneVal), ctx.currentTime);

        // 1. Main Sound Buffer
        const mainBuffer = generateAudioBuffer(ctx, sound);
        const mainSource = ctx.createBufferSource();
        mainSource.buffer = mainBuffer;
        mainSource.loop = true;
        mainSource.connect(toneFilterRef.current);
        mainSource.start();
        mainSourceRef.current = mainSource;

        // 2. Optional Atmosphere Layer Buffer
        const layerBuffer = generateLayerBuffer(ctx, layer);
        if (layerBuffer) {
          if (!layerGainRef.current) {
            layerGainRef.current = ctx.createGain();
            layerGainRef.current.connect(toneFilterRef.current);
          }
          layerGainRef.current.gain.setValueAtTime(0.4, ctx.currentTime);

          const layerSource = ctx.createBufferSource();
          layerSource.buffer = layerBuffer;
          layerSource.loop = true;
          layerSource.connect(layerGainRef.current);
          layerSource.start();
          layerSourceRef.current = layerSource;
        }
      } catch {
        // AudioContext could be blocked until user gesture
      }
    },
    [stopAudio],
  );

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      startAudio(activeSound, activeLayer, volume, tone);
      setIsPlaying(true);
    }
  };

  const handleSelectSound = (sound: SoundType) => {
    setActiveSound(sound);
    if (isPlaying) {
      startAudio(sound, activeLayer, volume, tone);
    }
  };

  const handleSelectLayer = (layer: AtmosphereLayer) => {
    setActiveLayer(layer);
    if (isPlaying) {
      startAudio(activeSound, layer, volume, tone);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(newVol, audioCtxRef.current.currentTime);
    }
  };

  const handleToneChange = (newTone: number) => {
    setTone(newTone);
    if (toneFilterRef.current && audioCtxRef.current) {
      toneFilterRef.current.frequency.setValueAtTime(
        getFilterCutoff(newTone),
        audioCtxRef.current.currentTime,
      );
    }
  };

  // Timer selection
  const handleSelectTimer = (minutes: TimerMinutes) => {
    setTimerPreset(minutes);
    if (minutes === 0) {
      setTimerRemainingSec(null);
    } else {
      setTimerRemainingSec(minutes * 60);
      if (!isPlaying) {
        startAudio(activeSound, activeLayer, volume, tone);
        setIsPlaying(true);
      }
    }
  };

  // Sleep Timer countdown and auto fade-out
  useEffect(() => {
    if (!isPlaying || timerRemainingSec === null) return;

    const interval = setInterval(() => {
      setTimerRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          stopAudio();
          setIsPlaying(false);
          setTimerPreset(0);
          return null;
        }

        // Auto fade-out in final 10 seconds
        if (prev === 10 && masterGainRef.current && audioCtxRef.current) {
          const ctx = audioCtxRef.current;
          masterGainRef.current.gain.setValueAtTime(
            masterGainRef.current.gain.value,
            ctx.currentTime,
          );
          masterGainRef.current.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 9.5);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, timerRemainingSec, stopAudio]);

  // Box Breathing cycle animation counter (16s cycle: 4s Inhale, 4s Hold, 4s Exhale, 4s Rest)
  useEffect(() => {
    if (viewMode !== "breathe") return;
    const interval = setInterval(() => {
      setBreatheSeconds((prev) => (prev + 1) % 16);
    }, 1000);
    return () => clearInterval(interval);
  }, [viewMode]);

  useEffect(() => {
    return () => {
      stopAudio(true);
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
    };
  }, [stopAudio]);

  const activePreset = PRESETS.find((p) => p.id === activeSound);

  // Format timer MM:SS
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Breathing phase calculation
  const getBreathePhase = (sec: number) => {
    const cycle = sec % 16;
    if (cycle < 4) {
      return { step: "Inhale", countdown: 4 - cycle, prompt: "Inhale gently through nose..." };
    }
    if (cycle < 8) {
      return { step: "Hold", countdown: 8 - cycle, prompt: "Hold breath comfortably..." };
    }
    if (cycle < 12) {
      return { step: "Exhale", countdown: 12 - cycle, prompt: "Exhale softly through mouth..." };
    }
    return { step: "Rest", countdown: 16 - cycle, prompt: "Rest and pause..." };
  };

  const breathePhase = getBreathePhase(breatheSeconds);
  const isBreatheExpanding = breatheSeconds < 4;
  const isBreatheContracting = breatheSeconds >= 8 && breatheSeconds < 12;

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title="Ambient Sound"
      footer={
        <div className="flex flex-col gap-1.5 inline-full">
          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-2.5">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className={`
                flex cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs
                font-medium shadow-2xs transition-all block-7
                active:scale-95
                ${
                  isPlaying
                    ? "bg-accent-500 text-white hover:bg-accent-600"
                    : "border border-line/70 bg-surface-raised/80 text-fg hover:border-line hover:bg-surface-raised"
                }
              `}
            >
              {isPlaying ? (
                <>
                  <PauseIcon className="block-3 inline-3" weight="fill" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <PlayIcon className="block-3 inline-3" weight="fill" />
                  <span>Play {activePreset?.label}</span>
                </>
              )}
            </button>

            {/* Volume Control */}
            <div className="flex flex-1 items-center gap-1.5 max-inline-28">
              <SpeakerLowIcon className="shrink-0 text-fg-muted block-3 inline-3" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="cursor-pointer accent-accent-500 block-1.5 inline-full"
                title={`Volume: ${Math.round(volume * 100)}%`}
                aria-label="Master volume"
              />
              <SpeakerHighIcon className="shrink-0 text-fg-muted block-3 inline-3" />
            </div>

            {/* Tone Toggle */}
            <button
              type="button"
              onClick={() => setShowToneSlider((prev) => !prev)}
              title="Acoustic Warmth & Filter"
              className={`
                cursor-pointer rounded-md border p-1.5 transition-colors
                ${
                  showToneSlider
                    ? "border-accent-500/50 bg-accent-500/15 text-accent-400"
                    : "border-line/60 bg-surface-raised/60 text-fg-muted hover:text-fg"
                }
              `}
            >
              <SlidersHorizontalIcon className="block-3.5 inline-3.5" />
            </button>
          </div>

          {/* Collapsible Tone Slider */}
          {showToneSlider && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-line/40 bg-surface/50 px-2 py-1 text-3xs">
              <span className="font-medium text-fg-muted">Tone:</span>
              <span className="text-fg-muted">Mellow</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={tone}
                onChange={(e) => handleToneChange(parseInt(e.target.value, 10))}
                className="cursor-pointer accent-accent-500 inline-full"
                aria-label="Tone warmth"
              />
              <span className="text-fg-muted">Bright</span>
            </div>
          )}

          {/* Sleep / Focus Timer Segmented Control */}
          <div className="flex items-center justify-between gap-1 border-bs border-line/40 pbs-1.5 text-3xs">
            <div className="flex items-center gap-1 text-fg-muted">
              <TimerIcon className="block-3 inline-3" />
              <span>Timer</span>
            </div>

            <div className="flex rounded-md border border-line/50 bg-surface p-0.5">
              {TIMERS.map((t) => (
                <button
                  key={t.minutes}
                  type="button"
                  onClick={() => handleSelectTimer(t.minutes)}
                  className={`
                    cursor-pointer rounded-sm px-1.5 py-0.5 font-medium transition-all
                    ${
                      timerPreset === t.minutes
                        ? "border border-line/60 bg-surface-raised font-semibold text-fg shadow-2xs"
                        : "text-fg-muted hover:text-fg"
                    }
                  `}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {timerRemainingSec !== null && (
              <span className="inline-flex items-center gap-1 rounded-sm border border-accent-500/30 bg-accent-500/10 px-1 py-0.5 font-mono text-3xs font-medium text-accent-400">
                {formatTimer(timerRemainingSec)}
              </span>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col justify-between p-1.5 select-none min-block-full">
        {/* Header with View Toggle (Sounds / Breathe) */}
        <div className="flex items-center justify-between border-be border-line/40 pbe-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-fg">
            <SpeakerHighIcon
              className={`block-3.5 inline-3.5 ${isPlaying ? "text-accent-500" : "text-fg-muted"}`}
            />
            <span>Ambient Sound</span>
          </div>

          {/* Desktop Mode Switch Segmented Control */}
          <div className="flex rounded-md border border-line/50 bg-surface p-0.5 text-2xs">
            <button
              type="button"
              onClick={() => setViewMode("sounds")}
              className={`
                cursor-pointer rounded-sm px-2 py-0.5 font-medium transition-all
                ${
                  viewMode === "sounds"
                    ? "border border-line/60 bg-surface-raised font-semibold text-fg shadow-2xs"
                    : "text-fg-muted hover:text-fg"
                }
              `}
            >
              Sounds
            </button>
            <button
              type="button"
              onClick={() => setViewMode("breathe")}
              className={`
                cursor-pointer rounded-sm px-2 py-0.5 font-medium transition-all
                ${
                  viewMode === "breathe"
                    ? "border border-line/60 bg-surface-raised font-semibold text-fg shadow-2xs"
                    : "text-fg-muted hover:text-fg"
                }
              `}
            >
              Breathe
            </button>
          </div>
        </div>

        {/* View Mode: Sounds */}
        {viewMode === "sounds" ? (
          <div className="my-1 flex flex-col gap-2">
            {/* Sound Presets 4x2 Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => {
                const isSelected = activeSound === p.id;
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectSound(p.id)}
                    className={`
                      flex cursor-pointer items-center gap-2 rounded-md border p-1.5
                      text-start transition-all
                      active:scale-95
                      ${
                        isSelected
                          ? "border-accent-500/70 bg-accent-500/10 text-fg shadow-2xs"
                          : "border-line/50 bg-surface/60 text-fg-muted hover:border-line hover:bg-surface-raised/70 hover:text-fg"
                      }
                    `}
                  >
                    <Icon
                      className={`shrink-0 block-4 inline-4 ${isSelected ? "text-accent-400" : "text-fg-muted"}`}
                      weight="duotone"
                    />
                    <div className="flex-1 min-inline-0">
                      <div className="truncate text-2xs font-semibold">{p.label}</div>
                      <div className="truncate text-3xs text-fg-muted/80">{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Atmosphere Layer Selector (Mixer) */}
            <div className="flex items-center justify-between gap-1.5 rounded-md border border-line/40 bg-surface/40 p-1.5 text-2xs">
              <span className="font-medium text-fg-muted">Layer:</span>
              <div className="flex gap-1">
                {LAYERS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleSelectLayer(l.id)}
                    className={`
                      cursor-pointer rounded-sm px-1.5 py-0.5 text-3xs font-medium transition-all
                      ${
                        activeLayer === l.id
                          ? "border border-line/60 bg-surface-raised font-semibold text-fg shadow-2xs"
                          : "text-fg-muted hover:bg-surface-raised/40 hover:text-fg"
                      }
                    `}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* View Mode: Box Breathing Guide */
          <div className="my-2 flex flex-col items-center justify-center gap-2 py-2">
            <div className="relative flex items-center justify-center block-20 inline-20">
              {/* Outer guide ring */}
              <div
                className={`
                  absolute rounded-full border border-accent-500/30 transition-all duration-1000
                  block-20 inline-20
                  ${isBreatheExpanding ? "scale-100 opacity-80" : isBreatheContracting ? "scale-75 opacity-40" : "scale-90 opacity-60"}
                `}
              />
              {/* Inner animated orb */}
              <div
                className={`
                  flex items-center justify-center rounded-full bg-accent-500/20 text-accent-400
                  shadow-inner transition-all duration-1000 block-14 inline-14
                  ${isBreatheExpanding ? "scale-100 bg-accent-500/30" : isBreatheContracting ? "scale-65 bg-accent-500/10" : "scale-80"}
                `}
              >
                <span className="font-mono text-sm font-bold">{breathePhase.countdown}s</span>
              </div>
            </div>

            {/* Step text & Guidance */}
            <div className="flex flex-col items-center text-center">
              <span className="text-xs font-semibold text-fg">{breathePhase.step}</span>
              <span className="text-3xs text-fg-muted">{breathePhase.prompt}</span>
            </div>
          </div>
        )}
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
