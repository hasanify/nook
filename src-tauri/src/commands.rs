use crate::config::{AppConfig, WidgetInstance};
use crate::state::AppState;
use crate::windows;
use tauri::{AppHandle, Emitter, Manager};
use tracing::info;

#[tauri::command]
pub fn get_app_config(state: tauri::State<AppState>) -> AppConfig {
    state.config.get_config()
}

#[tauri::command]
pub fn get_instance(state: tauri::State<AppState>, id: String) -> Result<WidgetInstance, String> {
    let cfg = state.config.get_config();
    cfg.widgets
        .into_iter()
        .find(|w| w.id == id)
        .ok_or_else(|| format!("Widget with id '{}' not found", id))
}

#[tauri::command]
pub fn add_widget(app: AppHandle, kind: String) -> Result<WidgetInstance, String> {
    let instance = windows::spawn_new_widget(&app, &kind)?;
    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [instance.id], "app": false }),
    );
    Ok(instance)
}

#[tauri::command]
pub fn duplicate_widget(app: AppHandle, id: String) -> Result<WidgetInstance, String> {
    let state = app.state::<AppState>();
    let original = state
        .config
        .get_config()
        .widgets
        .into_iter()
        .find(|w| w.id == id)
        .ok_or_else(|| format!("Widget '{}' not found", id))?;

    let new_id = format!("w_{}", uuid::Uuid::new_v4().simple());
    let mut clone = original.clone();
    clone.id = new_id.clone();
    clone.rect.x += 24;
    clone.rect.y += 24;

    state.config.update_config(|cfg| {
        cfg.widgets.push(clone.clone());
    });

    windows::spawn_widget(&app, &clone)?;
    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [new_id], "app": false }),
    );
    Ok(clone)
}

#[tauri::command]
pub fn remove_widget(app: AppHandle, id: String) -> Result<(), String> {
    let label = format!("widget-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.destroy();
    }

    let state = app.state::<AppState>();
    state.config.update_config(|cfg| {
        cfg.widgets.retain(|w| w.id != id);
    });

    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [id], "app": false }),
    );
    Ok(())
}

#[tauri::command]
pub fn set_bounds(
    app: AppHandle,
    id: String,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    commit: Option<bool>,
) -> Result<(), String> {
    windows::update_widget_geometry(&app, &id, x, y, w, h, commit.unwrap_or(false))
}

#[tauri::command]
pub fn get_edit_mode(state: tauri::State<AppState>) -> bool {
    state.is_edit_mode()
}

#[tauri::command]
pub fn set_edit_mode(app: AppHandle, on: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.set_edit_mode(on);
    info!("Edit mode set to: {}", on);
    let _ = app.emit("edit-mode", serde_json::json!({ "on": on }));
    Ok(())
}

#[tauri::command]
pub fn set_opacity(app: AppHandle, id: String, value: f32) -> Result<(), String> {
    windows::set_widget_opacity(&app, &id, value)?;

    let state = app.state::<AppState>();
    state.config.update_config(|cfg| {
        if let Some(target) = cfg.widgets.iter_mut().find(|w| w.id == id) {
            target.opacity = value;
        }
    });

    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [id], "app": false }),
    );
    Ok(())
}

#[tauri::command]
pub fn set_always_on_top(app: AppHandle, id: String, on: bool) -> Result<(), String> {
    windows::set_widget_always_on_top(&app, &id, on)?;

    let state = app.state::<AppState>();
    state.config.update_config(|cfg| {
        if let Some(target) = cfg.widgets.iter_mut().find(|w| w.id == id) {
            target.always_on_top = on;
        }
    });

    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [id], "app": false }),
    );
    Ok(())
}

#[tauri::command]
pub fn update_state(
    app: AppHandle,
    id: String,
    patch: serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.config.update_config(|cfg| {
        if let Some(target) = cfg.widgets.iter_mut().find(|w| w.id == id) {
            for (k, v) in patch {
                target.state.insert(k, v);
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    id: String,
    patch: serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.config.update_config(|cfg| {
        if let Some(target) = cfg.widgets.iter_mut().find(|w| w.id == id) {
            for (k, v) in patch {
                target.settings.insert(k, v);
            }
        }
    });

    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [id], "app": false }),
    );
    Ok(())
}

#[tauri::command]
pub fn verify_desktop_pin(app: AppHandle, id: String) -> Result<bool, String> {
    windows::verify_widget_pin(&app, &id)
}

#[tauri::command]
pub fn update_app_config(
    app: AppHandle,
    theme: Option<String>,
    grid_snap: Option<i32>,
    autostart: Option<bool>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.config.update_config(|cfg| {
        if let Some(t) = theme {
            cfg.app.theme = t;
        }
        if let Some(g) = grid_snap {
            cfg.app.grid_snap = g;
        }
        if let Some(a) = autostart {
            cfg.app.autostart = a;
        }
    });

    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [], "app": true }),
    );
    Ok(())
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle, widget_id: Option<String>) -> Result<(), String> {
    windows::open_settings_window(&app, widget_id)
}

#[tauri::command]
pub fn get_all_manifests() -> Vec<crate::registry::WidgetManifest> {
    let reg = crate::registry::ManifestRegistry::new();
    reg.list().into_iter().cloned().collect()
}

#[tauri::command]
pub async fn timer_schedule(
    app: AppHandle,
    id: String,
    ends_at_ms: u64,
    title: String,
    body: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state
        .timer_scheduler
        .schedule(app, id, ends_at_ms, title, body)
        .await;
    Ok(())
}

#[tauri::command]
pub async fn timer_cancel(id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.timer_scheduler.cancel(&id).await;
    Ok(())
}

#[tauri::command]
pub fn save_account_token(provider: String, token: String) -> Result<(), String> {
    crate::secrets::set_secret(&provider, &token)
}

#[tauri::command]
pub fn clear_account_token(provider: String) -> Result<(), String> {
    crate::secrets::delete_secret(&provider)
}

#[tauri::command]
pub fn has_account_token(provider: String) -> bool {
    crate::secrets::has_secret(&provider)
}

#[tauri::command]
pub async fn get_provider_snapshot(
    widget_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<crate::providers::ProviderPayload>, String> {
    Ok(state.poller.get_snapshot(&widget_id).await)
}

#[tauri::command]
pub async fn refresh_widget_provider(
    app: AppHandle,
    widget_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<crate::providers::ProviderPayload>, String> {
    Ok(state.poller.poll_widget_now(&app, &widget_id).await)
}
