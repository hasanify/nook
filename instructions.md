# Nook Custom Widget Developer & AI Agent Guide

This specification teaches AI agents (and human developers) how to build custom widgets for **Nook**, a native desktop widget canvas for Windows built with Tauri, Rust, and React.

Users can import widgets directly into Nook using **a single `.html` / `.nook` file** or **a `.zip` archive**. You can also test and preview your widgets instantly in the browser with full system API simulation using the [Online Custom Widget Builder](https://hasanify.github.io/nook/builder/).

---

## 1. Quick Prompt for AI Agents

To create a new widget, you can prompt any AI agent with:

> _"You are creating a custom widget for Nook. Follow the specifications in `instructions.md`. Create a single self-contained HTML file (or ZIP archive) with the embedded manifest, dark/light theme support, and usage of `window.Nook` (including native system APIs if relevant). The widget should be: [describe your widget idea here]."_

---

## 2. Supported Packaging Formats

Nook supports two packaging formats:

### Option A: Single-File Widget (`.html` or `.nook`) — Recommended for AI Generation

A standalone HTML file where all CSS, JavaScript, and HTML are contained in one file.

The manifest is defined inside a `<script type="application/json" id="nook-manifest">` tag in the `<head>` or at the top of the file:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My Widget</title>
    <script type="application/json" id="nook-manifest">
      {
        "id": "my-custom-widget",
        "name": "My Custom Widget",
        "description": "Displays live system info and custom metrics",
        "version": "1.0.0",
        "author": "Your Name",
        "defaultSize": { "w": 320, "h": 220 },
        "minSize": { "w": 240, "h": 160 },
        "resizable": true,
        "settingsSchema": [
          {
            "key": "refreshInterval",
            "label": "Refresh Rate (seconds)",
            "type": "number",
            "defaultValue": 5,
            "min": 1,
            "max": 60
          }
        ]
      }
    </script>
    <style>
      /* Inline CSS */
    </style>
  </head>
  <body>
    <div id="app">...</div>
    <script>
      // Inline JavaScript interacting with window.Nook
    </script>
  </body>
</html>
```

---

### Option B: ZIP Archive Bundle (`.zip`)

A standard `.zip` file containing:

- `manifest.json` (required): Widget metadata and settings schema.
- `index.html` (required): Entry point file.
- Optional local files: `.css`, `.js`, `.svg`, `.png`, fonts, etc.

**Archive Structure Example:**

```text
my-widget.zip
├── manifest.json
├── index.html
├── style.css
└── app.js
```

---

## 3. Manifest Specification (`manifest.json` or `#nook-manifest`)

Every widget must define a manifest adhering to this schema:

| Field            | Type                       | Required | Description                                                                                                                           |
| ---------------- | -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                   | **Yes**  | Unique identifier (lowercase alphanumeric, hyphens, and underscores, e.g. `"crypto-pulse"`). Cannot collide with built-in widget IDs. |
| `name`           | `string`                   | **Yes**  | Display name shown in Nook's widget picker and headers.                                                                               |
| `description`    | `string`                   | **Yes**  | Short summary of what the widget does.                                                                                                |
| `version`        | `string`                   | **Yes**  | Semantic version string (e.g. `"1.0.0"`).                                                                                             |
| `author`         | `string`                   | No       | Author name or handle.                                                                                                                |
| `defaultSize`    | `{ w: number, h: number }` | **Yes**  | Initial window dimensions in pixels.                                                                                                  |
| `minSize`        | `{ w: number, h: number }` | **Yes**  | Minimum resize bounds in pixels.                                                                                                      |
| `maxSize`        | `{ w: number, h: number }` | No       | Optional maximum resize bounds.                                                                                                       |
| `resizable`      | `boolean`                  | No       | Whether the widget can be resized on the desktop (default: `true`).                                                                   |
| `settingsSchema` | `Array<SettingsField>`     | No       | Configurable fields automatically rendered in Nook's Settings inspector.                                                              |

### Settings Schema (`settingsSchema`)

Declaring fields in `settingsSchema` allows users to configure your widget directly inside Nook's native Settings app!

```json
[
  {
    "key": "apiKey",
    "label": "API Key",
    "type": "text",
    "placeholder": "Enter key...",
    "defaultValue": ""
  },
  {
    "key": "refreshRate",
    "label": "Refresh Rate (s)",
    "type": "number",
    "defaultValue": 10,
    "min": 2,
    "max": 60,
    "step": 1
  },
  {
    "key": "showDetails",
    "label": "Show Detailed Graph",
    "type": "boolean",
    "defaultValue": true
  },
  {
    "key": "chartStyle",
    "label": "Chart Style",
    "type": "select",
    "defaultValue": "smooth",
    "options": [
      { "label": "Smooth Line", "value": "smooth" },
      { "label": "Bar Chart", "value": "bars" },
      { "label": "Minimal Gauge", "value": "gauge" }
    ]
  }
]
```

---

## 4. The `window.Nook` JavaScript Bridge API

Nook automatically injects a `window.Nook` client object into your widget's iframe before any scripts execute.

### TypeScript Definition

```typescript
interface NookBridge {
  /** The unique ID of this active widget instance on the desktop */
  instanceId: string;

  /** The parsed manifest of this widget */
  manifest: Manifest;

  /** Current Nook app theme: "dark" or "light" */
  theme: "dark" | "light";

  /** Whether Nook is currently in desktop edit mode (moving/resizing widgets) */
  editMode: boolean;

  /** Synchronous snapshot of the widget's settings */
  settings: Record<string, any>;

  /** Synchronous snapshot of the widget's persisted state */
  state: Record<string, any>;

  /** Fetch latest persisted state */
  getState<T = Record<string, any>>(): Promise<T>;

  /** Persist state patch to Nook's desktop storage across restarts */
  setState(patch: Record<string, any>): Promise<void>;

  /** Fetch latest settings */
  getSettings<T = Record<string, any>>(): Promise<T>;

  /** Subscribe to settings changes saved by the user in Settings */
  onSettingsChange(callback: (settings: Record<string, any>) => void): () => void;

  /** Subscribe to dark/light theme changes */
  onThemeChange(callback: (theme: "dark" | "light") => void): () => void;

  /** Subscribe to edit mode toggle events */
  onEditModeChange(callback: (editMode: boolean) => void): () => void;

  /** Toggle desktop edit mode */
  toggleEditMode(): void;

  /** Native Windows system telemetry and operations */
  system: {
    /** Get live CPU load, memory utilization, and system uptime */
    getVitals(): Promise<{
      cpu_percent: number;
      memory_used_mb: number;
      memory_total_mb: number;
      uptime_seconds: number;
    }>;

    /** Get laptop battery level, charging status, and remaining time */
    getBattery(): Promise<{
      has_battery: boolean;
      level: number; // 0 to 100
      charging: boolean;
      state: string; // "Charging", "Discharging", "Full", etc.
      time_remaining_mins?: number;
    }>;

    /** Get active media playback status (Spotify, YouTube, browser, Windows media) */
    getMediaStatus(): Promise<{
      has_media: boolean;
      title?: string;
      artist?: string;
      album?: string;
      is_playing?: boolean;
    }>;

    /** Control system media: "play", "pause", "playPause", "next", "previous" */
    sendMediaCommand(command: "play" | "pause" | "playPause" | "next" | "previous"): Promise<void>;

    /** Scan local listening ports and their associated process names and PIDs */
    getListeningPorts(): Promise<
      Array<{
        port: number;
        pid: number;
        process_name: string;
        protocol: string;
      }>
    >;

    /** Test network latency / ping an endpoint */
    ping(url: string): Promise<{
      ok: boolean;
      latency_ms: number;
      status_code?: number;
    }>;

    /** Show native OS desktop notification */
    notify(options: { title: string; body: string }): Promise<void>;

    /** Open a web URL in the user's default external browser (https or mailto) */
    openUrl(url: string): Promise<void>;
  };
}
```

---

## 5. Styling & Theme Integration

Nook automatically injects CSS variables into the widget's root document (`:root` / `html`) that adapt when the user switches themes, selects appearance presets, or changes accent colors:

### Color Tokens

| CSS Variable    | Dark Theme Value | Light Theme Value | Usage                                              |
| --------------- | ---------------- | ----------------- | -------------------------------------------------- |
| `--bg-canvas`   | `#09090b`        | `#ffffff`         | Deepest background                                 |
| `--bg-surface`  | `#18181b`        | `#f4f4f5`         | Default card / widget background                   |
| `--bg-elevated` | `#27272a`        | `#e4e4e7`         | Hovered cards, badges, buttons                     |
| `--fg`          | `#fafafa`        | `#09090b`         | Primary text and headings                          |
| `--fg-muted`    | `#a1a1aa`        | `#71717a`         | Secondary text, labels                             |
| `--fg-subtle`   | `#71717a`        | `#a1a1aa`         | Hints, timestamps, dividers                        |
| `--line`        | `#27272a`        | `#e4e4e7`         | Borders and dividers                               |
| `--accent`      | `#3b82f6`        | `#2563eb`         | Interactive accent (customizable via context menu) |
| `--error`       | `#ef4444`        | `#dc2626`         | Error indicators                                   |
| `--success`     | `#22c55e`        | `#16a34a`         | Success indicators                                 |

### Typography & Roundness Tokens

Nook synchronizes the user's active Appearance preset (Clean Modern, Glass, Neo Brutalist, Terminal, etc.) and custom studio settings into your widget:

| CSS Variable     | Description                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `--font-family`  | The active font family chosen by the user in Nook Settings.                                     |
| `--font-sans`    | Sans-serif font stack (`"Inter", "Segoe UI Variable Text", system-ui, sans-serif`).             |
| `--font-mono`    | Monospace font stack (`"JetBrains Mono", "Cascadia Mono", monospace`).                          |
| `--font-serif`   | Serif font stack (`"Newsreader", "Charter", "Georgia", serif`).                                 |
| `--font-rounded` | Rounded font stack (`"Quicksand", "Nunito", sans-serif`).                                       |
| `--font-tech`    | Technical font stack (`"Space Mono", "Cascadia Code", monospace`).                              |
| `--radius`       | Active border radius (e.g. `16px` for Clean Modern, `0px` for Neo Brutalist, `24px` for Round). |
| `--radius-sm`    | Small radius token (`6px`).                                                                     |
| `--radius-md`    | Medium radius token (`10px`).                                                                   |
| `--radius-lg`    | Large radius token (`16px`).                                                                    |
| `--radius-xl`    | Extra-large radius token (`24px`).                                                              |

### Recommended Baseline Styles

Custom widgets are hosted directly inside Nook's native `WidgetShell` card, which applies the active preset's backdrop, surface, border, and shadows. Therefore, custom widget content should keep `html, body` transparent and inherit fonts and tokens:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

body {
  font-family: var(
    --font-family,
    var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)
  );
  color: var(--fg, #fafafa);
  user-select: none;
  position: relative;
}
```

### Essential Guidelines for AI Agents & Developers

1. **Always provide CSS variable fallbacks:** When using theme tokens like `var(--bg-surface)`, always specify a fallback color (for example: `background: var(--bg-surface, #18181b); color: var(--fg, #fafafa);`).
2. **Prevent scrollbars strictly:** Set `overflow: hidden;` on `html, body` and use `width: 100%; height: 100%;` instead of viewport units (`100vw`/`100vh`) which can trigger sub-pixel scrollbars inside sandboxed iframes.
3. **Safe script lifecycle boot:** Iframe documents may execute while `document.readyState` is already interactive or complete. Always boot your widget with:
   ```js
   function initWidget() {
     // Your widget initialization logic here
   }

   if (document.readyState === "loading") {
     document.addEventListener("DOMContentLoaded", initWidget);
   } else {
     initWidget();
   }
   ```
4. **Handle window resize for dynamic layouts:** When drawing SVGs or canvas graphics, recalculate dimensions inside a `window.addEventListener("resize", ...)` handler so the widget scales smoothly when resized by the user. Guard against zero initial dimensions with `Math.max(1, window.innerWidth)`.
5. **Use inline SVG icons instead of emojis or HTML altcodes:** Never use emojis (such as ⚡, 🎵, ⚙, 📶) or HTML altcodes/unicode entities (such as ⏮, ⏯, ⏭, ★, •) for icons in widget interfaces. Emojis and altcodes render inconsistently across Windows font configurations, distort layout line heights, and clash with customized widget palettes. Always use crisp, inline vector `<svg>` icons with `viewBox="0 0 24 24"`, `fill="currentColor"` or `stroke="currentColor"`, and explicit dimensions (`width` and `height`).
6. **Preview with the Online Builder:** Test and verify your widget in the [Online Custom Widget Builder](https://hasanify.github.io/nook/builder/) to inspect manifest parsing, mock system APIs, and test light/dark theme transitions before importing into Nook desktop.

You may also use Tailwind CSS by including `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>` in `<head>`.

---

## 6. Complete Single-File Widget Example

Below is a complete, production-ready single-file widget: a **Hardware HUD & Media Controller**. You can save this exact code as `system-hud.html` and import it directly into Nook!

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>System & Media HUD</title>
    <script type="application/json" id="nook-manifest">
      {
        "id": "system-media-hud",
        "name": "System & Media HUD",
        "description": "Live CPU, RAM, Battery gauges and media playback controls",
        "version": "1.0.0",
        "author": "Nook Community",
        "defaultSize": { "w": 320, "h": 220 },
        "minSize": { "w": 260, "h": 180 },
        "resizable": true,
        "settingsSchema": [
          {
            "key": "refreshInterval",
            "label": "Telemetry Interval (seconds)",
            "type": "number",
            "defaultValue": 3,
            "min": 1,
            "max": 30
          },
          {
            "key": "showMedia",
            "label": "Show Media Controller",
            "type": "boolean",
            "defaultValue": true
          }
        ]
      }
    </script>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
        background: var(--bg-surface);
        color: var(--fg);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100vh;
        overflow: hidden;
        user-select: none;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--fg-muted);
      }
      .metrics-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .metric-card {
        background: var(--bg-elevated);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .metric-label {
        font-size: 10px;
        color: var(--fg-muted);
      }
      .metric-val {
        font-size: 15px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .bar {
        width: 100%;
        height: 4px;
        background: var(--line);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 2px;
      }
      .bar-fill {
        height: 100%;
        background: var(--accent);
        width: 0%;
        transition: width 0.3s ease;
      }
      .media-card {
        background: var(--bg-elevated);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: auto;
      }
      .media-info {
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .media-title {
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .media-artist {
        font-size: 10px;
        color: var(--fg-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .btn-group {
        display: flex;
        gap: 6px;
      }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-surface);
        border: 1px solid var(--line);
        color: var(--fg);
        border-radius: 6px;
        width: 28px;
        height: 28px;
        padding: 0;
        cursor: pointer;
        transition:
          background 0.15s,
          border-color 0.15s;
      }
      button:hover {
        background: var(--line);
        border-color: var(--fg-muted);
      }
      button svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <span>System Telemetry</span>
      <span id="uptime" style="font-weight: 400;">--</span>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">CPU LOAD</div>
        <div class="metric-val" id="cpu-val">0%</div>
        <div class="bar"><div id="cpu-bar" class="bar-fill"></div></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">RAM USED</div>
        <div class="metric-val" id="ram-val">0%</div>
        <div class="bar"><div id="ram-bar" class="bar-fill"></div></div>
      </div>
    </div>

    <div class="media-card" id="media-box">
      <div class="media-info">
        <div class="media-title" id="media-title">No Media Playing</div>
        <div class="media-artist" id="media-artist">Idle</div>
      </div>
      <div class="btn-group">
        <button
          onclick="window.Nook.system.sendMediaCommand('previous')"
          title="Previous Track"
          aria-label="Previous Track"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
        </button>
        <button
          onclick="window.Nook.system.sendMediaCommand('playPause')"
          title="Play or Pause"
          aria-label="Play or Pause"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <button
          onclick="window.Nook.system.sendMediaCommand('next')"
          title="Next Track"
          aria-label="Next Track"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      </div>
    </div>

    <script>
      async function updateTelemetry() {
        try {
          const vitals = await window.Nook.system.getVitals();
          if (vitals) {
            const cpu = Math.round(vitals.cpu_percent || 0);
            document.getElementById("cpu-val").textContent = cpu + "%";
            document.getElementById("cpu-bar").style.width = Math.min(100, cpu) + "%";

            const ramPercent =
              Math.round((vitals.memory_used_mb / vitals.memory_total_mb) * 100) || 0;
            document.getElementById("ram-val").textContent = ramPercent + "%";
            document.getElementById("ram-bar").style.width = Math.min(100, ramPercent) + "%";

            const hrs = Math.floor(vitals.uptime_seconds / 3600);
            const mins = Math.floor((vitals.uptime_seconds % 3600) / 60);
            document.getElementById("uptime").textContent = `UP ${hrs}h ${mins}m`;
          }

          const media = await window.Nook.system.getMediaStatus();
          if (media && media.has_media && media.title) {
            document.getElementById("media-title").textContent = media.title;
            document.getElementById("media-artist").textContent = media.artist || "Unknown Artist";
          } else {
            document.getElementById("media-title").textContent = "No Media Active";
            document.getElementById("media-artist").textContent = "Windows Media";
          }
        } catch (err) {
          console.error("Failed to poll telemetry:", err);
        }
      }

      let timer = null;
      function startPolling() {
        if (timer) clearInterval(timer);
        const intervalSec = (window.Nook.settings && window.Nook.settings.refreshInterval) || 3;
        updateTelemetry();
        timer = setInterval(updateTelemetry, intervalSec * 1000);
      }

      // Listen to settings changes from Nook
      window.Nook.onSettingsChange((newSettings) => {
        if (newSettings.showMedia === false) {
          document.getElementById("media-box").style.display = "none";
        } else {
          document.getElementById("media-box").style.display = "flex";
        }
        startPolling();
      });

      // Start on boot
      startPolling();
    </script>
  </body>
</html>
```

---

## 7. How to Test & Import Your Widget

1. Open **Nook**.
2. Open **Settings** (via tray icon or hotkey `Ctrl+Alt+E`).
3. Click the **Widgets** tab.
4. Click the **"Import Widget"** button.
5. Drag and drop your `.html`, `.nook`, or `.zip` file into the modal (or browse).
6. Click **"Add to Desktop Now"**! Your widget will immediately appear on your Windows desktop.
