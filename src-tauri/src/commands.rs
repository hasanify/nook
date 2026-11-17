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
pub async fn add_widget(app: AppHandle, kind: String) -> Result<WidgetInstance, String> {
    let instance = windows::spawn_new_widget(&app, &kind)?;
    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [instance.id], "app": false }),
    );
    Ok(instance)
}

#[tauri::command]
pub async fn duplicate_widget(app: AppHandle, id: String) -> Result<WidgetInstance, String> {
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

    windows::spawn_widget(&app, &clone)?;

    state.config.update_config(|cfg| {
        cfg.widgets.push(clone.clone());
    });

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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_name: String,
    pub release_url: String,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
}

fn parse_version(v: &str) -> (u64, u64, u64) {
    let clean = v.trim().trim_start_matches('v');
    let mut parts = clean.split('.');
    let major = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let patch = parts
        .next()
        .and_then(|p| p.split('-').next())
        .and_then(|p| p.parse().ok())
        .unwrap_or(0);
    (major, minor, patch)
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    parse_version(latest) > parse_version(current)
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();
    let client = reqwest::Client::builder()
        .user_agent("Nook-App")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = "https://api.github.com/repos/hasanify/nook/releases/latest";
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch latest release: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API returned HTTP status {}", resp.status()));
    }

    let release: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse release response: {}", e))?;

    let tag_name = release["tag_name"]
        .as_str()
        .ok_or_else(|| "Missing tag_name in release".to_string())?;

    let release_name = release["name"].as_str().unwrap_or(tag_name).to_string();

    let release_url = release["html_url"]
        .as_str()
        .unwrap_or("https://github.com/hasanify/nook/releases")
        .to_string();

    let release_notes = release["body"].as_str().map(|s| s.to_string());
    let has_update = is_newer_version(tag_name, &current_version);

    let mut download_url = None;
    let mut asset_name = None;

    if let Some(assets) = release["assets"].as_array() {
        for asset in assets {
            if let Some(name) = asset["name"].as_str() {
                if name.ends_with(".exe") {
                    asset_name = Some(name.to_string());
                    download_url = asset["browser_download_url"]
                        .as_str()
                        .map(|s| s.to_string());
                    break;
                }
            }
        }
    }

    Ok(UpdateCheckResult {
        current_version,
        latest_version: tag_name.trim_start_matches('v').to_string(),
        has_update,
        release_name,
        release_url,
        release_notes,
        download_url,
        asset_name,
    })
}

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    download_url: String,
    asset_name: String,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Nook-App")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut resp = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to start update download: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with status: {}", resp.status()));
    }

    let temp_dir = std::env::temp_dir();
    let safe_name = if asset_name.is_empty() {
        "Nook_Setup.exe".to_string()
    } else {
        asset_name
    };
    let dest_path = temp_dir.join(&safe_name);

    let total_size = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = std::fs::File::create(&dest_path)
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;

    use std::io::Write;
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Error while downloading: {}", e))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write to file: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = ((downloaded as f64 / total_size as f64) * 100.0) as u32;
            let _ = app.emit(
                "update-download-progress",
                serde_json::json!({ "percent": percent }),
            );
        }
    }
    drop(file);

    info!(
        "Update downloaded to {:?}, launching installer...",
        dest_path
    );

    #[cfg(windows)]
    {
        std::process::Command::new(&dest_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        app.exit(0);
    }

    Ok(())
}

#[tauri::command]
pub async fn list_vercel_projects(
) -> Result<Vec<crate::providers::vercel::VercelProjectSummary>, String> {
    let token = crate::secrets::get_secret("vercel");
    let client = reqwest::Client::new();
    crate::providers::vercel::list_projects(&client, token.as_deref()).await
}
