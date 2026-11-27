import type { Manifest } from "./types";

export interface BridgeConfig {
  instanceId: string;
  manifest: Manifest;
  theme: "dark" | "light";
  editMode: boolean;
  settings: Record<string, unknown>;
  state: Record<string, unknown>;
  fontFamily?: string;
  radius?: string;
}

export interface NookBridgeApi {
  instanceId: string;
  manifest: Manifest;
  theme: "dark" | "light";
  editMode: boolean;
  settings: Record<string, unknown>;
  state: Record<string, unknown>;
  getState: () => Promise<Record<string, unknown>>;
  setState: (patch: Record<string, unknown>) => Promise<boolean>;
  getSettings: () => Promise<Record<string, unknown>>;
  onSettingsChange: (cb: (settings: Record<string, unknown>) => void) => () => void;
  onThemeChange: (cb: (theme: "dark" | "light") => void) => () => void;
  onEditModeChange: (cb: (editMode: boolean) => void) => () => void;
  toggleEditMode: () => Promise<boolean>;
  system: {
    getVitals: () => Promise<unknown>;
    getBattery: () => Promise<unknown>;
    getMediaStatus: () => Promise<unknown>;
    sendMediaCommand: (command: string) => Promise<boolean>;
    getListeningPorts: () => Promise<unknown>;
    ping: (url: string) => Promise<unknown>;
    notify: (options: { title: string; body?: string } | string) => Promise<boolean>;
    openUrl: (url: string) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    Nook?: NookBridgeApi;
  }
}

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function generateBridgeScript(config: BridgeConfig): string {
  const serializedConfig = safeJsonStringify(config);

  return `(function() {
  if (window.__NOOK_BRIDGE_INITIALIZED__) return;
  window.__NOOK_BRIDGE_INITIALIZED__ = true;

  const config = ${serializedConfig};

  const DARK_TOKENS = {
    "--bg-canvas": "transparent",
    "--bg-surface": "transparent",
    "--bg-elevated": "rgba(255, 255, 255, 0.06)",
    "--fg": "#fafafa",
    "--fg-muted": "#a1a1aa",
    "--fg-subtle": "#71717a",
    "--line": "rgba(255, 255, 255, 0.12)",
    "--accent": "#3b82f6",
    "--error": "#ef4444",
    "--success": "#22c55e"
  };

  const LIGHT_TOKENS = {
    "--bg-canvas": "transparent",
    "--bg-surface": "transparent",
    "--bg-elevated": "rgba(0, 0, 0, 0.04)",
    "--fg": "#09090b",
    "--fg-muted": "#71717a",
    "--fg-subtle": "#a1a1aa",
    "--line": "rgba(0, 0, 0, 0.08)",
    "--accent": "#2563eb",
    "--error": "#dc2626",
    "--success": "#16a34a"
  };

  let currentAccent = (config.settings && typeof config.settings.widgetColor === "string" && config.settings.widgetColor) || "";

  function applyTheme(theme) {
    const root = document.documentElement;
    if (!root) return;
    const tokens = theme === "light" ? LIGHT_TOKENS : DARK_TOKENS;
    for (const [key, val] of Object.entries(tokens)) {
      root.style.setProperty(key, val);
    }
    if (currentAccent) {
      root.style.setProperty("--accent", currentAccent);
    }
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }

  function injectBaseStyles() {
    if (document.getElementById("nook-bridge-styles")) return;

    try {
      if (window.parent && window.parent.document) {
        const parentNodes = window.parent.document.querySelectorAll('link[rel="stylesheet"], style');
        parentNodes.forEach(function(node) {
          if (node.tagName === "STYLE" && (node.id === "nook-bridge-styles" || (node.textContent && node.textContent.includes("nook-bridge")))) return;
          const clone = node.cloneNode(true);
          document.head.appendChild(clone);
        });
      }
    } catch (e) {}

    const styleEl = document.createElement("style");
    styleEl.id = "nook-bridge-styles";
    const initialFont = config.fontFamily || '"Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif';
    const initialRadius = config.radius || "16px";
    styleEl.textContent = \`
      *, *::before, *::after {
        box-sizing: border-box;
      }
      :root, html {
        background: transparent !important;
        background-color: transparent !important;
        overflow: hidden !important;
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        --font-sans: "Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif;
        --font-mono: "JetBrains Mono", "Cascadia Mono", ui-monospace, monospace;
        --font-serif: "Newsreader", "Charter", "Georgia", "Times New Roman", serif;
        --font-rounded: "Quicksand", "Nunito", system-ui, sans-serif;
        --font-tech: "Space Mono", "Cascadia Code", "Consolas", monospace;
        --font-family: \${initialFont};
        --radius: \${initialRadius};
        --radius-sm: 6px;
        --radius-md: 10px;
        --radius-lg: 16px;
        --radius-xl: 24px;
      }
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent !important;
        background-color: transparent !important;
        color: var(--fg);
        font-family: var(--font-family, var(--font-sans));
        box-sizing: border-box;
        overflow: hidden !important;
      }
      html, body {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      ::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    \`;
    const target = document.head || document.documentElement || document.body;
    if (target) {
      if (target.firstChild) {
        target.insertBefore(styleEl, target.firstChild);
      } else {
        target.appendChild(styleEl);
      }
    } else {
      document.addEventListener("DOMContentLoaded", function() {
        const t = document.head || document.documentElement || document.body;
        if (t && !document.getElementById("nook-bridge-styles")) {
          if (t.firstChild) {
            t.insertBefore(styleEl, t.firstChild);
          } else {
            t.appendChild(styleEl);
          }
        }
      });
    }
  }

  applyTheme(config.theme);
  injectBaseStyles();

  window.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      window.parent.postMessage({
        type: "nook:rpc:context-menu",
        action: "context-menu",
        instanceId: config.instanceId,
        payload: {
          screenX: typeof e.screenX === "number" ? Math.round(e.screenX) : null,
          screenY: typeof e.screenY === "number" ? Math.round(e.screenY) : null,
          clientX: typeof e.clientX === "number" ? Math.round(e.clientX) : null,
          clientY: typeof e.clientY === "number" ? Math.round(e.clientY) : null
        }
      }, "*");
    } catch (err) {
      console.error("[Nook Bridge] Context menu forward error:", err);
    }
  }, true);

  document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
  }, true);

  window.addEventListener("load", function() {
    try {
      window.dispatchEvent(new Event("resize"));
    } catch (e) {}
  });

  let reqId = 0;
  const pendingRequests = new Map();

  function sendRpc(action, payload) {
    return new Promise(function(resolve, reject) {
      const id = "rpc_" + (++reqId) + "_" + Math.random().toString(36).slice(2, 9);
      const timer = setTimeout(function() {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error("RPC request timed out after 15s for action: " + action));
        }
      }, 15000);
      pendingRequests.set(id, { resolve: resolve, reject: reject, timer: timer });
      window.parent.postMessage({
        type: "nook:rpc:" + action,
        action: action,
        requestId: id,
        payload: payload,
        instanceId: config.instanceId
      }, "*");
    });
  }

  const settingsListeners = new Set();
  const themeListeners = new Set();
  const editModeListeners = new Set();

  const nook = {
    instanceId: config.instanceId,
    manifest: config.manifest,
    theme: config.theme,
    editMode: config.editMode,
    settings: config.settings || {},
    state: config.state || {},
    getState: function() {
      return sendRpc("get-state");
    },
    setState: function(patch) {
      return sendRpc("set-state", { patch: patch }).then(function(res) {
        if (patch && typeof patch === "object") {
          nook.state = Object.assign({}, nook.state, patch);
        }
        return res;
      });
    },
    getSettings: function() {
      return sendRpc("get-settings");
    },
    onSettingsChange: function(cb) {
      if (typeof cb === "function") {
        settingsListeners.add(cb);
        return function() {
          settingsListeners.delete(cb);
        };
      }
      return function() {};
    },
    onThemeChange: function(cb) {
      if (typeof cb === "function") {
        themeListeners.add(cb);
        return function() {
          themeListeners.delete(cb);
        };
      }
      return function() {};
    },
    onEditModeChange: function(cb) {
      if (typeof cb === "function") {
        editModeListeners.add(cb);
        return function() {
          editModeListeners.delete(cb);
        };
      }
      return function() {};
    },
    toggleEditMode: function() {
      return sendRpc("toggle-edit-mode");
    },
    system: {
      getVitals: function() {
        return sendRpc("get-vitals");
      },
      getBattery: function() {
        return sendRpc("get-battery");
      },
      getMediaStatus: function() {
        return sendRpc("get-media");
      },
      sendMediaCommand: function(command) {
        return sendRpc("media-command", { command: command });
      },
      getListeningPorts: function() {
        return sendRpc("get-ports");
      },
      ping: function(url) {
        return sendRpc("ping", { url: url });
      },
      notify: function(options) {
        return sendRpc("notify", typeof options === "string" ? { title: options } : options);
      },
      openUrl: function(url) {
        return sendRpc("open-url", { url: url });
      }
    }
  };

  window.Nook = nook;

  window.addEventListener("message", function(event) {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "nook:rpc:response") {
      const pending = pendingRequests.get(data.requestId);
      if (pending) {
        pendingRequests.delete(data.requestId);
        if (pending.timer) {
          clearTimeout(pending.timer);
        }
        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data.result);
        }
      }
      return;
    }

    if (data.type === "nook:settings-changed") {
      const newSettings = (data.payload && data.payload.settings) || {};
      nook.settings = newSettings;
      if (typeof newSettings.widgetColor === "string" && newSettings.widgetColor) {
        currentAccent = newSettings.widgetColor;
        document.documentElement.style.setProperty("--accent", currentAccent);
      }
      if (typeof newSettings.fontFamily === "string" && newSettings.fontFamily) {
        document.documentElement.style.setProperty("--font-family", newSettings.fontFamily);
      }
      settingsListeners.forEach(function(cb) {
        try { cb(newSettings); } catch (err) { console.error("[Nook Bridge] Settings listener error:", err); }
      });
    } else if (data.type === "nook:appearance-changed") {
      const payload = data.payload || {};
      if (payload.fontFamily) {
        document.documentElement.style.setProperty("--font-family", payload.fontFamily);
      }
      if (payload.radius) {
        document.documentElement.style.setProperty("--radius", payload.radius);
      }
    } else if (data.type === "nook:theme-changed") {
      const newTheme = data.payload && data.payload.theme === "light" ? "light" : "dark";
      nook.theme = newTheme;
      applyTheme(newTheme);
      themeListeners.forEach(function(cb) {
        try { cb(newTheme); } catch (err) { console.error("[Nook Bridge] Theme listener error:", err); }
      });
    } else if (data.type === "nook:edit-mode-changed") {
      const newEditMode = Boolean(data.payload && data.payload.editMode);
      nook.editMode = newEditMode;
      editModeListeners.forEach(function(cb) {
        try { cb(newEditMode); } catch (err) { console.error("[Nook Bridge] EditMode listener error:", err); }
      });
    }
  });

  let readyDispatched = false;
  function dispatchReady() {
    if (readyDispatched) return;
    readyDispatched = true;
    try {
      const readyEvent = new CustomEvent("nook:ready", { detail: nook });
      window.dispatchEvent(readyEvent);
      document.dispatchEvent(readyEvent);
    } catch (e) {
      console.error("[Nook Bridge] Failed to dispatch nook:ready", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", dispatchReady, { once: true });
  } else {
    setTimeout(dispatchReady, 0);
  }
})();`;
}
