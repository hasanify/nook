// Nook Custom Widget Online Builder
// Adheres strictly to anti-slop guidelines: zero em dashes

import { TEMPLATES } from "./templates.js";

// Design tokens matching Nook desktop app
const DARK_TOKENS = {
  "--bg-canvas": "#09090b",
  "--bg-surface": "#18181b",
  "--bg-elevated": "#27272a",
  "--fg": "#fafafa",
  "--fg-muted": "#a1a1aa",
  "--fg-subtle": "#71717a",
  "--line": "#27272a",
  "--accent": "#3b82f6",
  "--error": "#ef4444",
  "--success": "#22c55e",
};

const LIGHT_TOKENS = {
  "--bg-canvas": "#ffffff",
  "--bg-surface": "#f4f4f5",
  "--bg-elevated": "#e4e4e7",
  "--fg": "#09090b",
  "--fg-muted": "#71717a",
  "--fg-subtle": "#a1a1aa",
  "--line": "#e4e4e7",
  "--accent": "#2563eb",
  "--error": "#dc2626",
  "--success": "#16a34a",
};

// Simulation State
const simState = {
  theme: "dark",
  editMode: false,
  wallpaper: "dots",
  activeTab: "code",
  activeDrawerTab: "settings",
  size: { w: 280, h: 180 },
  manifest: null,
  settings: {},
  persistedState: {},
  telemetry: {
    cpu: 24,
    ramUsed: 8420,
    ramTotal: 16384,
    uptime: 14400,
    battery: { has_battery: true, level: 88, charging: false, state: "Discharging" },
    media: {
      has_media: true,
      title: "Midnight City",
      artist: "M83",
      album: "Hurry Up, We're Dreaming",
      is_playing: true,
    },
    ports: [
      { port: 3000, pid: 1420, process_name: "node.exe", protocol: "TCP" },
      { port: 5173, pid: 8840, process_name: "vite.exe", protocol: "TCP" },
      { port: 8080, pid: 9024, process_name: "docker-proxy", protocol: "TCP" },
    ],
  },
};

// DOM References
const codeEditor = document.getElementById("code-editor");
const previewIframe = document.getElementById("preview-iframe");
const widgetBox = document.getElementById("widget-box");
const canvasWrapper = document.getElementById("canvas-wrapper");
const editDimensions = document.getElementById("edit-dimensions");
const editBadge = document.getElementById("edit-badge");
const toastContainer = document.getElementById("toast-container");
const contextMenu = document.getElementById("context-menu");
const dropzone = document.getElementById("dropzone-overlay");

// Toast helper
export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}

// Manifest parser from HTML
export function extractManifest(html) {
  const manifestMatch = html.match(
    /<script[^>]*id=["']nook-manifest["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (manifestMatch && manifestMatch[1]) {
    try {
      return JSON.parse(manifestMatch[1]);
    } catch {
      // Manifest is not valid JSON, fall back to defaults
    }
  }
  return {
    id: "custom-widget",
    name: "Custom Widget",
    description: "Custom widget created in Nook Builder",
    version: "1.0.0",
    author: "Community",
    defaultSize: { w: 280, h: 180 },
    minSize: { w: 180, h: 120 },
    resizable: true,
    settingsSchema: [],
  };
}

// Generate the bridge script matching Nook's host implementation
function generateBridgeScript(config) {
  const serializedConfig = JSON.stringify(config).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

  return `(function() {
    if (window.__NOOK_BRIDGE_INITIALIZED__) return;
    window.__NOOK_BRIDGE_INITIALIZED__ = true;

    const config = ${serializedConfig};
    const DARK_TOKENS = ${JSON.stringify(DARK_TOKENS)};
    const LIGHT_TOKENS = ${JSON.stringify(LIGHT_TOKENS)};

    function applyTheme(theme) {
      const root = document.documentElement;
      if (!root) return;
      const tokens = theme === "light" ? LIGHT_TOKENS : DARK_TOKENS;
      for (const [key, val] of Object.entries(tokens)) {
        root.style.setProperty(key, val);
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
      const styleEl = document.createElement("style");
      styleEl.id = "nook-bridge-styles";
      styleEl.textContent = \`
        *, *::before, *::after { box-sizing: border-box; }
        :root, html { background: transparent !important; }
        body {
          margin: 0;
          padding: 0;
          background: transparent;
          color: var(--fg);
          font-family: system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
          overflow: hidden;
        }
      \`;
      const target = document.head || document.documentElement || document.body;
      if (target) {
        if (target.firstChild) target.insertBefore(styleEl, target.firstChild);
        else target.appendChild(styleEl);
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
            clientX: e.clientX,
            clientY: e.clientY
          }
        }, "*");
      } catch (err) {}
    }, true);

    let reqId = 0;
    const pendingRequests = new Map();

    function sendRpc(action, payload) {
      return new Promise(function(resolve, reject) {
        const id = "rpc_" + (++reqId) + "_" + Math.random().toString(36).slice(2, 9);
        const timer = setTimeout(function() {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error("RPC timed out for action: " + action));
          }
        }, 10000);
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
      getState: function() { return sendRpc("get-state"); },
      setState: function(patch) {
        return sendRpc("set-state", { patch: patch }).then(function(res) {
          if (patch && typeof patch === "object") {
            nook.state = Object.assign({}, nook.state, patch);
          }
          return res;
        });
      },
      getSettings: function() { return sendRpc("get-settings"); },
      onSettingsChange: function(cb) {
        if (typeof cb === "function") {
          settingsListeners.add(cb);
          return function() { settingsListeners.delete(cb); };
        }
        return function() {};
      },
      onThemeChange: function(cb) {
        if (typeof cb === "function") {
          themeListeners.add(cb);
          return function() { themeListeners.delete(cb); };
        }
        return function() {};
      },
      onEditModeChange: function(cb) {
        if (typeof cb === "function") {
          editModeListeners.add(cb);
          return function() { editModeListeners.delete(cb); };
        }
        return function() {};
      },
      toggleEditMode: function() { return sendRpc("toggle-edit-mode"); },
      system: {
        getVitals: function() { return sendRpc("get-vitals"); },
        getBattery: function() { return sendRpc("get-battery"); },
        getMediaStatus: function() { return sendRpc("get-media"); },
        sendMediaCommand: function(command) { return sendRpc("media-command", { command: command }); },
        getListeningPorts: function() { return sendRpc("get-ports"); },
        ping: function(url) { return sendRpc("ping", { url: url }); },
        notify: function(options) { return sendRpc("notify", typeof options === "string" ? { title: options } : options); },
        openUrl: function(url) { return sendRpc("open-url", { url: url }); }
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
          if (pending.timer) clearTimeout(pending.timer);
          if (data.error) pending.reject(new Error(data.error));
          else pending.resolve(data.result);
        }
        return;
      }

      if (data.type === "nook:settings-changed") {
        const newSettings = (data.payload && data.payload.settings) || {};
        nook.settings = newSettings;
        settingsListeners.forEach(function(cb) {
          try { cb(newSettings); } catch (_err) {}
        });
      } else if (data.type === "nook:theme-changed") {
        const newTheme = data.payload && data.payload.theme === "light" ? "light" : "dark";
        nook.theme = newTheme;
        applyTheme(newTheme);
        themeListeners.forEach(function(cb) {
          try { cb(newTheme); } catch (_err) {}
        });
      } else if (data.type === "nook:edit-mode-changed") {
        const newEditMode = Boolean(data.payload && data.payload.editMode);
        nook.editMode = newEditMode;
        editModeListeners.forEach(function(cb) {
          try { cb(newEditMode); } catch (_err) {}
        });
      }
    });

    try {
      const readyEvent = new CustomEvent("nook:ready", { detail: nook });
      window.dispatchEvent(readyEvent);
      document.dispatchEvent(readyEvent);
    } catch (e) {}
  })();`;
}

function combineHtmlWithBridge(rawHtml, bridgeScript) {
  const scriptTag = `<script id="nook-bridge">${bridgeScript}</script>`;
  if (/<\/head>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/head>/i, () => `${scriptTag}\n</head>`);
  }
  if (/<body[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<body[^>]*>/i, (match) => `${match}${scriptTag}\n`);
  }
  return `<head>${scriptTag}</head>\n${rawHtml}`;
}

// Log RPC events
function logRpcEvent(action, payload, direction = "in") {
  const logEl = document.getElementById("rpc-log");
  if (!logEl) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = "rpc-log-entry";
  entry.innerHTML = `<span class="rpc-time">[${time}]</span> <span class="rpc-dir ${direction}">${direction === "in" ? "<-" : "->"}</span> <strong>${action}</strong> <code>${JSON.stringify(payload ?? "")}</code>`;
  logEl.prepend(entry);
}

// Handle RPC calls from the widget iframe
window.addEventListener("message", async (event) => {
  if (event.source !== previewIframe.contentWindow) return;
  const data = event.data;
  if (!data || typeof data !== "object") return;

  const { requestId, payload, action } = data;
  const actionType = typeof data.type === "string" ? data.type : `nook:rpc:${action}`;

  if (!actionType.startsWith("nook:rpc:") || actionType === "nook:rpc:response") return;

  logRpcEvent(actionType, payload, "in");

  const reply = (result, error = null) => {
    if (!previewIframe.contentWindow || !requestId) return;
    previewIframe.contentWindow.postMessage(
      {
        type: "nook:rpc:response",
        requestId,
        result,
        error: error ? String(error) : null,
      },
      "*",
    );
  };

  switch (actionType) {
    case "nook:rpc:context-menu": {
      openContextMenu(event);
      reply(true);
      break;
    }
    case "nook:rpc:get-vitals": {
      // Simulate slight realistic fluctuations
      const cpu = Math.max(5, Math.min(99, simState.telemetry.cpu + (Math.random() * 4 - 2)));
      reply({
        cpu_percent: cpu,
        memory_used_mb: simState.telemetry.ramUsed,
        memory_total_mb: simState.telemetry.ramTotal,
        uptime_seconds: simState.telemetry.uptime,
      });
      break;
    }
    case "nook:rpc:get-battery": {
      reply(simState.telemetry.battery);
      break;
    }
    case "nook:rpc:get-media": {
      reply(simState.telemetry.media);
      break;
    }
    case "nook:rpc:media-command": {
      const cmd = payload?.command;
      if (cmd === "play" || cmd === "playPause" || cmd === "pause") {
        simState.telemetry.media.is_playing = !simState.telemetry.media.is_playing;
      }
      showToast(`Media command: ${cmd}`);
      renderTelemetryControls();
      reply(true);
      break;
    }
    case "nook:rpc:get-ports": {
      reply(simState.telemetry.ports);
      break;
    }
    case "nook:rpc:ping": {
      const url = payload?.url || "";
      const start = performance.now();
      try {
        await fetch(url, { mode: "no-cors" });
        const latency = Math.round(performance.now() - start);
        reply({ ok: true, latency_ms: latency, status_code: 200 });
      } catch {
        reply({ ok: false, latency_ms: 999, status_code: 500 });
      }
      break;
    }
    case "nook:rpc:notify": {
      const title = typeof payload === "string" ? payload : payload?.title || "Nook Notification";
      const body = payload?.body || "";
      showToast(`Notification: ${title} ${body ? " - " + body : ""}`, "success");
      reply(true);
      break;
    }
    case "nook:rpc:open-url": {
      const url = payload?.url || payload;
      if (url && typeof url === "string") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      reply(true);
      break;
    }
    case "nook:rpc:get-state": {
      reply(simState.persistedState);
      break;
    }
    case "nook:rpc:set-state": {
      if (payload?.patch && typeof payload.patch === "object") {
        simState.persistedState = Object.assign({}, simState.persistedState, payload.patch);
        renderStateInspector();
      }
      reply(true);
      break;
    }
    case "nook:rpc:get-settings": {
      reply(simState.settings);
      break;
    }
    case "nook:rpc:toggle-edit-mode": {
      toggleEditMode();
      reply(true);
      break;
    }
    default:
      reply(null, `Unsupported action in web simulator: ${actionType}`);
  }
});

// Update the preview iframe
export function updatePreview() {
  const rawHtml = codeEditor.value;
  simState.manifest = extractManifest(rawHtml);

  // Initialize settings default values if not set
  if (simState.manifest.settingsSchema && Array.isArray(simState.manifest.settingsSchema)) {
    simState.manifest.settingsSchema.forEach((field) => {
      if (!(field.key in simState.settings)) {
        simState.settings[field.key] = field.defaultValue;
      }
    });
  }

  // Update visual size from manifest if unset
  if (simState.manifest.defaultSize && !widgetBox.dataset.customResized) {
    simState.size.w = simState.manifest.defaultSize.w || 280;
    simState.size.h = simState.manifest.defaultSize.h || 180;
  }

  applySize();
  renderManifestForm();
  renderSettingsInspector();

  const bridgeScript = generateBridgeScript({
    instanceId: "builder-test-instance",
    manifest: simState.manifest,
    theme: simState.theme,
    editMode: simState.editMode,
    settings: simState.settings,
    state: simState.persistedState,
  });

  const finalHtml = combineHtmlWithBridge(rawHtml, bridgeScript);
  previewIframe.srcdoc = finalHtml;

  editBadge.textContent = simState.manifest.name || simState.manifest.id || "Custom Widget";
}

// Apply window size
function applySize() {
  widgetBox.style.width = `${simState.size.w}px`;
  widgetBox.style.height = `${simState.size.h}px`;
  editDimensions.textContent = `${simState.size.w} × ${simState.size.h}px`;
}

// Edit mode toggle
export function toggleEditMode() {
  simState.editMode = !simState.editMode;
  widgetBox.classList.toggle("edit-active", simState.editMode);
  document.getElementById("btn-edit-mode").classList.toggle("active", simState.editMode);

  if (previewIframe.contentWindow) {
    previewIframe.contentWindow.postMessage(
      {
        type: "nook:edit-mode-changed",
        payload: { editMode: simState.editMode },
      },
      "*",
    );
  }
}

// Theme toggle
export function setTheme(theme) {
  simState.theme = theme;
  document.getElementById("btn-theme-toggle").textContent =
    theme === "dark" ? "🌙 Dark" : "☀️ Light";
  if (previewIframe.contentWindow) {
    previewIframe.contentWindow.postMessage(
      {
        type: "nook:theme-changed",
        payload: { theme },
      },
      "*",
    );
  }
}

// Wallpaper selector
export function setWallpaper(type) {
  simState.wallpaper = type;
  canvasWrapper.className = `canvas-wrapper wallpaper-${type}`;
}

// Context menu display
function openContextMenu(_e) {
  const rect = widgetBox.getBoundingClientRect();
  contextMenu.style.top = `${rect.top + 30}px`;
  contextMenu.style.left = `${rect.left + 30}px`;
  contextMenu.style.display = "block";
}

window.addEventListener("click", () => {
  contextMenu.style.display = "none";
});

// Render settings inspector controls dynamically
function renderSettingsInspector() {
  const container = document.getElementById("settings-inspector-fields");
  if (!container) return;
  container.innerHTML = "";

  const schema = simState.manifest?.settingsSchema;
  if (!schema || !Array.isArray(schema) || schema.length === 0) {
    container.innerHTML = `<p style="color: var(--fg-muted); font-size: 13px;">This widget declares no <code>settingsSchema</code> in its manifest.</p>`;
    return;
  }

  schema.forEach((field) => {
    const row = document.createElement("div");
    row.className = "form-group";
    const currentVal = simState.settings[field.key] ?? field.defaultValue;

    if (field.type === "boolean") {
      row.innerHTML = `
        <label class="checkbox-label">
          <input type="checkbox" data-key="${field.key}" ${currentVal ? "checked" : ""} />
          <span>${field.label}</span>
        </label>
      `;
      row.querySelector("input").addEventListener("change", (e) => {
        simState.settings[field.key] = e.target.checked;
        broadcastSettingsChange();
      });
    } else if (field.type === "select") {
      const optionsHtml = (field.options || [])
        .map(
          (opt) =>
            `<option value="${opt.value}" ${opt.value === currentVal ? "selected" : ""}>${opt.label}</option>`,
        )
        .join("");
      row.innerHTML = `
        <label class="form-label">${field.label}</label>
        <select class="form-select" data-key="${field.key}">${optionsHtml}</select>
      `;
      row.querySelector("select").addEventListener("change", (e) => {
        simState.settings[field.key] = e.target.value;
        broadcastSettingsChange();
      });
    } else if (field.type === "number") {
      row.innerHTML = `
        <label class="form-label">${field.label}</label>
        <input type="number" class="form-input" data-key="${field.key}" value="${currentVal}" min="${field.min ?? ""}" max="${field.max ?? ""}" step="${field.step ?? 1}" />
      `;
      row.querySelector("input").addEventListener("input", (e) => {
        simState.settings[field.key] = parseFloat(e.target.value) || 0;
        broadcastSettingsChange();
      });
    } else {
      row.innerHTML = `
        <label class="form-label">${field.label}</label>
        <input type="text" class="form-input" data-key="${field.key}" value="${currentVal ?? ""}" placeholder="${field.placeholder ?? ""}" />
      `;
      row.querySelector("input").addEventListener("input", (e) => {
        simState.settings[field.key] = e.target.value;
        broadcastSettingsChange();
      });
    }
    container.appendChild(row);
  });
}

function broadcastSettingsChange() {
  if (previewIframe.contentWindow) {
    previewIframe.contentWindow.postMessage(
      {
        type: "nook:settings-changed",
        payload: { settings: simState.settings },
      },
      "*",
    );
  }
}

// Render state inspector
function renderStateInspector() {
  const container = document.getElementById("state-json-view");
  if (!container) return;
  container.textContent = JSON.stringify(simState.persistedState, null, 2);
}

// Render manifest form
function renderManifestForm() {
  const m = simState.manifest || {};
  document.getElementById("mf-id").value = m.id || "";
  document.getElementById("mf-name").value = m.name || "";
  document.getElementById("mf-version").value = m.version || "1.0.0";
  document.getElementById("mf-author").value = m.author || "";
  document.getElementById("mf-desc").value = m.description || "";
  document.getElementById("mf-default-w").value = m.defaultSize?.w || 280;
  document.getElementById("mf-default-h").value = m.defaultSize?.h || 180;
  document.getElementById("mf-min-w").value = m.minSize?.w || 180;
  document.getElementById("mf-min-h").value = m.minSize?.h || 120;
  document.getElementById("mf-resizable").checked = m.resizable !== false;
}

// Sync visual manifest form back into HTML code
export function syncManifestToCode() {
  const m = {
    id: document.getElementById("mf-id").value.trim(),
    name: document.getElementById("mf-name").value.trim(),
    description: document.getElementById("mf-desc").value.trim(),
    version: document.getElementById("mf-version").value.trim(),
    author: document.getElementById("mf-author").value.trim(),
    defaultSize: {
      w: parseInt(document.getElementById("mf-default-w").value, 10) || 280,
      h: parseInt(document.getElementById("mf-default-h").value, 10) || 180,
    },
    minSize: {
      w: parseInt(document.getElementById("mf-min-w").value, 10) || 180,
      h: parseInt(document.getElementById("mf-min-h").value, 10) || 120,
    },
    resizable: document.getElementById("mf-resizable").checked,
    settingsSchema: simState.manifest?.settingsSchema || [],
  };

  const newScript = `<script type="application/json" id="nook-manifest">\n${JSON.stringify(m, null, 6)}\n    </script>`;
  let code = codeEditor.value;
  if (/<script[^>]*id=["']nook-manifest["'][^>]*>[\s\S]*?<\/script>/i.test(code)) {
    code = code.replace(/<script[^>]*id=["']nook-manifest["'][^>]*>[\s\S]*?<\/script>/i, newScript);
  } else if (/<\/head>/i.test(code)) {
    code = code.replace(/<\/head>/i, `${newScript}\n  </head>`);
  } else {
    code = `${newScript}\n${code}`;
  }
  codeEditor.value = code;
  updatePreview();
  showToast("Manifest synced to code", "success");
}

// Render telemetry controls
function renderTelemetryControls() {
  const cpuSlider = document.getElementById("telem-cpu");
  const ramSlider = document.getElementById("telem-ram");
  const batteryLevel = document.getElementById("telem-battery-level");
  const batteryCharging = document.getElementById("telem-battery-charging");
  const mediaPlaying = document.getElementById("telem-media-playing");
  const mediaTitle = document.getElementById("telem-media-title");
  const mediaArtist = document.getElementById("telem-media-artist");

  if (cpuSlider) cpuSlider.value = simState.telemetry.cpu;
  if (ramSlider) ramSlider.value = simState.telemetry.ramUsed;
  if (batteryLevel) batteryLevel.value = simState.telemetry.battery.level;
  if (batteryCharging) batteryCharging.checked = simState.telemetry.battery.charging;
  if (mediaPlaying) mediaPlaying.checked = simState.telemetry.media.is_playing;
  if (mediaTitle) mediaTitle.value = simState.telemetry.media.title;
  if (mediaArtist) mediaArtist.value = simState.telemetry.media.artist;
}

// Drag & Drop handling for .html, .nook, .zip files
export function initDragAndDrop() {
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragging");
  });

  window.addEventListener("dragleave", (e) => {
    if (e.relatedTarget === null) {
      dropzone.classList.remove("is-dragging");
    }
  });

  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragging");

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const name = file.name.toLowerCase();

    if (name.endsWith(".html") || name.endsWith(".nook")) {
      const text = await file.text();
      codeEditor.value = text;
      updatePreview();
      showToast(`Loaded ${file.name}`, "success");
    } else if (name.endsWith(".zip")) {
      if (typeof window.JSZip === "undefined") {
        showToast("JSZip library is still loading, please try again in a moment", "error");
        return;
      }
      try {
        const zip = await window.JSZip.loadAsync(file);
        let indexHtml = "";
        let manifestJson = "";

        for (const [path, entry] of Object.entries(zip.files)) {
          if (path.toLowerCase() === "index.html" || path.toLowerCase().endsWith("/index.html")) {
            indexHtml = await entry.async("text");
          } else if (
            path.toLowerCase() === "manifest.json" ||
            path.toLowerCase().endsWith("/manifest.json")
          ) {
            manifestJson = await entry.async("text");
          }
        }

        if (!indexHtml) {
          showToast("No index.html found in ZIP archive", "error");
          return;
        }

        // If manifest.json was separate, embed it as #nook-manifest
        if (manifestJson && !indexHtml.includes('id="nook-manifest"')) {
          const manifestTag = `<script type="application/json" id="nook-manifest">\n${manifestJson}\n</script>`;
          if (/<\/head>/i.test(indexHtml)) {
            indexHtml = indexHtml.replace(/<\/head>/i, `${manifestTag}\n</head>`);
          } else {
            indexHtml = `${manifestTag}\n${indexHtml}`;
          }
        }

        codeEditor.value = indexHtml;
        updatePreview();
        showToast(`Imported ${file.name}`, "success");
      } catch (err) {
        showToast(`Failed to parse ZIP: ${err.message}`, "error");
      }
    } else {
      showToast("Unsupported file format. Please drop a .html, .nook, or .zip file.", "error");
    }
  });
}

// Exporters
export function exportHtml(extension = "html") {
  const content = codeEditor.value;
  const manifest = extractManifest(content);
  const filename = `${manifest.id || "custom-widget"}.${extension}`;

  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${filename}`, "success");
}

export async function exportZip() {
  if (typeof window.JSZip === "undefined") {
    showToast("JSZip is loading, please try again in a second", "error");
    return;
  }
  const content = codeEditor.value;
  const manifest = extractManifest(content);
  const zip = new window.JSZip();

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("index.html", content);

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${manifest.id || "custom-widget"}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${filename}`, "success");
}

export function copyCode() {
  navigator.clipboard.writeText(codeEditor.value).then(() => {
    showToast("Widget code copied to clipboard", "success");
  });
}

// Generate AI Prompt for custom widgets
export function generateAiPrompt() {
  const m = simState.manifest || {};
  return `You are creating a custom widget for Nook. Follow the specifications in instructions.md.
Create a single self-contained HTML file with the embedded manifest in <script type="application/json" id="nook-manifest">, dark and light theme support using CSS variables, and integration with window.Nook (including native system APIs if relevant).

Widget specifications:
- ID: "${m.id || "my-widget"}"
- Name: "${m.name || "My Widget"}"
- Description: "${m.description || "Describe widget purpose"}"
- Default Size: ${m.defaultSize?.w || 280}w x ${m.defaultSize?.h || 180}h

Ensure the code is self-contained with no external CSS/JS build requirements.`;
}

function setupSplitResizers() {
  const leftPane = document.getElementById("left-pane");
  const rightPane = document.getElementById("right-pane");
  const resizerH = document.getElementById("split-resizer-h");
  const resizerV = document.getElementById("split-resizer-v");
  const drawer = document.getElementById("simulator-drawer");
  const widgetResizer = document.getElementById("widget-resizer");

  // 1. Horizontal Splitter (Editor vs Canvas)
  if (resizerH && leftPane) {
    resizerH.addEventListener("mousedown", (e) => {
      e.preventDefault();
      resizerH.classList.add("is-dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      if (previewIframe) previewIframe.style.pointerEvents = "none";

      function onMouseMove(moveEvent) {
        const totalW = window.innerWidth;
        const newW = Math.max(280, Math.min(totalW - 320, moveEvent.clientX));
        leftPane.style.width = `${newW}px`;
        leftPane.style.maxWidth = "none";
      }

      function onMouseUp() {
        resizerH.classList.remove("is-dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (previewIframe) previewIframe.style.pointerEvents = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  // 2. Vertical Splitter (Canvas vs Simulator Drawer)
  if (resizerV && drawer && rightPane) {
    resizerV.addEventListener("mousedown", (e) => {
      e.preventDefault();
      resizerV.classList.add("is-dragging");
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      if (previewIframe) previewIframe.style.pointerEvents = "none";

      function onMouseMove(moveEvent) {
        const rect = rightPane.getBoundingClientRect();
        const newH = Math.max(90, Math.min(rect.height - 100, rect.bottom - moveEvent.clientY));
        drawer.style.height = `${newH}px`;
      }

      function onMouseUp() {
        resizerV.classList.remove("is-dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (previewIframe) previewIframe.style.pointerEvents = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  // 3. Widget Box Corner Resizer
  if (widgetResizer) {
    widgetResizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.body.style.cursor = "se-resize";
      document.body.style.userSelect = "none";
      if (previewIframe) previewIframe.style.pointerEvents = "none";

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = simState.size.w;
      const startH = simState.size.h;
      const minW = simState.manifest?.minSize?.w ?? 160;
      const minH = simState.manifest?.minSize?.h ?? 100;

      function onMouseMove(moveEvent) {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const newW = Math.max(minW, Math.round(startW + deltaX));
        const newH = Math.max(minH, Math.round(startH + deltaY));
        simState.size.w = newW;
        simState.size.h = newH;
        widgetBox.dataset.customResized = "true";
        applySize();
      }

      function onMouseUp() {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (previewIframe) previewIframe.style.pointerEvents = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }
}

// Setup Event Listeners
function setupEvents() {
  // Code editor input debounce
  let editorTimer;
  codeEditor.addEventListener("input", () => {
    clearTimeout(editorTimer);
    editorTimer = setTimeout(updatePreview, 300);
  });

  // Template picker
  document.getElementById("template-select")?.addEventListener("change", (e) => {
    const key = e.target.value;
    if (TEMPLATES[key]) {
      codeEditor.value = TEMPLATES[key].code;
      delete widgetBox.dataset.customResized;
      updatePreview();
      showToast(`Loaded ${TEMPLATES[key].name} template`, "info");
    }
  });

  // New Widget button
  document.getElementById("btn-new-widget")?.addEventListener("click", () => {
    codeEditor.value = TEMPLATES["border-clock"].code;
    delete widgetBox.dataset.customResized;
    updatePreview();
    showToast("Reset to starter boilerplate", "info");
  });

  // Export buttons
  document.getElementById("btn-export-html")?.addEventListener("click", () => exportHtml("html"));
  document.getElementById("btn-export-nook")?.addEventListener("click", () => exportHtml("nook"));
  document.getElementById("btn-export-zip")?.addEventListener("click", exportZip);
  document.getElementById("btn-copy-code")?.addEventListener("click", copyCode);

  // File upload input
  const fileInput = document.getElementById("file-upload-input");
  document.getElementById("btn-upload-file")?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith(".zip")) {
      const zip = await window.JSZip.loadAsync(file);
      for (const [path, entry] of Object.entries(zip.files)) {
        if (path.toLowerCase().endsWith("index.html")) {
          codeEditor.value = await entry.async("text");
          updatePreview();
          showToast(`Imported ${file.name}`, "success");
          return;
        }
      }
    } else {
      codeEditor.value = await file.text();
      updatePreview();
      showToast(`Imported ${file.name}`, "success");
    }
  });

  // Edit Mode toggle button
  document.getElementById("btn-edit-mode")?.addEventListener("click", toggleEditMode);

  // Theme toggle button
  document.getElementById("btn-theme-toggle")?.addEventListener("click", () => {
    setTheme(simState.theme === "dark" ? "light" : "dark");
  });

  // Wallpaper toggle
  document.getElementById("wallpaper-select")?.addEventListener("change", (e) => {
    setWallpaper(e.target.value);
  });

  // Size preset buttons
  document.querySelectorAll("[data-size-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [w, h] = btn.getAttribute("data-size-preset").split("x").map(Number);
      simState.size.w = w;
      simState.size.h = h;
      widgetBox.dataset.customResized = "true";
      applySize();
    });
  });

  // Left pane tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.getAttribute("data-tab");
      document.querySelectorAll(".pane-tab-view").forEach((view) => {
        if (view.id === `tab-${target}`) {
          view.classList.add("active-pane");
        } else {
          view.classList.remove("active-pane");
        }
      });
      if (target === "prompt") {
        document.getElementById("ai-prompt-textarea").value = generateAiPrompt();
      }
    });
  });

  // Copy AI Prompt button
  document.getElementById("btn-copy-prompt")?.addEventListener("click", () => {
    const text = document.getElementById("ai-prompt-textarea").value;
    navigator.clipboard.writeText(text).then(() => {
      showToast("AI prompt copied to clipboard", "success");
    });
  });

  // Sync Manifest button
  document.getElementById("btn-sync-manifest")?.addEventListener("click", syncManifestToCode);

  // Simulator Drawer tabs
  document.querySelectorAll(".drawer-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".drawer-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.getAttribute("data-drawer-tab");
      document.querySelectorAll(".drawer-view").forEach((view) => {
        if (view.id === `drawer-${target}`) {
          view.classList.add("active-drawer");
        } else {
          view.classList.remove("active-drawer");
        }
      });
    });
  });

  // State reset button
  document.getElementById("btn-reset-state")?.addEventListener("click", () => {
    simState.persistedState = {};
    renderStateInspector();
    showToast("Persisted state cleared", "info");
  });

  // Telemetry control inputs
  document.getElementById("telem-cpu")?.addEventListener("input", (e) => {
    simState.telemetry.cpu = parseInt(e.target.value, 10);
    const label = document.getElementById("telem-cpu-val");
    if (label) label.textContent = `${simState.telemetry.cpu}%`;
  });
  document.getElementById("telem-ram")?.addEventListener("input", (e) => {
    simState.telemetry.ramUsed = parseInt(e.target.value, 10);
    const label = document.getElementById("telem-ram-val");
    if (label) label.textContent = `${simState.telemetry.ramUsed} MB`;
  });
  document.getElementById("telem-battery-level")?.addEventListener("input", (e) => {
    simState.telemetry.battery.level = parseInt(e.target.value, 10);
    const label = document.getElementById("telem-bat-val");
    if (label) label.textContent = `${simState.telemetry.battery.level}%`;
  });
  document.getElementById("telem-battery-charging")?.addEventListener("change", (e) => {
    simState.telemetry.battery.charging = e.target.checked;
    simState.telemetry.battery.state = e.target.checked ? "Charging" : "Discharging";
  });
  document.getElementById("telem-media-playing")?.addEventListener("change", (e) => {
    simState.telemetry.media.is_playing = e.target.checked;
  });
  document.getElementById("telem-media-title")?.addEventListener("input", (e) => {
    simState.telemetry.media.title = e.target.value;
  });
  document.getElementById("telem-media-artist")?.addEventListener("input", (e) => {
    simState.telemetry.media.artist = e.target.value;
  });

  // Context menu items
  document.getElementById("ctx-settings")?.addEventListener("click", () => {
    contextMenu.style.display = "none";
    document.querySelector('[data-drawer-tab="settings"]')?.click();
    showToast("Opened Settings inspector", "info");
  });
  document.getElementById("ctx-edit")?.addEventListener("click", () => {
    contextMenu.style.display = "none";
    toggleEditMode();
  });
  document.getElementById("ctx-reload")?.addEventListener("click", () => {
    contextMenu.style.display = "none";
    updatePreview();
    showToast("Widget reloaded", "info");
  });

  // Keyboard shortcut Ctrl+Alt+E for Edit Mode
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && (e.key === "e" || e.key === "E")) {
      e.preventDefault();
      toggleEditMode();
    }
  });

  initDragAndDrop();
}

// Initial Boot
function init() {
  try {
    if (codeEditor && TEMPLATES["border-clock"]) {
      codeEditor.value = TEMPLATES["border-clock"].code;
    }
    updatePreview();
    setupEvents();
    setupSplitResizers();
    renderTelemetryControls();
    renderStateInspector();
  } catch {
    // Silently handle any initialization failure
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
