use crate::registry::{ManifestSize, WidgetManifest};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};

pub fn get_custom_widgets_dir() -> PathBuf {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(app_data).join("com.nook.app").join("custom_widgets")
}

pub fn list_custom_widgets() -> Result<Vec<WidgetManifest>, String> {
    let dir = get_custom_widgets_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read custom widgets directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let manifest_path = path.join("manifest.json");
            if manifest_path.exists() {
                if let Ok(content) = fs::read_to_string(&manifest_path) {
                    if let Ok(manifest) = serde_json::from_str::<WidgetManifest>(&content) {
                        list.push(manifest);
                    } else {
                        tracing::warn!("Failed to parse manifest at {:?}", manifest_path);
                    }
                }
            }
        }
    }

    list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(list)
}

pub fn validate_widget_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("Widget ID cannot be empty".to_string());
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(format!(
            "Invalid widget ID '{}': only alphanumeric characters, hyphens, and underscores are allowed",
            id
        ));
    }
    Ok(())
}

fn sanitize_id(stem: &str) -> String {
    let mut id = String::new();
    for c in stem.chars() {
        if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
            id.push(c.to_ascii_lowercase());
        } else if c == ' ' || c == '.' {
            id.push('-');
        }
    }
    let trimmed = id.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "custom-widget".to_string()
    } else {
        trimmed
    }
}

fn default_manifest_for_stem(stem: &str) -> WidgetManifest {
    let id = sanitize_id(stem);
    WidgetManifest {
        id,
        name: if stem.trim().is_empty() {
            "Custom Widget".to_string()
        } else {
            stem.to_string()
        },
        description: "Custom widget imported from file".to_string(),
        version: "1.0.0".to_string(),
        author: "Custom".to_string(),
        default_size: ManifestSize { w: 340, h: 320 },
        min_size: ManifestSize { w: 200, h: 150 },
        resizable: true,
    }
}

fn extract_embedded_manifest(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let mut search_start = 0;
    while let Some(start_tag_idx) = lower[search_start..].find("<script") {
        let tag_begin = search_start + start_tag_idx;
        if let Some(tag_end_relative) = lower[tag_begin..].find('>') {
            let tag_end = tag_begin + tag_end_relative;
            let tag_header = &lower[tag_begin..=tag_end];
            if tag_header.contains("id=\"nook-manifest\"") || tag_header.contains("id='nook-manifest'") {
                if let Some(close_idx_rel) = lower[tag_end + 1..].find("</script>") {
                    let body_start = tag_end + 1;
                    let body_end = tag_end + 1 + close_idx_rel;
                    return Some(html[body_start..body_end].trim().to_string());
                }
            }
            search_start = tag_end + 1;
        } else {
            break;
        }
    }
    None
}

fn parse_manifest_with_defaults(json_str: &str, file_stem: &str) -> Result<WidgetManifest, String> {
    if let Ok(m) = serde_json::from_str::<WidgetManifest>(json_str) {
        return Ok(m);
    }

    let mut val: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Invalid JSON in manifest: {}", e))?;

    if let Some(obj) = val.as_object_mut() {
        if !obj.contains_key("id") || obj["id"].as_str().map(|s| s.trim().is_empty()).unwrap_or(true) {
            obj.insert("id".to_string(), serde_json::json!(sanitize_id(file_stem)));
        }
        if !obj.contains_key("name") || obj["name"].as_str().map(|s| s.trim().is_empty()).unwrap_or(true) {
            obj.insert("name".to_string(), serde_json::json!(file_stem));
        }
        if !obj.contains_key("description") {
            obj.insert("description".to_string(), serde_json::json!("Custom widget imported from file"));
        }
        if !obj.contains_key("version") {
            obj.insert("version".to_string(), serde_json::json!("1.0.0"));
        }
        if !obj.contains_key("author") {
            obj.insert("author".to_string(), serde_json::json!("Custom"));
        }
        if !obj.contains_key("defaultSize") {
            obj.insert("defaultSize".to_string(), serde_json::json!({ "w": 340, "h": 320 }));
        }
        if !obj.contains_key("minSize") {
            obj.insert("minSize".to_string(), serde_json::json!({ "w": 200, "h": 150 }));
        }
        if !obj.contains_key("resizable") {
            obj.insert("resizable".to_string(), serde_json::json!(true));
        }
    }

    serde_json::from_value::<WidgetManifest>(val)
        .map_err(|e| format!("Failed to parse WidgetManifest: {}", e))
}

pub fn import_custom_widget(file_bytes: Vec<u8>, file_name: String) -> Result<WidgetManifest, String> {
    let is_zip = file_name.to_lowercase().ends_with(".zip")
        || file_bytes.starts_with(b"PK\x03\x04");

    if is_zip {
        let reader = std::io::Cursor::new(&file_bytes);
        let mut archive = zip::ZipArchive::new(reader)
            .map_err(|e| format!("Invalid ZIP archive: {}", e))?;

        // Detect root prefix if files are nested in a folder
        let mut prefix = String::new();
        let has_root_manifest = archive.by_name("manifest.json").is_ok();
        let has_root_index = archive.by_name("index.html").is_ok();

        if !has_root_manifest || !has_root_index {
            let names: Vec<String> = (0..archive.len())
                .filter_map(|i| archive.by_index(i).ok().map(|f| f.name().to_string()))
                .collect();

            if let Some(m_entry) = names.iter().find(|n| n.ends_with("/manifest.json")) {
                let candidate_prefix = &m_entry[..m_entry.len() - "manifest.json".len()];
                let idx_entry = format!("{}index.html", candidate_prefix);
                if names.iter().any(|n| n == &idx_entry) {
                    prefix = candidate_prefix.to_string();
                }
            }
        }

        let manifest_entry_name = format!("{}manifest.json", prefix);
        let index_entry_name = format!("{}index.html", prefix);

        let mut manifest_content = String::new();
        {
            let mut manifest_file = archive.by_name(&manifest_entry_name)
                .map_err(|_| "Archive must contain 'manifest.json'".to_string())?;
            manifest_file.read_to_string(&mut manifest_content)
                .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
        }

        // Verify index.html exists
        archive.by_name(&index_entry_name)
            .map_err(|_| "Archive must contain 'index.html'".to_string())?;

        let file_stem = Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("custom-widget");

        let manifest = parse_manifest_with_defaults(&manifest_content, file_stem)?;
        validate_widget_id(&manifest.id)?;

        let target_dir = get_custom_widgets_dir().join(&manifest.id);
        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create widget directory {:?}: {}", target_dir, e))?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| format!("Failed to read entry {} from archive: {}", i, e))?;

            let file_raw_name = file.name().to_string();
            if !prefix.is_empty() && !file_raw_name.starts_with(&prefix) {
                continue;
            }
            let rel_name = if !prefix.is_empty() {
                &file_raw_name[prefix.len()..]
            } else {
                &file_raw_name
            };
            if rel_name.is_empty() {
                continue;
            }

            let rel_path = Path::new(rel_name);
            // ZipSlip prevention
            if rel_path.is_absolute()
                || rel_path.components().any(|c| matches!(c, std::path::Component::ParentDir | std::path::Component::RootDir | std::path::Component::Prefix(_)))
            {
                continue;
            }

            let outpath = target_dir.join(rel_path);
            if file.is_dir() {
                fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Failed to create directory {:?}: {}", outpath, e))?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)
                            .map_err(|e| format!("Failed to create parent directory {:?}: {}", p, e))?;
                    }
                }
                let mut outfile = fs::File::create(&outpath)
                    .map_err(|e| format!("Failed to create file {:?}: {}", outpath, e))?;
                std::io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to extract file {:?}: {}", outpath, e))?;
            }
        }

        Ok(manifest)
    } else {
        // Single file (.html or .nook)
        let html_content = String::from_utf8(file_bytes.clone())
            .map_err(|e| format!("File is not valid UTF-8: {}", e))?;

        let file_stem = Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("custom-widget");

        let manifest = if let Some(embedded_json) = extract_embedded_manifest(&html_content) {
            parse_manifest_with_defaults(&embedded_json, file_stem)?
        } else {
            default_manifest_for_stem(file_stem)
        };

        validate_widget_id(&manifest.id)?;

        let target_dir = get_custom_widgets_dir().join(&manifest.id);
        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create widget directory {:?}: {}", target_dir, e))?;

        let index_path = target_dir.join("index.html");
        fs::write(&index_path, &file_bytes)
            .map_err(|e| format!("Failed to write index.html: {}", e))?;

        let manifest_path = target_dir.join("manifest.json");
        let manifest_json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
        fs::write(&manifest_path, manifest_json)
            .map_err(|e| format!("Failed to write manifest.json: {}", e))?;

        Ok(manifest)
    }
}

pub fn delete_custom_widget(app: &tauri::AppHandle, id: String) -> Result<(), String> {
    validate_widget_id(&id)?;
    let dir = get_custom_widgets_dir().join(&id);
    if dir.exists() {
        fs::remove_dir_all(&dir)
            .map_err(|e| format!("Failed to delete widget directory: {}", e))?;
    }

    let state = app.state::<crate::state::AppState>();
    let instances_to_remove: Vec<String> = state
        .config
        .get_config()
        .widgets
        .iter()
        .filter(|w| w.kind == id)
        .map(|w| w.id.clone())
        .collect();

    for inst_id in &instances_to_remove {
        let label = format!("widget-{}", inst_id);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.destroy();
        }
    }

    state.config.update_config(|cfg| {
        cfg.widgets.retain(|w| w.kind != id);
    });

    let _ = app.emit(
        "config-changed",
        serde_json::json!({ "ids": instances_to_remove, "app": false }),
    );

    Ok(())
}

pub fn get_custom_widget_content(id: String) -> Result<String, String> {
    validate_widget_id(&id)?;
    let path = get_custom_widgets_dir().join(&id).join("index.html");
    if !path.exists() {
        return Err(format!("Widget index.html not found for '{}'", id));
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read widget index.html: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    #[test]
    fn test_validation() {
        assert!(validate_widget_id("my-widget_123").is_ok());
        assert!(validate_widget_id("my widget").is_err());
        assert!(validate_widget_id("my/widget").is_err());
        assert!(validate_widget_id("").is_err());
        assert!(validate_widget_id("../widget").is_err());
    }

    #[test]
    fn test_sanitization() {
        assert_eq!(sanitize_id("My Cool Widget"), "my-cool-widget");
        assert_eq!(sanitize_id("  test...123  "), "test---123");
        assert_eq!(sanitize_id("___"), "___");
        assert_eq!(sanitize_id(""), "custom-widget");
    }

    #[test]
    fn test_extract_manifest() {
        let html_1 = r#"
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/json" id="nook-manifest">
                { "id": "test-1", "name": "Test One" }
                </script>
            </head>
            <body>Hello</body>
            </html>
        "#;
        let extracted_1 = extract_embedded_manifest(html_1).expect("Should extract manifest");
        assert!(extracted_1.contains("\"id\": \"test-1\""));

        let html_2 = r#"<script id='nook-manifest' type="application/json">{"id":"test-2"}</script>"#;
        let extracted_2 = extract_embedded_manifest(html_2).expect("Should extract manifest");
        assert!(extracted_2.contains("\"id\":\"test-2\""));

        let html_3 = r#"<div>No manifest here</div>"#;
        assert!(extract_embedded_manifest(html_3).is_none());
    }

    #[test]
    fn test_import_html_and_read_content() {
        let test_id = format!("test_widget_{}", uuid::Uuid::new_v4().simple());
        let html = format!(
            r#"<!DOCTYPE html><html><head><script type="application/json" id="nook-manifest">
            {{"id": "{}", "name": "Dynamic Test Widget"}}
            </script></head><body><h1>Dynamic Widget</h1></body></html>"#,
            test_id
        );

        let manifest = import_custom_widget(html.into_bytes(), "test.html".to_string())
            .expect("Import should succeed");
        assert_eq!(manifest.id, test_id);
        assert_eq!(manifest.name, "Dynamic Test Widget");

        let content = get_custom_widget_content(test_id.clone()).expect("Content should be read");
        assert!(content.contains("Dynamic Widget"));

        // Clean up test widget directory
        let widget_dir = get_custom_widgets_dir().join(&test_id);
        let _ = fs::remove_dir_all(&widget_dir);
    }

    #[test]
    fn test_import_zip() {
        let test_id = format!("test_zip_{}", uuid::Uuid::new_v4().simple());
        let manifest_json = format!(
            r#"{{
                "id": "{}",
                "name": "Zip Test Widget",
                "description": "Widget in zip",
                "version": "1.2.3",
                "author": "Tester",
                "defaultSize": {{ "w": 400, "h": 300 }},
                "minSize": {{ "w": 250, "h": 200 }},
                "resizable": false
            }}"#,
            test_id
        );

        let mut buffer = std::io::Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buffer);
            let options = SimpleFileOptions::default();

            zip.start_file("manifest.json", options).unwrap();
            zip.write_all(manifest_json.as_bytes()).unwrap();

            zip.start_file("index.html", options).unwrap();
            zip.write_all(b"<html><body><h1>Zip Widget</h1></body></html>").unwrap();

            zip.finish().unwrap();
        }

        let zip_bytes = buffer.into_inner();
        let manifest = import_custom_widget(zip_bytes, "widget.zip".to_string())
            .expect("Zip import should succeed");

        assert_eq!(manifest.id, test_id);
        assert_eq!(manifest.name, "Zip Test Widget");
        assert_eq!(manifest.default_size.w, 400);

        let content = get_custom_widget_content(test_id.clone()).expect("Content should be read");
        assert!(content.contains("Zip Widget"));

        // Clean up
        let widget_dir = get_custom_widgets_dir().join(&test_id);
        let _ = fs::remove_dir_all(&widget_dir);
    }
}

