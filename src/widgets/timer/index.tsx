import { useState, useEffect, useRef, useCallback } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { timerSchedule, timerCancel } from "../../core/ipc";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

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

export function TimerWidget({ instance, editMode, patchState }: WidgetProps) {
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

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      onToggleEditMode={() => {}}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      headerSlot={
        mode === "pomodoro" ? (
          <span className="text-[10px] font-medium tracking-wide text-fg-muted uppercase">
            {phase} • {cycle}/{cyclesBeforeLong}
          </span>
        ) : undefined
      }
    >
      <div className="flex h-full flex-col justify-between select-none">
        {/* Mode Selector */}
        <div className="flex rounded-md border border-line bg-surface-raised p-0.5 text-xs">
          {(["pomodoro", "countdown", "stopwatch"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleSwitchMode(m)}
              className={`flex-1 rounded py-1 text-center font-medium capitalize transition-colors ${
                mode === m ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Time Display */}
        <div className="my-auto flex flex-col items-center justify-center">
          <div className="font-mono text-3xl font-bold tracking-wider text-fg tabular-nums">
            {display.main}
          </div>
          {mode === "pomodoro" && (
            <div className="mt-1 text-xs text-fg-muted capitalize">
              {phase === "work" ? "Focus" : phase === "break" ? "Short Break" : "Long Break"}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {status === "running" ? (
            <button
              type="button"
              onClick={handlePause}
              className="flex-1 rounded-md border border-line bg-surface-raised py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              className="text-white flex-1 rounded-md bg-accent-500 py-1.5 text-xs font-medium transition-colors hover:bg-accent-600"
            >
              {status === "paused" ? "Resume" : "Start"}
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            disabled={status === "idle" && (state.accumulatedMs || 0) === 0}
            className="rounded-md border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg disabled:opacity-40"
          >
            Reset
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
