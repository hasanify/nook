use std::sync::atomic::{AtomicIsize, Ordering};
use tracing::{debug, error, info};
use windows::core::{w, BOOL};
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, POINT, RECT};
use windows::Win32::Graphics::Gdi::{CreateRoundRectRgn, ScreenToClient, SetWindowRgn};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowExW, FindWindowW, GetParent, GetWindowLongPtrW, IsWindow,
    SetLayeredWindowAttributes, SetParent, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE,
    HWND_BOTTOM, HWND_TOP, HWND_TOPMOST, LWA_ALPHA, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE,
    SWP_NOSIZE, SWP_NOZORDER, WS_CHILD, WS_CLIPSIBLINGS, WS_EX_APPWINDOW, WS_EX_LAYERED,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_POPUP, WS_SYSMENU,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PinStrategy {
    AboveIcons,
    BottomToplevel,
    Topmost,
}

static CACHED_HOST: AtomicIsize = AtomicIsize::new(0);

/// Finds the HWND that directly hosts `SHELLDLL_DefView`.
/// On Win11 24H2+ and default Win10, this is usually `Progman`.
/// If wallpaper transitions or WorkerW-splitting occurred, it is a top-level `WorkerW`.
pub fn find_defview_host() -> Option<HWND> {
    let cached = CACHED_HOST.load(Ordering::Relaxed);
    if cached != 0 {
        let hwnd = HWND(cached as *mut _);
        // SAFETY: Verifying if cached HWND is still valid and has SHELLDLL_DefView child
        unsafe {
            if IsWindow(Some(hwnd)).as_bool() {
                if let Ok(child) = FindWindowExW(Some(hwnd), None, w!("SHELLDLL_DefView"), None) {
                    if child.0 as isize != 0 {
                        return Some(hwnd);
                    }
                }
            }
        }
    }

    // 1. Enumerate top-level WorkerW windows looking for SHELLDLL_DefView child
    struct EnumContext {
        target: Option<HWND>,
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam.0 as *mut EnumContext);
        // Check for SHELLDLL_DefView child
        if let Ok(defview) = FindWindowExW(Some(hwnd), None, w!("SHELLDLL_DefView"), None) {
            if defview.0 as isize != 0 {
                ctx.target = Some(hwnd);
                return BOOL(0); // Stop enumeration
            }
        }
        BOOL(1) // Continue enumeration
    }

    let mut ctx = EnumContext { target: None };
    // SAFETY: Calling EnumWindows with a valid callback and context pointer
    unsafe {
        let _ = EnumWindows(Some(enum_windows_proc), LPARAM(&mut ctx as *mut _ as isize));
    }

    if let Some(host) = ctx.target {
        debug!("Found DefView host in top-level window: {:?}", host);
        CACHED_HOST.store(host.0 as isize, Ordering::Relaxed);
        return Some(host);
    }

    // 2. Fall back to Progman if it hosts SHELLDLL_DefView
    // SAFETY: Checking Progman for SHELLDLL_DefView child
    unsafe {
        if let Ok(progman) = FindWindowW(w!("Progman"), None) {
            if progman.0 as isize != 0 {
                if let Ok(defview) =
                    FindWindowExW(Some(progman), None, w!("SHELLDLL_DefView"), None)
                {
                    if defview.0 as isize != 0 {
                        debug!("Found DefView host in Progman: {:?}", progman);
                        CACHED_HOST.store(progman.0 as isize, Ordering::Relaxed);
                        return Some(progman);
                    }
                }
            }
        }
    }

    error!("Failed to find DefView host in WorkerW or Progman");
    None
}

/// Attaches the given window as a child of the desktop layer (`PinStrategy::AboveIcons`).
pub fn attach(hwnd: HWND, opacity: f32) -> Result<PinStrategy, String> {
    let host =
        find_defview_host().ok_or_else(|| "Could not locate desktop host window".to_string())?;

    // SAFETY: Direct Win32 reparenting and style application.
    // Order per MSDN: SetParent first, then set window styles and z-order.
    unsafe {
        SetParent(hwnd, Some(host)).map_err(|e| format!("SetParent failed: {}", e))?;

        let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        style = (style & !(WS_POPUP.0 as isize | WS_SYSMENU.0 as isize))
            | WS_CHILD.0 as isize
            | WS_CLIPSIBLINGS.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, style);

        let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        ex_style = (ex_style | WS_EX_TOOLWINDOW.0 as isize | WS_EX_LAYERED.0 as isize)
            & !(WS_EX_APPWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

        let alpha = (opacity.clamp(0.1, 1.0) * 255.0) as u8;
        let _ = SetLayeredWindowAttributes(hwnd, COLORREF(0), alpha, LWA_ALPHA);

        // Place above DefView amongst desktop siblings
        SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        )
        .map_err(|e| format!("SetWindowPos failed: {}", e))?;

        info!("Attached widget HWND {:?} to host {:?}", hwnd, host);
        Ok(PinStrategy::AboveIcons)
    }
}

/// Smoothly updates the alpha transparency of a layered window without altering hierarchy or styles.
pub fn set_opacity(hwnd: HWND, opacity: f32) -> Result<(), String> {
    unsafe {
        let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        if (ex_style & (WS_EX_LAYERED.0 as isize)) == 0 {
            ex_style |= WS_EX_LAYERED.0 as isize;
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);
        }
        let alpha = (opacity.clamp(0.1, 1.0) * 255.0) as u8;
        SetLayeredWindowAttributes(hwnd, COLORREF(0), alpha, LWA_ALPHA)
            .map_err(|e| format!("SetLayeredWindowAttributes failed: {}", e))
    }
}

/// Fallback attach strategy: keeps window top-level at the bottom of z-order (`BottomToplevel`).
pub fn attach_bottom(hwnd: HWND, opacity: f32) -> Result<PinStrategy, String> {
    // SAFETY: Setting top-level tool window at HWND_BOTTOM
    unsafe {
        let _ = SetParent(hwnd, None);

        let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        style = (style & !(WS_CHILD.0 as isize | WS_SYSMENU.0 as isize))
            | WS_POPUP.0 as isize
            | WS_CLIPSIBLINGS.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, style);

        let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        ex_style = (ex_style
            | WS_EX_TOOLWINDOW.0 as isize
            | WS_EX_LAYERED.0 as isize
            | WS_EX_NOACTIVATE.0 as isize)
            & !(WS_EX_APPWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

        let alpha = (opacity.clamp(0.1, 1.0) * 255.0) as u8;
        let _ = SetLayeredWindowAttributes(hwnd, COLORREF(0), alpha, LWA_ALPHA);

        SetWindowPos(
            hwnd,
            Some(HWND_BOTTOM),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        )
        .map_err(|e| format!("SetWindowPos to bottom failed: {}", e))?;

        info!("Set widget HWND {:?} to BottomToplevel", hwnd);
        Ok(PinStrategy::BottomToplevel)
    }
}

/// Detaches widget and converts it to a top-level `HWND_TOPMOST` tool window for "Always on top".
pub fn detach_to_topmost(hwnd: HWND, opacity: f32) -> Result<PinStrategy, String> {
    // SAFETY: Restoring top-level style and positioning at HWND_TOPMOST
    unsafe {
        let _ = SetParent(hwnd, None);

        let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        style = (style & !(WS_CHILD.0 as isize | WS_SYSMENU.0 as isize))
            | WS_POPUP.0 as isize
            | WS_CLIPSIBLINGS.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, style);

        let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        ex_style = (ex_style | WS_EX_TOOLWINDOW.0 as isize | WS_EX_LAYERED.0 as isize)
            & !(WS_EX_APPWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

        let alpha = (opacity.clamp(0.1, 1.0) * 255.0) as u8;
        let _ = SetLayeredWindowAttributes(hwnd, COLORREF(0), alpha, LWA_ALPHA);

        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        )
        .map_err(|e| format!("SetWindowPos topmost failed: {}", e))?;

        info!("Detached widget HWND {:?} to Topmost", hwnd);
        Ok(PinStrategy::Topmost)
    }
}

/// Applies screen-space rect to the window.
/// If child of desktop host, translates screen coordinates to host client coordinates.
pub fn set_bounds_screen(
    hwnd: HWND,
    screen_rect: RECT,
    strategy: PinStrategy,
    corner_radius: i32,
) -> Result<(), String> {
    // SAFETY: Translating coordinates and setting window geometry
    unsafe {
        let (x, y, w, h) = if strategy == PinStrategy::AboveIcons {
            if let Some(host) = find_defview_host() {
                let mut pt = POINT {
                    x: screen_rect.left,
                    y: screen_rect.top,
                };
                let _ = ScreenToClient(host, &mut pt);
                (
                    pt.x,
                    pt.y,
                    screen_rect.right - screen_rect.left,
                    screen_rect.bottom - screen_rect.top,
                )
            } else {
                (
                    screen_rect.left,
                    screen_rect.top,
                    screen_rect.right - screen_rect.left,
                    screen_rect.bottom - screen_rect.top,
                )
            }
        } else {
            (
                screen_rect.left,
                screen_rect.top,
                screen_rect.right - screen_rect.left,
                screen_rect.bottom - screen_rect.top,
            )
        };

        SetWindowPos(hwnd, None, x, y, w, h, SWP_NOZORDER | SWP_NOACTIVATE)
            .map_err(|e| format!("SetWindowPos bounds failed: {}", e))?;

        // Apply rounded window region only if dimensions changed or first set
        if corner_radius > 0 {
            let mut current_rect = RECT::default();
            let size_changed =
                if windows::Win32::UI::WindowsAndMessaging::GetWindowRect(hwnd, &mut current_rect)
                    .is_ok()
                {
                    (current_rect.right - current_rect.left != w)
                        || (current_rect.bottom - current_rect.top != h)
                } else {
                    true
                };

            if size_changed {
                let rgn = CreateRoundRectRgn(0, 0, w, h, corner_radius, corner_radius);
                if !rgn.is_invalid() {
                    let _ = SetWindowRgn(hwnd, Some(rgn), true);
                }
            }
        }

        Ok(())
    }
}

/// Verifies whether the window is currently attached to the desktop host.
pub fn verify(hwnd: HWND) -> bool {
    // SAFETY: Checking IsWindow and comparing parent with find_defview_host()
    unsafe {
        if !IsWindow(Some(hwnd)).as_bool() {
            return false;
        }
        if let Some(host) = find_defview_host() {
            if let Ok(parent) = GetParent(hwnd) {
                return parent == host;
            }
        }
        // If DefView host is unavailable, BottomToplevel is active.
        // As long as the window exists as a top-level window (parent is 0), it is valid.
        let parent = GetParent(hwnd).unwrap_or_default();
        parent.0 as isize == 0
    }
}
