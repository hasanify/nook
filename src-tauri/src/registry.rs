use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestSize {
    pub w: i32,
    pub h: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    #[serde(rename = "defaultSize")]
    pub default_size: ManifestSize,
    #[serde(rename = "minSize")]
    pub min_size: ManifestSize,
    #[serde(default)]
    pub resizable: bool,
    #[serde(rename = "settingsSchema", default, skip_serializing_if = "Option::is_none")]
    pub settings_schema: Option<Vec<serde_json::Value>>,
}

pub struct ManifestRegistry {
    manifests: HashMap<String, WidgetManifest>,
    builtin_ids: HashSet<String>,
}

impl Default for ManifestRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ManifestRegistry {
    pub fn new_builtins() -> Self {
        let mut manifests = HashMap::new();

        let placeholder_json = r#"{
            "id": "placeholder",
            "name": "Spike Widget",
            "description": "Test widget",
            "version": "1.0.0",
            "author": "Nook",
            "defaultSize": { "w": 340, "h": 320 },
            "minSize": { "w": 260, "h": 220 },
            "resizable": true
        }"#;
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(placeholder_json) {
            manifests.insert(m.id.clone(), m);
        }

        let notes_json = include_str!("../../src/widgets/notes/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(notes_json) {
            manifests.insert(m.id.clone(), m);
        }

        let timer_json = include_str!("../../src/widgets/timer/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(timer_json) {
            manifests.insert(m.id.clone(), m);
        }

        let github_json = include_str!("../../src/widgets/github-repo/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(github_json) {
            manifests.insert(m.id.clone(), m);
        }

        let vercel_json = include_str!("../../src/widgets/vercel-project/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(vercel_json) {
            manifests.insert(m.id.clone(), m);
        }

        let clock_json = include_str!("../../src/widgets/clock/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(clock_json) {
            manifests.insert(m.id.clone(), m);
        }

        let weather_json = include_str!("../../src/widgets/weather/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(weather_json) {
            manifests.insert(m.id.clone(), m);
        }

        let todo_json = include_str!("../../src/widgets/todo/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(todo_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_tone_json = include_str!("../../src/widgets/ai-tone/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_tone_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_reply_json = include_str!("../../src/widgets/ai-reply/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_reply_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_eli5_json = include_str!("../../src/widgets/ai-eli5/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_eli5_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_book_nugget_json = include_str!("../../src/widgets/ai-book-nugget/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_book_nugget_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_history_json = include_str!("../../src/widgets/ai-history/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_history_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_stoic_json = include_str!("../../src/widgets/ai-stoic/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_stoic_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_stretch_json = include_str!("../../src/widgets/ai-stretch/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_stretch_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_journal_prompt_json =
            include_str!("../../src/widgets/ai-journal-prompt/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_journal_prompt_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_unstuck_json = include_str!("../../src/widgets/ai-unstuck/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_unstuck_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ai_vocab_json = include_str!("../../src/widgets/ai-vocab/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ai_vocab_json) {
            manifests.insert(m.id.clone(), m);
        }

        let port_sentinel_json = include_str!("../../src/widgets/port-sentinel/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(port_sentinel_json) {
            manifests.insert(m.id.clone(), m);
        }

        let api_health_json = include_str!("../../src/widgets/api-health/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(api_health_json) {
            manifests.insert(m.id.clone(), m);
        }

        let github_prs_json = include_str!("../../src/widgets/github-prs/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(github_prs_json) {
            manifests.insert(m.id.clone(), m);
        }

        let system_vitals_json = include_str!("../../src/widgets/system-vitals/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(system_vitals_json) {
            manifests.insert(m.id.clone(), m);
        }

        let now_playing_json = include_str!("../../src/widgets/now-playing/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(now_playing_json) {
            manifests.insert(m.id.clone(), m);
        }

        let battery_monitor_json = include_str!("../../src/widgets/battery-monitor/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(battery_monitor_json) {
            manifests.insert(m.id.clone(), m);
        }

        let world_clock_json = include_str!("../../src/widgets/world-clock/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(world_clock_json) {
            manifests.insert(m.id.clone(), m);
        }

        let habits_json = include_str!("../../src/widgets/habits/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(habits_json) {
            manifests.insert(m.id.clone(), m);
        }

        let ambient_sound_json = include_str!("../../src/widgets/ambient-sound/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(ambient_sound_json) {
            manifests.insert(m.id.clone(), m);
        }

        let news_feed_json = include_str!("../../src/widgets/news-feed/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(news_feed_json) {
            manifests.insert(m.id.clone(), m);
        }

        let shortcuts_json = include_str!("../../src/widgets/shortcuts/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(shortcuts_json) {
            manifests.insert(m.id.clone(), m);
        }

        let clipboard_json = include_str!("../../src/widgets/clipboard/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(clipboard_json) {
            manifests.insert(m.id.clone(), m);
        }

        let crypto_ticker_json = include_str!("../../src/widgets/crypto-ticker/manifest.json");
        if let Ok(m) = serde_json::from_str::<WidgetManifest>(crypto_ticker_json) {
            manifests.insert(m.id.clone(), m);
        }

        let builtin_ids: HashSet<String> = manifests.keys().cloned().collect();
        Self {
            manifests,
            builtin_ids,
        }
    }

    pub fn new() -> Self {
        let mut reg = Self::new_builtins();
        if let Ok(custom_manifests) = crate::custom_widgets::list_custom_widgets() {
            for m in custom_manifests {
                if !reg.builtin_ids.contains(&m.id) {
                    reg.manifests.insert(m.id.clone(), m);
                }
            }
        }
        reg
    }

    pub fn is_builtin(&self, id: &str) -> bool {
        self.builtin_ids.contains(id)
    }

    pub fn is_builtin_id(id: &str) -> bool {
        Self::new_builtins().is_builtin(id)
    }

    pub fn get(&self, kind: &str) -> Option<&WidgetManifest> {
        self.manifests.get(kind)
    }

    pub fn list(&self) -> Vec<&WidgetManifest> {
        self.manifests.values().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_registry_builtins() {
        let reg = ManifestRegistry::new();
        assert!(reg.is_builtin("notes"));
        assert!(reg.is_builtin("clock"));
        assert!(reg.get("notes").is_some());
        assert!(!reg.is_builtin("nonexistent_random_widget"));
        assert!(ManifestRegistry::is_builtin_id("notes"));
        assert!(!ManifestRegistry::is_builtin_id("nonexistent_random_widget"));
    }

    #[test]
    fn test_manifest_deserialization_with_settings_schema() {
        let json = r#"{
            "id": "test-settings",
            "name": "Test Settings",
            "description": "Test",
            "version": "1.0.0",
            "author": "Tester",
            "defaultSize": { "w": 300, "h": 200 },
            "minSize": { "w": 200, "h": 150 },
            "resizable": true,
            "settingsSchema": [
                {
                    "key": "apiKey",
                    "label": "API Key",
                    "type": "secret"
                }
            ]
        }"#;

        let manifest = serde_json::from_str::<WidgetManifest>(json).unwrap();
        assert_eq!(manifest.id, "test-settings");
        assert!(manifest.settings_schema.is_some());
        let schema = manifest.settings_schema.unwrap();
        assert_eq!(schema.len(), 1);
        assert_eq!(schema[0]["key"], "apiKey");
    }
}
