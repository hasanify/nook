pub mod commands;
pub mod config;
pub mod migrations;
pub mod pin;
pub mod poller;
pub mod providers;
pub mod registry;
pub mod secrets;
pub mod shell_watch;
pub mod state;
pub mod timer;
pub mod tray;
pub mod windows;

use state::AppState;
use std::path::PathBuf;
use tauri::{Emitter, Manager, RunEvent, WindowEvent};
use tracing::info;

fn setup_logging() {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    let log_dir = PathBuf::from(&app_data).join("com.nook.app").join("logs");
    let _ = std::fs::create_dir_all(&log_dir);

    let file_appender = tracing_appender::rolling::daily(&log_dir, "nook.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // Keep log guard alive
    Box::leak(Box::new(_guard));

    let subscriber = tracing_subscriber::fmt().with_writer(non_blocking).finish();

    let _ = tracing::subscriber::set_global_default(subscriber);

    let crash_dir = PathBuf::from(&app_data).join("com.nook.app");
    std::panic::set_hook(Box::new(move |info| {
        tracing::error!("FATAL PANIC: {}", info);
        let crash_path = crash_dir.join("crash.log");
        let _ = std::fs::write(crash_path, format!("FATAL PANIC: {}\n", info));
    }));
}

static GLOBAL_APP: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

pub fn get_app_handle() -> Option<&'static tauri::AppHandle> {
    GLOBAL_APP.get()
}

static IS_UPDATE_PROMPT_OPEN: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

fn start_auto_update_loop(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Initial grace period after startup before checking
        tokio::time::sleep(tokio::time::Duration::from_secs(15)).await;

        loop {
            let auto_update_enabled = {
                let state = app.state::<AppState>();
                state.config.get_config().app.auto_update
            };

            if auto_update_enabled {
                match commands::check_for_updates(app.clone()).await {
                    Ok(res) => {
                        if res.has_update {
                            info!(
                                "Automatic update check found new version: {}",
                                res.latest_version
                            );
                            let _ = app.emit("update-available", &res);

                            if let Some(download_url) = res.download_url {
                                if !IS_UPDATE_PROMPT_OPEN
                                    .swap(true, std::sync::atomic::Ordering::SeqCst)
                                {
                                    let latest_version = res.latest_version.clone();
                                    let app_handle = app.clone();
                                    let asset_name = res.asset_name.unwrap_or_default();

                                    tauri::async_runtime::spawn(async move {
                                        let should_install = tokio::task::spawn_blocking(move || {
                                            #[cfg(windows)]
                                            {
                                                use ::windows::core::HSTRING;
                                                use ::windows::Win32::UI::WindowsAndMessaging::{
                                                    MessageBoxW, IDOK, MB_ICONINFORMATION,
                                                    MB_OKCANCEL, MB_SETFOREGROUND, MB_TOPMOST,
                                                };

                                                let title = HSTRING::from("Nook Update Available");
                                                let text = HSTRING::from(format!(
                                                    "A new version of Nook (v{}) is available.\n\nWould you like to install it now?",
                                                    latest_version
                                                ));

                                                let ret = unsafe {
                                                    MessageBoxW(
                                                        None,
                                                        &text,
                                                        &title,
                                                        MB_OKCANCEL
                                                            | MB_ICONINFORMATION
                                                            | MB_SETFOREGROUND
                                                            | MB_TOPMOST,
                                                    )
                                                };
                                                ret == IDOK
                                            }
                                            #[cfg(not(windows))]
                                            {
                                                false
                                            }
                                        })
                                        .await
                                        .unwrap_or(false);

                                        IS_UPDATE_PROMPT_OPEN
                                            .store(false, std::sync::atomic::Ordering::SeqCst);

                                        if should_install {
                                            info!(
                                                "User confirmed update prompt: installing version {} from {}...",
                                                res.latest_version, download_url
                                            );
                                            if let Err(e) = commands::install_update(
                                                app_handle,
                                                download_url,
                                                asset_name,
                                            )
                                            .await
                                            {
                                                tracing::error!(
                                                    "Failed to install update after confirmation: {}",
                                                    e
                                                );
                                            }
                                        } else {
                                            info!(
                                                "User declined or dismissed update prompt for version {}.",
                                                res.latest_version
                                            );
                                        }
                                    });
                                }
                            }
                        }
                    }
                    Err(e) => {
                        tracing::debug!("Automatic update check failed: {}", e);
                    }
                }
            }

            // Check every 4 hours
            tokio::time::sleep(tokio::time::Duration::from_secs(4 * 3600)).await;
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    setup_logging();
    info!("Starting Nook application");

    // Ensure WebView2 default clear background is completely transparent (RGBA 0)
    std::env::set_var("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "0");

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            info!("Second instance launched, activating Settings/widgets");
            let _ = crate::windows::open_settings_window(app, None);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    let app = builder
        .manage(AppState::new())
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = GLOBAL_APP.set(handle.clone());

            // Set up system tray
            tray::setup_tray(&handle).map_err(Box::<dyn std::error::Error>::from)?;

            // Start background explorer recovery watcher
            shell_watch::start_shell_watch(handle.clone());

            // Start shared background HTTP poller
            let state = handle.state::<AppState>();
            state.poller.start_background_loop(handle.clone());

            // Start background auto-update periodic checker
            start_auto_update_loop(handle.clone());

            // Synchronize autostart with user preference in config.json.
            // On Windows, NSIS uninstaller deletes the Run registry key during an update.
            // When the updated app launches, we restore the autostart registration if config.autostart is true.
            let autostart_wanted = state.config.get_config().app.autostart;
            use tauri_plugin_autostart::ManagerExt;
            let autolaunch = handle.autolaunch();
            if autostart_wanted {
                match autolaunch.is_enabled() {
                    Ok(true) => {
                        // Already enabled; call enable() again to ensure executable path is updated to new binary
                        let _ = autolaunch.enable();
                    }
                    Ok(false) | Err(_) => {
                        info!("Restoring autostart registration from config (enabled = true)");
                        if let Err(e) = autolaunch.enable() {
                            tracing::warn!("Failed to enable autostart on startup: {}", e);
                        }
                    }
                }
            } else if let Ok(true) = autolaunch.is_enabled() {
                info!("Disabling autostart to match config (enabled = false)");
                let _ = autolaunch.disable();
            }

            // Spawn or restore configured widgets
            windows::ensure_all_widgets(&handle).map_err(Box::<dyn std::error::Error>::from)?;

            // Pre-initialize context menu window so right-click is instantaneous and thread-safe
            windows::ensure_context_menu_window(&handle)
                .map_err(Box::<dyn std::error::Error>::from)?;

            // Register global edit mode hotkey Ctrl+Alt+E
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
                if let Ok(shortcut) = "Ctrl+Alt+E".parse::<Shortcut>() {
                    let h = handle.clone();
                    let _ = app
                        .global_shortcut()
                        .on_shortcut(shortcut, move |_app, _sc, ev| {
                            if ev.state() == ShortcutState::Pressed {
                                let state = h.state::<AppState>();
                                let current = state.is_edit_mode();
                                let new_val = !current;
                                state.set_edit_mode(new_val);
                                info!("Global shortcut toggled edit mode: {}", new_val);
                                let _ = h.emit("edit-mode", serde_json::json!({ "on": new_val }));
                            }
                        });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_config,
            commands::get_instance,
            commands::add_widget,
            commands::duplicate_widget,
            commands::remove_widget,
            commands::set_bounds,
            commands::batch_set_bounds,
            commands::get_desktop_work_area,
            commands::get_edit_mode,
            commands::set_edit_mode,
            commands::get_widget_edit_mode,
            commands::set_widget_edit_mode,
            commands::set_opacity,
            commands::set_always_on_top,
            commands::update_state,
            commands::update_settings,
            commands::verify_desktop_pin,
            commands::update_app_config,
            commands::open_settings_window,
            commands::show_settings_window,
            commands::open_context_menu,
            commands::hide_context_menu,
            commands::get_all_manifests,
            commands::timer_schedule,
            commands::timer_cancel,
            commands::save_account_token,
            commands::get_account_token,
            commands::clear_account_token,
            commands::has_account_token,
            commands::get_provider_snapshot,
            commands::refresh_widget_provider,
            commands::get_app_version,
            commands::check_for_updates,
            commands::install_update,
            commands::list_vercel_projects,
            commands::get_listening_ports,
            commands::kill_port_process,
            commands::ping_endpoint,
            commands::get_system_vitals,
            commands::send_media_command,
            commands::get_media_status,
            commands::get_battery_status,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        RunEvent::ExitRequested { api, code, .. } if code.is_none() => {
            // When last window closes, prevent exit so Nook lives in tray
            api.prevent_exit();
        }
        RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "settings" || label == "widget-context-menu" => {
            api.prevent_close();
            if let Some(w) = app_handle.get_webview_window(&label) {
                let _ = w.hide();
            }
        }
        _ => {}
    });
}
