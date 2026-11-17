use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
}

pub struct ManifestRegistry {
    manifests: HashMap<String, WidgetManifest>,
}

impl Default for ManifestRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ManifestRegistry {
    pub fn new() -> Self {
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

        Self { manifests }
    }

    pub fn get(&self, kind: &str) -> Option<&WidgetManifest> {
        self.manifests.get(kind)
    }

    pub fn list(&self) -> Vec<&WidgetManifest> {
        self.manifests.values().collect()
    }
}
