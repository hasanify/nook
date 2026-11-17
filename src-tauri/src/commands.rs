use crate::pin::PinStrategy;
use crate::windows;
use tauri::AppHandle;

#[tauri::command]
pub fn set_bounds(
    app: AppHandle,
    label: String,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
) -> Result<(), String> {
    windows::update_widget_bounds(&app, &label, x, y, w, h, PinStrategy::AboveIcons)
}

#[tauri::command]
pub fn switch_pin_strategy(
    app: AppHandle,
    label: String,
    strategy: String,
) -> Result<String, String> {
    windows::switch_widget_strategy(&app, &label, &strategy)
}

#[tauri::command]
pub fn verify_desktop_pin(app: AppHandle, label: String) -> Result<bool, String> {
    windows::verify_widget_pin(&app, &label)
}
