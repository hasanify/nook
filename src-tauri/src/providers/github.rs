use super::{ProviderPayload, ProviderStatus};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitItem {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub date: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRunItem {
    pub id: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub branch: String,
    pub updated_at: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseItem {
    pub tag_name: String,
    pub name: Option<String>,
    pub published_at: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubData {
    pub repo: String,
    pub branch: String,
    pub stars: Option<u64>,
    pub forks: Option<u64>,
    pub open_issues: Option<u64>,
    pub latest_release: Option<ReleaseItem>,
    pub commits: Vec<CommitItem>,
    pub runs: Vec<WorkflowRunItem>,
}

pub async fn fetch_github(
    client: &reqwest::Client,
    repo: &str,
    branch_opt: Option<&str>,
    token_opt: Option<&str>,
) -> ProviderPayload {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let clean_repo = repo.trim();
    if clean_repo.is_empty() || !clean_repo.contains('/') {
        return ProviderPayload {
            status: ProviderStatus::NotFound,
            message: Some("Invalid repository format (expected owner/repo)".to_string()),
            data: None,
            updated_at: now,
        };
    }

    let branch = branch_opt.unwrap_or("").trim();

    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("nook/0.1.0"));
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    headers.insert(
        "X-GitHub-Api-Version",
        HeaderValue::from_static("2022-11-28"),
    );

    if let Some(token) = token_opt {
        if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", token.trim())) {
            headers.insert(AUTHORIZATION, val);
        }
    }

    // 1. Fetch commits
    let mut commits_url = format!(
        "https://api.github.com/repos/{}/commits?per_page=5",
        clean_repo
    );
    if !branch.is_empty() {
        commits_url.push_str(&format!("&sha={}", branch));
    }

    let commits_res = match client
        .get(&commits_url)
        .headers(headers.clone())
        .send()
        .await
    {
        Ok(res) => res,
        Err(err) => {
            warn!("GitHub fetch failed (network): {}", err);
            return ProviderPayload {
                status: ProviderStatus::Offline,
                message: Some("Offline — showing cached data".to_string()),
                data: None,
                updated_at: now,
            };
        }
    };

    let status_code = commits_res.status().as_u16();
    if status_code == 401 || status_code == 403 {
        // Check rate limiting
        if commits_res
            .headers()
            .get("x-ratelimit-remaining")
            .map(|v| v == "0")
            .unwrap_or(false)
        {
            return ProviderPayload {
                status: ProviderStatus::RateLimited,
                message: Some("GitHub API rate limit exceeded".to_string()),
                data: None,
                updated_at: now,
            };
        }
        return ProviderPayload {
            status: ProviderStatus::BadToken,
            message: Some("Invalid GitHub token — configure in Settings".to_string()),
            data: None,
            updated_at: now,
        };
    } else if status_code == 404 {
        return ProviderPayload {
            status: ProviderStatus::NotFound,
            message: Some("Repository not found — check repository name".to_string()),
            data: None,
            updated_at: now,
        };
    } else if !commits_res.status().is_success() {
        return ProviderPayload {
            status: ProviderStatus::Error,
            message: Some(format!("GitHub API returned error {}", status_code)),
            data: None,
            updated_at: now,
        };
    }

    let commits_json: serde_json::Value =
        commits_res.json().await.unwrap_or(serde_json::Value::Null);
    let mut parsed_commits = Vec::new();
    if let Some(arr) = commits_json.as_array() {
        for item in arr {
            let sha_full = item.get("sha").and_then(|v| v.as_str()).unwrap_or("");
            let sha = if sha_full.len() >= 7 {
                &sha_full[..7]
            } else {
                sha_full
            };
            let raw_msg = item
                .get("commit")
                .and_then(|c| c.get("message"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let message = raw_msg.lines().next().unwrap_or("").to_string();
            let author = item
                .get("commit")
                .and_then(|c| c.get("author"))
                .and_then(|a| a.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();
            let date = item
                .get("commit")
                .and_then(|c| c.get("author"))
                .and_then(|a| a.get("date"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let url = item
                .get("html_url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            parsed_commits.push(CommitItem {
                sha: sha.to_string(),
                message,
                author,
                date,
                url,
            });
        }
    }

    // 2. Fetch workflow runs
    let mut runs_url = format!(
        "https://api.github.com/repos/{}/actions/runs?per_page=3",
        clean_repo
    );
    if !branch.is_empty() {
        runs_url.push_str(&format!("&branch={}", branch));
    }

    let mut parsed_runs = Vec::new();
    if let Ok(runs_res) = client.get(&runs_url).headers(headers.clone()).send().await {
        if runs_res.status().is_success() {
            if let Ok(runs_json) = runs_res.json::<serde_json::Value>().await {
                if let Some(arr) = runs_json.get("workflow_runs").and_then(|v| v.as_array()) {
                    for r in arr {
                        let id = r.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
                        let name = r
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Build")
                            .to_string();
                        let r_status = r
                            .get("status")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let conclusion = r
                            .get("conclusion")
                            .and_then(|v| v.as_str())
                            .map(String::from);
                        let r_branch = r
                            .get("head_branch")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let updated_at = r
                            .get("updated_at")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let url = r
                            .get("html_url")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        parsed_runs.push(WorkflowRunItem {
                            id,
                            name,
                            status: r_status,
                            conclusion,
                            branch: r_branch,
                            updated_at,
                            url,
                        });
                    }
                }
            }
        }
    }

    // 3. Fetch repo stats (stars, forks, open issues)
    let repo_meta_url = format!("https://api.github.com/repos/{}", clean_repo);
    let mut stars = None;
    let mut forks = None;
    let mut open_issues = None;

    if let Ok(repo_res) = client
        .get(&repo_meta_url)
        .headers(headers.clone())
        .send()
        .await
    {
        if repo_res.status().is_success() {
            if let Ok(json) = repo_res.json::<serde_json::Value>().await {
                stars = json.get("stargazers_count").and_then(|v| v.as_u64());
                forks = json.get("forks_count").and_then(|v| v.as_u64());
                open_issues = json.get("open_issues_count").and_then(|v| v.as_u64());
            }
        }
    }

    // 4. Fetch latest release
    let release_url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        clean_repo
    );
    let mut latest_release = None;

    if let Ok(rel_res) = client.get(&release_url).headers(headers).send().await {
        if rel_res.status().is_success() {
            if let Ok(json) = rel_res.json::<serde_json::Value>().await {
                if let Some(tag) = json.get("tag_name").and_then(|v| v.as_str()) {
                    let name = json.get("name").and_then(|v| v.as_str()).map(String::from);
                    let published_at = json
                        .get("published_at")
                        .and_then(|v| v.as_str())
                        .map(String::from);
                    let url = json
                        .get("html_url")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    latest_release = Some(ReleaseItem {
                        tag_name: tag.to_string(),
                        name,
                        published_at,
                        url,
                    });
                }
            }
        }
    }

    info!(
        "Successfully fetched GitHub data for '{}' ({} commits, {} runs, stars: {:?}, release: {:?})",
        clean_repo,
        parsed_commits.len(),
        parsed_runs.len(),
        stars,
        latest_release.as_ref().map(|r| &r.tag_name)
    );

    let data = GitHubData {
        repo: clean_repo.to_string(),
        branch: branch.to_string(),
        stars,
        forks,
        open_issues,
        latest_release,
        commits: parsed_commits,
        runs: parsed_runs,
    };

    ProviderPayload {
        status: ProviderStatus::Ok,
        message: None,
        data: serde_json::to_value(data).ok(),
        updated_at: now,
    }
}
