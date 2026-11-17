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
pub struct VercelProjectMeta {
    pub domain: Option<String>,
    pub domains: Vec<String>,
    pub framework: Option<String>,
    pub git_repo: Option<String>,
    pub updated_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VercelData {
    pub project_id: String,
    pub meta: Option<VercelProjectMeta>,
    pub deployments: Vec<DeploymentItem>,
}

pub async fn fetch_vercel(
    client: &reqwest::Client,
    project_id: &str,
    token_opt: Option<&str>,
    limit_opt: Option<usize>,
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

    let limit = limit_opt.unwrap_or(5).clamp(1, 20);
    let url = format!(
        "https://api.vercel.com/v6/deployments?projectId={}&limit={}",
        clean_project, limit
    );

    let res = match client.get(&url).headers(headers.clone()).send().await {
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

    // Fetch project details (domains, framework, git repo)
    let project_url = format!("https://api.vercel.com/v9/projects/{}", clean_project);
    let mut project_meta = None;
    if let Ok(meta_res) = client.get(&project_url).headers(headers).send().await {
        if meta_res.status().is_success() {
            if let Ok(json) = meta_res.json::<serde_json::Value>().await {
                let framework = json
                    .get("framework")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let updated_at = json.get("updatedAt").and_then(|v| v.as_u64());

                let mut domains = Vec::new();
                let mut primary_domain = None;

                if let Some(aliases) = json
                    .get("targets")
                    .and_then(|t| t.get("production"))
                    .and_then(|p| p.get("alias"))
                    .and_then(|a| a.as_array())
                {
                    for a in aliases {
                        if let Some(d) = a.as_str() {
                            domains.push(d.to_string());
                        }
                    }
                }

                if let Some(u) = json
                    .get("targets")
                    .and_then(|t| t.get("production"))
                    .and_then(|p| p.get("url"))
                    .and_then(|v| v.as_str())
                {
                    primary_domain = Some(u.to_string());
                } else if !domains.is_empty() {
                    primary_domain = Some(domains[0].clone());
                }

                let git_repo = json.get("link").and_then(|l| {
                    let org = l.get("org").and_then(|v| v.as_str())?;
                    let repo = l.get("repo").and_then(|v| v.as_str())?;
                    Some(format!("{}/{}", org, repo))
                });

                project_meta = Some(VercelProjectMeta {
                    domain: primary_domain,
                    domains,
                    framework,
                    git_repo,
                    updated_at,
                });
            }
        }
    }

    info!(
        "Successfully fetched Vercel data for '{}' ({} deployments, domain: {:?})",
        clean_project,
        parsed_deployments.len(),
        project_meta.as_ref().and_then(|m| m.domain.as_ref())
    );

    let data = VercelData {
        project_id: clean_project.to_string(),
        meta: project_meta,
        deployments: parsed_deployments,
    };

    ProviderPayload {
        status: ProviderStatus::Ok,
        message: None,
        data: serde_json::to_value(data).ok(),
        updated_at: now,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VercelProjectSummary {
    pub id: String,
    pub name: String,
    pub framework: Option<String>,
}

pub async fn list_projects(
    client: &reqwest::Client,
    token_opt: Option<&str>,
) -> Result<Vec<VercelProjectSummary>, String> {
    let token = match token_opt {
        Some(t) if !t.trim().is_empty() => t.trim(),
        _ => return Err("Vercel token not configured".to_string()),
    };

    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("nook/0.1.0"));
    if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
        headers.insert(AUTHORIZATION, val);
    }

    let url = "https://api.vercel.com/v9/projects?limit=100";
    let res = client
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Failed to reach Vercel API: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Vercel returned status {}", res.status()));
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse Vercel response: {}", e))?;

    let mut list = Vec::new();
    if let Some(arr) = json.get("projects").and_then(|v| v.as_array()) {
        for p in arr {
            let id = p
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let name = p
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let framework = p
                .get("framework")
                .and_then(|v| v.as_str())
                .map(String::from);
            if !name.is_empty() {
                list.push(VercelProjectSummary {
                    id,
                    name,
                    framework,
                });
            }
        }
    }

    Ok(list)
}
