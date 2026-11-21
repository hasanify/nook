import { useState, useMemo } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

interface HabitItem {
  id: string;
  title: string;
  completedDays: string[]; // "YYYY-MM-DD"
}

const DEFAULT_HABITS: HabitItem[] = [
  { id: "1", title: "Drink 2L Water", completedDays: [] },
  { id: "2", title: "Read 15 mins", completedDays: [] },
  { id: "3", title: "Daily Walk / Move", completedDays: [] },
];

function getISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateStreak(completedDays: string[], todayDate: Date): number {
  if (!completedDays || completedDays.length === 0) return 0;
  const set = new Set(completedDays);

  const today = new Date(todayDate);
  today.setHours(0, 0, 0, 0);
  const todayStr = getISODate(today);

  let current = new Date(today);
  let streak = 0;

  // If today is checked, start from today. If not, check if yesterday was completed to keep streak alive
  if (set.has(todayStr)) {
    streak = 1;
    current.setDate(current.getDate() - 1);
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (!set.has(getISODate(yesterday))) {
      return 0;
    }
    current = yesterday;
  }

  while (set.has(getISODate(current))) {
    streak++;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

function generateDaysWindow(todayDate: Date) {
  const list = [];
  const today = new Date(todayDate);
  today.setHours(0, 0, 0, 0);
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = getISODate(d);
    list.push({
      iso,
      label: dayNames[d.getDay()],
      dayNum: d.getDate(),
      isToday: i === 0,
    });
  }
  return list;
}

export function HabitsWidget({ instance, editMode, patchState }: WidgetProps) {
  const [today] = useState(() => new Date());
  const initialHabits = useMemo(() => {
    const raw = instance.state.habits;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as HabitItem[];
    }
    return DEFAULT_HABITS;
  }, [instance.state.habits]);

  const [habits, setHabits] = useState<HabitItem[]>(initialHabits);
  const [newTitle, setNewTitle] = useState("");
  const [showInput, setShowInput] = useState(false);

  // Generate the last 7 days window (oldest to newest)
  const daysWindow = useMemo(() => generateDaysWindow(today), [today]);

  const toggleDay = (habitId: string, dateIso: string) => {
    const next = habits.map((h) => {
      if (h.id !== habitId) return h;
      const set = new Set(h.completedDays);
      if (set.has(dateIso)) {
        set.delete(dateIso);
      } else {
        set.add(dateIso);
      }
      return {
        ...h,
        completedDays: Array.from(set),
      };
    });
    setHabits(next);
    patchState({ habits: next });
  };

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const item: HabitItem = {
      id: Date.now().toString(),
      title: trimmed,
      completedDays: [],
    };
    const next = [...habits, item];
    setHabits(next);
    patchState({ habits: next });
    setNewTitle("");
    setShowInput(false);
  };

  const handleDelete = (id: string) => {
    const next = habits.filter((h) => h.id !== id);
    setHabits(next);
    patchState({ habits: next });
  };

  return (
    <WidgetShell instance={instance} editMode={editMode} title="Habits Tracker">
      <div className="flex min-h-full flex-col justify-between p-1.5 select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/40 pb-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-fg">
            <span>⚡</span>
            <span>Habits</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInput((v) => !v)}
              className="cursor-pointer text-[11px] font-medium text-accent-500 transition-colors hover:text-accent-400"
            >
              {showInput ? "Cancel" : "+ Habit"}
            </button>
          </div>
        </div>

        {/* Add input if active */}
        {showInput && (
          <div className="my-1.5 flex gap-1.5">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setShowInput(false);
              }}
              placeholder="e.g. Meditate 10 mins"
              className="flex-1 rounded-lg border border-line bg-surface-raised/60 px-2 py-1 text-xs text-fg placeholder:text-fg-muted/60 focus:border-accent-500 focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAdd}
              className="cursor-pointer rounded-lg bg-accent-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent-600"
            >
              Add
            </button>
          </div>
        )}

        {/* Table / List */}
        <div className="my-1.5 space-y-2 pr-0.5">
          {habits.length === 0 ? (
            <div className="py-6 text-center text-xs text-fg-muted">
              No habits tracked yet. Click + Habit to start!
            </div>
          ) : (
            habits.map((habit) => {
              const streak = calculateStreak(habit.completedDays, today);
              const completedSet = new Set(habit.completedDays);

              return (
                <div
                  key={habit.id}
                  className="group rounded-lg border border-line/40 bg-surface/50 p-2 transition-colors hover:bg-surface-raised/40"
                >
                  {/* Top row: Title & Streak & Delete */}
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="truncate text-xs font-semibold text-fg">{habit.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-500/15 text-amber-400 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                        🔥 {streak}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(habit.id)}
                        title="Delete habit"
                        className="cursor-pointer text-xs text-fg-muted/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-error"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* 7-day checkboxes */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {daysWindow.map((day) => {
                      const checked = completedSet.has(day.iso);
                      return (
                        <button
                          key={day.iso}
                          type="button"
                          onClick={() => toggleDay(habit.id, day.iso)}
                          className={`flex cursor-pointer flex-col items-center justify-center rounded py-1 transition-all ${
                            checked
                              ? "bg-accent-500 font-bold text-white shadow-sm"
                              : day.isToday
                                ? "border border-accent-500/50 bg-surface-raised text-fg"
                                : "bg-surface-raised/40 text-fg-muted hover:bg-surface-raised"
                          }`}
                        >
                          <span className="text-[9px] tracking-wider uppercase">{day.label}</span>
                          <span className="mt-0.5 font-mono text-[10px] leading-none">
                            {day.dayNum}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[10px] text-fg-muted">
          <span>{habits.length} habits active</span>
          <span>7-Day Rolling Streak</span>
        </div>
      </div>
    </WidgetShell>
  );
}

const habitsModule: WidgetModule = {
  manifest,
  component: HabitsWidget,
  defaultSettings: {},
  defaultState: {
    habits: DEFAULT_HABITS,
  },
};

export default habitsModule;
