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

interface VercelProjectMeta {
  domain?: string;
  domains?: string[];
  framework?: string;
  git_repo?: string;
  updated_at?: number;
}

interface VercelData {
  project_id: string;
  meta?: VercelProjectMeta;
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

  const showDomain = instance.settings.showDomain !== false;
  const showFramework = instance.settings.showFramework !== false;

  const { payload, loading, refresh } = useProvider<VercelData>(instance.id);
  const data = payload?.data;

  const handleOpenLink = (url: string) => {
    if (url) {
      const fullUrl = url.startsWith("http") ? url : `https://${url}`;
      void openUrl(fullUrl);
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

  const primaryDomain =
    data?.meta?.domain ||
    (latestDeployment?.url ? latestDeployment.url.replace(/^https?:\/\//, "") : undefined);

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={projectId || manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
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
        {/* Meta Bar: Domain link, framework, git repo */}
        {((showDomain && primaryDomain) ||
          (showFramework && (data?.meta?.framework || data?.meta?.git_repo))) && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line/40 pb-2 text-[11px]">
            {showDomain && primaryDomain && (
              <button
                type="button"
                onClick={() => handleOpenLink(primaryDomain)}
                className="group flex max-w-[200px] items-center gap-1 truncate rounded-md border border-line/60 bg-surface-raised px-1.5 py-0.5 font-medium text-fg-muted transition-colors hover:border-accent-500/50 hover:bg-surface hover:text-accent-500"
                title={`Open ${primaryDomain}`}
              >
                <svg
                  className="h-3 w-3 shrink-0 text-accent-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span className="truncate font-mono text-[10px] text-fg group-hover:text-accent-500">
                  {primaryDomain}
                </span>
              </button>
            )}

            {showFramework && data?.meta?.framework && (
              <span className="rounded border border-line/50 bg-surface px-1.5 py-0.5 font-mono text-[9px] text-fg-muted">
                {data.meta.framework}
              </span>
            )}

            {showFramework && data?.meta?.git_repo && (
              <button
                type="button"
                onClick={() => handleOpenLink(`https://github.com/${data.meta!.git_repo}`)}
                className="group flex max-w-[140px] items-center gap-1 truncate rounded-md border border-line/50 bg-surface-raised px-1.5 py-0.5 font-medium text-fg-muted transition-colors hover:border-accent-500/50 hover:bg-surface hover:text-accent-500"
                title={`GitHub repo: ${data.meta.git_repo}`}
              >
                <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span className="truncate font-mono text-[9px]">{data.meta.git_repo}</span>
              </button>
            )}
          </div>
        )}

        <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
          Deployments
        </span>
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1 pb-2">
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
    showDomain: true,
    showFramework: true,
    pollInterval: 30,
    limit: 5,
  },
  defaultState: {},
};

export default module;
