use crate::migrations;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::Notify;
use tracing::{error, info, warn};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub version: u32,
    pub app: AppSection,
    pub widgets: Vec<WidgetInstance>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let (work_left, work_top, work_w, _) = crate::windows::get_primary_work_area();
        let default_w = 340;
        let default_h = 320;
        let x = (work_left + work_w - default_w - 24).max(work_left);
        let y = work_top + 24;

        let default_placeholder = WidgetInstance {
            id: format!("w_{}", uuid::Uuid::new_v4().simple()),
            kind: "placeholder".to_string(),
            rect: Rect {
                x,
                y,
                w: default_w,
                h: default_h,
            },
            monitor: MonitorRef::default(),
            opacity: 0.95,
            always_on_top: false,
            settings: serde_json::Map::new(),
            state: serde_json::Map::new(),
        };

        Self {
            version: 1,
            app: AppSection::default(),
            widgets: vec![default_placeholder],
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSection {
    pub theme: String,
    pub autostart: bool,
    #[serde(alias = "edit_hotkey")]
    pub edit_hotkey: String,
    #[serde(alias = "grid_snap")]
    pub grid_snap: i32,
    #[serde(alias = "pin_strategy")]
    pub pin_strategy: String,
    #[serde(default = "default_widget_preset", alias = "widget_preset")]
    pub widget_preset: String,
    #[serde(default, alias = "default_ai_provider")]
    pub default_ai_provider: Option<String>,
}

fn default_widget_preset() -> String {
    "default".to_string()
}

impl Default for AppSection {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            autostart: false,
            edit_hotkey: "Ctrl+Alt+E".to_string(),
            grid_snap: 8,
            pin_strategy: "auto".to_string(),
            widget_preset: "default".to_string(),
            default_ai_provider: None,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MonitorRef {
    pub name: String,
    pub origin_x: i32,
    pub origin_y: i32,
}

impl Default for MonitorRef {
    fn default() -> Self {
        Self {
            name: "\\\\.\\DISPLAY1".to_string(),
            origin_x: 0,
            origin_y: 0,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WidgetInstance {
    pub id: String,
    #[serde(alias = "type")]
    pub kind: String,
    pub rect: Rect,
    pub monitor: MonitorRef,
    pub opacity: f32,
    #[serde(default, alias = "always_on_top")]
    pub always_on_top: bool,
    #[serde(default)]
    pub settings: serde_json::Map<String, serde_json::Value>,
    #[serde(default)]
    pub state: serde_json::Map<String, serde_json::Value>,
}

pub struct ConfigManager {
    dir: PathBuf,
    current: Arc<Mutex<AppConfig>>,
    notify_save: Arc<Notify>,
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigManager {
    pub fn new() -> Self {
        let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        let dir = PathBuf::from(app_data).join("com.nook.app");
        let _ = fs::create_dir_all(&dir);

        let initial_config = Self::load_from_disk(&dir);
        let current = Arc::new(Mutex::new(initial_config));
        let notify_save = Arc::new(Notify::new());

        let manager = Self {
            dir,
            current,
            notify_save,
        };

        manager.spawn_debounce_writer();
        manager
    }

    pub fn get_config(&self) -> AppConfig {
        self.current.lock().unwrap().clone()
    }

    pub fn update_config<F>(&self, update_fn: F)
    where
        F: FnOnce(&mut AppConfig),
    {
        {
            let mut cfg = self.current.lock().unwrap();
            update_fn(&mut cfg);
        }
        self.notify_save.notify_one();
    }

    pub fn flush(&self) {
        let cfg = self.get_config();
        Self::write_atomic(&self.dir, &cfg);
    }

    fn load_from_disk(dir: &Path) -> AppConfig {
        let config_path = dir.join("config.json");
        if !config_path.exists() {
            info!("No existing config.json found, using defaults");
            return AppConfig::default();
        }

        match fs::read_to_string(&config_path) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(val) => match migrations::migrate(val) {
                    Ok(migrated) => match serde_json::from_value::<AppConfig>(migrated) {
                        Ok(cfg) => {
                            info!("Successfully loaded config.json (version {})", cfg.version);
                            cfg
                        }
                        Err(err) => {
                            error!("Failed to parse migrated config: {}", err);
                            Self::backup_corrupt(dir, &config_path);
                            AppConfig::default()
                        }
                    },
                    Err(err) => {
                        error!("Failed to run config migrations: {}", err);
                        Self::backup_corrupt(dir, &config_path);
                        AppConfig::default()
                    }
                },
                Err(err) => {
                    error!("Corrupt JSON in config.json: {}", err);
                    Self::backup_corrupt(dir, &config_path);
                    AppConfig::default()
                }
            },
            Err(err) => {
                error!("Failed to read config.json: {}", err);
                AppConfig::default()
            }
        }
    }

    fn backup_corrupt(dir: &Path, config_path: &Path) {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let corrupt_path = dir.join(format!("config.corrupt-{}.json", ts));
        warn!("Renaming corrupt config to {:?}", corrupt_path);
        let _ = fs::rename(config_path, corrupt_path);
    }

    fn write_atomic(dir: &Path, config: &AppConfig) {
        let config_path = dir.join("config.json");
        let tmp_path = dir.join("config.json.tmp");
        let bak_path = dir.join("config.json.bak");

        match serde_json::to_string_pretty(config) {
            Ok(json) => {
                if let Err(err) = fs::write(&tmp_path, json) {
                    error!("Failed to write config.json.tmp: {}", err);
                    return;
                }

                // If config.json already exists, create .bak backup
                if config_path.exists() {
                    let _ = fs::copy(&config_path, &bak_path);
                }

                if let Err(err) = fs::rename(&tmp_path, &config_path) {
                    error!("Failed to rename config.json.tmp to config.json: {}", err);
                } else {
                    info!("Atomically saved config.json");
                }
            }
            Err(err) => {
                error!("Failed to serialize AppConfig: {}", err);
            }
        }
    }

    fn spawn_debounce_writer(&self) {
        let notify = self.notify_save.clone();
        let current = self.current.clone();
        let dir = self.dir.clone();

        tauri::async_runtime::spawn(async move {
            loop {
                notify.notified().await;
                // Debounce writes by 300ms
                tokio::time::sleep(Duration::from_millis(300)).await;

                let cfg = current.lock().unwrap().clone();
                Self::write_atomic(&dir, &cfg);
            }
        });
    }
}
