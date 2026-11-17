use crate::state::AppState;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, Submenu};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{error, info};

pub const EDIT_LAYOUT_ID: &str = "tray_edit_layout";
pub const SETTINGS_ID: &str = "tray_settings";
pub const QUIT_ID: &str = "tray_quit";

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    info!("Setting up system tray icon and menu");

    let icon_bytes = include_bytes!("../icons/32x32.png");
    let icon = tauri::image::Image::from_bytes(icon_bytes)
        .map_err(|e| format!("Failed to load tray icon image: {}", e))?;

    // Add Widget Submenu items
    let add_notes = MenuItem::with_id(app, "add:notes", "Notes", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let add_timer = MenuItem::with_id(app, "add:timer", "Timer", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let add_github = MenuItem::with_id(app, "add:github-repo", "GitHub Repo", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let add_vercel = MenuItem::with_id(
        app,
        "add:vercel-project",
        "Vercel Project",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let add_submenu = Submenu::with_items(
        app,
        "Add widget",
        true,
        &[&add_notes, &add_timer, &add_github, &add_vercel],
    )
    .map_err(|e| e.to_string())?;

    let edit_item = CheckMenuItem::with_id(
        app,
        EDIT_LAYOUT_ID,
        "Edit layout (Ctrl+Alt+E)",
        true,
        false,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;

    let settings_item = MenuItem::with_id(app, SETTINGS_ID, "Settings", true, None::<&str>)
        .map_err(|e| e.to_string())?;

    let quit_item =
        MenuItem::with_id(app, QUIT_ID, "Quit", true, None::<&str>).map_err(|e| e.to_string())?;

    let menu = Menu::with_items(app, &[&add_submenu, &edit_item, &settings_item, &quit_item])
        .map_err(|e| e.to_string())?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Nook")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            match id {
                EDIT_LAYOUT_ID => {
                    let state = app.state::<AppState>();
                    let current = state.is_edit_mode();
                    let new_val = !current;
                    state.set_edit_mode(new_val);

                    info!("Tray toggled edit mode: {}", new_val);
                    let _ = app.emit("edit-mode", serde_json::json!({ "on": new_val }));

                    // Update checkmark state in tray menu
                    if let Ok(item) = edit_item.set_checked(new_val) {
                        item
                    }
                }
                SETTINGS_ID => {
                    info!("Tray Settings clicked");
                    let _ = crate::windows::open_settings_window(app, None);
                }
                QUIT_ID => {
                    info!("Tray Quit clicked, flushing config and exiting");
                    let state = app.state::<AppState>();
                    state.config.flush();
                    app.exit(0);
                }
                other => {
                    if let Some(kind) = other.strip_prefix("add:") {
                        info!("Tray Add {} clicked", kind);
                        if let Err(e) = crate::windows::spawn_new_widget(app, kind) {
                            error!("Failed to spawn widget {}: {}", kind, e);
                        }
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                info!("Tray double-clicked, opening settings");
                let _ = crate::windows::open_settings_window(tray.app_handle(), None);
            }
        })
        .build(app)
        .map_err(|e| format!("Failed to build tray icon: {}", e))?;

    Ok(())
}
