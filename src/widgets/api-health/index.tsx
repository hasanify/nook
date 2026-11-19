import { useState, useEffect, useCallback, useMemo } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { pingEndpoint, type PingResult } from "../../core/ipc";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

interface PingRecord {
  status: number;
  latency: number;
  ok: boolean;
  time: number;
}

const DEFAULT_SAMPLE_PINGS: PingRecord[] = [
  { status: 200, latency: 45, ok: true, time: Date.now() - 50000 },
  { status: 200, latency: 42, ok: true, time: Date.now() - 40000 },
  { status: 200, latency: 58, ok: true, time: Date.now() - 30000 },
  { status: 200, latency: 39, ok: true, time: Date.now() - 20000 },
  { status: 200, latency: 44, ok: true, time: Date.now() - 10000 },
  { status: 200, latency: 41, ok: true, time: Date.now() },
];

export function ApiHealthWidget({ instance, editMode, patchState }: WidgetProps) {
  const savedPings = instance.state.pings as PingRecord[] | undefined;

  const [pings, setPings] = useState<PingRecord[]>(savedPings || DEFAULT_SAMPLE_PINGS);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const endpoint =
    typeof instance.settings.endpoint === "string" && instance.settings.endpoint.trim()
      ? instance.settings.endpoint.trim()
      : "https://api.github.com/zen";
  const method =
    typeof instance.settings.method === "string" ? instance.settings.method.toUpperCase() : "GET";
  const intervalSec = parseInt(
    typeof instance.settings.interval === "string" ? instance.settings.interval : "10",
    10,
  );

  const handlePing = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);

    try {
      const res: PingResult = await pingEndpoint(endpoint, method);
      const newRecord: PingRecord = {
        status: res.status,
        latency: res.latency_ms,
        ok: res.ok,
        time: Date.now(),
      };

      setPings((prev) => {
        const next = [...prev.slice(-15), newRecord];
        patchState({ pings: next });
        return next;
      });

      if (!res.ok && res.error) {
        setErrorBanner(res.error);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [endpoint, method, patchState]);

  useEffect(() => {
    let active = true;
    const runPing = async () => {
      try {
        const res: PingResult = await pingEndpoint(endpoint, method);
        if (active) {
          const newRecord: PingRecord = {
            status: res.status,
            latency: res.latency_ms,
            ok: res.ok,
            time: Date.now(),
          };
          setPings((prev) => {
            const next = [...prev.slice(-15), newRecord];
            patchState({ pings: next });
            return next;
          });
          if (!res.ok && res.error) {
            setErrorBanner(res.error);
          }
        }
      } catch (err) {
        if (active) {
          setErrorBanner(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void runPing();

    if (intervalSec > 0) {
      const timer = setInterval(() => {
        void runPing();
      }, intervalSec * 1000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }

    return () => {
      active = false;
    };
  }, [endpoint, method, intervalSec, patchState]);

  const latest = pings[pings.length - 1];
  const isHealthy = latest?.ok ?? true;
  const latestLatency = latest?.latency ?? 0;

  const uptimePercent = useMemo(() => {
    if (pings.length === 0) return 100;
    const oks = pings.filter((p) => p.ok).length;
    return Math.round((oks / pings.length) * 100);
  }, [pings]);

  const maxLatency = useMemo(() => {
    return Math.max(...pings.map((p) => p.latency), 100);
  }, [pings]);

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
      headerSlot={
        <svg
          className={`h-3 w-3 shrink-0 ${isHealthy ? "text-ok" : "text-error"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      }
      headerActions={
        <button
          type="button"
          onClick={() => void handlePing()}
          disabled={loading}
          title="Ping now"
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-raised hover:text-fg disabled:opacity-40"
        >
          <svg
            className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      }
      banner={
        errorBanner ? (
          <Banner message={errorBanner} type="warn" onAction={() => setErrorBanner(null)} />
        ) : undefined
      }
    >
      <div className="flex h-full min-h-0 flex-1 flex-col justify-between gap-1.5 p-1 select-none">
        {/* Endpoint URL Pill */}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[10px] text-fg-muted" title={endpoint}>
            {method} {endpoint.replace(/^https?:\/\//, "")}
          </span>
          <span
            className={`py-0.2 shrink-0 rounded px-1.5 font-mono text-[9px] font-bold ${
              isHealthy ? "bg-ok/15 text-ok" : "bg-error/15 text-error"
            }`}
          >
            {latest?.status ? `${latest.status} ${latest.ok ? "OK" : "ERR"}` : "OFFLINE"}
          </span>
        </div>

        {/* Latency & Uptime Stat Callout */}
        <div className="flex items-baseline justify-between rounded-lg border border-line bg-surface-raised/40 px-3 py-2">
          <div>
            <span className="block font-mono text-[9px] font-semibold text-fg-muted">LATENCY</span>
            <span
              className={`font-mono text-xl font-bold tracking-tight ${
                !isHealthy
                  ? "text-error"
                  : latestLatency < 150
                    ? "text-ok"
                    : latestLatency < 350
                      ? "text-amber-500"
                      : "text-error"
              }`}
            >
              {latestLatency} <span className="text-xs font-normal text-fg-muted">ms</span>
            </span>
          </div>

          <div className="text-right">
            <span className="block font-mono text-[9px] font-semibold text-fg-muted">UPTIME</span>
            <span
              className={`font-mono text-base font-bold ${
                uptimePercent >= 99
                  ? "text-ok"
                  : uptimePercent >= 90
                    ? "text-amber-500"
                    : "text-error"
              }`}
            >
              {uptimePercent}%
            </span>
          </div>
        </div>

        {/* Sparkline History Bars */}
        <div className="flex flex-col gap-1">
          <div className="flex h-9 items-end gap-1 rounded border border-line/40 bg-surface-raised/20 p-1">
            {pings.map((p, idx) => {
              const heightPct = Math.max(15, Math.min(100, (p.latency / maxLatency) * 100));
              return (
                <div
                  key={idx}
                  title={`${p.latency}ms (${p.status})`}
                  className={`flex-1 rounded-xs transition-all duration-300 ${
                    !p.ok ? "bg-error" : p.latency < 150 ? "bg-ok/80" : "bg-amber-500/80"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[10px] text-fg-muted">
          <span>Poll every {intervalSec}s</span>
          <span>HTTP Sentinel</span>
        </div>
      </div>
    </WidgetShell>
  );
}

const apiHealthModule: WidgetModule = {
  manifest,
  component: ApiHealthWidget,
  defaultSettings: {
    endpoint: "https://api.github.com/zen",
    method: "GET",
    interval: "10",
  },
  defaultState: {
    pings: DEFAULT_SAMPLE_PINGS,
  },
};

export default apiHealthModule;
