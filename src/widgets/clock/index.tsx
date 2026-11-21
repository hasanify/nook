import { useEffect, useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

export function ClockWidget({ instance, editMode }: WidgetProps) {
  const [time, setTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const format = String(instance.settings.format ?? "12h");
  const showSeconds = instance.settings.showSeconds !== false;
  const showDate = instance.settings.showDate !== false;
  const showDayProgress = instance.settings.showDayProgress !== false;

  const hours24 = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const is12h = format === "12h";
  const hours = is12h ? hours24 % 12 || 12 : hours24;
  const ampm = is12h ? (hours24 >= 12 ? "PM" : "AM") : "";

  const pad = (n: number) => n.toString().padStart(2, "0");

  const dayOfWeek = time.toLocaleDateString(undefined, { weekday: "long" });
  const fullDate = time.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Calculate day progress percentage
  const totalSecondsToday = hours24 * 3600 + minutes * 60 + seconds;
  const dayProgressPercent = Math.min(100, Math.max(0, (totalSecondsToday / 86400) * 100));

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
      footer={
        showDayProgress ? (
          <div className="flex flex-col gap-1 inline-full">
            <div className="flex justify-between text-[10px] text-fg-muted">
              <span>Day progress</span>
              <span className="font-mono">{dayProgressPercent.toFixed(0)}%</span>
            </div>
            <div className="overflow-hidden rounded-full bg-surface-raised block-1.5 inline-full">
              <div
                className="rounded-full bg-accent-500 transition-all duration-500 block-full"
                style={{ width: `${dayProgressPercent}%` }}
              />
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center justify-center p-2 select-none min-block-full">
        {/* Main Clock Display */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-baseline gap-1 font-mono tracking-tight text-fg">
            <span className="text-4xl font-bold tracking-tight">
              {pad(hours)}:{pad(minutes)}
            </span>
            {showSeconds && (
              <span className="text-xl font-medium text-fg-muted">:{pad(seconds)}</span>
            )}
            {is12h && (
              <span className="ms-1 text-xs font-semibold tracking-wider text-accent-500">
                {ampm}
              </span>
            )}
          </div>

          {showDate && (
            <div className="mbs-2 flex items-center gap-1.5 text-xs text-fg-muted">
              <span className="font-semibold text-fg/90">{dayOfWeek}</span>
              <span>•</span>
              <span>{fullDate}</span>
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: ClockWidget,
  defaultSettings: {
    format: "12h",
    showSeconds: true,
    showDate: true,
    showDayProgress: true,
  },
  defaultState: {},
};

export default module;
