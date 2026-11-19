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
            commands::get_edit_mode,
            commands::set_edit_mode,
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
