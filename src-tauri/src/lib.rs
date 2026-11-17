pub mod commands;
pub mod pin;
pub mod windows;

use tauri::RunEvent;
use tracing::info;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            info!("Nook core initialized, spawning placeholder test widget");
            let handle = app.handle().clone();
            windows::spawn_placeholder(&handle).map_err(Box::<dyn std::error::Error>::from)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_bounds,
            commands::switch_pin_strategy,
            commands::verify_desktop_pin,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        if let RunEvent::ExitRequested { api, code, .. } = event {
            // If code is None (e.g. all windows closed), prevent application exit
            if code.is_none() {
                api.prevent_exit();
            }
        }
    });
}
