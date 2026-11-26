// Starter templates for Nook Custom Widget Builder
// All copy adheres strictly to anti-slop guidelines: zero em dashes.

export const TEMPLATES = {
  "border-clock": {
    name: "Border Clock",
    description: "Minimal clock with animated border tracking seconds and settings",
    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Border Clock</title>
    <script type="application/json" id="nook-manifest">
      {
        "id": "border-clock",
        "name": "Border Clock",
        "description": "A minimal clock whose border fills up as the seconds pass",
        "version": "1.0.0",
        "author": "Nook Community",
        "defaultSize": { "w": 280, "h": 180 },
        "minSize": { "w": 180, "h": 120 },
        "resizable": true,
        "settingsSchema": [
          {
            "key": "hour12",
            "label": "12-hour format",
            "type": "boolean",
            "defaultValue": false
          },
          {
            "key": "showSeconds",
            "label": "Show seconds digits",
            "type": "boolean",
            "defaultValue": true
          },
          {
            "key": "showDate",
            "label": "Show date",
            "type": "boolean",
            "defaultValue": true
          },
          {
            "key": "smooth",
            "label": "Smooth border fill",
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
      html, body {
        height: 100%;
        width: 100%;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        background: var(--bg-surface, #18181b);
        color: var(--fg, #fafafa);
        border-radius: 14px;
        overflow: hidden;
        user-select: none;
        position: relative;
      }
      svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      #track {
        fill: none;
        stroke: var(--line, #27272a);
        stroke-width: 4;
      }
      #progress {
        fill: none;
        stroke: var(--accent, #3b82f6);
        stroke-width: 4;
        stroke-linecap: butt;
      }
      .content {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .time {
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }
      #hm {
        font-size: var(--hm-size, 44px);
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      #sec {
        font-size: calc(var(--hm-size, 44px) * 0.4);
        font-weight: 500;
        color: var(--fg-muted, #a1a1aa);
      }
      #ampm {
        font-size: calc(var(--hm-size, 44px) * 0.28);
        color: var(--fg-muted, #a1a1aa);
        font-weight: 600;
      }
      #date {
        font-size: calc(var(--hm-size, 44px) * 0.3);
        color: var(--fg-muted, #a1a1aa);
      }
    </style>
  </head>
  <body>
    <svg id="svg" xmlns="http://www.w3.org/2000/svg">
      <path id="track" />
      <path id="progress" pathLength="60" />
    </svg>

    <div class="content">
      <div class="time">
        <span id="hm">00:00</span>
        <span id="sec">00</span>
        <span id="ampm"></span>
      </div>
      <div id="date"></div>
    </div>

    <script>
      const track = document.getElementById("track");
      const progress = document.getElementById("progress");
      const hmEl = document.getElementById("hm");
      const secEl = document.getElementById("sec");
      const ampmEl = document.getElementById("ampm");
      const dateEl = document.getElementById("date");

      const defaults = { hour12: false, showSeconds: true, showDate: true, smooth: true };
      let cfg = Object.assign({}, defaults, (window.Nook && window.Nook.settings) || {});

      const STROKE = 4;
      const pad = (n) => String(n).padStart(2, "0");

      function buildPath() {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const i = STROKE / 2;
        const r = Math.max(2, Math.min(14 - i, W / 2 - i, H / 2 - i));
        const x0 = i, y0 = i, x1 = W - i, y1 = H - i, cx = W / 2;
        const d = [
          \`M \${cx} \${y0}\`,
          \`H \${x1 - r}\`,
          \`A \${r} \${r} 0 0 1 \${x1} \${y0 + r}\`,
          \`V \${y1 - r}\`,
          \`A \${r} \${r} 0 0 1 \${x1 - r} \${y1}\`,
          \`H \${x0 + r}\`,
          \`A \${r} \${r} 0 0 1 \${x0} \${y1 - r}\`,
          \`V \${y0 + r}\`,
          \`A \${r} \${r} 0 0 1 \${x0 + r} \${y0}\`,
          \`H \${cx}\`,
        ].join(" ");
        track.setAttribute("d", d);
        progress.setAttribute("d", d);

        const size = Math.max(18, Math.min(W / 4.6, H / 2.6));
        document.documentElement.style.setProperty("--hm-size", size + "px");
      }

      function render() {
        const now = new Date();
        let h = now.getHours();
        const m = now.getMinutes();
        const s = now.getSeconds();
        const ms = now.getMilliseconds();

        let suffix = "";
        if (cfg.hour12) {
          suffix = h >= 12 ? "PM" : "AM";
          h = h % 12 || 12;
        }
        hmEl.textContent = (cfg.hour12 ? String(h) : pad(h)) + ":" + pad(m);
        secEl.textContent = pad(s);
        secEl.style.display = cfg.showSeconds ? "" : "none";
        ampmEl.textContent = suffix;

        dateEl.style.display = cfg.showDate ? "" : "none";
        if (cfg.showDate) {
          dateEl.textContent = now.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
        }

        const filled = cfg.smooth ? s + ms / 1000 : s + 1;
        progress.setAttribute("stroke-dasharray", \`\${filled} 60\`);
      }

      let loopToken = 0;
      function restart() {
        loopToken++;
        const token = loopToken;
        (function tick() {
          if (token !== loopToken) return;
          render();
          if (cfg.smooth) requestAnimationFrame(tick);
          else setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
        })();
      }

      window.addEventListener("resize", () => {
        buildPath();
        render();
      });

      if (window.Nook && window.Nook.onSettingsChange) {
        window.Nook.onSettingsChange((s) => {
          cfg = Object.assign({}, defaults, s);
          restart();
        });
      }

      buildPath();
      restart();
    </script>
  </body>
</html>`,
  },

  "system-vitals": {
    name: "System Vitals Monitor",
    description: "Real-time CPU and Memory dials using window.Nook.system.getVitals()",
    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>System Vitals</title>
    <script type="application/json" id="nook-manifest">
      {
        "id": "system-vitals",
        "name": "System Vitals",
        "description": "Glanceable CPU load and memory pressure gauge",
        "version": "1.0.0",
        "author": "Nook Team",
        "defaultSize": { "w": 300, "h": 190 },
        "minSize": { "w": 220, "h": 140 },
        "resizable": true,
        "settingsSchema": [
          {
            "key": "refreshRate",
            "label": "Poll Interval (seconds)",
            "type": "number",
            "defaultValue": 2,
            "min": 1,
            "max": 10
          },
          {
            "key": "showUptime",
            "label": "Show System Uptime",
            "type": "boolean",
            "defaultValue": true
          }
        ]
      }
    </script>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--bg-surface, #18181b);
        color: var(--fg, #fafafa);
        padding: 16px;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-radius: 14px;
        border: 1px solid var(--line, #27272a);
        overflow: hidden;
        user-select: none;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .badge {
        font-size: 11px;
        color: var(--accent, #3b82f6);
        background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent);
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 500;
      }
      .metrics {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 8px 0;
      }
      .metric-card {
        background: var(--bg-elevated, #27272a);
        padding: 10px;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .metric-label {
        font-size: 11px;
        color: var(--fg-muted, #a1a1aa);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .metric-value {
        font-size: 22px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }
      .bar-track {
        height: 4px;
        background: var(--line, #3f3f46);
        border-radius: 2px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        background: var(--accent, #3b82f6);
        width: 0%;
        transition: width 0.3s ease;
      }
      .footer {
        font-size: 11px;
        color: var(--fg-subtle, #71717a);
        display: flex;
        justify-content: space-between;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <span>Hardware Vitals</span>
      <span class="badge" id="battery-status">Battery</span>
    </div>

    <div class="metrics">
      <div class="metric-card">
        <span class="metric-label">CPU Load</span>
        <span class="metric-value" id="cpu-val">0%</span>
        <div class="bar-track"><div class="bar-fill" id="cpu-bar"></div></div>
      </div>
      <div class="metric-card">
        <span class="metric-label">Memory</span>
        <span class="metric-value" id="ram-val">0%</span>
        <div class="bar-track"><div class="bar-fill" id="ram-bar"></div></div>
      </div>
    </div>

    <div class="footer">
      <span id="ram-detail">0 / 0 GB</span>
      <span id="uptime">Uptime: 0h 0m</span>
    </div>

    <script>
      let settings = Object.assign({ refreshRate: 2, showUptime: true }, (window.Nook && window.Nook.settings) || {});
      const cpuVal = document.getElementById("cpu-val");
      const cpuBar = document.getElementById("cpu-bar");
      const ramVal = document.getElementById("ram-val");
      const ramBar = document.getElementById("ram-bar");
      const ramDetail = document.getElementById("ram-detail");
      const uptimeEl = document.getElementById("uptime");
      const batteryBadge = document.getElementById("battery-status");

      async function update() {
        if (!window.Nook || !window.Nook.system) return;
        try {
          const vitals = await window.Nook.system.getVitals();
          if (vitals) {
            const cpu = Math.round(vitals.cpu_percent || 0);
            cpuVal.textContent = cpu + "%";
            cpuBar.style.width = cpu + "%";

            const usedGb = (vitals.memory_used_mb / 1024).toFixed(1);
            const totalGb = (vitals.memory_total_mb / 1024).toFixed(1);
            const ramPercent = Math.min(100, Math.round((vitals.memory_used_mb / vitals.memory_total_mb) * 100));
            ramVal.textContent = ramPercent + "%";
            ramBar.style.width = ramPercent + "%";
            ramDetail.textContent = usedGb + " / " + totalGb + " GB";

            if (settings.showUptime) {
              const h = Math.floor(vitals.uptime_seconds / 3600);
              const m = Math.floor((vitals.uptime_seconds % 3600) / 60);
              uptimeEl.textContent = "Up: " + h + "h " + m + "m";
              uptimeEl.style.display = "";
            } else {
              uptimeEl.style.display = "none";
            }
          }

          const battery = await window.Nook.system.getBattery();
          if (battery && battery.has_battery) {
            batteryBadge.textContent = battery.level + "% " + (battery.charging ? "⚡" : "");
          } else {
            batteryBadge.textContent = "AC Power";
          }
        } catch (_err) {
          // Ignore vitals polling error
        }
      }

      if (window.Nook && window.Nook.onSettingsChange) {
        window.Nook.onSettingsChange((s) => {
          settings = Object.assign(settings, s);
          startTimer();
          update();
        });
      }

      let timer = null;
      function startTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(update, Math.max(1, settings.refreshRate || 2) * 1000);
      }

      update();
      startTimer();
    </script>
  </body>
</html>`,
  },

  "quick-notes": {
    name: "Quick Scratchpad",
    description:
      "Persistent notepad widget that stores drafts across restarts using Nook.setState()",
    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Quick Notes</title>
    <script type="application/json" id="nook-manifest">
      {
        "id": "quick-scratchpad",
        "name": "Quick Scratchpad",
        "description": "Minimal desktop sticky note that persists text automatically",
        "version": "1.0.0",
        "author": "Nook Community",
        "defaultSize": { "w": 280, "h": 220 },
        "minSize": { "w": 200, "h": 140 },
        "resizable": true,
        "settingsSchema": [
          {
            "key": "fontSize",
            "label": "Font Size",
            "type": "select",
            "defaultValue": "13px",
            "options": [
              { "label": "Small", "value": "12px" },
              { "label": "Medium", "value": "13px" },
              { "label": "Large", "value": "15px" }
            ]
          }
        ]
      }
    </script>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--bg-surface, #18181b);
        color: var(--fg, #fafafa);
        padding: 12px;
        height: 100vh;
        display: flex;
        flex-direction: column;
        border-radius: 14px;
        border: 1px solid var(--line, #27272a);
        overflow: hidden;
      }
      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 11px;
        color: var(--fg-muted, #a1a1aa);
        user-select: none;
      }
      .status {
        font-size: 10px;
        color: var(--fg-subtle, #71717a);
        transition: opacity 0.2s;
      }
      textarea {
        flex: 1;
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        color: var(--fg, #fafafa);
        font-family: "Cascadia Mono", Consolas, monospace;
        font-size: var(--note-font, 13px);
        line-height: 1.5;
        resize: none;
      }
      textarea::placeholder {
        color: var(--fg-subtle, #71717a);
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <span>Scratchpad</span>
      <span class="status" id="save-status">Synced</span>
    </div>
    <textarea id="editor" placeholder="Type your quick note or scratch ideas here..."></textarea>

    <script>
      const editor = document.getElementById("editor");
      const status = document.getElementById("save-status");
      let saveTimeout = null;

      function applySettings(s) {
        if (s && s.fontSize) {
          document.documentElement.style.setProperty("--note-font", s.fontSize);
        }
      }

      async function init() {
        if (!window.Nook) return;
        applySettings(window.Nook.settings);

        try {
          const state = await window.Nook.getState();
          if (state && typeof state.text === "string") {
            editor.value = state.text;
          }
        } catch (_e) {
          // Ignore state loading error
        }

        if (window.Nook.onSettingsChange) {
          window.Nook.onSettingsChange(applySettings);
        }
      }

      editor.addEventListener("input", () => {
        status.textContent = "Saving...";
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          if (window.Nook && window.Nook.setState) {
            await window.Nook.setState({ text: editor.value, lastModified: Date.now() });
            status.textContent = "Saved";
          }
        }, 400);
      });

      init();
    </script>
  </body>
</html>`,
  },

  "media-controller": {
    name: "Media Player Mini",
    description: "Desktop media controller with Windows playback status and playback buttons",
    code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Media Controller</title>
    <script type="application/json" id="nook-manifest">
      {
        "id": "media-mini",
        "name": "Media Player Mini",
        "description": "Desktop player widget that controls active Windows media",
        "version": "1.0.0",
        "author": "Nook Community",
        "defaultSize": { "w": 280, "h": 140 },
        "minSize": { "w": 220, "h": 110 },
        "resizable": true
      }
    </script>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--bg-surface, #18181b);
        color: var(--fg, #fafafa);
        padding: 14px;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border-radius: 14px;
        border: 1px solid var(--line, #27272a);
        overflow: hidden;
        user-select: none;
      }
      .track-info {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .album-art {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        background: var(--bg-elevated, #27272a);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: var(--fg-muted, #a1a1aa);
        flex-shrink: 0;
      }
      .meta {
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .title {
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .artist {
        font-size: 11px;
        color: var(--fg-muted, #a1a1aa);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .controls {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;
      }
      button {
        background: transparent;
        border: none;
        color: var(--fg, #fafafa);
        cursor: pointer;
        padding: 6px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, transform 0.1s;
      }
      button:hover {
        background: var(--bg-elevated, #27272a);
      }
      button:active {
        transform: scale(0.92);
      }
      .play-btn {
        background: var(--accent, #3b82f6);
        color: #ffffff;
        width: 36px;
        height: 36px;
      }
      .play-btn:hover {
        background: var(--accent, #3b82f6);
        filter: brightness(1.1);
      }
      svg { width: 16px; height: 16px; fill: currentColor; }
      .play-btn svg { width: 18px; height: 18px; }
    </style>
  </head>
  <body>
    <div class="track-info">
      <div class="album-art" id="art">🎵</div>
      <div class="meta">
        <span class="title" id="title">No Active Media</span>
        <span class="artist" id="artist">Start Spotify, YouTube, or browser audio</span>
      </div>
    </div>

    <div class="controls">
      <button id="prev" title="Previous Track">
        <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
      </button>
      <button class="play-btn" id="play" title="Play or Pause">
        <svg id="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <button id="next" title="Next Track">
        <svg viewBox="0 0 24 24"><path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
    </div>

    <script>
      const titleEl = document.getElementById("title");
      const artistEl = document.getElementById("artist");
      const playBtn = document.getElementById("play");
      const playIcon = document.getElementById("play-icon");

      let isPlaying = false;

      async function refresh() {
        if (!window.Nook || !window.Nook.system) return;
        try {
          const status = await window.Nook.system.getMediaStatus();
          if (status && status.has_media) {
            titleEl.textContent = status.title || "Unknown Title";
            artistEl.textContent = status.artist || (status.album || "Unknown Artist");
            isPlaying = Boolean(status.is_playing);
            updatePlayIcon();
          } else {
            titleEl.textContent = "No Active Media";
            artistEl.textContent = "Play audio in Windows to control";
            isPlaying = false;
            updatePlayIcon();
          }
        } catch (_e) {
          // Ignore media refresh error
        }
      }

      function updatePlayIcon() {
        if (isPlaying) {
          playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        } else {
          playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
      }

      playBtn.addEventListener("click", async () => {
        if (window.Nook && window.Nook.system) {
          await window.Nook.system.sendMediaCommand("playPause");
          isPlaying = !isPlaying;
          updatePlayIcon();
        }
      });

      document.getElementById("prev").addEventListener("click", () => {
        window.Nook && window.Nook.system && window.Nook.system.sendMediaCommand("previous");
      });

      document.getElementById("next").addEventListener("click", () => {
        window.Nook && window.Nook.system && window.Nook.system.sendMediaCommand("next");
      });

      refresh();
      setInterval(refresh, 2000);
    </script>
  </body>
</html>`,
  },
};
