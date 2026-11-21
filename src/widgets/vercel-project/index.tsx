import { ArrowSquareOut, GithubLogo, Globe } from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useMemo } from "react";

import { Banner } from "@/components/Banner";
import { StatusDot } from "@/components/StatusDot";
import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, ProviderStatus, WidgetModule, WidgetProps } from "@/core/types";
import { useProvider } from "@/core/use-provider";

import manifestJson from "./manifest.json";

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
      const fullUrl =
        url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
      openUrl(fullUrl).catch(() => {
        window.open(fullUrl, "_blank");
      });
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

  const primaryDomain = useMemo(() => {
    if (data?.meta?.domain) return data.meta.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const firstDomain = data?.meta?.domains?.[0];
    if (firstDomain) {
      return firstDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
    const prodDep = data?.deployments?.find((d) => d.target === "production");
    if (prodDep?.url) return prodDep.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const firstDepUrl = data?.deployments?.[0]?.url;
    if (firstDepUrl) return firstDepUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return undefined;
  }, [data]);

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={projectId || manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
      headerSlot={
        <StatusDot
          status={overallStatus}
          title={`Deployment: ${latestDeployment?.state || "None"}`}
        />
      }
      headerActions={
        primaryDomain ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLink(primaryDomain);
            }}
            className="
              flex cursor-pointer items-center justify-center rounded-sm
              text-fg-muted transition-colors block-5 inline-5
              hover:bg-surface-raised hover:text-accent-500
            "
            title={`Open https://${primaryDomain}`}
            aria-label={`Open https://${primaryDomain}`}
          >
            <ArrowSquareOut className="block-3 inline-3" />
          </button>
        ) : undefined
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
      <div className="flex flex-col gap-2 select-none min-block-full">
        {/* Primary Deployment Domain Card */}
        {showDomain && primaryDomain && (
          <div
            className="
            flex items-center justify-between rounded-lg border border-line/60
            bg-surface-raised/60 px-2.5 py-1.5 transition-colors
            hover:border-accent-500/40 hover:bg-surface-raised
          "
          >
            <div className="flex items-center gap-2 min-inline-0">
              <div className="flex shrink-0 items-center justify-center rounded-sm bg-accent-500/10 text-accent-500 block-5 inline-5">
                <Globe className="block-3 inline-3" />
              </div>
              <div className="flex flex-col min-inline-0">
                <span className="text-[9px] font-semibold tracking-wider text-fg-muted uppercase">
                  Primary Domain
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenLink(primaryDomain)}
                  className="
                    group flex cursor-pointer items-center gap-1 text-start
                    font-mono text-[11px] font-medium text-fg transition-colors
                    hover:text-accent-500
                  "
                  title={`Open https://${primaryDomain}`}
                >
                  <span className="truncate">{primaryDomain}</span>
                  <ArrowSquareOut
                    className="
                    opacity-60 transition-opacity block-2.5 inline-2.5
                    group-hover:opacity-100
                  "
                  />
                </button>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {showFramework && data?.meta?.framework && (
                <span className="rounded-sm border border-line/50 bg-surface px-1.5 py-0.5 font-mono text-[9px] text-fg-muted">
                  {data.meta.framework}
                </span>
              )}
              {showFramework && data?.meta?.git_repo && (
                <button
                  type="button"
                  onClick={() => handleOpenLink(`https://github.com/${data.meta!.git_repo}`)}
                  className="
                    flex cursor-pointer items-center gap-1 rounded-sm border
                    border-line/50 bg-surface px-1.5 py-0.5 text-fg-muted
                    transition-colors
                    hover:border-accent-500/50 hover:text-accent-500
                  "
                  title={`Open GitHub: ${data.meta.git_repo}`}
                >
                  <GithubLogo className="block-2.5 inline-2.5" weight="fill" />
                </button>
              )}
            </div>
          </div>
        )}

        <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
          Deployments
        </span>
        <div className="flex flex-col gap-1.5 pe-1 pbe-2">
          {data?.deployments && data.deployments.length > 0 ? (
            data.deployments.map((dep) => {
              const status = mapVercelState(dep.state);

              return (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => handleOpenLink(dep.url)}
                  className="
                    group flex cursor-pointer flex-col rounded-lg px-2.5 py-1.5
                    text-start text-xs transition-colors
                    hover:bg-surface-raised/80
                  "
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-inline-0">
                      <StatusDot status={status} />
                      <span
                        className="
                        truncate font-medium text-fg
                        group-hover:text-accent-500
                      "
                      >
                        {dep.name}
                      </span>
                      {dep.target && (
                        <span
                          className={`
                            rounded-full px-1.5 py-0.5 font-mono text-[9px]
                            font-medium uppercase
                            ${
                              dep.target === "production"
                                ? "border border-ok/30 bg-ok/15 text-ok"
                                : `border border-line/60 bg-surface-raised text-fg-muted`
                            }
                          `}
                        >
                          {dep.target}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-fg-muted">
                      {formatRelativeTimeMs(dep.created)}
                    </span>
                  </div>

                  <div className="mbs-1 flex items-center justify-between truncate text-[10px] text-fg-muted">
                    <span className="truncate">
                      {dep.commit_msg || dep.branch || "Manual deploy"}
                    </span>
                    {dep.branch && (
                      <span className="ms-1 shrink-0 rounded-sm bg-surface-raised px-1 py-0.5 font-mono text-accent-500">
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
