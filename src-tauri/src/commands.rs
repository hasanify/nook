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

    windows::sync_widget_effects(&app, Some(&id));
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DesktopWorkArea {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    #[serde(rename = "scaleFactor")]
    pub scale_factor: f64,
}

#[tauri::command]
pub fn get_desktop_work_area(app: AppHandle) -> Result<DesktopWorkArea, String> {
    let scale = app
        .webview_windows()
        .values()
        .next()
        .and_then(|w| w.scale_factor().ok())
        .unwrap_or(1.0);

    let (raw_left, raw_top, raw_w, raw_h) = windows::get_primary_work_area();
    let x = (raw_left as f64 / scale).round() as i32;
    let y = (raw_top as f64 / scale).round() as i32;
    let w = (raw_w as f64 / scale).round() as i32;
    let h = (raw_h as f64 / scale).round() as i32;

    Ok(DesktopWorkArea {
        x,
        y,
        w,
        h,
        scale_factor: scale,
    })
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
pub fn batch_set_bounds(app: AppHandle, bounds: Vec<windows::WidgetBounds>) -> Result<(), String> {
    windows::batch_update_widget_geometries(&app, bounds)
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
pub fn get_widget_edit_mode(state: tauri::State<AppState>, id: String) -> bool {
    state.is_widget_edit_mode(&id)
}

#[tauri::command]
pub fn set_widget_edit_mode(app: AppHandle, id: String, on: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.set_widget_edit_mode(id.clone(), on);
    info!("Widget {} edit mode set to: {}", id, on);
    let _ = app.emit(
        "widget-edit-mode",
        serde_json::json!({ "id": id, "on": on }),
    );
    Ok(())
}

#[tauri::command]
pub fn set_opacity(app: AppHandle, id: String, value: f32) -> Result<(), String> {
    windows::set_widget_opacity(&app, &id, value)
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

    windows::sync_widget_effects(&app, Some(&id));
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

    windows::sync_widget_effects(&app, Some(&id));

    let app_clone = app.clone();
    let id_clone = id.clone();
    tauri::async_runtime::spawn(async move {
        let state = app_clone.state::<AppState>();
        let _ = state.poller.poll_widget_now(&app_clone, &id_clone).await;
    });

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
    widget_preset: Option<String>,
    default_ai_provider: Option<String>,
    auto_update: Option<bool>,
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
        if let Some(p) = widget_preset {
            cfg.app.widget_preset = p;
        }
        if let Some(ai) = default_ai_provider {
            cfg.app.default_ai_provider = if ai.is_empty() || ai == "auto" {
                None
            } else {
                Some(ai)
            };
        }
        if let Some(u) = auto_update {
            cfg.app.auto_update = u;
        }
    });

    if let Some(a) = autostart {
        #[cfg(windows)]
        {
            if a {
                if let Err(e) = crate::autostart::enable() {
                    tracing::warn!("Failed to enable autostart: {}", e);
                }
            } else if let Err(e) = crate::autostart::disable() {
                tracing::warn!("Failed to disable autostart: {}", e);
            }
        }
        #[cfg(not(windows))]
        {
            use tauri_plugin_autostart::ManagerExt;
            let autolaunch = app.autolaunch();
            if a {
                if let Err(e) = autolaunch.enable() {
                    tracing::warn!("Failed to enable autostart: {}", e);
                }
            } else if let Err(e) = autolaunch.disable() {
                tracing::warn!("Failed to disable autostart: {}", e);
            }
        }
    }

    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": [], "app": true }),
    );

    windows::sync_widget_effects(&app, None);
    Ok(())
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle, widget_id: Option<String>) -> Result<(), String> {
    windows::open_settings_window(&app, widget_id)
}

#[tauri::command]
pub fn open_context_menu(
    app: AppHandle,
    widget_id: String,
    screen_x: Option<i32>,
    screen_y: Option<i32>,
) -> Result<(), String> {
    windows::show_context_menu_window(&app, &widget_id, screen_x, screen_y)
}

#[tauri::command]
pub fn hide_context_menu(app: AppHandle) -> Result<(), String> {
    windows::hide_context_menu_window(&app)
}

#[tauri::command]
pub fn show_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.set_skip_taskbar(false);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(())
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
pub fn get_account_token(provider: String) -> Option<String> {
    crate::secrets::get_secret(&provider)
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
    let token = crate::secrets::get_secret("github");

    let client = reqwest::Client::builder()
        .user_agent("Nook-Desktop-Widgets/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let api_url = "https://api.github.com/repos/hasanify/nook/releases/latest";
    let mut req = client.get(api_url);
    if let Some(t) = &token {
        req = req.header("Authorization", format!("Bearer {}", t));
    }

    // Attempt 1: Official GitHub REST API
    if let Ok(resp) = req.send().await {
        if resp.status().is_success() {
            if let Ok(release) = resp.json::<serde_json::Value>().await {
                if let Some(tag_name) = release["tag_name"].as_str() {
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

                    return Ok(UpdateCheckResult {
                        current_version,
                        latest_version: tag_name.trim_start_matches('v').to_string(),
                        has_update,
                        release_name,
                        release_url,
                        release_notes,
                        download_url,
                        asset_name,
                    });
                }
            }
        }
    }

    // Attempt 2: Fallback to public web redirect if unauthenticated API is rate limited (HTTP 403/429)
    let no_redirect_client = reqwest::Client::builder()
        .user_agent("Nook-Desktop-Widgets/1.0")
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let web_res = no_redirect_client
        .get("https://github.com/hasanify/nook/releases/latest")
        .send()
        .await
        .map_err(|e| format!("Failed to check updates: {}", e))?;

    let location = web_res
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "Failed to resolve latest release URL from GitHub".to_string())?;

    // location format: https://github.com/hasanify/nook/releases/tag/v0.9.1
    let tag_name = location
        .rsplit('/')
        .next()
        .ok_or_else(|| "Invalid release redirect URL".to_string())?;

    let clean_version = tag_name.trim_start_matches('v');
    let has_update = is_newer_version(tag_name, &current_version);
    let release_url = format!("https://github.com/hasanify/nook/releases/tag/{}", tag_name);
    let release_name = format!("Nook {}", tag_name);

    let mut download_url = None;
    let mut asset_name = None;

    if has_update {
        let assets_url = format!(
            "https://github.com/hasanify/nook/releases/expanded_assets/{}",
            tag_name
        );
        if let Ok(assets_res) = client.get(&assets_url).send().await {
            if let Ok(html) = assets_res.text().await {
                for part in html.split("href=\"") {
                    if let Some(url_end) = part.find(".exe\"") {
                        let path = &part[..url_end + 4];
                        let full_url = if path.starts_with("http") {
                            path.to_string()
                        } else {
                            format!("https://github.com{}", path)
                        };
                        let name = full_url
                            .rsplit('/')
                            .next()
                            .unwrap_or("nook_setup.exe")
                            .to_string();
                        download_url = Some(full_url);
                        asset_name = Some(name);
                        break;
                    }
                }
            }
        }

        if download_url.is_none() {
            let default_name = format!("Nook_{}_x64-setup.exe", clean_version);
            download_url = Some(format!(
                "https://github.com/hasanify/nook/releases/download/{}/{}",
                tag_name, default_name
            ));
            asset_name = Some(default_name);
        }
    }

    Ok(UpdateCheckResult {
        current_version,
        latest_version: clean_version.to_string(),
        has_update,
        release_name,
        release_url,
        release_notes: None,
        download_url,
        asset_name,
    })
}

static IS_INSTALLING_UPDATE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    download_url: String,
    asset_name: String,
) -> Result<(), String> {
    if IS_INSTALLING_UPDATE.swap(true, std::sync::atomic::Ordering::SeqCst) {
        info!("Update installation is already in progress, skipping duplicate call.");
        return Ok(());
    }

    let client = reqwest::Client::builder()
        .user_agent("Nook-App")
        .build()
        .map_err(|e| {
            IS_INSTALLING_UPDATE.store(false, std::sync::atomic::Ordering::SeqCst);
            format!("Failed to create HTTP client: {}", e)
        })?;

    let mut resp = client.get(&download_url).send().await.map_err(|e| {
        IS_INSTALLING_UPDATE.store(false, std::sync::atomic::Ordering::SeqCst);
        format!("Failed to start update download: {}", e)
    })?;

    if !resp.status().is_success() {
        IS_INSTALLING_UPDATE.store(false, std::sync::atomic::Ordering::SeqCst);
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
    let mut file = std::fs::File::create(&dest_path).map_err(|e| {
        IS_INSTALLING_UPDATE.store(false, std::sync::atomic::Ordering::SeqCst);
        format!("Failed to create temporary file: {}", e)
    })?;

    use std::io::Write;
    while let Some(chunk) = resp.chunk().await.map_err(|e| {
        IS_INSTALLING_UPDATE.store(false, std::sync::atomic::Ordering::SeqCst);
        format!("Error while downloading: {}", e)
    })? {
        if let Err(e) = file.write_all(&chunk) {
            IS_INSTALLING_UPDATE.store(false, std::sync::atomic::Ordering::SeqCst);
            return Err(format!("Failed to write to file: {}", e));
        }
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
        use std::os::windows::ffi::OsStrExt;

        // Try standard spawn first; if elevation is required (os error 740), invoke via ShellExecuteW "runas"
        let spawn_res = std::process::Command::new(&dest_path).spawn();

        let launched = match spawn_res {
            Ok(_) => true,
            Err(e) if e.raw_os_error() == Some(740) => {
                extern "system" {
                    fn ShellExecuteW(
                        hwnd: isize,
                        lpOperation: *const u16,
                        lpFile: *const u16,
                        lpParameters: *const u16,
                        lpDirectory: *const u16,
                        nShowCmd: i32,
                    ) -> isize;
                }

                let wide_path: Vec<u16> =
                    dest_path.as_os_str().encode_wide().chain(Some(0)).collect();
                let wide_verb: Vec<u16> = std::ffi::OsStr::new("runas")
                    .encode_wide()
                    .chain(Some(0))
                    .collect();

                let ret = unsafe {
                    ShellExecuteW(
                        0,
                        wide_verb.as_ptr(),
                        wide_path.as_ptr(),
                        std::ptr::null(),
                        std::ptr::null(),
                        1, // SW_SHOWNORMAL
                    )
                };

                ret > 32
            }
            Err(e) => {
                // Also attempt ShellExecuteW fallback for any other spawn failure on Windows
                extern "system" {
                    fn ShellExecuteW(
                        hwnd: isize,
                        lpOperation: *const u16,
                        lpFile: *const u16,
                        lpParameters: *const u16,
                        lpDirectory: *const u16,
                        nShowCmd: i32,
                    ) -> isize;
                }

                let wide_path: Vec<u16> =
                    dest_path.as_os_str().encode_wide().chain(Some(0)).collect();
                let wide_verb: Vec<u16> = std::ffi::OsStr::new("runas")
                    .encode_wide()
                    .chain(Some(0))
                    .collect();

                let ret = unsafe {
                    ShellExecuteW(
                        0,
                        wide_verb.as_ptr(),
                        wide_path.as_ptr(),
                        std::ptr::null(),
                        std::ptr::null(),
                        1,
                    )
                };

                if ret > 32 {
                    true
                } else {
                    IS_INSTALLING_UPDATE.store(false, std::sync::atomic::Ordering::SeqCst);
                    return Err(format!("Failed to launch installer: {}", e));
                }
            }
        };

        if !launched {
            IS_INSTALLING_UPDATE.store(false, std::sync::atomic::Ordering::SeqCst);
            return Err("Failed to launch installer: Elevation was canceled or denied".to_string());
        }

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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PortInfo {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub protocol: String,
}

#[cfg(windows)]
fn resolve_process_name(pid: u32) -> String {
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    extern "system" {
        fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> isize;
        fn QueryFullProcessImageNameW(
            h_process: isize,
            dw_flags: u32,
            lp_exe_name: *mut u16,
            lpdw_size: *mut u32,
        ) -> i32;
        fn CloseHandle(h_object: isize) -> i32;
    }

    if pid == 0 {
        return "System Idle".to_string();
    }
    if pid == 4 {
        return "System".to_string();
    }

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle != 0 {
            let mut name_buf = [0u16; 1024];
            let mut len = 1024u32;
            let ok = QueryFullProcessImageNameW(handle, 0, name_buf.as_mut_ptr(), &mut len);
            CloseHandle(handle);
            if ok != 0 && len > 0 {
                let full_path = String::from_utf16_lossy(&name_buf[..len as usize]);
                if let Some(pos) = full_path.rfind('\\') {
                    full_path[pos + 1..].to_string()
                } else {
                    full_path
                }
            } else {
                format!("PID: {}", pid)
            }
        } else {
            format!("PID: {}", pid)
        }
    }
}

#[tauri::command]
pub async fn get_listening_ports() -> Result<Vec<PortInfo>, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            const AF_INET: u32 = 2;
            const AF_INET6: u32 = 23;
            const TCP_TABLE_OWNER_PID_ALL: u32 = 5;
            const MIB_TCP_STATE_LISTEN: u32 = 2;

            #[repr(C)]
            #[derive(Copy, Clone)]
            struct MibTcpRowOwnerPid {
                dw_state: u32,
                dw_local_addr: u32,
                dw_local_port: u32,
                dw_remote_addr: u32,
                dw_remote_port: u32,
                dw_owning_pid: u32,
            }

            #[repr(C)]
            #[derive(Copy, Clone)]
            struct MibTcp6RowOwnerPid {
                uc_local_addr: [u8; 16],
                dw_local_scope_id: u32,
                dw_local_port: u32,
                uc_remote_addr: [u8; 16],
                dw_remote_scope_id: u32,
                dw_remote_port: u32,
                dw_state: u32,
                dw_owning_pid: u32,
            }

            extern "system" {
                fn GetExtendedTcpTable(
                    p_tcp_table: *mut std::ffi::c_void,
                    pdw_size: *mut u32,
                    b_order: i32,
                    ul_af: u32,
                    table_class: u32,
                    reserved: u32,
                ) -> u32;
            }

            let mut ports: Vec<PortInfo> = Vec::new();
            let mut seen_ports = std::collections::HashSet::new();

            // 1. IPv4 TCP listening ports
            let mut size: u32 = 0;
            unsafe {
                GetExtendedTcpTable(
                    std::ptr::null_mut(),
                    &mut size,
                    1,
                    AF_INET,
                    TCP_TABLE_OWNER_PID_ALL,
                    0,
                );
            }

            if size > 0 {
                let mut buffer = vec![0u8; size as usize];
                let ret = unsafe {
                    GetExtendedTcpTable(
                        buffer.as_mut_ptr() as *mut std::ffi::c_void,
                        &mut size,
                        1,
                        AF_INET,
                        TCP_TABLE_OWNER_PID_ALL,
                        0,
                    )
                };

                if ret == 0 {
                    let num_entries = unsafe { *(buffer.as_ptr() as *const u32) };
                    let rows_ptr = unsafe { buffer.as_ptr().add(4) as *const MibTcpRowOwnerPid };

                    for i in 0..num_entries {
                        let row = unsafe { *rows_ptr.add(i as usize) };
                        if row.dw_state == MIB_TCP_STATE_LISTEN {
                            let port = u16::from_be((row.dw_local_port & 0xFFFF) as u16);
                            if port > 0 && !seen_ports.contains(&port) {
                                seen_ports.insert(port);
                                let pid = row.dw_owning_pid;
                                let process_name = resolve_process_name(pid);

                                ports.push(PortInfo {
                                    port,
                                    pid,
                                    process_name,
                                    protocol: "TCP".to_string(),
                                });
                            }
                        }
                    }
                }
            }

            // 2. IPv6 TCP listening ports
            let mut size6: u32 = 0;
            unsafe {
                GetExtendedTcpTable(
                    std::ptr::null_mut(),
                    &mut size6,
                    1,
                    AF_INET6,
                    TCP_TABLE_OWNER_PID_ALL,
                    0,
                );
            }

            if size6 > 0 {
                let mut buffer6 = vec![0u8; size6 as usize];
                let ret6 = unsafe {
                    GetExtendedTcpTable(
                        buffer6.as_mut_ptr() as *mut std::ffi::c_void,
                        &mut size6,
                        1,
                        AF_INET6,
                        TCP_TABLE_OWNER_PID_ALL,
                        0,
                    )
                };

                if ret6 == 0 {
                    let num_entries6 = unsafe { *(buffer6.as_ptr() as *const u32) };
                    let rows_ptr6 = unsafe { buffer6.as_ptr().add(4) as *const MibTcp6RowOwnerPid };

                    for i in 0..num_entries6 {
                        let row = unsafe { *rows_ptr6.add(i as usize) };
                        if row.dw_state == MIB_TCP_STATE_LISTEN {
                            let port = u16::from_be((row.dw_local_port & 0xFFFF) as u16);
                            if port > 0 && !seen_ports.contains(&port) {
                                seen_ports.insert(port);
                                let pid = row.dw_owning_pid;
                                let process_name = resolve_process_name(pid);

                                ports.push(PortInfo {
                                    port,
                                    pid,
                                    process_name,
                                    protocol: "TCP6".to_string(),
                                });
                            }
                        }
                    }
                }
            }

            ports.sort_by_key(|p| p.port);
            Ok(ports)
        }
        #[cfg(not(windows))]
        {
            Ok(Vec::new())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn kill_port_process(pid: u32) -> Result<(), String> {
    if pid <= 4 {
        return Err("Cannot terminate core system process".to_string());
    }
    tokio::task::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const PROCESS_TERMINATE: u32 = 0x0001;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            extern "system" {
                fn OpenProcess(
                    dw_desired_access: u32,
                    b_inherit_handle: i32,
                    dw_process_id: u32,
                ) -> isize;
                fn TerminateProcess(h_process: isize, u_exit_code: u32) -> i32;
                fn CloseHandle(h_object: isize) -> i32;
            }

            // Attempt 1: Direct TerminateProcess via standard Win32 API
            let direct_kill_ok = unsafe {
                let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
                if handle != 0 {
                    let ok = TerminateProcess(handle, 1);
                    CloseHandle(handle);
                    ok != 0
                } else {
                    false
                }
            };

            if direct_kill_ok {
                return Ok(());
            }

            // Attempt 2: Fallback to official Windows taskkill.exe
            // Standard system utility handles processes across sessions and trees cleanly
            let output = std::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            if let Ok(ref out) = output {
                if out.status.success() {
                    return Ok(());
                }
            }

            // Attempt 3: If PID is a Windows Service (e.g. AnyDesk, Postgres, Docker), stop the service
            let service_lookup = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!(
                        "Get-CimInstance Win32_Service -Filter 'ProcessId = {}' | Select-Object -ExpandProperty Name",
                        pid
                    ),
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            if let Ok(lookup_out) = service_lookup {
                let service_name = String::from_utf8_lossy(&lookup_out.stdout).trim().to_string();
                if !service_name.is_empty() {
                    // Try stopping the service via net.exe
                    let _ = std::process::Command::new("net")
                        .args(["stop", &service_name, "/y"])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output();

                    // Check if terminated
                    let still_alive = unsafe {
                        let h = OpenProcess(0x1000, 0, pid);
                        if h != 0 {
                            CloseHandle(h);
                            true
                        } else {
                            false
                        }
                    };
                    if !still_alive {
                        return Ok(());
                    }

                    // Try elevated service stop via UAC RunAs
                    let _ = std::process::Command::new("powershell")
                        .args([
                            "-NoProfile",
                            "-Command",
                            &format!(
                                "Start-Process -FilePath 'net.exe' -ArgumentList 'stop \"{}\" /y' -Verb RunAs -Wait -WindowStyle Hidden",
                                service_name
                            ),
                        ])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output();

                    let still_alive_elevated = unsafe {
                        let h = OpenProcess(0x1000, 0, pid);
                        if h != 0 {
                            CloseHandle(h);
                            true
                        } else {
                            false
                        }
                    };
                    if !still_alive_elevated {
                        return Ok(());
                    }
                }
            }

            // Attempt 4: Elevated taskkill fallback via UAC RunAs if running un-elevated
            let _ = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!(
                        "Start-Process -FilePath 'taskkill.exe' -ArgumentList '/F /PID {}' -Verb RunAs -Wait -WindowStyle Hidden",
                        pid
                    ),
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            let still_running = unsafe {
                let h = OpenProcess(0x1000, 0, pid);
                if h != 0 {
                    CloseHandle(h);
                    true
                } else {
                    false
                }
            };

            if !still_running {
                return Ok(());
            }

            match output {
                Ok(out) => {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    let msg = if !stderr.trim().is_empty() {
                        stderr.trim().to_string()
                    } else if !stdout.trim().is_empty() {
                        stdout.trim().to_string()
                    } else {
                        format!(
                            "Failed to terminate process {}: Access denied or process not found",
                            pid
                        )
                    };
                    Err(msg)
                }
                Err(e) => Err(format!(
                    "Access denied or process {} not found ({})",
                    pid, e
                )),
            }
        }
        #[cfg(not(windows))]
        {
            let _ = pid;
            Ok(())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PingResult {
    pub status: u16,
    pub latency_ms: u64,
    pub ok: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn ping_endpoint(url: String, method: Option<String>) -> Result<PingResult, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let method_str = method.unwrap_or_else(|| "GET".to_string()).to_uppercase();
    let req = match method_str.as_str() {
        "HEAD" => client.head(&url),
        _ => client.get(&url),
    };

    let start = std::time::Instant::now();
    match req.send().await {
        Ok(resp) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            let status = resp.status().as_u16();
            let ok = resp.status().is_success();
            Ok(PingResult {
                status,
                latency_ms,
                ok,
                error: None,
            })
        }
        Err(e) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            Ok(PingResult {
                status: 0,
                latency_ms,
                ok: false,
                error: Some(e.to_string()),
            })
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SystemVitals {
    pub cpu_percent: f64,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub memory_percent: f64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_percent: f64,
}

static PREV_CPU_TIMES: std::sync::Mutex<Option<(u64, u64)>> = std::sync::Mutex::new(None);

#[tauri::command]
pub async fn get_system_vitals() -> Result<SystemVitals, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            #[repr(C)]
            struct FileTime {
                dw_low_date_time: u32,
                dw_high_date_time: u32,
            }

            #[allow(clippy::upper_case_acronyms)]
            #[repr(C)]
            struct MEMORYSTATUSEX {
                dw_length: u32,
                dw_memory_load: u32,
                ull_total_phys: u64,
                ull_avail_phys: u64,
                ull_total_page_file: u64,
                ull_avail_page_file: u64,
                ull_total_virtual: u64,
                ull_avail_virtual: u64,
                ull_avail_extended_virtual: u64,
            }

            extern "system" {
                fn GlobalMemoryStatusEx(lp_buffer: *mut MEMORYSTATUSEX) -> i32;
                fn GetSystemTimes(
                    lp_idle_time: *mut FileTime,
                    lp_kernel_time: *mut FileTime,
                    lp_user_time: *mut FileTime,
                ) -> i32;
                fn GetDiskFreeSpaceExW(
                    lp_directory_name: *const u16,
                    lp_free_bytes_available_to_caller: *mut u64,
                    lp_total_number_of_bytes: *mut u64,
                    lp_total_number_of_free_bytes: *mut u64,
                ) -> i32;
            }

            // 1. RAM
            let mut mem_status = MEMORYSTATUSEX {
                dw_length: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
                dw_memory_load: 0,
                ull_total_phys: 0,
                ull_avail_phys: 0,
                ull_total_page_file: 0,
                ull_avail_page_file: 0,
                ull_total_virtual: 0,
                ull_avail_virtual: 0,
                ull_avail_extended_virtual: 0,
            };
            unsafe {
                GlobalMemoryStatusEx(&mut mem_status);
            }
            let memory_total_bytes = mem_status.ull_total_phys;
            let memory_used_bytes = mem_status
                .ull_total_phys
                .saturating_sub(mem_status.ull_avail_phys);
            let memory_percent = mem_status.dw_memory_load as f64;

            // 2. CPU
            let mut idle_ft = FileTime {
                dw_low_date_time: 0,
                dw_high_date_time: 0,
            };
            let mut kernel_ft = FileTime {
                dw_low_date_time: 0,
                dw_high_date_time: 0,
            };
            let mut user_ft = FileTime {
                dw_low_date_time: 0,
                dw_high_date_time: 0,
            };
            unsafe {
                GetSystemTimes(&mut idle_ft, &mut kernel_ft, &mut user_ft);
            }
            let idle_u64 =
                ((idle_ft.dw_high_date_time as u64) << 32) | (idle_ft.dw_low_date_time as u64);
            let kernel_u64 =
                ((kernel_ft.dw_high_date_time as u64) << 32) | (kernel_ft.dw_low_date_time as u64);
            let user_u64 =
                ((user_ft.dw_high_date_time as u64) << 32) | (user_ft.dw_low_date_time as u64);
            let total_u64 = kernel_u64.saturating_add(user_u64);

            let mut prev_guard = PREV_CPU_TIMES.lock().unwrap();
            let cpu_percent = if let Some((prev_idle, prev_total)) = *prev_guard {
                let delta_idle = idle_u64.saturating_sub(prev_idle);
                let delta_total = total_u64.saturating_sub(prev_total);
                if delta_total > 0 {
                    let busy = delta_total.saturating_sub(delta_idle);
                    ((busy as f64 / delta_total as f64) * 100.0).clamp(0.0, 100.0)
                } else {
                    0.0
                }
            } else {
                15.0 // Initial baseline estimation
            };
            *prev_guard = Some((idle_u64, total_u64));

            // 3. Disk (system root drive C:\)
            let path_wide: Vec<u16> = "C:\\\0".encode_utf16().collect();
            let mut free_caller: u64 = 0;
            let mut total_bytes: u64 = 0;
            let mut total_free: u64 = 0;
            unsafe {
                GetDiskFreeSpaceExW(
                    path_wide.as_ptr(),
                    &mut free_caller,
                    &mut total_bytes,
                    &mut total_free,
                );
            }
            let disk_used_bytes = total_bytes.saturating_sub(total_free);
            let disk_percent = if total_bytes > 0 {
                ((disk_used_bytes as f64 / total_bytes as f64) * 100.0).clamp(0.0, 100.0)
            } else {
                0.0
            };

            Ok(SystemVitals {
                cpu_percent: (cpu_percent * 10.0).round() / 10.0,
                memory_used_bytes,
                memory_total_bytes,
                memory_percent: (memory_percent * 10.0).round() / 10.0,
                disk_used_bytes,
                disk_total_bytes: total_bytes,
                disk_percent: (disk_percent * 10.0).round() / 10.0,
            })
        }
        #[cfg(not(windows))]
        {
            Ok(SystemVitals {
                cpu_percent: 25.0,
                memory_used_bytes: 8 * 1024 * 1024 * 1024,
                memory_total_bytes: 16 * 1024 * 1024 * 1024,
                memory_percent: 50.0,
                disk_used_bytes: 250 * 1024 * 1024 * 1024,
                disk_total_bytes: 512 * 1024 * 1024 * 1024,
                disk_percent: 48.8,
            })
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MediaStatus {
    pub title: String,
    pub artist: String,
    pub player: String,
    pub is_playing: bool,
}

#[tauri::command]
pub async fn send_media_command(action: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        #[repr(C)]
        struct KeybdInput {
            w_vk: u16,
            w_scan: u16,
            dw_flags: u32,
            time: u32,
            dw_extra_info: usize,
        }

        #[repr(C)]
        struct Input {
            r#type: u32,
            ki: KeybdInput,
            _padding: [u8; 8],
        }

        extern "system" {
            fn SendInput(c_inputs: u32, p_inputs: *const Input, cb_size: i32) -> u32;
        }

        const INPUT_KEYBOARD: u32 = 1;
        const KEYEVENTF_KEYUP: u32 = 0x0002;

        let vk: u16 = match action.as_str() {
            "play_pause" => 0xB3,
            "next" => 0xB0,
            "previous" => 0xB1,
            "volume_up" => 0xAF,
            "volume_down" => 0xAE,
            "mute" => 0xAD,
            _ => return Err(format!("Unsupported media action: {}", action)),
        };

        let inputs = [
            Input {
                r#type: INPUT_KEYBOARD,
                ki: KeybdInput {
                    w_vk: vk,
                    w_scan: 0,
                    dw_flags: 0,
                    time: 0,
                    dw_extra_info: 0,
                },
                _padding: [0; 8],
            },
            Input {
                r#type: INPUT_KEYBOARD,
                ki: KeybdInput {
                    w_vk: vk,
                    w_scan: 0,
                    dw_flags: KEYEVENTF_KEYUP,
                    time: 0,
                    dw_extra_info: 0,
                },
                _padding: [0; 8],
            },
        ];

        unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_ptr(),
                std::mem::size_of::<Input>() as i32,
            );
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = action;
        Ok(())
    }
}

#[tauri::command]
pub async fn get_media_status() -> Result<MediaStatus, String> {
    #[cfg(windows)]
    {
        struct MediaDetection {
            active: Option<MediaStatus>,
            idle: Option<MediaStatus>,
        }

        unsafe extern "system" fn enum_callback(hwnd: isize, lparam: isize) -> i32 {
            extern "system" {
                fn IsWindowVisible(hwnd: isize) -> i32;
                fn GetWindowTextLengthW(hwnd: isize) -> i32;
                fn GetWindowTextW(hwnd: isize, lp_string: *mut u16, n_max_count: i32) -> i32;
                fn GetWindowThreadProcessId(hwnd: isize, lpdw_process_id: *mut u32) -> u32;
            }
            if IsWindowVisible(hwnd) == 0 {
                return 1;
            }
            let len = GetWindowTextLengthW(hwnd);
            if !(1..=300).contains(&len) {
                return 1;
            }
            let mut buf: Vec<u16> = vec![0; (len + 1) as usize];
            let copied = GetWindowTextW(hwnd, buf.as_mut_ptr(), len + 1);
            if copied <= 0 {
                return 1;
            }

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let proc_name = resolve_process_name(pid).to_lowercase();

            let title_raw = String::from_utf16_lossy(&buf[..copied as usize]);
            let mut title_str = title_raw.trim();

            // Strip browser notification count prefixes like "(1) " or "(99+) "
            if title_str.starts_with('(') {
                if let Some(close_idx) = title_str.find(')') {
                    let inside = &title_str[1..close_idx];
                    if inside.chars().all(|c| c.is_ascii_digit() || c == '+') {
                        title_str = title_str[close_idx + 1..].trim();
                    }
                }
            }

            if title_str.is_empty() {
                return 1;
            }

            let lower = title_str.to_lowercase();
            // Filter non-media utility apps
            if proc_name.contains("code.exe")
                || proc_name.contains("nook.exe")
                || proc_name.contains("powershell")
                || proc_name.contains("cmd.exe")
                || proc_name.contains("taskmgr.exe")
                || proc_name.contains("explorer.exe")
            {
                return 1;
            }

            let slot = lparam as *mut MediaDetection;
            let detection = match slot.as_mut() {
                Some(d) => d,
                None => return 0,
            };

            // 1. Spotify
            if proc_name == "spotify.exe" {
                if lower == "spotify" || lower == "spotify free" || lower == "spotify premium" {
                    if detection.idle.is_none() {
                        detection.idle = Some(MediaStatus {
                            artist: "Spotify".to_string(),
                            title: "Ready to play".to_string(),
                            player: "Spotify".to_string(),
                            is_playing: false,
                        });
                    }
                    return 1;
                }

                // When playing, Spotify sets window title to "Artist - Title"
                let (artist, track) = if let Some((a, t)) = title_str.split_once(" - ") {
                    (a.trim().to_string(), t.trim().to_string())
                } else {
                    ("Spotify".to_string(), title_str.to_string())
                };

                detection.active = Some(MediaStatus {
                    artist,
                    title: track,
                    player: "Spotify".to_string(),
                    is_playing: true,
                });
                return 0; // Found active player
            }

            // 2. VLC
            if proc_name == "vlc.exe" {
                let clean = title_str.trim_end_matches(" - VLC media player").trim();
                if !clean.is_empty() && clean.to_lowercase() != "vlc media player" {
                    let (artist, track) = if let Some((a, t)) = clean.split_once(" - ") {
                        (a.trim().to_string(), t.trim().to_string())
                    } else {
                        ("VLC".to_string(), clean.to_string())
                    };
                    detection.active = Some(MediaStatus {
                        artist,
                        title: track,
                        player: "VLC".to_string(),
                        is_playing: true,
                    });
                    return 0;
                }
            }

            // 3. Desktop Media Players (Foobar2000, MusicBee, AIMP, Apple Music, TIDAL)
            if proc_name.contains("foobar2000")
                || proc_name.contains("musicbee")
                || proc_name.contains("aimp")
                || proc_name.contains("applemusic")
                || proc_name.contains("tidal")
            {
                let player_name = if proc_name.contains("foobar2000") {
                    "foobar2000"
                } else if proc_name.contains("musicbee") {
                    "MusicBee"
                } else if proc_name.contains("aimp") {
                    "AIMP"
                } else if proc_name.contains("applemusic") {
                    "Apple Music"
                } else {
                    "TIDAL"
                };

                let (artist, track) = if let Some((a, t)) = title_str.split_once(" - ") {
                    (a.trim().to_string(), t.trim().to_string())
                } else {
                    (player_name.to_string(), title_str.to_string())
                };

                detection.active = Some(MediaStatus {
                    artist,
                    title: track,
                    player: player_name.to_string(),
                    is_playing: true,
                });
                return 0;
            }

            // 4. Browsers (Chrome, Edge, Firefox, Brave, Opera, Vivaldi, Arc)
            let is_browser = proc_name.contains("chrome")
                || proc_name.contains("edge")
                || proc_name.contains("firefox")
                || proc_name.contains("brave")
                || proc_name.contains("opera")
                || proc_name.contains("vivaldi")
                || proc_name.contains("arc");

            if is_browser {
                // Strip browser name suffix
                let mut page_title = title_str;
                let suffixes = [
                    " - Google Chrome",
                    " - Microsoft\u{200B} Edge",
                    " - Microsoft Edge",
                    " - Mozilla Firefox",
                    " - Brave",
                    " - Opera",
                    " - Vivaldi",
                    " - Arc",
                ];
                for s in suffixes {
                    if let Some(stripped) = page_title.strip_suffix(s) {
                        page_title = stripped.trim();
                        break;
                    }
                }

                let page_lower = page_title.to_lowercase();
                if page_lower.ends_with(" - youtube music") {
                    let clean = page_title[..page_title.len() - 16].trim();
                    let (artist, track) = if let Some((a, t)) = clean.split_once(" - ") {
                        (a.trim().to_string(), t.trim().to_string())
                    } else {
                        ("YouTube Music".to_string(), clean.to_string())
                    };
                    detection.active = Some(MediaStatus {
                        artist,
                        title: track,
                        player: "YouTube Music".to_string(),
                        is_playing: true,
                    });
                    return 0;
                } else if page_lower.ends_with(" - youtube") {
                    let clean = page_title[..page_title.len() - 10].trim();
                    let (artist, track) = if let Some((a, t)) = clean.split_once(" - ") {
                        (a.trim().to_string(), t.trim().to_string())
                    } else {
                        ("YouTube".to_string(), clean.to_string())
                    };
                    detection.active = Some(MediaStatus {
                        artist,
                        title: track,
                        player: "YouTube".to_string(),
                        is_playing: true,
                    });
                    return 0;
                } else if page_lower.ends_with(" - soundcloud") {
                    let clean = page_title[..page_title.len() - 13].trim();
                    let (artist, track) = if let Some((a, t)) = clean.split_once(" - ") {
                        (a.trim().to_string(), t.trim().to_string())
                    } else {
                        ("SoundCloud".to_string(), clean.to_string())
                    };
                    detection.active = Some(MediaStatus {
                        artist,
                        title: track,
                        player: "SoundCloud".to_string(),
                        is_playing: true,
                    });
                    return 0;
                }
            }

            1
        }

        extern "system" {
            fn EnumWindows(
                lp_enum_func: unsafe extern "system" fn(isize, isize) -> i32,
                lparam: isize,
            ) -> i32;
        }

        let mut detection = MediaDetection {
            active: None,
            idle: None,
        };
        unsafe {
            EnumWindows(enum_callback, &mut detection as *mut _ as isize);
        }

        if let Some(active) = detection.active {
            return Ok(active);
        }
        if let Some(idle) = detection.idle {
            return Ok(idle);
        }

        Ok(MediaStatus {
            title: "No Active Track".to_string(),
            artist: "Ready to control".to_string(),
            player: "Windows Media".to_string(),
            is_playing: false,
        })
    }
    #[cfg(not(windows))]
    {
        Ok(MediaStatus {
            title: "No Active Track".to_string(),
            artist: "Ready to control".to_string(),
            player: "Desktop Media".to_string(),
            is_playing: false,
        })
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BatteryStatus {
    pub has_battery: bool,
    pub is_charging: bool,
    pub is_ac_plugged: bool,
    pub percent: u8,
    pub time_remaining_seconds: Option<u32>,
    pub battery_saver: bool,
}

#[tauri::command]
pub async fn get_battery_status() -> Result<BatteryStatus, String> {
    #[cfg(windows)]
    {
        #[allow(non_snake_case)]
        #[repr(C)]
        struct SystemPowerStatus {
            ac_line_status: u8,
            battery_flag: u8,
            battery_life_percent: u8,
            system_status_flag: u8,
            battery_life_time: u32,
            battery_full_life_time: u32,
        }

        extern "system" {
            fn GetSystemPowerStatus(lp_system_power_status: *mut SystemPowerStatus) -> i32;
        }

        let mut status = SystemPowerStatus {
            ac_line_status: 255,
            battery_flag: 255,
            battery_life_percent: 255,
            system_status_flag: 0,
            battery_life_time: 0xFFFFFFFF,
            battery_full_life_time: 0xFFFFFFFF,
        };

        let ok = unsafe { GetSystemPowerStatus(&mut status) };
        if ok == 0 {
            return Err("Failed to query GetSystemPowerStatus".to_string());
        }

        let has_battery = (status.battery_flag & 128) == 0 && status.battery_life_percent != 255;
        let is_charging = (status.battery_flag & 8) != 0;
        let is_ac_plugged = status.ac_line_status == 1;
        let percent = if has_battery {
            status.battery_life_percent
        } else {
            100
        };
        let time_remaining_seconds = if status.battery_life_time != 0xFFFFFFFF {
            Some(status.battery_life_time)
        } else {
            None
        };
        let battery_saver = status.system_status_flag == 1;

        Ok(BatteryStatus {
            has_battery,
            is_charging,
            is_ac_plugged,
            percent,
            time_remaining_seconds,
            battery_saver,
        })
    }
    #[cfg(not(windows))]
    {
        Ok(BatteryStatus {
            has_battery: true,
            is_charging: true,
            is_ac_plugged: true,
            percent: 95,
            time_remaining_seconds: None,
            battery_saver: false,
        })
    }
}

#[tauri::command]
pub async fn list_custom_widgets() -> Result<Vec<crate::registry::WidgetManifest>, String> {
    crate::custom_widgets::list_custom_widgets()
}

#[tauri::command]
pub async fn import_custom_widget(
    file_bytes: Vec<u8>,
    file_name: String,
) -> Result<crate::registry::WidgetManifest, String> {
    crate::custom_widgets::import_custom_widget(file_bytes, file_name)
}

#[tauri::command]
pub async fn delete_custom_widget(app: tauri::AppHandle, id: String) -> Result<(), String> {
    crate::custom_widgets::delete_custom_widget(&app, id)
}

#[tauri::command]
pub async fn get_custom_widget_content(id: String) -> Result<String, String> {
    crate::custom_widgets::get_custom_widget_content(id)
}

#[tauri::command]
pub fn get_installed_apps() -> Vec<crate::shortcuts::InstalledAppItem> {
    crate::shortcuts::get_installed_apps()
}

#[tauri::command]
pub fn pick_file_path() -> Option<crate::shortcuts::FilePickerResult> {
    crate::shortcuts::pick_file_dialog()
}

#[tauri::command]
pub fn pick_folder_path() -> Option<crate::shortcuts::FilePickerResult> {
    crate::shortcuts::pick_folder_dialog()
}
