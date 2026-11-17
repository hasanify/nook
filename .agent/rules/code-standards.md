# Code standards

- TypeScript strict; no `any`, no non-null `!` without a comment explaining why; no default exports except widget modules and pages.
- Styling: Tailwind v4 semantic utilities only (`bg-surface`, `text-fg-muted`, …). No raw palette utilities, no inline hex/rgb, no new CSS files. New tokens go in `src/styles/theme.css` under `@theme`.
- Accent color is used sparingly: primary action, focus ring, edit-mode outline. Never for decoration.
- Rust: no `unwrap()`/`expect()` outside startup; return `Result<_, String>` from commands; every `unsafe` block gets a `// SAFETY:` comment; run `cargo fmt` and `cargo clippy -D warnings` clean.
- All window geometry goes through `pin::set_bounds_screen`. Never call tauri `set_position` on widget windows.
- Secrets: never in config, logs, errors or events. Use `secrets.rs` only.
- Network: only through `poller.rs`. No `setInterval`/`fetch` for remote data in the webview.
- Keep it simple: no new dependency, abstraction or setting unless a requirement in the plan needs it.
- No tests are to be written for this project.
- Commit style: Conventional Commits, small and focused.
