import { useEffect, useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import { getSystemVitals, type SystemVitals } from "@/core/ipc";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function getStatusColor(percent: number): string {
  if (percent >= 90) return "text-red-400";
  if (percent >= 75) return "text-amber-400";
  return "text-accent-500";
}

function MiniSparkline({ history, colorClass }: { history: number[]; colorClass: string }) {
  if (history.length < 2) {
    return <div className="rounded-sm bg-surface/30 block-6 inline-full" />;
  }
  const max = 100;
  const w = 100;
  const h = 24;
  const points = history
    .map((val, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h - (Math.min(100, Math.max(0, val)) / max) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="overflow-hidden block-6 inline-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={colorClass}
        points={points}
      />
    </svg>
  );
}

export function SystemVitalsWidget({ instance, editMode }: WidgetProps) {
  const [vitals, setVitals] = useState<SystemVitals | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);

  const intervalSec = Math.max(
    1,
    parseInt((instance.settings.refreshInterval as string) || "2", 10),
  );

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const data = await getSystemVitals();
        if (!active) return;
        setVitals(data);
        setCpuHistory((prev) => {
          const next = [...prev, data.cpu_percent];
          return next.length > 20 ? next.slice(-20) : next;
        });
        setRamHistory((prev) => {
          const next = [...prev, data.memory_percent];
          return next.length > 20 ? next.slice(-20) : next;
        });
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

  return (
    <WidgetShell instance={instance} editMode={editMode} title="System Vitals">
      <div className="flex flex-col justify-between p-1.5 select-none min-block-full">
        <div className="flex items-center justify-between border-be border-line/40 pbe-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <span className="relative flex block-2 inline-2">
              <span className="absolute inline-flex animate-ping rounded-full bg-emerald-400 opacity-75 block-full inline-full" />
              <span className="relative inline-flex rounded-full bg-emerald-500 block-2 inline-2" />
            </span>
            System Vitals
          </div>
          <span className="font-mono text-[10px] text-fg-muted">{intervalSec}s poll</span>
        </div>

        <div className="my-1 grid grid-cols-2 gap-2">
          {/* CPU */}
          <div className="flex flex-col justify-between rounded-lg border border-line/40 bg-surface/50 p-2">
            <div className="mbe-1 flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-fg-muted">CPU</span>
              <span
                className={`
                  font-mono font-semibold
                  ${getStatusColor(vitals?.cpu_percent ?? 0)}
                `}
              >
                {vitals ? `${vitals.cpu_percent}%` : "--"}
              </span>
            </div>
            <div className="inline-full">
              <MiniSparkline
                history={cpuHistory.length > 0 ? cpuHistory : [0, 0]}
                colorClass={getStatusColor(vitals?.cpu_percent ?? 0)}
              />
            </div>
          </div>

          {/* RAM */}
          <div className="flex flex-col justify-between rounded-lg border border-line/40 bg-surface/50 p-2">
            <div className="mbe-1 flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-fg-muted">RAM</span>
              <span
                className={`
                  font-mono font-semibold
                  ${getStatusColor(vitals?.memory_percent ?? 0)}
                `}
              >
                {vitals ? `${vitals.memory_percent}%` : "--"}
              </span>
            </div>
            <div className="inline-full">
              <MiniSparkline
                history={ramHistory.length > 0 ? ramHistory : [0, 0]}
                colorClass={getStatusColor(vitals?.memory_percent ?? 0)}
              />
            </div>
          </div>
        </div>

        {/* Detail Bars */}
        <div className="space-y-1.5 text-[11px]">
          {/* RAM Bar */}
          <div>
            <div className="mbe-0.5 flex justify-between text-fg-muted">
              <span>Memory</span>
              <span className="font-mono">
                {vitals
                  ? `${formatBytes(vitals.memory_used_bytes)} / ${formatBytes(vitals.memory_total_bytes)}`
                  : "--"}
              </span>
            </div>
            <div className="overflow-hidden rounded-full border border-line/40 bg-surface-raised block-1.5 inline-full">
              <div
                className="rounded-full transition-all duration-300 block-full"
                style={{
                  width: `${Math.min(100, Math.max(0, vitals?.memory_percent ?? 0))}%`,
                  backgroundColor:
                    vitals && vitals.memory_percent >= 90
                      ? "var(--color-red-400, #f87171)"
                      : vitals && vitals.memory_percent >= 75
                        ? "var(--color-amber-400, #fbbf24)"
                        : "var(--color-accent-500, #38bdf8)",
                }}
              />
            </div>
          </div>

          {/* Disk Bar */}
          <div>
            <div className="mbe-0.5 flex justify-between text-fg-muted">
              <span>Disk (C:)</span>
              <span className="font-mono">
                {vitals
                  ? `${formatBytes(vitals.disk_used_bytes)} / ${formatBytes(vitals.disk_total_bytes)} (${vitals.disk_percent}%)`
                  : "--"}
              </span>
            </div>
            <div className="overflow-hidden rounded-full border border-line/40 bg-surface-raised block-1.5 inline-full">
              <div
                className="rounded-full transition-all duration-300 block-full"
                style={{
                  width: `${Math.min(100, Math.max(0, vitals?.disk_percent ?? 0))}%`,
                  backgroundColor:
                    vitals && vitals.disk_percent >= 90
                      ? "var(--color-red-400, #f87171)"
                      : vitals && vitals.disk_percent >= 80
                        ? "var(--color-amber-400, #fbbf24)"
                        : "var(--color-accent-500, #38bdf8)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

const systemVitalsModule: WidgetModule = {
  manifest,
  component: SystemVitalsWidget,
  defaultSettings: {
    refreshInterval: "2",
  },
  defaultState: {},
};

export default systemVitalsModule;
