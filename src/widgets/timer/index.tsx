import {
  ArrowCounterClockwiseIcon,
  MinusIcon,
  NotePencilIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import { timerCancel, timerSchedule } from "@/core/ipc";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

type TimerMode = "countdown" | "pomodoro" | "stopwatch";
type TimerStatus = "idle" | "running" | "paused";
type PomodoroPhase = "work" | "break" | "long";

interface TimerSettings {
  countdownMinutes?: number;
  workMinutes?: number;
  breakMinutes?: number;
  longBreakMinutes?: number;
  cyclesBeforeLong?: number;
  notify?: boolean;
}

interface TimerState {
  mode?: TimerMode;
  status?: TimerStatus;
  endsAt?: number;
  startedAt?: number;
  accumulatedMs?: number;
  phase?: PomodoroPhase;
  cycle?: number;
}

export function TimerWidget({ instance, editMode, patchState, patchSettings }: WidgetProps) {
  const settings = instance.settings as TimerSettings;
  const state = instance.state as TimerState;

  const countdownMinutes = Number(settings.countdownMinutes) || 10;
  const workMinutes = Number(settings.workMinutes) || 25;
  const breakMinutes = Number(settings.breakMinutes) || 5;
  const longBreakMinutes = Number(settings.longBreakMinutes) || 15;
  const cyclesBeforeLong = Number(settings.cyclesBeforeLong) || 4;
  const notify = settings.notify !== false;

  const mode = state.mode || "pomodoro";
  const status = state.status || "idle";
  const phase = state.phase || "work";
  const cycle = state.cycle || 1;

  // Current time state for pure rendering
  const [now, setNow] = useState(() => Date.now());

  // Inline duration editing
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const getCurrentDurationMinutes = useCallback((): number => {
    if (mode === "countdown") return countdownMinutes;
    if (mode === "pomodoro") {
      if (phase === "work") return workMinutes;
      if (phase === "break") return breakMinutes;
      if (phase === "long") return longBreakMinutes;
    }
    return 10;
  }, [mode, phase, countdownMinutes, workMinutes, breakMinutes, longBreakMinutes]);

  const applyDuration = useCallback(
    (mins: number) => {
      const clamped = Math.max(1, Math.min(999, mins));
      if (mode === "countdown") {
        patchSettings({ countdownMinutes: clamped });
      } else if (mode === "pomodoro") {
        if (phase === "work") {
          patchSettings({ workMinutes: clamped });
        } else if (phase === "break") {
          patchSettings({ breakMinutes: clamped });
        } else if (phase === "long") {
          patchSettings({ longBreakMinutes: clamped });
        }
      }
      if (status === "idle") {
        patchState({ accumulatedMs: 0 });
      }
    },
    [mode, phase, status, patchSettings, patchState],
  );

  const adjustDuration = useCallback(
    (delta: number, e?: React.MouseEvent) => {
      const step = e?.shiftKey ? 5 : 1;
      const current = getCurrentDurationMinutes();
      applyDuration(current + delta * step);
    },
    [getCurrentDurationMinutes, applyDuration],
  );

  const handleInlineCommit = useCallback(() => {
    setIsEditing(false);
    const parsed = parseInt(editValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      applyDuration(parsed);
    }
  }, [editValue, applyDuration]);

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleInlineCommit();
  };

  const handleAddMinutes = useCallback(
    (mins: number) => {
      const addMs = mins * 60 * 1000;
      if (status === "running" && state.endsAt) {
        const nextEndsAt = state.endsAt + addMs;
        patchState({ endsAt: nextEndsAt });
        if (notify) {
          const title =
            mode === "pomodoro"
              ? `${phase === "work" ? "Focus Session" : "Break"} Complete!`
              : "Countdown Finished!";
          const body =
            mode === "pomodoro"
              ? phase === "work"
                ? "Great work. Time to take a break!"
                : "Break is over. Ready to focus again?"
              : "Your timer has finished.";
          void timerSchedule(instance.id, nextEndsAt, title, body);
        }
      } else if (status === "paused") {
        const current = getCurrentDurationMinutes();
        applyDuration(current + mins);
      }
    },
    [
      status,
      state.endsAt,
      notify,
      mode,
      phase,
      instance.id,
      patchState,
      getCurrentDurationMinutes,
      applyDuration,
    ],
  );

  const presets =
    mode === "countdown"
      ? [5, 10, 15, 20, 25, 30, 45, 60]
      : phase === "work"
        ? [15, 20, 25, 30, 45, 50]
        : phase === "break"
          ? [3, 5, 10, 15]
          : [10, 15, 20, 30];

  const currentDurationMins = getCurrentDurationMinutes();

  // Active running tick (every 250ms only when running)
  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, [status]);

  // Compute duration for the current mode & phase
  const getTargetDurationMs = useCallback((): number => {
    if (mode === "countdown") {
      return countdownMinutes * 60 * 1000;
    }
    if (mode === "pomodoro") {
      if (phase === "work") return workMinutes * 60 * 1000;
      if (phase === "break") return breakMinutes * 60 * 1000;
      if (phase === "long") return longBreakMinutes * 60 * 1000;
    }
    return 0;
  }, [mode, phase, countdownMinutes, workMinutes, breakMinutes, longBreakMinutes]);

  // Handle completion
  const handleComplete = useCallback(() => {
    void timerCancel(instance.id);

    if (mode === "pomodoro") {
      let nextPhase: PomodoroPhase = "break";
      let nextCycle = cycle;

      if (phase === "work") {
        if (cycle >= cyclesBeforeLong) {
          nextPhase = "long";
          nextCycle = 1;
        } else {
          nextPhase = "break";
        }
      } else {
        nextPhase = "work";
        if (phase === "break") {
          nextCycle = cycle + 1;
        }
      }

      patchState({
        status: "idle",
        endsAt: undefined,
        accumulatedMs: 0,
        phase: nextPhase,
        cycle: nextCycle,
      });
    } else {
      patchState({
        status: "idle",
        endsAt: undefined,
        accumulatedMs: 0,
      });
    }
  }, [instance.id, mode, phase, cycle, cyclesBeforeLong, patchState]);

  // Check if countdown or pomodoro has finished
  const checkCompletionRef = useRef(handleComplete);
  useEffect(() => {
    checkCompletionRef.current = handleComplete;
  }, [handleComplete]);

  useEffect(() => {
    if (status !== "running") return;
    if (mode === "stopwatch") return;

    if (state.endsAt && now >= state.endsAt) {
      checkCompletionRef.current();
    }
  }, [status, mode, state.endsAt, now]);

  // Calculate display time
  const getDisplayTime = (): { main: string; sub?: string } => {
    if (mode === "stopwatch") {
      let elapsed = state.accumulatedMs || 0;
      if (status === "running" && state.startedAt) {
        elapsed += now - state.startedAt;
      }
      const totalSec = Math.floor(elapsed / 1000);
      const ms = Math.floor((elapsed % 1000) / 100);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      return {
        main: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`,
      };
    }

    const totalDuration = getTargetDurationMs();
    let remainingMs = totalDuration;

    if (status === "running" && state.endsAt) {
      remainingMs = Math.max(0, state.endsAt - now);
    } else if (status === "paused") {
      remainingMs = Math.max(0, totalDuration - (state.accumulatedMs || 0));
    }

    const totalSec = Math.ceil(remainingMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;

    return {
      main: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    };
  };

  // User Actions
  const handleStart = () => {
    const startEpoch = Date.now();
    setNow(startEpoch);

    if (mode === "stopwatch") {
      patchState({
        status: "running",
        startedAt: startEpoch,
      });
      return;
    }

    const duration = getTargetDurationMs();
    const alreadyElapsed = state.accumulatedMs || 0;
    const remaining = Math.max(0, duration - alreadyElapsed);
    const endsAt = startEpoch + remaining;

    if (notify) {
      const title =
        mode === "pomodoro"
          ? `${phase === "work" ? "Focus Session" : "Break"} Complete!`
          : "Countdown Finished!";
      const body =
        mode === "pomodoro"
          ? phase === "work"
            ? "Great work. Time to take a break!"
            : "Break is over. Ready to focus again?"
          : `Your ${countdownMinutes}-minute timer has finished.`;

      void timerSchedule(instance.id, endsAt, title, body);
    }

    patchState({
      status: "running",
      endsAt,
    });
  };

  const handlePause = () => {
    const pauseEpoch = Date.now();
    setNow(pauseEpoch);
    void timerCancel(instance.id);

    if (mode === "stopwatch") {
      const addition = state.startedAt ? pauseEpoch - state.startedAt : 0;
      patchState({
        status: "paused",
        accumulatedMs: (state.accumulatedMs || 0) + addition,
        startedAt: undefined,
      });
      return;
    }

    if (state.endsAt) {
      const totalDuration = getTargetDurationMs();
      const remaining = Math.max(0, state.endsAt - pauseEpoch);
      const accumulated = totalDuration - remaining;
      patchState({
        status: "paused",
        accumulatedMs: accumulated,
        endsAt: undefined,
      });
    }
  };

  const handleReset = () => {
    setNow(Date.now());
    void timerCancel(instance.id);
    patchState({
      status: "idle",
      endsAt: undefined,
      startedAt: undefined,
      accumulatedMs: 0,
    });
  };

  const handleSwitchMode = (nextMode: TimerMode) => {
    if (nextMode === mode) return;
    void timerCancel(instance.id);
    patchState({
      mode: nextMode,
      status: "idle",
      endsAt: undefined,
      startedAt: undefined,
      accumulatedMs: 0,
    });
  };

  const display = getDisplayTime();
  const targetDuration = getTargetDurationMs();
  const elapsedMs =
    status === "running" && state.endsAt
      ? Math.max(0, targetDuration - (state.endsAt - now))
      : (state.accumulatedMs ?? 0);
  const progressPercent =
    targetDuration > 0 ? Math.min(100, Math.max(0, (elapsedMs / targetDuration) * 100)) : 0;

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
      headerSlot={
        mode === "pomodoro" ? (
          <span className="font-mono text-3xs font-semibold tracking-wider text-accent-500 uppercase">
            {phase} • {cycle}/{cyclesBeforeLong}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col justify-between select-none min-block-full">
        {/* Mode Selector */}
        <div className="flex rounded-lg border border-line/50 bg-surface-raised/70 p-0.5 text-xs">
          {(["pomodoro", "countdown", "stopwatch"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleSwitchMode(m)}
              className={`
                flex-1 rounded-md py-1 text-center font-medium capitalize
                transition-all
                ${
                  mode === m
                    ? "bg-surface font-semibold text-fg shadow-xs"
                    : `
                    text-fg-muted
                    hover:text-fg
                  `
                }
              `}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Time Display */}
        <div className="my-auto flex flex-col items-center justify-center py-1">
          {mode !== "stopwatch" && status === "idle" ? (
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => adjustDuration(-1, e)}
                  className="
                    flex items-center justify-center rounded-lg border
                    border-line/60 bg-surface-raised/40 text-fg-muted
                    transition-colors block-7 inline-7
                    hover:border-accent-500/60 hover:text-accent-500
                    active:scale-95
                  "
                  title="Decrease 1 min (Shift for 5 min)"
                >
                  <MinusIcon className="block-3 inline-3" weight="bold" />
                </button>

                {isEditing ? (
                  <form onSubmit={handleInlineSubmit} className="flex items-center">
                    <input
                      ref={inputRef}
                      type="number"
                      min="1"
                      max="999"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleInlineCommit}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setIsEditing(false);
                      }}
                      className="
                        rounded-md border border-accent-500 bg-surface px-1.5
                        py-0.5 text-center font-mono text-3xl font-light text-fg
                        outline-none inline-20
                        focus:ring-1 focus:ring-accent-500
                      "
                      autoFocus
                    />
                    <span className="ms-1 font-mono text-xs text-fg-muted">m</span>
                  </form>
                ) : (
                  <div
                    onClick={() => {
                      setEditValue(String(currentDurationMins));
                      setIsEditing(true);
                    }}
                    className="
                      group flex cursor-pointer items-center gap-1 rounded-lg
                      px-2 py-0.5 font-mono text-4xl font-light tracking-tight
                      text-fg tabular-nums transition-colors
                      hover:bg-surface-raised/80
                    "
                    title="Click to type custom duration"
                  >
                    <span>{display.main}</span>
                    <NotePencilIcon
                      className="
                      text-fg-muted opacity-0 transition-opacity block-3
                      inline-3
                      group-hover:opacity-70
                    "
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => adjustDuration(1, e)}
                  className="
                    flex items-center justify-center rounded-lg border
                    border-line/60 bg-surface-raised/40 text-fg-muted
                    transition-colors block-7 inline-7
                    hover:border-accent-500/60 hover:text-accent-500
                    active:scale-95
                  "
                  title="Increase 1 min (Shift for 5 min)"
                >
                  <PlusIcon className="block-3 inline-3" weight="bold" />
                </button>
              </div>

              {mode === "pomodoro" && (
                <div className="mbs-0.5 text-xs text-fg-muted capitalize">
                  {phase === "work"
                    ? "Focus Session"
                    : phase === "break"
                      ? "Short Break"
                      : "Long Break"}
                </div>
              )}

              {/* Preset Pills */}
              <div className="mbs-2 flex flex-wrap items-center justify-center gap-1 max-inline-full">
                {presets.map((preset) => {
                  const isCurrent = preset === currentDurationMins;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyDuration(preset)}
                      className={`
                        rounded-sm px-1.5 py-0.5 font-mono text-2xs
                        transition-colors
                        ${
                          isCurrent
                            ? `border border-accent-500/30 bg-accent-500/20 font-semibold text-accent-500`
                            : `
                            bg-surface-raised/50 text-fg-muted
                            hover:bg-surface-raised hover:text-fg
                          `
                        }
                      `}
                    >
                      {preset}m
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="font-mono text-4xl font-light tracking-tight text-fg tabular-nums">
                {display.main}
              </div>
              {mode === "pomodoro" && (
                <div className="mbs-1 text-xs text-fg-muted capitalize">
                  {phase === "work"
                    ? "Focus Session"
                    : phase === "break"
                      ? "Short Break"
                      : "Long Break"}
                </div>
              )}

              {/* Progress Bar (countdown & pomodoro) */}
              {mode !== "stopwatch" && targetDuration > 0 && (
                <div className="mbs-2.5 overflow-hidden rounded-full bg-surface-raised block-1 inline-32">
                  <div
                    className="bg-accent-500 transition-all duration-300 block-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 pbe-2">
          {status === "running" ? (
            <button
              type="button"
              onClick={handlePause}
              className="
                flex flex-1 items-center justify-center gap-1.5 rounded-lg
                border border-line bg-surface-raised py-1.5 text-xs font-medium
                text-fg transition-colors
                hover:bg-surface
              "
            >
              <PauseIcon className="block-3 inline-3" weight="fill" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              className="
                flex flex-1 items-center justify-center gap-1.5 rounded-lg
                bg-accent-500 py-1.5 text-xs font-medium text-white shadow-xs
                transition-colors
                hover:bg-accent-600
              "
            >
              <PlayIcon className="block-3 inline-3" weight="fill" />
              <span>{status === "paused" ? "Resume" : "Start"}</span>
            </button>
          )}

          {/* Quick extend buttons when running or paused in countdown / pomodoro */}
          {mode !== "stopwatch" && (status === "running" || status === "paused") && (
            <>
              <button
                type="button"
                onClick={() => handleAddMinutes(1)}
                className="
                  flex items-center justify-center rounded-lg border border-line
                  bg-surface-raised px-2 py-1.5 font-mono text-xs font-medium
                  text-fg-muted transition-colors
                  hover:border-accent-500/50 hover:text-fg
                "
                title="Add 1 minute"
              >
                +1m
              </button>
              <button
                type="button"
                onClick={() => handleAddMinutes(5)}
                className="
                  flex items-center justify-center rounded-lg border border-line
                  bg-surface-raised px-2 py-1.5 font-mono text-xs font-medium
                  text-fg-muted transition-colors
                  hover:border-accent-500/50 hover:text-fg
                "
                title="Add 5 minutes"
              >
                +5m
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleReset}
            disabled={status === "idle" && (state.accumulatedMs || 0) === 0}
            className="
              flex items-center justify-center gap-1 rounded-lg border
              border-line bg-surface-raised px-3 py-1.5 text-xs font-medium
              text-fg-muted transition-colors
              hover:text-fg
              disabled:opacity-40
            "
            title="Reset timer"
          >
            <ArrowCounterClockwiseIcon className="block-3 inline-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: TimerWidget,
  defaultSettings: {
    countdownMinutes: 10,
    workMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLong: 4,
    notify: true,
  },
  defaultState: {
    mode: "pomodoro",
    status: "idle",
    phase: "work",
    cycle: 1,
    accumulatedMs: 0,
  },
};

export default module;
