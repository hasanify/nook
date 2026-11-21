import { useEffect, useState } from "react";
import { Lightning } from "@phosphor-icons/react";
import { WidgetShell } from "../../components/WidgetShell";
import { getBatteryStatus, type BatteryStatus } from "../../core/ipc";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

function formatRemainingTime(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

function getBatteryColor(percent: number, isCharging: boolean): string {
  if (isCharging) return "text-emerald-400";
  if (percent <= 20) return "text-red-400";
  if (percent <= 40) return "text-amber-400";
  return "text-accent-500";
}

function getBatteryBg(percent: number, isCharging: boolean): string {
  if (isCharging) return "bg-emerald-500";
  if (percent <= 20) return "bg-red-500";
  if (percent <= 40) return "bg-amber-500";
  return "bg-accent-500";
}

export function BatteryMonitorWidget({ instance, editMode }: WidgetProps) {
  const [battery, setBattery] = useState<BatteryStatus | null>(null);

  const intervalSec = Math.max(
    2,
    parseInt((instance.settings.refreshInterval as string) || "5", 10),
  );

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const data = await getBatteryStatus();
        if (!active) return;
        setBattery(data);
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

  const percent = battery?.percent ?? 100;
  const isCharging = battery?.is_charging ?? false;
  const isAcPlugged = battery?.is_ac_plugged ?? true;
  const hasBattery = battery?.has_battery ?? true;
  const timeText = formatRemainingTime(battery?.time_remaining_seconds);

  return (
    <WidgetShell instance={instance} editMode={editMode} title="Battery Monitor">
      <div className="flex min-h-full flex-col justify-between p-1.5 select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/40 pb-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isCharging ? "animate-ping bg-emerald-400" : "bg-accent-400"
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isCharging ? "bg-emerald-500" : "bg-accent-500"
                }`}
              />
            </span>
            Power & Battery
          </div>
          <span className="font-mono text-[10px] text-fg-muted">
            {isAcPlugged ? "AC Connected" : "Battery Mode"}
          </span>
        </div>

        {/* Center Battery Display */}
        <div className="my-auto flex items-center justify-between gap-3 py-1">
          {/* Gauge Graphic */}
          <div className="flex items-center">
            {/* Battery Body */}
            <div className="relative flex h-14 w-28 items-center rounded-xl border-2 border-line/80 bg-surface/50 p-1 shadow-inner">
              {/* Fill */}
              <div
                className={`h-full rounded-lg transition-all duration-500 ${getBatteryBg(
                  percent,
                  isCharging,
                )}`}
                style={{ width: `${Math.max(5, Math.min(100, percent))}%` }}
              />

              {/* Charging Bolt Overlay */}
              {isCharging && (
                <div className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                  <Lightning className="h-6 w-6 animate-pulse" weight="fill" />
                </div>
              )}
            </div>
            {/* Battery Tip */}
            <div className="-ml-[1px] h-5 w-1.5 rounded-r bg-line/80" />
          </div>

          {/* Value and Status */}
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-0.5">
              <span
                className={`font-mono text-2xl font-bold tracking-tight ${getBatteryColor(
                  percent,
                  isCharging,
                )}`}
              >
                {hasBattery ? percent : "100"}
              </span>
              <span className="font-mono text-xs text-fg-muted">%</span>
            </div>

            <span className="text-[11px] font-medium text-fg">
              {!hasBattery
                ? "Desktop (No Battery)"
                : isCharging
                  ? "Charging"
                  : isAcPlugged
                    ? "Full / On AC"
                    : "Discharging"}
            </span>

            {timeText && <span className="font-mono text-[10px] text-fg-muted">{timeText}</span>}
          </div>
        </div>

        {/* Footer info pills */}
        <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[10px] text-fg-muted">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Health: Good</span>
          </div>

          {battery?.battery_saver && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
              Battery Saver
            </span>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const batteryMonitorModule: WidgetModule = {
  manifest,
  component: BatteryMonitorWidget,
  defaultSettings: {
    refreshInterval: "5",
  },
  defaultState: {},
};

export default batteryMonitorModule;
