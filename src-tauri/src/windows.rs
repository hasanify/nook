use crate::config::{MonitorRef, Rect, WidgetInstance};
use crate::pin::{self, PinStrategy};
use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tracing::{info, warn};
use windows::Win32::Foundation::{HWND, RECT};

pub fn spawn_widget(app: &AppHandle, instance: &WidgetInstance) -> Result<(), String> {
    let label = format!("widget-{}", instance.id);
    info!("Spawning widget window: {}", label);

    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.show();
        return Ok(());
    }

    let url_str = format!("index.html?w={}", instance.id);
    let url = WebviewUrl::App(url_str.into());

    let window = WebviewWindowBuilder::new(app, &label, url)
        .title(format!("Nook Widget ({})", instance.kind))
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false)
        .visible(false)
        .transparent(false)
        .build()
        .map_err(|e| format!("Failed to build webview window '{}': {}", label, e))?;

    let raw_hwnd = window
        .hwnd()
        .map_err(|e| format!("Failed to get raw HWND from '{}': {}", label, e))?;
    let hwnd = HWND(raw_hwnd.0);

    let strategy = if instance.always_on_top {
        pin::detach_to_topmost(hwnd, instance.opacity)?
    } else {
        match pin::attach(hwnd, instance.opacity) {
            Ok(strat) => strat,
            Err(err) => {
                warn!(
                    "Desktop attach failed for '{}' ({}), falling back to BottomToplevel",
                    label, err
                );
                pin::attach_bottom(hwnd, instance.opacity)?
            }
        }
    };

    let screen_rect = RECT {
        left: instance.rect.x,
        top: instance.rect.y,
        right: instance.rect.x + instance.rect.w,
        bottom: instance.rect.y + instance.rect.h,
    };

    pin::set_bounds_screen(hwnd, screen_rect, strategy, 16)?;

    window
        .show()
        .map_err(|e| format!("Failed to show window '{}': {}", label, e))?;

    info!("Successfully spawned and positioned widget '{}'", label);
    Ok(())
}

pub fn spawn_new_widget(app: &AppHandle, kind: &str) -> Result<WidgetInstance, String> {
    let id = format!("w_{}", uuid::Uuid::new_v4().simple());
    let state = app.state::<AppState>();

    let existing_count = state.config.get_config().widgets.len();
    let stagger_offset = 24 * (existing_count as i32 % 6);

    let (default_w, default_h) = {
        let reg = crate::registry::ManifestRegistry::new();
        if let Some(m) = reg.get(kind) {
            (m.default_size.w, m.default_size.h)
        } else {
            (320, 240)
        }
    };

    let instance = WidgetInstance {
        id: id.clone(),
        kind: kind.to_string(),
        rect: Rect {
            x: 160 + stagger_offset,
            y: 120 + stagger_offset,
            w: default_w,
            h: default_h,
        },
        monitor: MonitorRef::default(),
        opacity: 0.95,
        always_on_top: false,
        settings: serde_json::Map::new(),
        state: serde_json::Map::new(),
    };

    state.config.update_config(|cfg| {
        cfg.widgets.push(instance.clone());
    });

    spawn_widget(app, &instance)?;
    Ok(instance)
}

pub fn ensure_all_widgets(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let config = state.config.get_config();

    // If config has no widgets yet, spawn at least one placeholder widget for user interaction
    if config.widgets.is_empty() {
        let placeholder = WidgetInstance {
            id: "placeholder".to_string(),
            kind: "placeholder".to_string(),
            rect: Rect {
                x: 160,
                y: 120,
                w: 340,
                h: 320,
            },
            monitor: MonitorRef::default(),
            opacity: 0.95,
            always_on_top: false,
            settings: serde_json::Map::new(),
            state: serde_json::Map::new(),
        };
        state.config.update_config(|cfg| {
            cfg.widgets.push(placeholder.clone());
        });
        return spawn_widget(app, &placeholder);
    }

    for instance in config.widgets {
        let label = format!("widget-{}", instance.id);
        if let Some(window) = app.get_webview_window(&label) {
            if let Ok(raw_hwnd) = window.hwnd() {
                let hwnd = HWND(raw_hwnd.0);
                if !instance.always_on_top && !pin::verify(hwnd) {
                    info!("Widget '{}' lost desktop attach, re-attaching", label);
                    let _ = pin::attach(hwnd, instance.opacity);
                }
            }
        } else {
            info!("Widget window '{}' missing, recreating from config", label);
            let _ = spawn_widget(app, &instance);
        }
    }

    Ok(())
}

pub fn relayout_all_widgets(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let config = state.config.get_config();

    for instance in config.widgets {
        let label = format!("widget-{}", instance.id);
        if let Some(window) = app.get_webview_window(&label) {
            if let Ok(raw_hwnd) = window.hwnd() {
                let hwnd = HWND(raw_hwnd.0);
                let strategy = if instance.always_on_top {
                    PinStrategy::Topmost
                } else {
                    PinStrategy::AboveIcons
                };

                let screen_rect = RECT {
                    left: instance.rect.x,
                    top: instance.rect.y,
                    right: instance.rect.x + instance.rect.w,
                    bottom: instance.rect.y + instance.rect.h,
                };

                let _ = pin::set_bounds_screen(hwnd, screen_rect, strategy, 16);
            }
        }
    }

    Ok(())
}

pub fn update_widget_geometry(
    app: &AppHandle,
    id: &str,
    mut x: i32,
    mut y: i32,
    mut w: i32,
    mut h: i32,
    commit: bool,
) -> Result<(), String> {
    let label = format!("widget-{}", id);
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    let state = app.state::<AppState>();
    let config = state.config.get_config();

    // Min size constraints
    w = w.max(200);
    h = h.max(160);

    // Grid snap if configured
    let grid_snap = config.app.grid_snap;
    if grid_snap > 0 {
        x = (x / grid_snap) * grid_snap;
        y = (y / grid_snap) * grid_snap;
        w = (w / grid_snap) * grid_snap;
        h = (h / grid_snap) * grid_snap;
    }

    let raw_hwnd = window
        .hwnd()
        .map_err(|e| format!("Failed to get HWND: {}", e))?;
    let hwnd = HWND(raw_hwnd.0);

    let is_always_on_top = config
        .widgets
        .iter()
        .find(|w| w.id == id)
        .map(|w| w.always_on_top)
        .unwrap_or(false);

    let strategy = if is_always_on_top {
        PinStrategy::Topmost
    } else {
        PinStrategy::AboveIcons
    };

    let rect = RECT {
        left: x,
        top: y,
        right: x + w,
        bottom: y + h,
    };

    pin::set_bounds_screen(hwnd, rect, strategy, 16)?;

    if commit {
        state.config.update_config(|cfg| {
            if let Some(target) = cfg.widgets.iter_mut().find(|w| w.id == id) {
                target.rect = Rect { x, y, w, h };
            }
        });
    }

    Ok(())
}

pub fn set_widget_opacity(app: &AppHandle, id: &str, opacity: f32) -> Result<(), String> {
    let label = format!("widget-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        if let Ok(raw) = window.hwnd() {
            let hwnd = HWND(raw.0);
            let state = app.state::<AppState>();
            let cfg = state.config.get_config();
            let is_topmost = cfg
                .widgets
                .iter()
                .find(|w| w.id == id)
                .map(|w| w.always_on_top)
                .unwrap_or(false);

            if is_topmost {
                let _ = pin::detach_to_topmost(hwnd, opacity);
            } else if pin::attach(hwnd, opacity).is_err() {
                let _ = pin::attach_bottom(hwnd, opacity);
            }
        }
    }
    Ok(())
}

pub fn set_widget_always_on_top(app: &AppHandle, id: &str, on: bool) -> Result<(), String> {
    let label = format!("widget-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        if let Ok(raw) = window.hwnd() {
            let hwnd = HWND(raw.0);
            let state = app.state::<AppState>();
            let cfg = state.config.get_config();
            let opacity = cfg
                .widgets
                .iter()
                .find(|w| w.id == id)
                .map(|w| w.opacity)
                .unwrap_or(0.95);

            if on {
                pin::detach_to_topmost(hwnd, opacity)?;
            } else if pin::attach(hwnd, opacity).is_err() {
                pin::attach_bottom(hwnd, opacity)?;
            }
        }
    }
    Ok(())
}

pub fn verify_widget_pin(app: &AppHandle, id: &str) -> Result<bool, String> {
    let label = format!("widget-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        if let Ok(raw) = window.hwnd() {
            let hwnd = HWND(raw.0);
            return Ok(pin::verify(hwnd));
        }
    }
    Ok(false)
}

pub fn open_settings_window(app: &AppHandle, widget_id: Option<String>) -> Result<(), String> {
    const LABEL: &str = "settings";

    if let Some(window) = app.get_webview_window(LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(w_id) = widget_id {
            let _ = window.emit("focus-widget", serde_json::json!({ "id": w_id }));
        }
        return Ok(());
    }

    let url_str = match &widget_id {
        Some(w_id) => format!("index.html?view=settings&w={}", w_id),
        None => "index.html?view=settings".to_string(),
    };
    let url = WebviewUrl::App(url_str.into());

    let window = WebviewWindowBuilder::new(app, LABEL, url)
        .title("Nook Settings")
        .decorations(true)
        .skip_taskbar(true)
        .resizable(true)
        .inner_size(680.0, 560.0)
        .min_inner_size(520.0, 420.0)
        .center()
        .build()
        .map_err(|e| format!("Failed to create settings window: {}", e))?;

    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}
