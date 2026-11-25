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
import { getCustomWidgetContent } from "@/core/ipc";
import type { WidgetProps } from "@/core/types";

function combineHtmlWithBridge(rawHtml: string, bridgeScript: string): string {
  const scriptTag = `<script id="nook-bridge">${bridgeScript}</script>`;
  if (/<\/head>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/head>/i, `${scriptTag}\n</head>`);
  }
  if (/<body[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<body[^>]*>/i, `$&${scriptTag}\n`);
  }
  if (/<html[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<html[^>]*>/i, `$&<head>${scriptTag}</head>\n`);
  }
  return `<head>${scriptTag}</head>\n${rawHtml}`;
}

function getSystemTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ||
    document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
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

  // Memoize combined HTML and bridge script
  const srcDoc = useMemo(() => {
    if (!rawHtml) return "";
    const script = generateBridgeScript({
      instanceId: instance.id,
      manifest: (instance as unknown as { manifest?: unknown }).manifest ?? {
        id: widgetKind,
        name: widgetKind,
      },
      theme,
      editMode,
      settings: instance.settings ?? {},
      state: instance.state ?? {},
    });
    return combineHtmlWithBridge(rawHtml, script);
  }, [rawHtml, instance, widgetKind, theme, editMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-card border border-line bg-surface p-4 text-xs text-fg-muted select-none block-full inline-full">
        Loading custom widget...
      </div>
    );
  }

  if (error || !rawHtml) {
    return (
      <div className="flex flex-col items-center justify-center rounded-card border border-error bg-surface p-4 text-center text-xs text-error select-none block-full inline-full">
        <span className="mbe-1 font-semibold">Failed to load custom widget</span>
        <span className="text-fg-muted">{error || "No content found"}</span>
      </div>
    );
  }

  return (
    /* oxlint-disable react/iframe-missing-sandbox */
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
      srcDoc={srcDoc}
      className="block border-0 bg-transparent block-full inline-full"
      title={widgetKind || "Custom Widget"}
    />
  );
}

export default CustomWidgetHost;
