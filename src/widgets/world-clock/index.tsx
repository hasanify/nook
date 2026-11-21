import { Globe, Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

interface CityTimezone {
  id: string;
  name: string;
  zone: string;
  flag: string;
}

const DEFAULT_CITIES: CityTimezone[] = [
  { id: "nyc", name: "New York", zone: "America/New_York", flag: "🇺🇸" },
  { id: "lon", name: "London", zone: "Europe/London", flag: "🇬🇧" },
  { id: "tok", name: "Tokyo", zone: "Asia/Tokyo", flag: "🇯🇵" },
  { id: "sf", name: "San Francisco", zone: "America/Los_Angeles", flag: "🇺🇸" },
  { id: "utc", name: "UTC", zone: "UTC", flag: "🌐" },
];

function getTimeInZone(
  date: Date,
  timeZone: string,
  is24h: boolean,
  showSeconds: boolean,
): {
  timeStr: string;
  period: string;
  isDay: boolean;
  offsetHours: number;
  dayDiff: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: !is24h,
      hour: "numeric",
      minute: "2-digit",
      second: showSeconds ? "2-digit" : undefined,
    });

    const parts = formatter.formatToParts(date);
    let hour = 0;
    let minute = "00";
    let second = "00";
    let period = "";

    for (const p of parts) {
      if (p.type === "hour") hour = parseInt(p.value, 10);
      if (p.type === "minute") minute = p.value;
      if (p.type === "second") second = p.value;
      if (p.type === "dayPeriod") period = p.value;
    }

    // 24h hour for day/night logic
    const hour24Formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hour: "numeric",
    });
    const hour24 = parseInt(hour24Formatter.format(date), 10);
    const isDay = hour24 >= 6 && hour24 < 18;

    // Calculate offset relative to local time
    // Local date string in target timezone vs local timezone
    const targetDateStr = date.toLocaleString("en-US", { timeZone });
    const targetDate = new Date(targetDateStr);
    const localDateStr = date.toLocaleString("en-US");
    const localDate = new Date(localDateStr);
    const diffHours = Math.round((targetDate.getTime() - localDate.getTime()) / 3600000);

    // Calculate day diff
    const targetDay = targetDate.getDate();
    const localDay = localDate.getDate();
    let dayDiff = "Today";
    if (targetDay > localDay || (localDay >= 28 && targetDay === 1)) {
      dayDiff = "Tomorrow";
    } else if (targetDay < localDay || (targetDay >= 28 && localDay === 1)) {
      dayDiff = "Yesterday";
    }

    const timeStr = showSeconds
      ? `${hour.toString().padStart(2, "0")}:${minute}:${second}`
      : `${hour.toString().padStart(2, "0")}:${minute}`;

    const offsetHours = Math.round(diffHours);

    return {
      timeStr,
      period,
      isDay,
      offsetHours,
      dayDiff,
    };
  } catch {
    return {
      timeStr: "--:--",
      period: "",
      isDay: true,
      offsetHours: 0,
      dayDiff: "Today",
    };
  }
}

export function WorldClockWidget({ instance, editMode }: WidgetProps) {
  const [now, setNow] = useState(() => new Date());

  const is24h = instance.settings.timeFormat === "24h";
  const showSeconds = Boolean(instance.settings.showSeconds);

  useEffect(() => {
    const timer = setInterval(
      () => {
        setNow(new Date());
      },
      showSeconds ? 1000 : 10000,
    );
    return () => clearInterval(timer);
  }, [showSeconds]);

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title="World Clock"
      footer={
        <div className="flex items-center justify-between inline-full">
          <span>{DEFAULT_CITIES.length} timezones active</span>
          <span className="flex items-center gap-1">
            <Sun className="text-amber-500 block-2.5 inline-2.5" weight="fill" /> Day /{" "}
            <Moon className="text-indigo-400 block-2.5 inline-2.5" weight="fill" /> Night
          </span>
        </div>
      }
    >
      <div className="flex flex-col justify-between p-1.5 select-none min-block-full">
        {/* Header */}
        <div className="flex items-center justify-between border-be border-line/40 pbe-1 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-fg">
            <Globe className="text-accent-500 block-3.5 inline-3.5" />
            World Clocks
          </div>
          <span className="font-mono text-[10px] text-fg-muted">
            {is24h ? "24H Mode" : "12H Mode"}
          </span>
        </div>

        {/* City rows */}
        <div className="my-1.5 space-y-1.5 pe-0.5">
          {DEFAULT_CITIES.map((city) => {
            const { timeStr, period, isDay, offsetHours, dayDiff } = getTimeInZone(
              now,
              city.zone,
              is24h,
              showSeconds,
            );

            return (
              <div
                key={city.id}
                className="
                  flex items-center justify-between rounded-lg border
                  border-line/40 bg-surface/50 px-2.5 py-1.5 transition-colors
                  hover:bg-surface-raised
                "
              >
                {/* Left: Flag, City, Offset */}
                <div className="flex items-center gap-2">
                  <span className="flex items-center text-sm">
                    {city.flag === "🌐" ? (
                      <Globe className="text-fg-muted block-4 inline-4" />
                    ) : (
                      city.flag
                    )}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-fg">{city.name}</span>
                      {isDay ? (
                        <Sun className="text-amber-500 block-3 inline-3" weight="fill" />
                      ) : (
                        <Moon className="text-indigo-400 block-3 inline-3" weight="fill" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-fg-muted">
                      <span>{dayDiff}</span>
                      <span>•</span>
                      <span>
                        {offsetHours === 0
                          ? "Same"
                          : offsetHours > 0
                            ? `+${offsetHours}h`
                            : `${offsetHours}h`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Time */}
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-sm font-bold tracking-tight text-fg">
                    {timeStr}
                  </span>
                  {period && (
                    <span className="text-[10px] font-medium text-fg-muted uppercase">
                      {period}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetShell>
  );
}

const worldClockModule: WidgetModule = {
  manifest,
  component: WorldClockWidget,
  defaultSettings: {
    timeFormat: "12h",
    showSeconds: false,
  },
  defaultState: {},
};

export default worldClockModule;
