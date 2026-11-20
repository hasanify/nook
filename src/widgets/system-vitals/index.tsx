import { useEffect, useState } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { getSystemVitals, type SystemVitals } from "../../core/ipc";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

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
    return <div className="h-6 w-full rounded bg-surface/30" />;
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
      className="h-6 w-full overflow-hidden"
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
      <div className="flex min-h-full flex-col justify-between p-1.5 select-none">
        <div className="flex items-center justify-between border-b border-line/40 pb-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <span className="relative flex h-2 w-2">
              <span className="bg-emerald-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-emerald-500 relative inline-flex h-2 w-2 rounded-full" />
            </span>
            System Vitals
          </div>
          <span className="font-mono text-[10px] text-fg-muted">{intervalSec}s poll</span>
        </div>

        <div className="my-1 grid grid-cols-2 gap-2">
          {/* CPU */}
          <div className="flex flex-col justify-between rounded-lg border border-line/40 bg-surface/50 p-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-fg-muted">CPU</span>
              <span
                className={`font-mono font-semibold ${getStatusColor(vitals?.cpu_percent ?? 0)}`}
              >
                {vitals ? `${vitals.cpu_percent}%` : "--"}
              </span>
            </div>
            <div className="w-full">
              <MiniSparkline
                history={cpuHistory.length > 0 ? cpuHistory : [0, 0]}
                colorClass={getStatusColor(vitals?.cpu_percent ?? 0)}
              />
            </div>
          </div>

          {/* RAM */}
          <div className="flex flex-col justify-between rounded-lg border border-line/40 bg-surface/50 p-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-fg-muted">RAM</span>
              <span
                className={`font-mono font-semibold ${getStatusColor(vitals?.memory_percent ?? 0)}`}
              >
                {vitals ? `${vitals.memory_percent}%` : "--"}
              </span>
            </div>
            <div className="w-full">
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
            <div className="mb-0.5 flex justify-between text-fg-muted">
              <span>Memory</span>
              <span className="font-mono">
                {vitals
                  ? `${formatBytes(vitals.memory_used_bytes)} / ${formatBytes(vitals.memory_total_bytes)}`
                  : "--"}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-line/40 bg-surface-raised">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, vitals?.memory_percent ?? 0))}%`,
                  backgroundColor:
                    vitals && vitals.memory_percent >= 90
                      ? "rgb(248 113 113)"
                      : vitals && vitals.memory_percent >= 75
                        ? "rgb(251 191 36)"
                        : "var(--color-accent-500, #38bdf8)",
                }}
              />
            </div>
          </div>

          {/* Disk Bar */}
          <div>
            <div className="mb-0.5 flex justify-between text-fg-muted">
              <span>Disk (C:)</span>
              <span className="font-mono">
                {vitals
                  ? `${formatBytes(vitals.disk_used_bytes)} / ${formatBytes(vitals.disk_total_bytes)} (${vitals.disk_percent}%)`
                  : "--"}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-line/40 bg-surface-raised">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, vitals?.disk_percent ?? 0))}%`,
                  backgroundColor:
                    vitals && vitals.disk_percent >= 90
                      ? "rgb(248 113 113)"
                      : vitals && vitals.disk_percent >= 80
                        ? "rgb(251 191 36)"
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
