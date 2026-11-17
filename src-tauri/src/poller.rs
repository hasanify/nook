use crate::config::AppConfig;
use crate::providers::github::fetch_github;
use crate::providers::vercel::fetch_vercel;
use crate::providers::ProviderPayload;
use crate::secrets::get_secret;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use tracing::{debug, info};

pub struct PollerManager {
    client: reqwest::Client,
    cache: Arc<Mutex<HashMap<String, ProviderPayload>>>,
    last_polled: Arc<Mutex<HashMap<String, u64>>>,
}

impl Default for PollerManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PollerManager {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_default();

        Self {
            client,
            cache: Arc::new(Mutex::new(HashMap::new())),
            last_polled: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn get_snapshot(&self, widget_id: &str) -> Option<ProviderPayload> {
        let cache = self.cache.lock().await;
        cache.get(widget_id).cloned()
    }

    pub fn start_background_loop(&self, app: AppHandle) {
        let client = self.client.clone();
        let cache = self.cache.clone();
        let last_polled = self.last_polled.clone();

        tauri::async_runtime::spawn(async move {
            info!("Started shared background HTTP poller");

            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;

                let app_state = app.state::<crate::state::AppState>();
                let config: AppConfig = app_state.config.get_config();

                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                for widget in &config.widgets {
                    let (interval_secs, should_poll) = {
                        let mut times = last_polled.lock().await;
                        let last = times.get(&widget.id).copied().unwrap_or(0);
                        let default_interval = match widget.kind.as_str() {
                            "github-repo" => 60,
                            "vercel-project" => 30,
                            _ => 0,
                        };
                        let interval = widget
                            .settings
                            .get("pollInterval")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(default_interval);

                        if interval > 0 && (now >= last + interval || last == 0) {
                            times.insert(widget.id.clone(), now);
                            (interval, true)
                        } else {
                            (interval, false)
                        }
                    };

                    if !should_poll || interval_secs == 0 {
                        continue;
                    }

                    debug!("Polling data for widget '{}' ({})", widget.id, widget.kind);

                    let payload = match widget.kind.as_str() {
                        "github-repo" => {
                            let repo = widget
                                .settings
                                .get("repository")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let branch = widget.settings.get("branch").and_then(|v| v.as_str());
                            let commit_count = widget
                                .settings
                                .get("commitCount")
                                .and_then(|v| v.as_u64())
                                .map(|n| n as usize);
                            let token = get_secret("github");

                            fetch_github(&client, repo, branch, token.as_deref(), commit_count)
                                .await
                        }
                        "vercel-project" => {
                            let project_id = widget
                                .settings
                                .get("projectId")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let limit = widget
                                .settings
                                .get("limit")
                                .and_then(|v| v.as_u64())
                                .map(|n| n as usize);
                            let token = get_secret("vercel");

                            fetch_vercel(&client, project_id, token.as_deref(), limit).await
                        }
                        _ => continue,
                    };

                    {
                        let mut c = cache.lock().await;
                        c.insert(widget.id.clone(), payload.clone());
                    }

                    let event_name = format!("provider-data-{}", widget.id);
                    let _ = app.emit(&event_name, &payload);
                }
            }
        });
    }

    pub async fn poll_widget_now(
        &self,
        app: &AppHandle,
        widget_id: &str,
    ) -> Option<ProviderPayload> {
        let app_state = app.state::<crate::state::AppState>();
        let config: AppConfig = app_state.config.get_config();
        let widget = config.widgets.into_iter().find(|w| w.id == widget_id)?;

        let payload = match widget.kind.as_str() {
            "github-repo" => {
                let repo = widget
                    .settings
                    .get("repository")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let branch = widget.settings.get("branch").and_then(|v| v.as_str());
                let commit_count = widget
                    .settings
                    .get("commitCount")
                    .and_then(|v| v.as_u64())
                    .map(|n| n as usize);
                let token = get_secret("github");

                fetch_github(&self.client, repo, branch, token.as_deref(), commit_count).await
            }
            "vercel-project" => {
                let project_id = widget
                    .settings
                    .get("projectId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let limit = widget
                    .settings
                    .get("limit")
                    .and_then(|v| v.as_u64())
                    .map(|n| n as usize);
                let token = get_secret("vercel");

                fetch_vercel(&self.client, project_id, token.as_deref(), limit).await
            }
            _ => return None,
        };

        {
            let mut c = self.cache.lock().await;
            c.insert(widget_id.to_string(), payload.clone());
        }

        {
            let mut times = self.last_polled.lock().await;
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            times.insert(widget_id.to_string(), now);
        }

        let event_name = format!("provider-data-{}", widget_id);
        let _ = app.emit(&event_name, &payload);

        Some(payload)
    }
}
