use crate::registry::{ManifestSize, WidgetManifest};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};

pub const MAX_ZIP_FILES: usize = 1000;
pub const MAX_TOTAL_UNCOMPRESSED_SIZE: u64 = 50 * 1024 * 1024; // 50 MB

const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
    "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
];

pub fn get_custom_widgets_dir() -> PathBuf {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(app_data)
        .join("com.nook.app")
        .join("custom_widgets")
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

    list.sort_by_key(|a| a.name.to_lowercase());
    Ok(list)
}

pub fn validate_widget_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("Widget ID cannot be empty".to_string());
    }
    if !id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(format!(
            "Invalid widget ID '{}': only alphanumeric characters, hyphens, and underscores are allowed",
            id
        ));
    }
    if WINDOWS_RESERVED_NAMES
        .iter()
        .any(|&r| r.eq_ignore_ascii_case(id))
    {
        return Err(format!(
            "Invalid widget ID '{}': reserved Windows device name",
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
    } else if WINDOWS_RESERVED_NAMES
        .iter()
        .any(|&r| r.eq_ignore_ascii_case(&trimmed))
    {
        format!("widget-{}", trimmed)
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
        settings_schema: None,
    }
}

fn find_ascii_case_insensitive(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() {
        return Some(0);
    }
    if haystack.len() < needle.len() {
        return None;
    }
    haystack.windows(needle.len()).position(|window| {
        window
            .iter()
            .zip(needle.iter())
            .all(|(a, b)| a.eq_ignore_ascii_case(b))
    })
}

fn extract_embedded_manifest(html: &str) -> Option<String> {
    let bytes = html.as_bytes();
    let mut search_start = 0;
    while let Some(rel_start) = find_ascii_case_insensitive(&bytes[search_start..], b"<script") {
        let tag_begin = search_start + rel_start;
        if let Some(rel_end) = bytes[tag_begin..].iter().position(|&b| b == b'>') {
            let tag_end = tag_begin + rel_end;
            let tag_header = &bytes[tag_begin..=tag_end];
            let has_manifest_id = find_ascii_case_insensitive(tag_header, b"id=\"nook-manifest\"")
                .is_some()
                || find_ascii_case_insensitive(tag_header, b"id='nook-manifest'").is_some();

            if has_manifest_id {
                let body_start = tag_end + 1;
                if let Some(rel_close) =
                    find_ascii_case_insensitive(&bytes[body_start..], b"</script>")
                {
                    let body_end = body_start + rel_close;
                    if let Ok(manifest_str) = std::str::from_utf8(&bytes[body_start..body_end]) {
                        return Some(manifest_str.trim().to_string());
                    }
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

    let mut val: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("Invalid JSON in manifest: {}", e))?;

    if let Some(obj) = val.as_object_mut() {
        if !obj.contains_key("id")
            || obj["id"]
                .as_str()
                .map(|s| s.trim().is_empty())
                .unwrap_or(true)
        {
            obj.insert("id".to_string(), serde_json::json!(sanitize_id(file_stem)));
        }
        if !obj.contains_key("name")
            || obj["name"]
                .as_str()
                .map(|s| s.trim().is_empty())
                .unwrap_or(true)
        {
            obj.insert("name".to_string(), serde_json::json!(file_stem));
        }
        if !obj.contains_key("description") {
            obj.insert(
                "description".to_string(),
                serde_json::json!("Custom widget imported from file"),
            );
        }
        if !obj.contains_key("version") {
            obj.insert("version".to_string(), serde_json::json!("1.0.0"));
        }
        if !obj.contains_key("author") {
            obj.insert("author".to_string(), serde_json::json!("Custom"));
        }
        if !obj.contains_key("defaultSize") {
            obj.insert(
                "defaultSize".to_string(),
                serde_json::json!({ "w": 340, "h": 320 }),
            );
        }
        if !obj.contains_key("minSize") {
            obj.insert(
                "minSize".to_string(),
                serde_json::json!({ "w": 200, "h": 150 }),
            );
        }
        if !obj.contains_key("resizable") {
            obj.insert("resizable".to_string(), serde_json::json!(true));
        }
    }

    serde_json::from_value::<WidgetManifest>(val)
        .map_err(|e| format!("Failed to parse WidgetManifest: {}", e))
}

pub fn import_custom_widget(
    file_bytes: Vec<u8>,
    file_name: String,
) -> Result<WidgetManifest, String> {
    let is_zip =
        file_name.to_lowercase().ends_with(".zip") || file_bytes.starts_with(b"PK\x03\x04");

    if is_zip {
        let reader = std::io::Cursor::new(&file_bytes);
        let mut archive =
            zip::ZipArchive::new(reader).map_err(|e| format!("Invalid ZIP archive: {}", e))?;

        if archive.len() > MAX_ZIP_FILES {
            return Err(format!(
                "Archive contains too many files ({} > max {})",
                archive.len(),
                MAX_ZIP_FILES
            ));
        }

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

        let mut total_uncompressed_bytes: u64 = 0;
        let mut manifest_content = String::new();
        {
            let mut manifest_file = archive
                .by_name(&manifest_entry_name)
                .map_err(|_| "Archive must contain 'manifest.json'".to_string())?;
            let mut limited = (&mut manifest_file).take(MAX_TOTAL_UNCOMPRESSED_SIZE + 1);
            limited
                .read_to_string(&mut manifest_content)
                .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
            total_uncompressed_bytes += manifest_content.len() as u64;
            if total_uncompressed_bytes > MAX_TOTAL_UNCOMPRESSED_SIZE {
                return Err(format!(
                    "Archive exceeds maximum uncompressed size of {} bytes",
                    MAX_TOTAL_UNCOMPRESSED_SIZE
                ));
            }
        }

        // Verify index.html exists
        archive
            .by_name(&index_entry_name)
            .map_err(|_| "Archive must contain 'index.html'".to_string())?;

        let file_stem = Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("custom-widget");

        let manifest = parse_manifest_with_defaults(&manifest_content, file_stem)?;
        validate_widget_id(&manifest.id)?;
        if crate::registry::ManifestRegistry::is_builtin_id(&manifest.id) {
            return Err(format!(
                "Cannot import custom widget with built-in ID '{}'",
                manifest.id
            ));
        }

        let target_dir = get_custom_widgets_dir().join(&manifest.id);
        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create widget directory {:?}: {}", target_dir, e))?;

        let extract_result = (|| -> Result<(), String> {
            for i in 0..archive.len() {
                let mut file = archive
                    .by_index(i)
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
                    || rel_path.components().any(|c| {
                        matches!(
                            c,
                            std::path::Component::ParentDir
                                | std::path::Component::RootDir
                                | std::path::Component::Prefix(_)
                        )
                    })
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
                            fs::create_dir_all(p).map_err(|e| {
                                format!("Failed to create parent directory {:?}: {}", p, e)
                            })?;
                        }
                    }
                    let mut outfile = fs::File::create(&outpath)
                        .map_err(|e| format!("Failed to create file {:?}: {}", outpath, e))?;

                    let remaining =
                        MAX_TOTAL_UNCOMPRESSED_SIZE.saturating_sub(total_uncompressed_bytes);
                    let mut limited = (&mut file).take(remaining + 1);
                    let copied = std::io::copy(&mut limited, &mut outfile)
                        .map_err(|e| format!("Failed to extract file {:?}: {}", outpath, e))?;
                    total_uncompressed_bytes += copied;
                    if total_uncompressed_bytes > MAX_TOTAL_UNCOMPRESSED_SIZE {
                        return Err(format!(
                            "Archive exceeds maximum uncompressed size of {} bytes",
                            MAX_TOTAL_UNCOMPRESSED_SIZE
                        ));
                    }
                }
            }
            Ok(())
        })();

        if let Err(e) = extract_result {
            let _ = fs::remove_dir_all(&target_dir);
            return Err(e);
        }

        Ok(manifest)
    } else {
        // Single file (.html or .nook)
        let html_content = std::str::from_utf8(&file_bytes)
            .map_err(|e| format!("File is not valid UTF-8: {}", e))?;

        let file_stem = Path::new(&file_name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("custom-widget");

        let manifest = if let Some(embedded_json) = extract_embedded_manifest(html_content) {
            parse_manifest_with_defaults(&embedded_json, file_stem)?
        } else {
            default_manifest_for_stem(file_stem)
        };

        validate_widget_id(&manifest.id)?;
        if crate::registry::ManifestRegistry::is_builtin_id(&manifest.id) {
            return Err(format!(
                "Cannot import custom widget with built-in ID '{}'",
                manifest.id
            ));
        }

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

pub fn validate_can_delete_custom_widget(id: &str) -> Result<PathBuf, String> {
    validate_widget_id(id)?;

    if crate::registry::ManifestRegistry::is_builtin_id(id) {
        return Err(format!("Cannot delete built-in widget '{}'", id));
    }

    let dir = get_custom_widgets_dir().join(id);
    if !dir.exists() {
        return Err(format!("Custom widget '{}' not found", id));
    }

    Ok(dir)
}

pub fn delete_custom_widget<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let dir = validate_can_delete_custom_widget(&id)?;

    fs::remove_dir_all(&dir).map_err(|e| format!("Failed to delete widget directory: {}", e))?;

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

        let html_2 =
            r#"<script id='nook-manifest' type="application/json">{"id":"test-2"}</script>"#;
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
            zip.write_all(b"<html><body><h1>Zip Widget</h1></body></html>")
                .unwrap();

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

    #[test]
    fn test_extract_manifest_unicode() {
        let html_unicode = r#"
            <!DOCTYPE html>
            <html>
            <head>
                <title>İpek Yolu & 🦀 & Привет & 日本語</title>
                <script type="application/json" id="nook-manifest">
                { "id": "unicode-widget", "name": "Unicode Widget" }
                </script>
            </head>
            <body>Merhaba Dünya!</body>
            </html>
        "#;
        let extracted = extract_embedded_manifest(html_unicode)
            .expect("Should extract manifest with non-ASCII text");
        assert!(extracted.contains("\"id\": \"unicode-widget\""));
    }

    #[test]
    fn test_windows_reserved_names() {
        assert!(validate_widget_id("CON").is_err());
        assert!(validate_widget_id("con").is_err());
        assert!(validate_widget_id("prn").is_err());
        assert!(validate_widget_id("AUX").is_err());
        assert!(validate_widget_id("NUL").is_err());
        assert!(validate_widget_id("COM1").is_err());
        assert!(validate_widget_id("com9").is_err());
        assert!(validate_widget_id("lpt1").is_err());
        assert!(validate_widget_id("LPT9").is_err());

        // Valid IDs containing reserved substrings should pass
        assert!(validate_widget_id("con-widget").is_ok());
        assert!(validate_widget_id("my_aux").is_ok());
        assert!(validate_widget_id("null").is_ok());

        // Test sanitization of reserved names
        assert_eq!(sanitize_id("CON"), "widget-con");
        assert_eq!(sanitize_id("nul"), "widget-nul");
    }

    #[test]
    fn test_delete_builtin_widget_protection() {
        // Built-in widgets must be protected from deletion
        let err_notes = validate_can_delete_custom_widget("notes").unwrap_err();
        assert_eq!(err_notes, "Cannot delete built-in widget 'notes'");

        let err_clock = validate_can_delete_custom_widget("clock").unwrap_err();
        assert_eq!(err_clock, "Cannot delete built-in widget 'clock'");

        // Non-existent custom widget should return not found
        let err_missing =
            validate_can_delete_custom_widget("nonexistent_test_widget_xyz").unwrap_err();
        assert_eq!(
            err_missing,
            "Custom widget 'nonexistent_test_widget_xyz' not found"
        );
    }

    #[test]
    fn test_archive_missing_required_files() {
        // Missing manifest.json
        let mut buffer_no_manifest = std::io::Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buffer_no_manifest);
            let options = SimpleFileOptions::default();
            zip.start_file("index.html", options).unwrap();
            zip.write_all(b"<html></html>").unwrap();
            zip.finish().unwrap();
        }
        let err1 = import_custom_widget(
            buffer_no_manifest.into_inner(),
            "missing_manifest.zip".to_string(),
        )
        .unwrap_err();
        assert!(err1.contains("Archive must contain 'manifest.json'"));

        // Missing index.html
        let mut buffer_no_index = std::io::Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buffer_no_index);
            let options = SimpleFileOptions::default();
            zip.start_file("manifest.json", options).unwrap();
            zip.write_all(b"{\"id\": \"no-index\", \"name\": \"No Index\"}")
                .unwrap();
            zip.finish().unwrap();
        }
        let err2 = import_custom_widget(
            buffer_no_index.into_inner(),
            "missing_index.zip".to_string(),
        )
        .unwrap_err();
        assert!(err2.contains("Archive must contain 'index.html'"));
    }

    #[test]
    fn test_zip_limits() {
        let mut buffer_too_many = std::io::Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buffer_too_many);
            let options = SimpleFileOptions::default();
            for i in 0..=MAX_ZIP_FILES {
                zip.start_file(format!("file_{}.txt", i), options).unwrap();
                zip.write_all(b"a").unwrap();
            }
            zip.finish().unwrap();
        }
        let err = import_custom_widget(buffer_too_many.into_inner(), "too_many.zip".to_string())
            .unwrap_err();
        assert!(err.contains("Archive contains too many files"));
    }

    #[test]
    fn test_cannot_import_builtin_id() {
        // Test HTML import with built-in ID
        let html = r#"<!DOCTYPE html><html><head><script type="application/json" id="nook-manifest">
        {"id": "notes", "name": "Fake Notes"}
        </script></head><body>Fake</body></html>"#;
        let err_html =
            import_custom_widget(html.as_bytes().to_vec(), "notes.html".to_string()).unwrap_err();
        assert_eq!(
            err_html,
            "Cannot import custom widget with built-in ID 'notes'"
        );

        // Test ZIP import with built-in ID
        let manifest_json = r#"{
            "id": "clock",
            "name": "Fake Clock",
            "description": "Fake Clock",
            "version": "1.0.0",
            "author": "Hacker",
            "defaultSize": { "w": 300, "h": 200 },
            "minSize": { "w": 200, "h": 150 }
        }"#;
        let mut buffer = std::io::Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buffer);
            let options = SimpleFileOptions::default();
            zip.start_file("manifest.json", options).unwrap();
            zip.write_all(manifest_json.as_bytes()).unwrap();
            zip.start_file("index.html", options).unwrap();
            zip.write_all(b"<html></html>").unwrap();
            zip.finish().unwrap();
        }
        let err_zip =
            import_custom_widget(buffer.into_inner(), "clock.zip".to_string()).unwrap_err();
        assert_eq!(
            err_zip,
            "Cannot import custom widget with built-in ID 'clock'"
        );
    }
}
