import { useState, useEffect, useCallback, useMemo } from "react";
import { WidgetShell } from "../../components/WidgetShell";
import { Banner } from "../../components/Banner";
import { getListeningPorts, killPortProcess, type PortInfo } from "../../core/ipc";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest } from "../../core/types";

const manifest = manifestJson as Manifest;

const COMMON_DEV_PORTS = new Set([
  3000, 3001, 3002, 3306, 4000, 4200, 5000, 5001, 5173, 5174, 5432, 6379, 8000, 8080, 8888, 9000,
  9200, 27017,
]);

export function PortSentinelWidget({ instance, editMode, patchState }: WidgetProps) {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ text: string; type: "info" | "warn" | "error" } | null>(
    null,
  );

  const devPortsOnly =
    typeof instance.settings.devPortsOnly === "boolean" ? instance.settings.devPortsOnly : false;
  const refreshIntervalSec = parseInt(
    typeof instance.settings.refreshInterval === "string" ? instance.settings.refreshInterval : "5",
    10,
  );

  const fetchPorts = useCallback(async () => {
    try {
      const list = await getListeningPorts();
      setPorts(list);
      patchState({ lastCount: list.length });
    } catch (err) {
      setBanner({
        text: err instanceof Error ? err.message : String(err),
        type: "warn",
      });
    }
  }, [patchState]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await getListeningPorts();
        if (active) {
          setPorts(list);
          patchState({ lastCount: list.length });
        }
      } catch (err) {
        if (active) {
          setBanner({
            text: err instanceof Error ? err.message : String(err),
            type: "warn",
          });
        }
      }
    };

    void load();

    if (refreshIntervalSec > 0) {
      const interval = setInterval(() => {
        void load();
      }, refreshIntervalSec * 1000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    return () => {
      active = false;
    };
  }, [patchState, refreshIntervalSec]);

  const handleKill = async (portItem: PortInfo) => {
    setKillingPid(portItem.pid);
    try {
      await killPortProcess(portItem.pid);
      setBanner({
        text: `Terminated ${portItem.process_name} (PID ${portItem.pid}) on :${portItem.port}`,
        type: "info",
      });
      await fetchPorts();
    } catch (err) {
      setBanner({
        text: err instanceof Error ? err.message : String(err),
        type: "error",
      });
    } finally {
      setKillingPid(null);
    }
  };

  const filteredPorts = useMemo(() => {
    return ports.filter((p) => {
      if (devPortsOnly && !COMMON_DEV_PORTS.has(p.port)) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.port.toString().includes(q) ||
          p.process_name.toLowerCase().includes(q) ||
          p.pid.toString().includes(q)
        );
      }
      return true;
    });
  }, [ports, devPortsOnly, search]);

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
          className="h-3 w-3 shrink-0 text-accent-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="2" />
          <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
        </svg>
      }
      headerActions={
        <div className="flex items-center gap-1">
          <span className="py-0.2 rounded-full bg-surface-raised px-1.5 font-mono text-[9px] font-bold text-fg-muted">
            {filteredPorts.length}
          </span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchPorts().finally(() => setLoading(false));
            }}
            disabled={loading}
            title="Scan ports"
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
        </div>
      }
      banner={
        banner ? (
          <Banner message={banner.text} type={banner.type} onAction={() => setBanner(null)} />
        ) : undefined
      }
    >
      <div className="flex h-full min-h-0 flex-1 flex-col justify-between gap-1.5 p-1 select-none">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by port or process (e.g. 3000, node)…"
            className="w-full rounded-md border border-line bg-surface-raised/40 px-2 py-1 text-[11px] text-fg placeholder:text-fg-muted/40 focus:border-accent-500 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer text-[10px] text-fg-muted hover:text-fg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Port List */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {filteredPorts.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-xs text-fg-muted">
              {devPortsOnly
                ? "No active dev ports detected"
                : search
                  ? "No matching ports found"
                  : "No listening ports detected"}
            </div>
          ) : (
            filteredPorts.map((p) => {
              const isDev = COMMON_DEV_PORTS.has(p.port);
              const isKilling = killingPid === p.pid;
              return (
                <div
                  key={`${p.port}-${p.pid}`}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface-raised/40 px-2 py-1.5 transition-colors hover:bg-surface-raised"
                >
                  {/* Left: Port & Protocol */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold ${
                        isDev ? "text-accent-500" : "text-fg"
                      }`}
                    >
                      :{p.port}
                    </span>
                    <span className="truncate text-[11px] font-medium text-fg-muted select-text">
                      {p.process_name}
                    </span>
                  </div>

                  {/* Right: PID & Kill Button */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] text-fg-muted/60 select-text">
                      PID {p.pid}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleKill(p)}
                      disabled={isKilling}
                      title={`Terminate ${p.process_name} (PID ${p.pid})`}
                      className="cursor-pointer rounded bg-error/15 px-1.5 py-0.5 text-[9px] font-semibold text-error transition-colors hover:bg-error hover:text-white disabled:opacity-40"
                    >
                      {isKilling ? "…" : "Kill"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/40 pt-1 text-[10px] text-fg-muted">
          <span>{ports.length} total listening</span>
          <span>{devPortsOnly ? "Dev ports filter: ON" : "TCP Radar"}</span>
        </div>
      </div>
    </WidgetShell>
  );
}

const portSentinelModule: WidgetModule = {
  manifest,
  component: PortSentinelWidget,
  defaultSettings: {
    devPortsOnly: false,
    refreshInterval: "5",
  },
  defaultState: {
    lastCount: 0,
  },
};

export default portSentinelModule;
