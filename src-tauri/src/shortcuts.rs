use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstalledAppItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub category: String,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FilePickerResult {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
}

fn guess_icon(lower: &str) -> String {
    if lower.contains("chrome") || lower.contains("google") {
        "google".to_string()
    } else if lower.contains("github") {
        "github".to_string()
    } else if lower.contains("discord") {
        "discord".to_string()
    } else if lower.contains("spotify") {
        "spotify".to_string()
    } else if lower.contains("youtube") {
        "youtube".to_string()
    } else if lower.contains("slack") {
        "slack".to_string()
    } else if lower.contains("reddit") {
        "reddit".to_string()
    } else if lower.contains("twitter") || lower == "x" {
        "twitter".to_string()
    } else if lower.contains("code")
        || lower.contains("studio")
        || lower.contains("git")
        || lower.contains("sublime")
        || lower.contains("intellij")
        || lower.contains("pycharm")
        || lower.contains("rider")
        || lower.contains("clion")
        || lower.contains("cursor")
        || lower.contains("windsurf")
    {
        "code".to_string()
    } else if lower.contains("terminal")
        || lower.contains("cmd")
        || lower.contains("powershell")
        || lower.contains("bash")
        || lower.contains("prompt")
    {
        "terminal".to_string()
    } else if lower.contains("calc") {
        "calculator".to_string()
    } else if lower.contains("explorer")
        || lower.contains("files")
        || lower.contains("folder")
        || lower.contains("directory")
    {
        "folder".to_string()
    } else if lower.contains("edge")
        || lower.contains("firefox")
        || lower.contains("brave")
        || lower.contains("browser")
        || lower.contains("opera")
        || lower.contains("vivaldi")
    {
        "globe".to_string()
    } else {
        "app".to_string()
    }
}

fn guess_category(lower: &str) -> String {
    if lower.contains("code")
        || lower.contains("terminal")
        || lower.contains("git")
        || lower.contains("cmd")
        || lower.contains("powershell")
        || lower.contains("studio")
        || lower.contains("sublime")
        || lower.contains("intellij")
        || lower.contains("rider")
        || lower.contains("pycharm")
        || lower.contains("cursor")
        || lower.contains("windsurf")
    {
        "Development".to_string()
    } else if lower.contains("chrome")
        || lower.contains("edge")
        || lower.contains("firefox")
        || lower.contains("brave")
        || lower.contains("opera")
        || lower.contains("browser")
        || lower.contains("vivaldi")
    {
        "Browsers".to_string()
    } else if lower.contains("spotify")
        || lower.contains("discord")
        || lower.contains("slack")
        || lower.contains("steam")
        || lower.contains("music")
        || lower.contains("media")
        || lower.contains("video")
        || lower.contains("player")
        || lower.contains("obs")
        || lower.contains("vlc")
        || lower.contains("telegram")
        || lower.contains("whatsapp")
    {
        "Media & Social".to_string()
    } else if lower.contains("calc")
        || lower.contains("notepad")
        || lower.contains("explorer")
        || lower.contains("task")
        || lower.contains("taskmgr")
        || lower.contains("snipping")
        || lower.contains("settings")
        || lower.contains("control")
    {
        "System Tools".to_string()
    } else {
        "Installed Software".to_string()
    }
}

#[cfg(windows)]
fn scan_lnk_directory(
    dir: &Path,
    apps: &mut Vec<InstalledAppItem>,
    seen_names: &mut HashSet<String>,
) {
    if !dir.is_dir() {
        return;
    }

    let mut stack = vec![dir.to_path_buf()];
    while let Some(current_dir) = stack.pop() {
        if let Ok(entries) = std::fs::read_dir(&current_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if !name.starts_with('.') {
                            stack.push(path);
                        }
                    }
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if ext.eq_ignore_ascii_case("lnk") {
                            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                                let lower_stem = stem.to_lowercase();
                                let clean_name = if lower_stem.ends_with(".exe") {
                                    &stem[..stem.len() - 4]
                                } else {
                                    stem
                                };
                                let lower_clean = clean_name.to_lowercase();

                                if lower_clean.contains("uninstall")
                                    || lower_clean.contains("documentation")
                                    || lower_clean.contains("readme")
                                    || lower_clean.contains("read me")
                                    || lower_clean.contains("help")
                                    || lower_clean.contains("license")
                                    || lower_clean.contains("support")
                                    || lower_clean.contains("website")
                                    || lower_clean.ends_with(".url")
                                    || lower_clean.starts_with("install ")
                                {
                                    continue;
                                }

                                if seen_names.insert(lower_clean.clone()) {
                                    let icon = guess_icon(&lower_clean);
                                    let category = guess_category(&lower_clean);
                                    let id = format!(
                                        "app_{}",
                                        lower_clean.replace(|c: char| !c.is_alphanumeric(), "_")
                                    );

                                    apps.push(InstalledAppItem {
                                        id,
                                        name: clean_name.to_string(),
                                        path: path.to_string_lossy().to_string(),
                                        icon: Some(icon),
                                        category,
                                        description: Some("Installed application".to_string()),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

pub fn get_installed_apps() -> Vec<InstalledAppItem> {
    let mut apps = Vec::new();
    let mut seen_names = HashSet::new();

    #[cfg(windows)]
    {
        // 1. User Start Menu
        if let Ok(app_data) = std::env::var("APPDATA") {
            let user_programs = PathBuf::from(app_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs");
            scan_lnk_directory(&user_programs, &mut apps, &mut seen_names);
        }

        // 2. All Users / ProgramData Start Menu
        let prog_data = std::env::var("ALLUSERSPROFILE")
            .or_else(|_| std::env::var("ProgramData"))
            .unwrap_or_else(|_| "C:\\ProgramData".to_string());
        let system_programs = PathBuf::from(prog_data)
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs");
        scan_lnk_directory(&system_programs, &mut apps, &mut seen_names);

        // 3. Built-in Windows system tools (guarantee presence)
        let builtins = [
            (
                "File Explorer",
                "explorer.exe",
                "folder",
                "System Tools",
                "Windows File Manager",
            ),
            (
                "Terminal",
                "wt.exe",
                "terminal",
                "Development",
                "Windows Terminal",
            ),
            (
                "Command Prompt",
                "cmd.exe",
                "terminal",
                "Development",
                "Windows Command Prompt",
            ),
            (
                "PowerShell",
                "powershell.exe",
                "terminal",
                "Development",
                "PowerShell Console",
            ),
            (
                "Calculator",
                "calc.exe",
                "calculator",
                "System Tools",
                "Windows Calculator",
            ),
            (
                "Notepad",
                "notepad.exe",
                "code",
                "System Tools",
                "Windows Notepad",
            ),
            (
                "Task Manager",
                "taskmgr.exe",
                "terminal",
                "System Tools",
                "System Task Manager",
            ),
            (
                "Snipping Tool",
                "snippingtool.exe",
                "app",
                "System Tools",
                "Screen Capture Utility",
            ),
        ];

        for (name, path, icon, category, desc) in builtins {
            let key = name.to_lowercase();
            if seen_names.insert(key.clone()) {
                apps.push(InstalledAppItem {
                    id: format!("sys_{}", key.replace(' ', "_")),
                    name: name.to_string(),
                    path: path.to_string(),
                    icon: Some(icon.to_string()),
                    category: category.to_string(),
                    description: Some(desc.to_string()),
                });
            }
        }
    }

    #[cfg(not(windows))]
    {
        // Non-windows basic fallback
        apps.push(InstalledAppItem {
            id: "sys_terminal".to_string(),
            name: "Terminal".to_string(),
            path: "terminal".to_string(),
            icon: Some("terminal".to_string()),
            category: "System Tools".to_string(),
            description: Some("System Terminal".to_string()),
        });
    }

    apps.sort_by_key(|a| a.name.to_lowercase());
    apps
}

pub fn pick_file_dialog() -> Option<FilePickerResult> {
    let dialog = rfd::FileDialog::new()
        .add_filter(
            "Applications & Files",
            &["exe", "lnk", "bat", "cmd", "ps1", "url", "*"],
        )
        .add_filter("Executables (*.exe)", &["exe"])
        .add_filter("Shortcuts (*.lnk)", &["lnk"])
        .add_filter("All Files (*.*)", &["*"]);

    let path = dialog.pick_file()?;
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Shortcut");
    let name = if stem.to_lowercase().ends_with(".exe") {
        stem[..stem.len() - 4].to_string()
    } else {
        stem.to_string()
    };

    Some(FilePickerResult {
        path: path.to_string_lossy().to_string(),
        name,
        is_dir: false,
    })
}

pub fn pick_folder_dialog() -> Option<FilePickerResult> {
    let path = rfd::FileDialog::new().pick_folder()?;
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Folder")
        .to_string();

    Some(FilePickerResult {
        path: path.to_string_lossy().to_string(),
        name,
        is_dir: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guess_icon() {
        assert_eq!(guess_icon("google chrome"), "google");
        assert_eq!(guess_icon("visual studio code"), "code");
        assert_eq!(guess_icon("windows terminal"), "terminal");
        assert_eq!(guess_icon("spotify music"), "spotify");
        assert_eq!(guess_icon("random unknown software"), "app");
    }

    #[test]
    fn test_guess_category() {
        assert_eq!(guess_category("google chrome"), "Browsers");
        assert_eq!(guess_category("visual studio code"), "Development");
        assert_eq!(guess_category("task manager"), "System Tools");
        assert_eq!(guess_category("discord"), "Media & Social");
    }

    #[test]
    fn test_get_installed_apps_non_empty() {
        let apps = get_installed_apps();
        assert!(!apps.is_empty(), "Should return installed or system apps");
    }
}
