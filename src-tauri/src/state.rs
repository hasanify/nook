use crate::config::ConfigManager;
use crate::poller::PollerManager;
use crate::timer::TimerScheduler;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub struct AppState {
    pub config: Arc<ConfigManager>,
    pub edit_mode: Arc<AtomicBool>,
    pub timer_scheduler: Arc<TimerScheduler>,
    pub poller: Arc<PollerManager>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            config: Arc::new(ConfigManager::new()),
            edit_mode: Arc::new(AtomicBool::new(false)),
            timer_scheduler: Arc::new(TimerScheduler::new()),
            poller: Arc::new(PollerManager::new()),
        }
    }

    pub fn is_edit_mode(&self) -> bool {
        self.edit_mode.load(Ordering::Relaxed)
    }

    pub fn set_edit_mode(&self, on: bool) {
        self.edit_mode.store(on, Ordering::Relaxed);
    }
}
