use crate::pin::{self, PinStrategy};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tracing::info;
use windows::Win32::Foundation::{HWND, RECT};

pub fn spawn_placeholder(app: &AppHandle) -> Result<(), String> {
    info!("Spawning placeholder widget window");

    // If window already exists, focus and show it
    if let Some(window) = app.get_webview_window("widget-placeholder") {
        let _ = window.show();
        return Ok(());
    }

    let url = WebviewUrl::App("index.html?w=placeholder".into());

    let window = WebviewWindowBuilder::new(app, "widget-placeholder", url)
        .title("Nook Placeholder")
        .decorations(false)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focused(false)
        .visible(false)
        .transparent(false)
        .build()
        .map_err(|e| format!("Failed to build placeholder webview window: {}", e))?;

    let raw_hwnd = window
        .hwnd()
        .map_err(|e| format!("Failed to get raw HWND from webview window: {}", e))?;

    let hwnd = HWND(raw_hwnd.0);

    // Attempt to attach to desktop host (AboveIcons), or gracefully fall back to BottomToplevel
    let strategy = match pin::attach(hwnd, 0.95) {
        Ok(strat) => {
            info!("Successfully attached with strategy: {:?}", strat);
            strat
        }
        Err(err) => {
            info!(
                "Desktop attach failed ({}), using BottomToplevel fallback",
                err
            );
            pin::attach_bottom(hwnd, 0.95).map_err(|e| format!("Failed to attach window: {}", e))?
        }
    };

    // Apply default initial bounds (logical 340x320 at offset 160, 120)
    let initial_rect = RECT {
        left: 160,
        top: 120,
        right: 160 + 340,
        bottom: 120 + 320,
    };

    pin::set_bounds_screen(hwnd, initial_rect, strategy, 16)
        .map_err(|e| format!("Failed to set initial window bounds: {}", e))?;

    // Display the attached window
    window
        .show()
        .map_err(|e| format!("Failed to show placeholder window: {}", e))?;

    info!("Placeholder widget window successfully spawned and pinned");
    Ok(())
}

pub fn update_widget_bounds(
    app: &AppHandle,
    label: &str,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    strategy: PinStrategy,
) -> Result<(), String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    let raw_hwnd = window
        .hwnd()
        .map_err(|e| format!("Failed to get HWND: {}", e))?;

    let hwnd = HWND(raw_hwnd.0);

    let rect = RECT {
        left: x,
        top: y,
        right: x + w.max(200),
        bottom: y + h.max(160),
    };

    pin::set_bounds_screen(hwnd, rect, strategy, 16)
}

pub fn switch_widget_strategy(
    app: &AppHandle,
    label: &str,
    strategy: &str,
) -> Result<String, String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    let raw_hwnd = window
        .hwnd()
        .map_err(|e| format!("Failed to get HWND: {}", e))?;
    let hwnd = HWND(raw_hwnd.0);

    match strategy {
        "above-icons" => match pin::attach(hwnd, 0.95) {
            Ok(_) => Ok("AboveIcons".to_string()),
            Err(e) => Err(format!("AboveIcons unavailable: {}", e)),
        },
        "bottom" => {
            pin::attach_bottom(hwnd, 0.95)?;
            Ok("BottomToplevel".to_string())
        }
        "topmost" => {
            pin::detach_to_topmost(hwnd, 0.95)?;
            Ok("Topmost".to_string())
        }
        other => Err(format!("Unknown strategy: {}", other)),
    }
}

pub fn verify_widget_pin(app: &AppHandle, label: &str) -> Result<bool, String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("Window '{}' not found", label))?;

    let raw_hwnd = window
        .hwnd()
        .map_err(|e| format!("Failed to get HWND: {}", e))?;
    let hwnd = HWND(raw_hwnd.0);

    Ok(pin::verify(hwnd))
}
