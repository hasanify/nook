use crate::config::ConfigManager;
use crate::poller::PollerManager;
use crate::timer::TimerScheduler;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub config: Arc<ConfigManager>,
    pub edit_mode: Arc<AtomicBool>,
    pub widget_edit_modes: Arc<Mutex<HashSet<String>>>,
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
            widget_edit_modes: Arc::new(Mutex::new(HashSet::new())),
            timer_scheduler: Arc::new(TimerScheduler::new()),
            poller: Arc::new(PollerManager::new()),
        }
    }

    pub fn is_edit_mode(&self) -> bool {
        self.edit_mode.load(Ordering::Relaxed)
    }

    pub fn set_edit_mode(&self, on: bool) {
        self.edit_mode.store(on, Ordering::Relaxed);
        if !on {
            self.clear_widget_edit_modes();
        }
    }

    pub fn is_widget_edit_mode(&self, id: &str) -> bool {
        if self.is_edit_mode() {
            return true;
        }
        if let Ok(set) = self.widget_edit_modes.lock() {
            set.contains(id)
        } else {
            false
        }
    }

    pub fn set_widget_edit_mode(&self, id: String, on: bool) {
        if let Ok(mut set) = self.widget_edit_modes.lock() {
            if on {
                set.insert(id);
            } else {
                set.remove(&id);
            }
        }
    }

    pub fn clear_widget_edit_modes(&self) {
        if let Ok(mut set) = self.widget_edit_modes.lock() {
            set.clear();
        }
    }
}
