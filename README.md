<p align="center">
  <img src="banner.webp" alt="Nook" />
</p>

# Nook

**Nook** is a lightweight, zero-configuration Windows-only desktop widget application built with Tauri v2, Rust, and React 19. Compact, borderless widgets (Notes, Timer, GitHub Repo, Vercel Project) sit directly on the desktop layer below standard application windows and survive `Win+D` ("Show Desktop") and "Hide desktop icons".

---

## Features

- **Tray-Only Presence:** Runs exclusively from the notification tray. Never displays in the taskbar or Alt+Tab switcher (for any window, including Settings). Closing Settings keeps Nook running.
- **Desktop Attachment (`PinStrategy::AboveIcons`):** Pinned directly into the desktop hierarchy above icons.
- **Per-Widget Always on Top (`PinStrategy::Topmost`):** Any widget can be detached to stay above all normal application windows via right-click or settings.
- **Zero-Lag & Low Footprint:** Single shared Rust background HTTP poller with ETag caching; near-zero idle CPU usage.
- **Pluggable Architecture:** Adding a new widget type requires only a manifest, an `index.tsx` component, and single-line registrations.
- **Resilient Lifecycle:** Automatic self-healing and reparenting after Windows Explorer restarts (`TaskbarCreated`).

---

## Stack

| Layer          | Technology          | Version        | Purpose                                                                  |
| -------------- | ------------------- | -------------- | ------------------------------------------------------------------------ |
| Shell          | Tauri               | 2.x            | Multi-window management, tray icon, native capabilities                  |
| Backend        | Rust                | 1.95+          | Desktop attachment, Win32 API integration, IPC                           |
| Win32 API      | `windows` crate     | 0.61           | Direct Win32 window reparenting and z-ordering                           |
| Frontend       | React               | 19.1.0         | Component rendering, reactive state management                           |
| Build Tool     | Vite                | 8.0+           | Fast bundling and development server                                     |
| Language       | TypeScript (strict) | 6.0+           | Full static typing across the UI layer                                   |
| Styling        | Tailwind CSS v4     | 4.3.5          | CSS-first `@theme` design system in `theme.css`                          |
| HTTP Client    | `reqwest`           | 0.12           | Rustls-based shared async HTTP poller                                    |
| Async Runtime  | `tokio`             | 1.x            | Task scheduling and background pollers                                   |
| Secret Storage | `keyring`           | 3.x            | Windows Credential Manager integration                                   |
| Linter         | `oxlint`            | 1.94+          | High-performance TypeScript and React linting                            |
| Formatter      | `prettier`          | 3.10+          | Code formatting with `prettier-plugin-tailwindcss`                       |
| CI/CD          | GitHub Actions      | Windows Latest | Automated lint, format, typecheck, clippy, and NSIS installer generation |

---

## Project Structure

```
nook/
├── .agent/rules/                   # Antigravity workspace rules (readme-sync, code-standards, no-cheap-fixes)
├── .github/workflows/build.yml     # Automated lint, clippy, and NSIS packaging pipeline
├── .husky/pre-commit               # Git hook triggering lint-staged
├── .oxlintrc.json                  # Oxlint configuration
├── .prettierrc.json                # Prettier configuration
├── lint-staged.config.mjs          # Staged file linting and formatting configuration
├── icon.png                        # Master application icon (1024x1024)
├── banner.webp                     # GitHub banner graphic
├── README.md                       # Synchronized project documentation
├── index.html                      # Unified webview HTML entry
├── package.json                    # Project dependencies and operational scripts
├── tsconfig.json                   # Strict TypeScript compiler options
├── vite.config.ts                  # Vite config (React + Tailwind v4 + port 1420)
├── src/
│   ├── main.tsx                    # Window router (?w=<id> or ?view=settings)
│   ├── styles/theme.css            # Tailwind v4 semantic tokens & styles
│   ├── core/                       # IPC wrappers, types, hooks
│   ├── components/                 # WidgetShell, EditOverlay, Banner, etc.
│   ├── settings/                   # Settings application interface
│   └── widgets/                    # Registered widget implementations
└── src-tauri/
    ├── Cargo.toml                  # Pinned Rust dependencies
    ├── build.rs                    # Tauri build hook
    ├── rustfmt.toml                # Rust formatting standards
    ├── tauri.conf.json             # Tauri configuration (tray, NSIS, permissions)
    ├── capabilities/               # Window capability manifests
    ├── icons/                      # Generated application icons
    └── src/                        # Rust backend implementation
```

---

## Development & Building

### Prerequisites

- **Operating System:** Windows 10 (1809+) or Windows 11
- **Node.js:** v22 LTS+
- **Rust:** Stable toolchain (`x86_64-pc-windows-msvc`) with `rustfmt` and `clippy`
- **Build Tools:** Visual Studio C++ Build Tools (Desktop development with C++)

### Commands

```powershell
# Install frontend dependencies
npm install

# Run application in development mode
npm run tauri dev

# Run linters and typecheckers
npm run lint
npm run typecheck
npm run format:check
npm run lint:rust
npm run fmt:rust:check

# Auto-format codebase
npm run format
npm run fmt:rust

# Build production NSIS installer
npm run tauri -- build --bundles nsis
```

The resulting installer is output to `src-tauri/target/release/bundle/nsis/Nook_0.1.0_x64-setup.exe`.

---

## Add-a-Widget Guide

To create and register a new widget type:

1. **Create Manifest:** Add `src/widgets/<name>/manifest.json`:
   ```json
   {
     "id": "clock",
     "name": "Clock",
     "defaultSize": { "w": 200, "h": 120 },
     "minSize": { "w": 140, "h": 80 },
     "settings": [{ "key": "hour12", "label": "12-hour", "type": "toggle", "default": false }]
   }
   ```
2. **Implement Component:** Create `src/widgets/<name>/index.tsx` exporting default `{ manifest, Component }` using `WidgetShell`.
3. **Register Frontend:** Add the widget module export to `src/widgets/registry.ts`.
4. **Register Backend:** Add an `include_str!` entry in `src-tauri/src/registry.rs` to expose the manifest to the native tray menu.
5. **Add Remote Provider (Optional):** If network data is required, implement the provider trait in `src-tauri/src/providers/<name>.rs` and specify `"provider": "<name>"` in `manifest.json`.

---

## Known Limitations

1. **Windows Only:** Relies on Win32 desktop parenting (`SHELLDLL_DefView` / `Progman`) and `WS_EX_TOOLWINDOW` semantics. In environments where no `Progman` or `WorkerW` is running, Nook automatically falls back to `PinStrategy::BottomToplevel`.
2. **Icons Layering:** Widgets sit directly above desktop icons by design, covering desktop icons situated immediately beneath them.
3. **Tray Overflow:** On Windows, new tray icons may initially be grouped inside the notification overflow chevron (`^`). Users should drag Nook onto the main visible taskbar tray area.
4. **Code Signing:** Windows installer executable is unsigned in development and triggers Windows SmartScreen warnings ("Unknown Publisher").
