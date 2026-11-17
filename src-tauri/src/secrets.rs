use keyring::Entry;
use tracing::{debug, info};

const SERVICE_NAME: &str = "com.nook.app";

pub fn set_secret(provider: &str, secret: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, provider).map_err(|e| e.to_string())?;
    entry
        .set_password(secret)
        .map_err(|e| format!("Failed to set credential for '{}': {}", provider, e))?;
    info!(
        "Securely stored credential for '{}' in Windows Credential Manager",
        provider
    );
    Ok(())
}

pub fn get_secret(provider: &str) -> Option<String> {
    let entry = Entry::new(SERVICE_NAME, provider).ok()?;
    entry.get_password().ok()
}

pub fn delete_secret(provider: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, provider).map_err(|e| e.to_string())?;
    let _ = entry.delete_credential();
    info!(
        "Cleared credential for '{}' from Windows Credential Manager",
        provider
    );
    Ok(())
}

pub fn has_secret(provider: &str) -> bool {
    let has = get_secret(provider).is_some();
    debug!("Credential status for '{}': {}", provider, has);
    has
}

pub fn redact(text: &str) -> String {
    if text.len() <= 6 {
        "***".to_string()
    } else {
        format!("{}...{}", &text[..3], &text[text.len() - 3..])
    }
}
