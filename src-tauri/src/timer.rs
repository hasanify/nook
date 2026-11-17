use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tracing::{error, info};

pub struct TimerScheduler {
    tasks: Arc<Mutex<HashMap<String, JoinHandle<()>>>>,
}

impl Default for TimerScheduler {
    fn default() -> Self {
        Self::new()
    }
}

impl TimerScheduler {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn schedule(
        &self,
        app: AppHandle,
        id: String,
        ends_at_ms: u64,
        title: String,
        body: String,
    ) {
        let mut tasks = self.tasks.lock().await;

        // Cancel any existing task for this timer ID
        if let Some(existing) = tasks.remove(&id) {
            existing.abort();
        }

        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        if ends_at_ms <= now_ms {
            info!(
                "Timer '{}' timestamp already in the past, not scheduling",
                id
            );
            return;
        }

        let wait_ms = ends_at_ms - now_ms;
        let tasks_clone = self.tasks.clone();
        let timer_id = id.clone();

        let handle = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(wait_ms)).await;

            info!(
                "Timer '{}' elapsed! Triggering notification: {}",
                timer_id, title
            );
            if let Err(e) = app
                .notification()
                .builder()
                .title(&title)
                .body(&body)
                .show()
            {
                error!(
                    "Failed to show notification for timer '{}': {}",
                    timer_id, e
                );
            }

            let mut tasks = tasks_clone.lock().await;
            tasks.remove(&timer_id);
        });

        tasks.insert(id, handle);
    }

    pub async fn cancel(&self, id: &str) {
        let mut tasks = self.tasks.lock().await;
        if let Some(existing) = tasks.remove(id) {
            existing.abort();
            info!("Timer '{}' scheduled notification cancelled", id);
        }
    }
}
