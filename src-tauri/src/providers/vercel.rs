use super::{ProviderPayload, ProviderStatus};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentItem {
    pub id: String,
    pub name: String,
    pub url: String,
    pub state: String,
    pub target: Option<String>,
    pub created: u64,
    pub commit_msg: Option<String>,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VercelData {
    pub project_id: String,
    pub deployments: Vec<DeploymentItem>,
}

pub async fn fetch_vercel(
    client: &reqwest::Client,
    project_id: &str,
    token_opt: Option<&str>,
) -> ProviderPayload {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let clean_project = project_id.trim();
    if clean_project.is_empty() {
        return ProviderPayload {
            status: ProviderStatus::NotFound,
            message: Some("No project specified — configure in Settings".to_string()),
            data: None,
            updated_at: now,
        };
    }

    let token = match token_opt {
        Some(t) if !t.trim().is_empty() => t.trim(),
        _ => {
            return ProviderPayload {
                status: ProviderStatus::BadToken,
                message: Some("Vercel token required — configure in Settings".to_string()),
                data: None,
                updated_at: now,
            };
        }
    };

    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("nook/0.1.0"));
    if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
        headers.insert(AUTHORIZATION, val);
    }

    let url = format!(
        "https://api.vercel.com/v6/deployments?projectId={}&limit=5",
        clean_project
    );

    let res = match client.get(&url).headers(headers).send().await {
        Ok(r) => r,
        Err(err) => {
            warn!("Vercel fetch failed (network): {}", err);
            return ProviderPayload {
                status: ProviderStatus::Offline,
                message: Some("Offline — showing cached data".to_string()),
                data: None,
                updated_at: now,
            };
        }
    };

    let status_code = res.status().as_u16();
    if status_code == 401 || status_code == 403 {
        return ProviderPayload {
            status: ProviderStatus::BadToken,
            message: Some("Invalid Vercel token — check Settings".to_string()),
            data: None,
            updated_at: now,
        };
    } else if status_code == 429 {
        return ProviderPayload {
            status: ProviderStatus::RateLimited,
            message: Some("Vercel rate limit reached — please wait".to_string()),
            data: None,
            updated_at: now,
        };
    } else if status_code == 404 {
        return ProviderPayload {
            status: ProviderStatus::NotFound,
            message: Some("Project not found on Vercel".to_string()),
            data: None,
            updated_at: now,
        };
    } else if !res.status().is_success() {
        return ProviderPayload {
            status: ProviderStatus::Error,
            message: Some(format!("Vercel API returned status {}", status_code)),
            data: None,
            updated_at: now,
        };
    }

    let json: serde_json::Value = res.json().await.unwrap_or(serde_json::Value::Null);
    let mut parsed_deployments = Vec::new();

    if let Some(arr) = json.get("deployments").and_then(|v| v.as_array()) {
        for d in arr {
            let id = d
                .get("uid")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let name = d
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let raw_url = d.get("url").and_then(|v| v.as_str()).unwrap_or("");
            let url = if raw_url.is_empty() {
                String::new()
            } else if raw_url.starts_with("http") {
                raw_url.to_string()
            } else {
                format!("https://{}", raw_url)
            };
            let state = d
                .get("state")
                .and_then(|v| v.as_str())
                .unwrap_or("READY")
                .to_string();
            let target = d.get("target").and_then(|v| v.as_str()).map(String::from);
            let created = d.get("created").and_then(|v| v.as_u64()).unwrap_or(0);

            let commit_msg = d
                .get("meta")
                .and_then(|m| m.get("githubCommitMessage"))
                .and_then(|v| v.as_str())
                .map(|m| m.lines().next().unwrap_or("").to_string());

            let branch = d
                .get("meta")
                .and_then(|m| m.get("githubCommitRef"))
                .and_then(|v| v.as_str())
                .map(String::from);

            parsed_deployments.push(DeploymentItem {
                id,
                name,
                url,
                state,
                target,
                created,
                commit_msg,
                branch,
            });
        }
    }

    info!(
        "Successfully fetched Vercel data for '{}' ({} deployments)",
        clean_project,
        parsed_deployments.len()
    );

    let data = VercelData {
        project_id: clean_project.to_string(),
        deployments: parsed_deployments,
    };

    ProviderPayload {
        status: ProviderStatus::Ok,
        message: None,
        data: serde_json::to_value(data).ok(),
        updated_at: now,
    }
}
