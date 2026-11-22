#[cfg(windows)]
pub fn enable() -> Result<(), Box<dyn std::error::Error>> {
    use windows_registry::{CURRENT_USER, LOCAL_MACHINE};

    let current_exe = std::env::current_exe()?;
    let exe_path = current_exe.to_string_lossy();

    // Critical: Windows Run key requires quotes around paths with spaces (e.g. C:\Program Files\Nook\nook.exe).
    // Without quotes, Windows parses the space and tries to run C:\Program.exe with arguments Files\Nook\nook.exe --autostart.
    let run_cmd = format!("\"{}\" --autostart", exe_path);

    let run_key = CURRENT_USER.create(r"Software\Microsoft\Windows\CurrentVersion\Run")?;
    run_key.set_string("Nook", &run_cmd)?;

    // Ensure Task Manager StartupApproved list reflects that Nook is enabled
    if let Ok(startup_approved) = CURRENT_USER
        .create(r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run")
    {
        let enabled_bytes: [u8; 12] = [
            0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ];
        let _ = startup_approved.set_bytes("Nook", windows_registry::Type::Bytes, &enabled_bytes);
    }

    // If running with elevated rights, clean up any stale/unquoted HKLM entries
    if let Ok(hklm_run) = LOCAL_MACHINE.open(r"Software\Microsoft\Windows\CurrentVersion\Run") {
        let _ = hklm_run.remove_value("Nook");
        let _ = hklm_run.remove_value("nook");
    }
    if let Ok(hklm_approved) = LOCAL_MACHINE
        .open(r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run")
    {
        let _ = hklm_approved.remove_value("Nook");
        let _ = hklm_approved.remove_value("nook");
    }

    tracing::info!("Registered Windows autostart: {}", run_cmd);
    Ok(())
}

#[cfg(windows)]
pub fn disable() -> Result<(), Box<dyn std::error::Error>> {
    use windows_registry::{CURRENT_USER, LOCAL_MACHINE};

    if let Ok(run_key) = CURRENT_USER.open(r"Software\Microsoft\Windows\CurrentVersion\Run") {
        let _ = run_key.remove_value("Nook");
        let _ = run_key.remove_value("nook");
    }

    if let Ok(startup_approved) =
        CURRENT_USER.open(r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run")
    {
        let _ = startup_approved.remove_value("Nook");
        let _ = startup_approved.remove_value("nook");
    }

    if let Ok(hklm_run) = LOCAL_MACHINE.open(r"Software\Microsoft\Windows\CurrentVersion\Run") {
        let _ = hklm_run.remove_value("Nook");
        let _ = hklm_run.remove_value("nook");
    }

    tracing::info!("Deregistered Windows autostart");
    Ok(())
}

#[cfg(windows)]
pub fn is_enabled() -> bool {
    use windows_registry::CURRENT_USER;

    if let Ok(run_key) = CURRENT_USER.open(r"Software\Microsoft\Windows\CurrentVersion\Run") {
        let has_run = run_key.get_string("Nook").is_ok() || run_key.get_string("nook").is_ok();
        if has_run {
            if let Ok(approved) = CURRENT_USER
                .open(r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run")
            {
                if let Ok(bytes) = approved
                    .get_value("Nook")
                    .or_else(|_| approved.get_value("nook"))
                {
                    return bytes.first().map(|&b| b % 2 == 0).unwrap_or(true);
                }
            }
            return true;
        }
    }
    false
}

#[cfg(not(windows))]
pub fn enable() -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(not(windows))]
pub fn disable() -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(not(windows))]
pub fn is_enabled() -> bool {
    false
}
