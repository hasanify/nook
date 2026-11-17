pub mod github;
pub mod vercel;
pub mod weather;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderStatus {
    Ok,
    Syncing,
    Offline,
    BadToken,
    RateLimited,
    NotFound,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPayload {
    pub status: ProviderStatus,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
    pub updated_at: u64,
}
