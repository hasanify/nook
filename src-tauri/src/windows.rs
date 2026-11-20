use crate::config::{MonitorRef, Rect, WidgetInstance};
use crate::pin::{self, PinStrategy};
use crate::state::AppState;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tracing::info;
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

    let (min_w, min_h) = {
        let reg = crate::registry::ManifestRegistry::new();
        if let Some(m) = reg.get(&instance.kind) {
            (m.min_size.w as f64, m.min_size.h as f64)
        } else {
            (200.0, 160.0)
        }
    };

    let window = WebviewWindowBuilder::new(app, &label, url)
        .title(format!("Nook Widget ({})", instance.kind))
        .inner_size(instance.rect.w as f64, instance.rect.h as f64)
        .min_inner_size(min_w, min_h)
        .maximizable(false)
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false)
        .visible(false)
        .transparent(true)
        .build()
        .map_err(|e| format!("Failed to build webview window '{}': {}", label, e))?;

    let raw_hwnd = window
        .hwnd()
        .map_err(|e| format!("Failed to get raw HWND from '{}': {}", label, e))?;
    let hwnd = HWND(raw_hwnd.0);

    pin::disable_system_menu(hwnd);

    let strategy = if instance.always_on_top {
        pin::detach_to_topmost(hwnd, instance.opacity)?
    } else {
        match pin::attach(hwnd, instance.opacity) {
            Ok(strat) => strat,
            Err(e) => {
                tracing::warn!("pin::attach failed, falling back to bottom: {}", e);
                pin::attach_bottom(hwnd, instance.opacity)?
            }
        }
    };

    let scale = window.scale_factor().unwrap_or(1.0);
    let phys_x = (instance.rect.x as f64 * scale).round() as i32;
    let phys_y = (instance.rect.y as f64 * scale).round() as i32;
    let phys_w = (instance.rect.w as f64 * scale).round() as i32;
    let phys_h = (instance.rect.h as f64 * scale).round() as i32;

    let screen_rect = RECT {
        left: phys_x,
        top: phys_y,
        right: phys_x + phys_w,
        bottom: phys_y + phys_h,
    };

    pin::set_bounds_screen(hwnd, screen_rect, strategy)?;

    // Ensure pure DirectComposition transparency without window effects
    let _ = window.set_effects(None);

    window
        .show()
        .map_err(|e| format!("Failed to show window '{}': {}", label, e))?;

    info!("Successfully spawned and positioned widget '{}'", label);
    Ok(())
}

pub fn get_primary_work_area() -> (i32, i32, i32, i32) {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::UI::WindowsAndMessaging::{
            SystemParametersInfoW, SPI_GETWORKAREA, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS,
        };
        let mut rc = RECT::default();
        if SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            Some(&mut rc as *mut _ as *mut _),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        )
        .is_ok()
        {
            let width = rc.right - rc.left;
            let height = rc.bottom - rc.top;
            if width > 0 && height > 0 {
                return (rc.left, rc.top, width, height);
            }
        }
    }
    (0, 0, 1920, 1080)
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

    let scale = app
        .webview_windows()
        .values()
        .next()
        .and_then(|w| w.scale_factor().ok())
        .unwrap_or(1.0);

    let (raw_left, raw_top, raw_w, _) = get_primary_work_area();
    let work_left = (raw_left as f64 / scale).round() as i32;
    let work_top = (raw_top as f64 / scale).round() as i32;
    let work_w = (raw_w as f64 / scale).round() as i32;
    let (x, y) = if kind == "placeholder" {
        (
            (work_left + work_w - default_w - 24 - stagger_offset).max(work_left),
            work_top + 24 + stagger_offset,
        )
    } else {
        (160 + stagger_offset, 120 + stagger_offset)
    };

    let instance = WidgetInstance {
        id: id.clone(),
        kind: kind.to_string(),
        rect: Rect {
            x,
            y,
            w: default_w,
            h: default_h,
        },
        monitor: MonitorRef::default(),
        opacity: 0.95,
        always_on_top: false,
        settings: serde_json::Map::new(),
        state: serde_json::Map::new(),
    };

    spawn_widget(app, &instance)?;

    state.config.update_config(|cfg| {
        cfg.widgets.push(instance.clone());
    });

    Ok(instance)
}

pub fn ensure_all_widgets(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let config = state.config.get_config();

    for instance in config.widgets {
        let label = format!("widget-{}", instance.id);
        if let Some(window) = app.get_webview_window(&label) {
            if let Ok(raw_hwnd) = window.hwnd() {
                let hwnd = HWND(raw_hwnd.0);
                if !instance.always_on_top && !pin::verify(hwnd) {
                    info!("Widget '{}' lost desktop attach, re-attaching", label);
                    if pin::attach(hwnd, instance.opacity).is_err() {
                        let _ = pin::attach_bottom(hwnd, instance.opacity);
                    }
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
                pin::disable_system_menu(hwnd);
                let strategy = if instance.always_on_top {
                    PinStrategy::Topmost
                } else {
                    PinStrategy::AboveIcons
                };

                let scale = window.scale_factor().unwrap_or(1.0);
                let phys_x = (instance.rect.x as f64 * scale).round() as i32;
                let phys_y = (instance.rect.y as f64 * scale).round() as i32;
                let phys_w = (instance.rect.w as f64 * scale).round() as i32;
                let phys_h = (instance.rect.h as f64 * scale).round() as i32;

                let screen_rect = RECT {
                    left: phys_x,
                    top: phys_y,
                    right: phys_x + phys_w,
                    bottom: phys_y + phys_h,
                };

                let _ = pin::set_bounds_screen(hwnd, screen_rect, strategy);
            }
        }
    }

    Ok(())
}

fn snap_to_grid(val: i32, grid: i32) -> i32 {
    if grid <= 1 {
        return val;
    }
    let half = grid / 2;
    if val >= 0 {
        ((val + half) / grid) * grid
    } else {
        ((val - half) / grid) * grid
    }
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

    // Grid snap if configured (> 1)
    let grid_snap = config.app.grid_snap;
    if grid_snap > 1 {
        x = snap_to_grid(x, grid_snap);
        y = snap_to_grid(y, grid_snap);
        w = snap_to_grid(w, grid_snap);
        h = snap_to_grid(h, grid_snap);
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
    } else if pin::verify(hwnd) {
        PinStrategy::AboveIcons
    } else {
        PinStrategy::BottomToplevel
    };

    let scale = window.scale_factor().unwrap_or(1.0);
    let phys_x = (x as f64 * scale).round() as i32;
    let phys_y = (y as f64 * scale).round() as i32;
    let phys_w = (w as f64 * scale).round() as i32;
    let phys_h = (h as f64 * scale).round() as i32;

    let rect = RECT {
        left: phys_x,
        top: phys_y,
        right: phys_x + phys_w,
        bottom: phys_y + phys_h,
    };

    pin::set_bounds_screen(hwnd, rect, strategy)?;

    if commit {
        state.config.update_config(|cfg| {
            if let Some(target) = cfg.widgets.iter_mut().find(|w| w.id == id) {
                target.rect = Rect { x, y, w, h };
            }
        });

        let _ = app.emit(
            "config-changed",
            serde_json::json!({ "ids": [id], "app": false }),
        );
    }

    Ok(())
}

pub fn sync_widget_effects(_app: &AppHandle, _widget_id: Option<&str>) {}

pub fn handle_widget_move_end(app: &AppHandle, hwnd: HWND) {
    let windows = app.webview_windows();
    let target = windows
        .values()
        .find(|w| w.hwnd().map(|h| HWND(h.0) == hwnd).unwrap_or(false));

    if let Some(window) = target {
        let label = window.label().to_string();
        if let Some(id) = label.strip_prefix("widget-") {
            let mut rc = RECT::default();
            unsafe {
                if windows::Win32::UI::WindowsAndMessaging::GetWindowRect(hwnd, &mut rc).is_ok() {
                    let scale = window.scale_factor().unwrap_or(1.0);
                    let mut x = (rc.left as f64 / scale).round() as i32;
                    let mut y = (rc.top as f64 / scale).round() as i32;
                    let mut w = ((rc.right - rc.left) as f64 / scale).round() as i32;
                    let mut h = ((rc.bottom - rc.top) as f64 / scale).round() as i32;

                    let state = app.state::<AppState>();
                    let (min_w, min_h) = {
                        let reg = crate::registry::ManifestRegistry::new();
                        let kind = state
                            .config
                            .get_config()
                            .widgets
                            .iter()
                            .find(|w| w.id == id)
                            .map(|w| w.kind.clone());
                        if let Some(k) = kind {
                            if let Some(m) = reg.get(&k) {
                                (m.min_size.w, m.min_size.h)
                            } else {
                                (200, 160)
                            }
                        } else {
                            (200, 160)
                        }
                    };

                    let grid_snap = state.config.get_config().app.grid_snap;
                    if grid_snap > 0 {
                        x = snap_to_grid(x, grid_snap);
                        y = snap_to_grid(y, grid_snap);
                        w = snap_to_grid(w, grid_snap);
                        h = snap_to_grid(h, grid_snap);
                    }
                    w = w.max(min_w);
                    h = h.max(min_h);

                    let phys_x = (x as f64 * scale).round() as i32;
                    let phys_y = (y as f64 * scale).round() as i32;
                    let phys_w = (w as f64 * scale).round() as i32;
                    let phys_h = (h as f64 * scale).round() as i32;
                    let rect = RECT {
                        left: phys_x,
                        top: phys_y,
                        right: phys_x + phys_w,
                        bottom: phys_y + phys_h,
                    };
                    let strategy = if state
                        .config
                        .get_config()
                        .widgets
                        .iter()
                        .find(|w| w.id == id)
                        .map(|w| w.always_on_top)
                        .unwrap_or(false)
                    {
                        PinStrategy::Topmost
                    } else {
                        PinStrategy::BottomToplevel
                    };
                    let _ = pin::set_bounds_screen(hwnd, rect, strategy);

                    let id_str = id.to_string();
                    state.config.update_config(|cfg| {
                        if let Some(w_item) =
                            cfg.widgets.iter_mut().find(|w_item| w_item.id == id_str)
                        {
                            w_item.rect = Rect { x, y, w, h };
                        }
                    });

                    let _ = app.emit(
                        "config-changed",
                        serde_json::json!({ "ids": [id_str], "app": false }),
                    );
                }
            }
        }
    }
}

pub fn set_widget_opacity(app: &AppHandle, id: &str, opacity: f32) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.config.update_config(|cfg| {
        if let Some(target) = cfg.widgets.iter_mut().find(|w| w.id == id) {
            target.opacity = opacity.clamp(0.1, 1.0);
        }
    });

    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [id], "app": false }),
    );

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
        let _ = window.set_skip_taskbar(false);
        let _ = window.show();
        let _ = window.unminimize();
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

    let mut builder = WebviewWindowBuilder::new(app, LABEL, url)
        .title("Nook Settings")
        .decorations(true)
        .skip_taskbar(false)
        .resizable(true)
        .inner_size(720.0, 600.0)
        .min_inner_size(540.0, 440.0)
        .visible(false)
        .center();

    if let Some(icon) = app.default_window_icon() {
        builder = builder
            .icon(icon.clone())
            .map_err(|e| format!("Failed to set settings window icon: {}", e))?;
    }

    let _window = builder
        .build()
        .map_err(|e| format!("Failed to create settings window: {}", e))?;

    // Window remains hidden until frontend is mounted and calls show_settings_window
    Ok(())
}

pub fn apply_window_corners(hwnd: HWND) {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE,
        };
        let pref: u32 = 2; // DWMWCP_ROUND (rounds corners to 16px radius)
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &pref as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );
    }
}

pub fn ensure_context_menu_window(app: &AppHandle) -> Result<(), String> {
    const LABEL: &str = "widget-context-menu";
    const MENU_W: f64 = 204.0;
    const MENU_H: f64 = 300.0;

    if app.get_webview_window(LABEL).is_some() {
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?view=context-menu".into());
    let _window = WebviewWindowBuilder::new(app, LABEL, url)
        .title("Nook Menu")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .shadow(false)
        .inner_size(MENU_W, MENU_H)
        .visible(false)
        .focused(false)
        .build()
        .map_err(|e| format!("Failed to create context menu window: {}", e))?;

    info!("Pre-initialized context menu window: {}", LABEL);
    Ok(())
}

pub fn show_context_menu_window(
    app: &AppHandle,
    widget_id: &str,
    _screen_x: Option<i32>,
    _screen_y: Option<i32>,
) -> Result<(), String> {
    const LABEL: &str = "widget-context-menu";
    const MENU_W: i32 = 204;
    const MENU_H: i32 = 300;

    #[cfg(windows)]
    let (mut phys_x, mut phys_y) = unsafe {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        let mut pt = POINT::default();
        let _ = GetCursorPos(&mut pt);
        (pt.x, pt.y)
    };
    #[cfg(not(windows))]
    let (mut phys_x, mut phys_y) = (100, 100);

    let (work_left, work_top, work_w, work_h) = get_primary_work_area();
    if phys_x + MENU_W > work_left + work_w {
        phys_x = (work_left + work_w - MENU_W).max(work_left);
    }
    if phys_y + MENU_H > work_top + work_h {
        phys_y = (work_top + work_h - MENU_H).max(work_top);
    }

    let window = match app.get_webview_window(LABEL) {
        Some(w) => w,
        None => {
            ensure_context_menu_window(app)?;
            app.get_webview_window(LABEL)
                .ok_or_else(|| "Failed to get context menu window".to_string())?
        }
    };

    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
        phys_x, phys_y,
    )));
    let _ = window.emit(
        "context-menu-open",
        serde_json::json!({ "widgetId": widget_id }),
    );
    let _ = window.show();
    let _ = window.set_focus();

    #[cfg(windows)]
    unsafe {
        if let Ok(raw_hwnd) = window.hwnd() {
            use windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow;
            let _ = SetForegroundWindow(HWND(raw_hwnd.0));
        }
    }

    Ok(())
}

pub fn hide_context_menu_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("widget-context-menu") {
        let _ = window.hide();
    }
    Ok(())
}
