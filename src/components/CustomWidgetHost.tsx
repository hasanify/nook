/* oxlint-disable react/iframe-missing-sandbox */
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useRef, useState } from "react";

import { generateBridgeScript } from "@/core/custom-widget-bridge";
import { getCustomWidgetContent, openContextMenu } from "@/core/ipc";
import { getPresetAppearance } from "@/core/presets";
import type { Manifest, WidgetProps } from "@/core/types";
import { useTheme } from "@/core/use-theme";

import { WidgetShell } from "./WidgetShell";

function combineHtmlWithBridge(rawHtml: string, bridgeScript: string): string {
  const scriptTag = `<script id="nook-bridge">${bridgeScript}</script>`;
  if (/<\/head>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/head>/i, () => `${scriptTag}\n</head>`);
  }
  if (/<body[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<body[^>]*>/i, (match) => `${match}${scriptTag}\n`);
  }
  if (/<html[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<html[^>]*>/i, (match) => `${match}<head>${scriptTag}</head>\n`);
  }
  return `<head>${scriptTag}</head>\n${rawHtml}`;
}

function getSystemTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  if (
    document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark"
  ) {
    return "dark";
  }
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function CustomWidgetHost({
  instance,
  editMode,
  onToggleEditMode,
  patchState,
  patchSettings: _patchSettings,
}: WidgetProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetKind = instance.kind || instance.type || "";

  const [fetchState, setFetchState] = useState<{
    kind: string;
    html: string | null;
    error: string | null;
    done: boolean;
  }>({
    kind: "",
    html: null,
    error: null,
    done: false,
  });

  const [theme, setTheme] = useState<"dark" | "light">(getSystemTheme);
  const { preset: globalPresetId } = useTheme();
  const [appearanceTick, setAppearanceTick] = useState(0);

  // Sync with appearance custom preset broadcasts
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("nook-appearance");
    const handleMessage = () => {
      setAppearanceTick((t) => t + 1);
    };
    channel.addEventListener("message", handleMessage);
    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, []);

  const effectivePresetId =
    (typeof instance.settings.widgetPreset === "string" && instance.settings.widgetPreset) ||
    globalPresetId;
  const widgetCustomFont =
    typeof instance.settings.widgetFont === "string" ? instance.settings.widgetFont : undefined;

  const { fontFamily, radius } = useMemo(() => {
    return getPresetAppearance(effectivePresetId, widgetCustomFont, appearanceTick);
  }, [effectivePresetId, widgetCustomFont, appearanceTick]);

  // Sync theme changes from root documentElement
  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => {
      setTheme(getSystemTheme());
    };

    updateTheme();
    const observer = new MutationObserver(() => updateTheme());
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const manifest: Manifest = (instance as unknown as { manifest?: Manifest }).manifest ?? {
    id: widgetKind,
    name: widgetKind,
    description: "",
    version: "0.1.0",
    author: "",
    defaultSize: { w: 280, h: 180 },
    minSize: { w: 160, h: 100 },
    resizable: true,
  };

  // Fetch widget HTML content
  useEffect(() => {
    if (!widgetKind) return;
    let active = true;

    getCustomWidgetContent(widgetKind)
      .then((html) => {
        if (!active) return;
        setFetchState({
          kind: widgetKind,
          html: html || null,
          error: html ? null : `Custom widget content for '${widgetKind}' is empty`,
          done: true,
        });
      })
      .catch((err) => {
        if (!active) return;
        setFetchState({
          kind: widgetKind,
          html: null,
          error: err instanceof Error ? err.message : String(err),
          done: true,
        });
      });

    return () => {
      active = false;
    };
  }, [widgetKind]);

  const loading = !widgetKind ? false : fetchState.kind !== widgetKind || !fetchState.done;
  const error = !widgetKind
    ? "No custom widget type specified"
    : fetchState.kind === widgetKind
      ? fetchState.error
      : null;
  const rawHtml = fetchState.kind === widgetKind ? fetchState.html : null;

  // Keep latest refs for message handler
  const instanceRef = useRef(instance);
  const patchStateRef = useRef(patchState);
  const onToggleEditModeRef = useRef(onToggleEditMode);

  useEffect(() => {
    instanceRef.current = instance;
    patchStateRef.current = patchState;
    onToggleEditModeRef.current = onToggleEditMode;
  });

  // Process RPC requests from iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== "object") return;

      const { requestId, payload } = data;
      const actionType: string =
        typeof data.type === "string" && data.type.startsWith("nook:rpc:")
          ? data.type
          : typeof data.action === "string"
            ? `nook:rpc:${data.action}`
            : "";

      if (!actionType.startsWith("nook:rpc:") || actionType === "nook:rpc:response") {
        return;
      }

      const replySuccess = (result: unknown) => {
        if (!iframeRef.current?.contentWindow || !requestId) return;
        iframeRef.current.contentWindow.postMessage(
          {
            type: "nook:rpc:response",
            requestId,
            result,
          },
          "*",
        );
      };

      const replyError = (err: unknown) => {
        if (!iframeRef.current?.contentWindow || !requestId) return;
        iframeRef.current.contentWindow.postMessage(
          {
            type: "nook:rpc:response",
            requestId,
            error: err instanceof Error ? err.message : String(err),
          },
          "*",
        );
      };

      try {
        switch (actionType) {
          case "nook:rpc:context-menu": {
            const p = payload as { screenX?: number; screenY?: number } | undefined;
            void openContextMenu(instanceRef.current.id, p?.screenX, p?.screenY);
            replySuccess(true);
            break;
          }
          case "nook:rpc:get-state": {
            replySuccess(instanceRef.current.state ?? {});
            break;
          }
          case "nook:rpc:set-state": {
            const patch = (
              payload && typeof payload === "object" && "patch" in payload
                ? (payload as { patch: Record<string, unknown> }).patch
                : payload
            ) as Record<string, unknown>;
            patchStateRef.current(patch ?? {});
            replySuccess(true);
            break;
          }
          case "nook:rpc:get-settings": {
            replySuccess(instanceRef.current.settings ?? {});
            break;
          }
          case "nook:rpc:toggle-edit-mode": {
            onToggleEditModeRef.current?.();
            replySuccess(true);
            break;
          }
          case "nook:rpc:get-vitals": {
            const vitals = await invoke("get_system_vitals");
            replySuccess(vitals);
            break;
          }
          case "nook:rpc:get-battery": {
            const battery = await invoke("get_battery_status");
            replySuccess(battery);
            break;
          }
          case "nook:rpc:get-media": {
            const media = await invoke("get_media_status");
            replySuccess(media);
            break;
          }
          case "nook:rpc:media-command": {
            const command =
              payload && typeof payload === "object" && "command" in payload
                ? String((payload as { command: unknown }).command ?? "")
                : typeof payload === "string"
                  ? payload
                  : "";
            await invoke("send_media_command", { action: command, command });
            replySuccess(true);
            break;
          }
          case "nook:rpc:get-ports": {
            const ports = await invoke("get_listening_ports");
            replySuccess(ports);
            break;
          }
          case "nook:rpc:ping": {
            const url =
              payload && typeof payload === "object" && "url" in payload
                ? String((payload as { url: unknown }).url ?? "")
                : typeof payload === "string"
                  ? payload
                  : "";
            const res = await invoke("ping_endpoint", { url });
            replySuccess(res);
            break;
          }
          case "nook:rpc:notify": {
            let title = "Nook Notification";
            let body: string | undefined;

            if (typeof payload === "string") {
              title = payload;
            } else if (payload && typeof payload === "object") {
              const p = payload as { title?: unknown; body?: unknown };
              if (typeof p.title === "string") title = p.title;
              if (typeof p.body === "string") body = p.body;
            }

            const notifOptions = body ? { title, body } : { title };
            const webNotifOptions = body ? { body } : undefined;

            try {
              let granted = await isPermissionGranted();
              if (!granted) {
                const permission = await requestPermission();
                granted = permission === "granted";
              }
              if (granted) {
                await sendNotification(notifOptions);
              } else if (typeof window !== "undefined" && "Notification" in window) {
                if (Notification.permission === "granted") {
                  void new Notification(title, webNotifOptions);
                } else if (Notification.permission !== "denied") {
                  const perm = await Notification.requestPermission();
                  if (perm === "granted") {
                    void new Notification(title, webNotifOptions);
                  }
                }
              }
            } catch {
              if (
                typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "granted"
              ) {
                void new Notification(title, webNotifOptions);
              }
            }
            replySuccess(true);
            break;
          }
          case "nook:rpc:open-url": {
            const url =
              payload && typeof payload === "object" && "url" in payload
                ? String((payload as { url: unknown }).url ?? "")
                : typeof payload === "string"
                  ? payload
                  : "";
            if (!/^(https?|mailto):/i.test(url)) {
              throw new Error(`Invalid or unsafe URL protocol: ${url}`);
            }
            try {
              await openUrl(url);
            } catch {
              if (typeof window !== "undefined") {
                window.open(url, "_blank");
              }
            }
            replySuccess(true);
            break;
          }
          default:
            replyError(`Unknown Nook RPC action: ${actionType}`);
        }
      } catch (err) {
        replyError(err);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Broadcast settings changes to iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: "nook:settings-changed",
        payload: { settings: instance.settings ?? {} },
      },
      "*",
    );
  }, [instance.settings]);

  // Broadcast edit mode changes to iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: "nook:edit-mode-changed",
        payload: { editMode },
      },
      "*",
    );
  }, [editMode]);

  // Broadcast theme changes to iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: "nook:theme-changed",
        payload: { theme },
      },
      "*",
    );
  }, [theme]);

  // Broadcast appearance (font family and corner radius) changes to iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: "nook:appearance-changed",
        payload: { fontFamily, radius },
      },
      "*",
    );
  }, [fontFamily, radius]);

  // Capture initial snapshot once on mount so srcDoc does not recompute on subsequent
  // settings, theme, or editMode changes, preventing iframe reload thrashing.
  const [initialSnapshot] = useState(() => ({
    theme: getSystemTheme(),
    editMode,
    settings: instance.settings ?? {},
    state: instance.state ?? {},
    manifest,
    fontFamily,
    radius,
  }));

  // Memoize combined HTML and bridge script once per widget load / rawHtml change
  const srcDoc = useMemo(() => {
    if (!rawHtml) return "";
    const script = generateBridgeScript({
      instanceId: instance.id,
      manifest: initialSnapshot.manifest,
      theme: initialSnapshot.theme,
      editMode: initialSnapshot.editMode,
      settings: initialSnapshot.settings,
      state: initialSnapshot.state,
      fontFamily: initialSnapshot.fontFamily,
      radius: initialSnapshot.radius,
    });
    return combineHtmlWithBridge(rawHtml, script);
  }, [rawHtml, instance.id, initialSnapshot]);

  if (loading) {
    return (
      <WidgetShell
        instance={instance}
        editMode={editMode}
        onToggleEditMode={onToggleEditMode}
        title={manifest.name || widgetKind}
        resizable={manifest.resizable ?? true}
        minSize={manifest.minSize ?? { w: 160, h: 100 }}
        defaultSize={manifest.defaultSize}
      >
        <div className="flex flex-1 items-center justify-center p-4 text-xs text-fg-muted select-none">
          Loading custom widget...
        </div>
      </WidgetShell>
    );
  }

  if (error || !rawHtml) {
    return (
      <WidgetShell
        instance={instance}
        editMode={editMode}
        onToggleEditMode={onToggleEditMode}
        title={manifest.name || widgetKind}
        resizable={manifest.resizable ?? true}
        minSize={manifest.minSize ?? { w: 160, h: 100 }}
        defaultSize={manifest.defaultSize}
      >
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-xs text-error select-none">
          <span className="mbe-1 font-semibold">Failed to load custom widget</span>
          <span className="text-fg-muted">{error || "No content found"}</span>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      onToggleEditMode={onToggleEditMode}
      title={manifest.name || widgetKind}
      resizable={manifest.resizable ?? true}
      minSize={manifest.minSize ?? { w: 160, h: 100 }}
      defaultSize={manifest.defaultSize}
      contentClass="flex flex-1 flex-col overflow-hidden relative block-full inline-full min-block-0 p-0"
    >
      {/* oxlint-disable react/iframe-missing-sandbox */}
      {srcDoc ? (
        <iframe
          ref={iframeRef}
          allowTransparency={true}
          srcDoc={srcDoc}
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            background: "transparent",
            backgroundColor: "transparent",
            colorScheme: theme === "light" ? "light" : "dark",
            overflow: "hidden",
            display: "block",
            pointerEvents: editMode ? "none" : "auto",
          }}
          className="block border-0 bg-transparent block-full inline-full"
          title={manifest.name || widgetKind || "Custom Widget"}
        />
      ) : null}
    </WidgetShell>
  );
}

export default CustomWidgetHost;
