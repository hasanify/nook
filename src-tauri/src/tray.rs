use crate::state::AppState;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, Submenu};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Listener, Manager};
use tracing::{error, info};

pub const EDIT_LAYOUT_ID: &str = "tray_edit_layout";
pub const SETTINGS_ID: &str = "tray_settings";
pub const QUIT_ID: &str = "tray_quit";

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    info!("Setting up system tray icon and menu");

    let icon_bytes = include_bytes!("../icons/32x32.png");
    let icon = tauri::image::Image::from_bytes(icon_bytes)
        .map_err(|e| format!("Failed to load tray icon image: {}", e))?;

    // Productivity Widgets
    let p_todo = MenuItem::with_id(app, "add:todo", "Quick Tasks", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let p_notes = MenuItem::with_id(app, "add:notes", "Notes", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let p_timer = MenuItem::with_id(app, "add:timer", "Timer", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let p_habits = MenuItem::with_id(app, "add:habits", "Habit Tracker", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sub_prod = Submenu::with_items(
        app,
        "Productivity",
        true,
        &[&p_todo, &p_notes, &p_timer, &p_habits],
    )
    .map_err(|e| e.to_string())?;

    // Developer Widgets
    let d_gh_repo = MenuItem::with_id(app, "add:github-repo", "GitHub Repo", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let d_gh_prs = MenuItem::with_id(app, "add:github-prs", "GitHub PRs", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let d_vercel = MenuItem::with_id(
        app,
        "add:vercel-project",
        "Vercel Project",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let d_ports = MenuItem::with_id(
        app,
        "add:port-sentinel",
        "Port Sentinel",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let d_health = MenuItem::with_id(app, "add:api-health", "API Health", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sub_dev = Submenu::with_items(
        app,
        "Developer Tools",
        true,
        &[&d_gh_repo, &d_gh_prs, &d_vercel, &d_ports, &d_health],
    )
    .map_err(|e| e.to_string())?;

    // Utilities & System
    let u_clock = MenuItem::with_id(app, "add:clock", "Clock & Date", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let u_world = MenuItem::with_id(app, "add:world-clock", "World Clock", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let u_weather = MenuItem::with_id(app, "add:weather", "Weather", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let u_vitals = MenuItem::with_id(
        app,
        "add:system-vitals",
        "System Vitals",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let u_battery = MenuItem::with_id(
        app,
        "add:battery-monitor",
        "Battery Monitor",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let u_music = MenuItem::with_id(app, "add:now-playing", "Now Playing", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let u_ambient = MenuItem::with_id(
        app,
        "add:ambient-sound",
        "Ambient Sound",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let u_news = MenuItem::with_id(app, "add:news-feed", "Tech News", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sub_utils = Submenu::with_items(
        app,
        "Utilities & System",
        true,
        &[
            &u_clock, &u_world, &u_weather, &u_vitals, &u_battery, &u_music, &u_ambient, &u_news,
        ],
    )
    .map_err(|e| e.to_string())?;

    // AI & Daily Reflection
    let a_reply = MenuItem::with_id(app, "add:ai-reply", "AI Quick Reply", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let a_tone = MenuItem::with_id(app, "add:ai-tone", "AI Tone Polish", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let a_eli5 = MenuItem::with_id(app, "add:ai-eli5", "AI ELI5 Explainer", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let a_unstuck = MenuItem::with_id(app, "add:ai-unstuck", "AI Unstuck", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let a_stoic = MenuItem::with_id(app, "add:ai-stoic", "Daily Stoic Quote", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let a_book = MenuItem::with_id(
        app,
        "add:ai-book-nugget",
        "Daily Book Nugget",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let a_history = MenuItem::with_id(
        app,
        "add:ai-history",
        "Today in History",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let a_vocab = MenuItem::with_id(app, "add:ai-vocab", "Word of the Day", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let a_journal = MenuItem::with_id(
        app,
        "add:ai-journal-prompt",
        "Journal Prompt",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let a_stretch = MenuItem::with_id(app, "add:ai-stretch", "Break & Stretch", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let sub_ai = Submenu::with_items(
        app,
        "AI Reflection",
        true,
        &[
            &a_reply, &a_tone, &a_eli5, &a_unstuck, &a_stoic, &a_book, &a_history, &a_vocab,
            &a_journal, &a_stretch,
        ],
    )
    .map_err(|e| e.to_string())?;

    let add_submenu = Submenu::with_items(
        app,
        "Add widget",
        true,
        &[&sub_prod, &sub_dev, &sub_utils, &sub_ai],
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

    // Keep tray edit checkmark in sync with global edit-mode events
    let edit_item_listener = edit_item.clone();
    app.listen("edit-mode", move |event| {
        #[derive(serde::Deserialize)]
        struct EditPayload {
            on: bool,
        }
        if let Ok(payload) = serde_json::from_str::<EditPayload>(event.payload()) {
            let _ = edit_item_listener.set_checked(payload.on);
        }
    });

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
