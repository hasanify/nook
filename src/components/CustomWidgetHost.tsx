/* oxlint-disable react/iframe-missing-sandbox */
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { generateBridgeScript } from "@/core/custom-widget-bridge";
import { getCustomWidgetContent, openContextMenu, setBounds } from "@/core/ipc";
import type { Manifest, Rect, WidgetProps } from "@/core/types";

import { EditOverlay } from "./EditOverlay";

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

function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
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

  // Sync bounds for moving and resizing in Edit Mode
  const [isInteracting, setIsInteracting] = useState(false);
  const [prevInstanceRect, setPrevInstanceRect] = useState(instance.rect);
  const [localBounds, setLocalBounds] = useState<Rect>(instance.rect);

  if (!isInteracting && !rectsEqual(prevInstanceRect, instance.rect)) {
    setPrevInstanceRect(instance.rect);
    setLocalBounds(instance.rect);
  }

  const inFlightRef = useRef(false);
  const queuedBoundsRef = useRef<{ bounds: Rect; commit: boolean } | null>(null);

  const sendBounds = useCallback(
    (bounds: Rect, commit: boolean) => {
      const prevCommit = queuedBoundsRef.current?.commit ?? false;
      queuedBoundsRef.current = { bounds, commit: commit || prevCommit };
      if (inFlightRef.current) return;

      const flush = async () => {
        while (queuedBoundsRef.current) {
          const next = queuedBoundsRef.current;
          queuedBoundsRef.current = null;
          inFlightRef.current = true;
          try {
            await setBounds(
              instance.id,
              next.bounds.x,
              next.bounds.y,
              next.bounds.w,
              next.bounds.h,
              next.commit,
            );
          } catch {
            // Silently catch IPC errors during bounds updates
          } finally {
            inFlightRef.current = false;
          }
        }
      };

      void flush();
    },
    [instance.id],
  );

  const handleBoundsChange = (bounds: Rect, commit: boolean) => {
    setIsInteracting(!commit);
    if (commit) {
      setLocalBounds(bounds);
      setPrevInstanceRect(bounds);
    }
    sendBounds(bounds, commit);
  };

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

  const handleResetToDefault = () => {
    if (!manifest.defaultSize) return;
    handleBoundsChange(
      { ...localBounds, w: manifest.defaultSize.w, h: manifest.defaultSize.h },
      true,
    );
  };

  const handleResetToFit = () => {
    const targetW = manifest.minSize?.w ?? 160;
    const targetH = manifest.minSize?.h ?? 100;
    handleBoundsChange({ ...localBounds, w: targetW, h: targetH }, true);
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

  // Capture initial snapshot once on mount so srcDoc does not recompute on subsequent
  // settings, theme, or editMode changes, preventing iframe reload thrashing.
  const [initialSnapshot] = useState(() => ({
    theme: getSystemTheme(),
    editMode,
    settings: instance.settings ?? {},
    state: instance.state ?? {},
    manifest,
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
    });
    return combineHtmlWithBridge(rawHtml, script);
  }, [rawHtml, instance.id, initialSnapshot]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void openContextMenu(instance.id, e.screenX, e.screenY);
  };

  if (loading) {
    return (
      <div
        onContextMenu={handleContextMenu}
        className="flex items-center justify-center rounded-card border border-line bg-surface p-4 text-xs text-fg-muted select-none block-full inline-full"
      >
        Loading custom widget...
      </div>
    );
  }

  if (error || !rawHtml) {
    return (
      <div
        onContextMenu={handleContextMenu}
        className="flex flex-col items-center justify-center rounded-card border border-error bg-surface p-4 text-center text-xs text-error select-none block-full inline-full"
      >
        <span className="mbe-1 font-semibold">Failed to load custom widget</span>
        <span className="text-fg-muted">{error || "No content found"}</span>
      </div>
    );
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`relative flex flex-col overflow-hidden select-none block-full inline-full ${
        editMode ? "rounded-card border-accent-500/80! ring-2 ring-accent-500/80 ring-inset" : ""
      }`}
      style={{ background: "transparent" }}
    >
      {editMode && (
        <EditOverlay
          id={instance.id}
          title={manifest.name || widgetKind}
          kind={widgetKind}
          editMode={editMode}
          resizable={manifest.resizable ?? true}
          minSize={manifest.minSize ?? { w: 160, h: 100 }}
          defaultSize={manifest.defaultSize}
          currentBounds={localBounds}
          onBoundsChange={handleBoundsChange}
          onToggleEditMode={onToggleEditMode ?? (() => {})}
          onContextMenu={handleContextMenu}
          onResetToDefault={manifest.defaultSize ? handleResetToDefault : undefined}
          onResetToFit={handleResetToFit}
        />
      )}

      {/* oxlint-disable react/iframe-missing-sandbox */}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
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
    </div>
  );
}

export default CustomWidgetHost;
