import { WidgetShell } from "../../components/WidgetShell";
import { StatusDot } from "../../components/StatusDot";
import { Banner } from "../../components/Banner";
import { useProvider } from "../../core/use-provider";
import { openUrl } from "@tauri-apps/plugin-opener";
import manifestJson from "./manifest.json";
import type { WidgetModule, WidgetProps, Manifest, ProviderStatus } from "../../core/types";

const manifest = manifestJson as Manifest;

interface DeploymentItem {
  id: string;
  name: string;
  url: string;
  state: string;
  target?: string;
  created: number;
  commit_msg?: string;
  branch?: string;
}

interface VercelData {
  project_id: string;
  deployments: DeploymentItem[];
}

function formatRelativeTimeMs(createdMs: number): string {
  if (!createdMs) return "";
  const diffMs = Date.now() - createdMs;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function mapVercelState(state: string) {
  switch (state.toUpperCase()) {
    case "READY":
      return "ok" as const;
    case "BUILDING":
    case "INITIALIZING":
    case "QUEUED":
      return "syncing" as const;
    case "ERROR":
      return "error" as const;
    case "CANCELED":
    default:
      return "idle" as const;
  }
}

export function VercelProjectWidget({ instance, editMode }: WidgetProps) {
  const projectId =
    typeof instance.settings.projectId === "string" && instance.settings.projectId
      ? instance.settings.projectId
      : "";

  const { payload, loading, refresh } = useProvider<VercelData>(instance.id);
  const data = payload?.data;

  const handleOpenLink = (url: string) => {
    if (url) {
      void openUrl(url);
    }
  };

  const latestDeployment = data?.deployments?.[0];
  const overallStatus = latestDeployment ? mapVercelState(latestDeployment.state) : "idle";

  const bannerInfo = (() => {
    if (!projectId) {
      return {
        message: "Configure project in Settings",
        type: "info" as const,
      };
    }
    if (!payload) return null;
    if (payload.status === ("bad-token" as ProviderStatus)) {
      return {
        message: payload.message || "Invalid Vercel token",
        type: "warn" as const,
      };
    }
    if (payload.status === ("rate-limited" as ProviderStatus)) {
      return {
        message: payload.message || "Rate limit reached",
        type: "warn" as const,
      };
    }
    if (payload.status === ("not-found" as ProviderStatus)) {
      return {
        message: payload.message || "Project not found",
        type: "error" as const,
      };
    }
    if (payload.status === ("offline" as ProviderStatus)) {
      return {
        message: "Offline — showing cached data",
        type: "warn" as const,
      };
    }
    if (payload.status === ("error" as ProviderStatus)) {
      return {
        message: payload.message || "Error fetching deployments",
        type: "error" as const,
      };
    }
    return null;
  })();

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={projectId || manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      headerSlot={
        <div className="flex items-center gap-1.5">
          <svg className="h-3 w-3 text-fg-muted" viewBox="0 0 76 65" fill="currentColor">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <StatusDot
            status={overallStatus}
            title={`Deployment: ${latestDeployment?.state || "None"}`}
          />
        </div>
      }
      banner={
        bannerInfo ? (
          <Banner
            message={bannerInfo.message}
            type={bannerInfo.type}
            actionText="Refresh"
            onAction={refresh}
          />
        ) : undefined
      }
    >
      <div className="flex h-full flex-col gap-2 overflow-hidden select-none">
        <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
          Deployments
        </span>
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {data?.deployments && data.deployments.length > 0 ? (
            data.deployments.map((dep) => {
              const status = mapVercelState(dep.state);

              return (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => handleOpenLink(dep.url)}
                  className="group flex flex-col rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-surface-raised/80"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <StatusDot status={status} />
                      <span className="truncate font-medium text-fg group-hover:text-accent-500">
                        {dep.name}
                      </span>
                      {dep.target && (
                        <span
                          className={`py-0.2 rounded-full px-1.5 font-mono text-[9px] font-medium uppercase ${
                            dep.target === "production"
                              ? "border border-ok/30 bg-ok/15 text-ok"
                              : "border border-line/60 bg-surface-raised text-fg-muted"
                          }`}
                        >
                          {dep.target}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-fg-muted">
                      {formatRelativeTimeMs(dep.created)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between truncate text-[10px] text-fg-muted">
                    <span className="truncate">
                      {dep.commit_msg || dep.branch || "Manual deploy"}
                    </span>
                    {dep.branch && (
                      <span className="py-0.2 ml-1 shrink-0 rounded bg-surface-raised px-1 font-mono text-accent-500">
                        {dep.branch}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-4 text-center text-xs text-fg-muted italic">
              {loading ? "Loading deployments..." : "No deployments found."}
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: VercelProjectWidget,
  defaultSettings: {
    projectId: "",
  },
  defaultState: {},
};

export default module;
