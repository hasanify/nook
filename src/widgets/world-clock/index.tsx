import { GlobeIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { differenceInCalendarDays, differenceInHours } from "date-fns";
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

const REGION_PRESETS: Record<string, CityTimezone[]> = {
  major: DEFAULT_CITIES,
  americas: [
    { id: "sf", name: "San Francisco", zone: "America/Los_Angeles", flag: "🇺🇸" },
    { id: "chi", name: "Chicago", zone: "America/Chicago", flag: "🇺🇸" },
    { id: "nyc", name: "New York", zone: "America/New_York", flag: "🇺🇸" },
    { id: "sao", name: "São Paulo", zone: "America/Sao_Paulo", flag: "🇧🇷" },
    { id: "utc", name: "UTC", zone: "UTC", flag: "🌐" },
  ],
  emea: [
    { id: "lon", name: "London", zone: "Europe/London", flag: "🇬🇧" },
    { id: "par", name: "Paris", zone: "Europe/Paris", flag: "🇫🇷" },
    { id: "ber", name: "Berlin", zone: "Europe/Berlin", flag: "🇩🇪" },
    { id: "dxb", name: "Dubai", zone: "Asia/Dubai", flag: "🇦🇪" },
    { id: "utc", name: "UTC", zone: "UTC", flag: "🌐" },
  ],
  apac: [
    { id: "mum", name: "Mumbai", zone: "Asia/Kolkata", flag: "🇮🇳" },
    { id: "sin", name: "Singapore", zone: "Asia/Singapore", flag: "🇸🇬" },
    { id: "tok", name: "Tokyo", zone: "Asia/Tokyo", flag: "🇯🇵" },
    { id: "syd", name: "Sydney", zone: "Australia/Sydney", flag: "🇦🇺" },
    { id: "utc", name: "UTC", zone: "UTC", flag: "🌐" },
  ],
};

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

    // Accurate calculation of target local time & day difference
    const targetFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
    const tParts = targetFormatter.formatToParts(date);
    const tMap: Record<string, number> = {};
    for (const p of tParts) {
      if (p.type !== "literal") tMap[p.type] = parseInt(p.value, 10);
    }
    const targetUtc = Date.UTC(
      tMap.year ?? date.getFullYear(),
      (tMap.month ?? 1) - 1,
      tMap.day ?? 1,
      tMap.hour ?? 0,
      tMap.minute ?? 0,
      tMap.second ?? 0,
    );
    const localUtc = Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    );
    const offsetHours = differenceInHours(new Date(targetUtc), new Date(localUtc));

    const targetDayUtc = Date.UTC(
      tMap.year ?? date.getFullYear(),
      (tMap.month ?? 1) - 1,
      tMap.day ?? 1,
    );
    const localDayUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiffDays = differenceInCalendarDays(new Date(targetDayUtc), new Date(localDayUtc));
    const dayDiff = dayDiffDays > 0 ? "Tomorrow" : dayDiffDays < 0 ? "Yesterday" : "Today";

    const timeStr = showSeconds
      ? `${hour.toString().padStart(2, "0")}:${minute}:${second}`
      : `${hour.toString().padStart(2, "0")}:${minute}`;

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

  const region = (instance.settings.region as string) || "major";
  const cities = REGION_PRESETS[region] ?? REGION_PRESETS.major ?? DEFAULT_CITIES;
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
          <span>{cities.length} timezones active</span>
          <span className="flex items-center gap-1">
            <SunIcon className="text-amber-500 block-2.5 inline-2.5" weight="fill" /> Day /{" "}
            <MoonIcon className="text-indigo-400 block-2.5 inline-2.5" weight="fill" /> Night
          </span>
        </div>
      }
    >
      <div className="flex flex-col justify-between p-1.5 select-none min-block-full">
        {/* Header */}
        <div className="flex items-center justify-between border-be border-line/40 pbe-1 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-fg">
            <GlobeIcon className="text-accent-500 block-3.5 inline-3.5" />
            World Clocks
          </div>
          <span className="font-mono text-2xs text-fg-muted">
            {is24h ? "24H Mode" : "12H Mode"}
          </span>
        </div>

        {/* City rows */}
        <div className="my-1.5 space-y-1.5 pe-0.5">
          {cities.map((city) => {
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
                      <GlobeIcon className="text-fg-muted block-4 inline-4" />
                    ) : (
                      city.flag
                    )}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-fg">{city.name}</span>
                      {isDay ? (
                        <SunIcon className="text-amber-500 block-3 inline-3" weight="fill" />
                      ) : (
                        <MoonIcon className="text-indigo-400 block-3 inline-3" weight="fill" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-2xs text-fg-muted">
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
                    <span className="text-2xs font-medium text-fg-muted uppercase">{period}</span>
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
    region: "major",
    timeFormat: "12h",
    showSeconds: false,
  },
  defaultState: {},
};

export default worldClockModule;
