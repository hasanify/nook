use tracing::info;
use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    DeleteMenu, FindWindowExW, FindWindowW, GetDesktopWindow, GetMenuItemCount, GetSystemMenu,
    GetWindowLongPtrW, IsWindow, SetParent, SetWindowLongPtrW, SetWindowPos, GWLP_HWNDPARENT,
    GWL_EXSTYLE, GWL_STYLE, HTBOTTOM, HTBOTTOMLEFT, HTBOTTOMRIGHT, HTCLIENT, HTLEFT, HTRIGHT,
    HTTOP, HTTOPLEFT, HTTOPRIGHT, HWND_NOTOPMOST, HWND_TOP, HWND_TOPMOST, MF_BYPOSITION,
    SC_KEYMENU, SC_MINIMIZE, SWP_FRAMECHANGED, SWP_HIDEWINDOW, SWP_NOACTIVATE, SWP_NOMOVE,
    SWP_NOSIZE, SWP_NOZORDER, WINDOWPOS, WM_EXITSIZEMOVE, WM_NCDESTROY, WM_NCHITTEST,
    WM_NCLBUTTONDBLCLK, WM_SHOWWINDOW, WM_SYSCOMMAND, WM_SYSKEYDOWN, WM_WINDOWPOSCHANGING,
    WS_CHILD, WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_EX_APPWINDOW, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_POPUP, WS_SYSMENU,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PinStrategy {
    AboveIcons,
    BottomToplevel,
    Topmost,
}

/// Attaches the given window to the desktop layer at HWND_BOTTOM without GDI reparenting,
/// preserving 100% of Tauri's DWM DirectComposition per-pixel alpha transparency and native mouse input.
pub fn attach(hwnd: HWND, opacity: f32) -> Result<PinStrategy, String> {
    attach_bottom(hwnd, opacity)
}

/// Opacity is handled with hardware acceleration by WebView2 CSS compositing.
pub fn set_opacity(_hwnd: HWND, _opacity: f32) -> Result<(), String> {
    Ok(())
}

/// Locates the desktop view window (SHELLDLL_DefView) which hosts desktop icons.
/// Setting this as the owner prevents Explorer's ToggleDesktop (Win+D) from hiding widget windows.
pub fn find_shelldll_defview() -> Option<HWND> {
    unsafe {
        // 1. Check under Progman (default desktop manager)
        let progman = FindWindowW(w!("Progman"), None).unwrap_or_default();
        if !progman.is_invalid() {
            if let Ok(view) = FindWindowExW(Some(progman), None, w!("SHELLDLL_DefView"), None) {
                if !view.is_invalid() {
                    return Some(view);
                }
            }
        }

        // 2. Iterate through WorkerW windows (used during wallpaper slideshows and on modern Windows 11)
        let desktop = GetDesktopWindow();
        let mut worker: Option<HWND> = None;
        loop {
            match FindWindowExW(Some(desktop), worker, w!("WorkerW"), None) {
                Ok(w_hwnd) if !w_hwnd.is_invalid() => {
                    if let Ok(view) =
                        FindWindowExW(Some(w_hwnd), None, w!("SHELLDLL_DefView"), None)
                    {
                        if !view.is_invalid() {
                            return Some(view);
                        }
                    }
                    worker = Some(w_hwnd);
                }
                _ => break,
            }
        }
    }
    None
}

/// Sets widget as a top-level tool window pinned at the desktop normal level.
pub fn attach_bottom(hwnd: HWND, _opacity: f32) -> Result<PinStrategy, String> {
    // SAFETY: Setting top-level tool window at HWND_NOTOPMOST
    unsafe {
        let _ = SetParent(hwnd, None);

        let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        style = (style & !(WS_CHILD.0 as isize | WS_SYSMENU.0 as isize))
            | WS_POPUP.0 as isize
            | WS_CLIPSIBLINGS.0 as isize
            | WS_CLIPCHILDREN.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, style);

        let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        ex_style = (ex_style | WS_EX_TOOLWINDOW.0 as isize)
            & !(WS_EX_APPWINDOW.0 as isize | WS_EX_NOACTIVATE.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

        // Make the desktop view (SHELLDLL_DefView) the owner so Explorer's ToggleDesktop (Win+D) treats it as part of the desktop
        if let Some(def_view) = find_shelldll_defview() {
            let _ = SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, def_view.0 as isize);
            info!(
                "Attached widget HWND {:?} owner to SHELLDLL_DefView {:?}",
                hwnd, def_view
            );
        } else {
            let progman = FindWindowW(w!("Progman"), None).unwrap_or_default();
            if !progman.is_invalid() {
                let _ = SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, progman.0 as isize);
                info!(
                    "Attached widget HWND {:?} owner to Progman {:?}",
                    hwnd, progman
                );
            }
        }

        use windows::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE,
        };
        let pref: u32 = 2; // DWMWCP_ROUND
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &pref as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );
        let border_color: u32 = 0xFFFFFFFE; // DWMWA_COLOR_NONE
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR,
            &border_color as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );

        SetWindowPos(
            hwnd,
            Some(HWND_NOTOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        )
        .map_err(|e| format!("SetWindowPos to bottom failed: {}", e))?;

        // Position right above desktop shell layer
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );

        info!("Set widget HWND {:?} to BottomToplevel", hwnd);
        Ok(PinStrategy::BottomToplevel)
    }
}

/// Detaches widget and converts it to a top-level `HWND_TOPMOST` tool window for "Always on top".
pub fn detach_to_topmost(hwnd: HWND, _opacity: f32) -> Result<PinStrategy, String> {
    // SAFETY: Restoring top-level style and positioning at HWND_TOPMOST
    unsafe {
        let _ = SetParent(hwnd, None);

        let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        style = (style & !(WS_CHILD.0 as isize | WS_SYSMENU.0 as isize))
            | WS_POPUP.0 as isize
            | WS_CLIPSIBLINGS.0 as isize
            | WS_CLIPCHILDREN.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, style);

        let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        ex_style = (ex_style | WS_EX_TOOLWINDOW.0 as isize) & !(WS_EX_APPWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

        // Clear owner when detached to topmost
        let _ = SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, 0);

        use windows::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE,
        };
        let pref: u32 = 2; // DWMWCP_ROUND
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &pref as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );
        let border_color: u32 = 0xFFFFFFFE; // DWMWA_COLOR_NONE
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR,
            &border_color as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );

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

const WIDGET_SUBCLASS_ID: usize = 0x5749;

/// Window subclass procedure to intercept system menu and Alt+Space commands.
///
/// # Safety
/// Called by Windows ComCtl32 subclassing dispatcher with valid HWND and message params.
pub unsafe extern "system" fn widget_subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _ref_data: usize,
) -> LRESULT {
    match msg {
        // Intercept Alt+Space system menu and minimize requests
        WM_SYSCOMMAND => {
            let cmd = wparam.0 & 0xFFF0;
            if cmd == SC_KEYMENU as usize || cmd == SC_MINIMIZE as usize {
                return LRESULT(0);
            }
        }
        WM_SYSKEYDOWN if wparam.0 == 0x20 => return LRESULT(0),
        WM_NCLBUTTONDBLCLK => return LRESULT(0),
        // Prevent Explorer's ToggleDesktop (Win+D) from hiding or minimizing the window
        WM_WINDOWPOSCHANGING if lparam.0 != 0 => {
            let wp = &mut *(lparam.0 as *mut WINDOWPOS);
            wp.flags.0 &= !SWP_HIDEWINDOW.0;
            if (wp.flags.0 & SWP_NOMOVE.0) == 0 && (wp.x <= -10000 || wp.y <= -10000) {
                wp.flags.0 |= SWP_NOMOVE.0 | SWP_NOSIZE.0;
            }
        }
        WM_SHOWWINDOW if wparam.0 == 0 => return LRESULT(0),
        WM_NCHITTEST => {
            let hit = DefSubclassProc(hwnd, msg, wparam, lparam);
            match hit.0 as u32 {
                HTLEFT | HTRIGHT | HTTOP | HTBOTTOM | HTTOPLEFT | HTTOPRIGHT | HTBOTTOMLEFT
                | HTBOTTOMRIGHT => return LRESULT(HTCLIENT as isize),
                _ => return hit,
            }
        }
        WM_EXITSIZEMOVE => {
            if let Some(app) = crate::get_app_handle() {
                crate::windows::handle_widget_move_end(app, hwnd);
            }
        }
        WM_NCDESTROY => {
            let _ = RemoveWindowSubclass(hwnd, Some(widget_subclass_proc), WIDGET_SUBCLASS_ID);
        }
        _ => {}
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

pub fn disable_system_menu(hwnd: HWND) {
    unsafe {
        let sys_menu = GetSystemMenu(hwnd, false);
        if !sys_menu.is_invalid() {
            let count = GetMenuItemCount(Some(sys_menu));
            for i in (0..count).rev() {
                let _ = DeleteMenu(sys_menu, i as u32, MF_BYPOSITION);
            }
        }
        let _ = SetWindowSubclass(hwnd, Some(widget_subclass_proc), WIDGET_SUBCLASS_ID, 0);
    }
}

/// Applies screen-space rect to the window, enforcing safe z-order without re-layout stalls.
pub fn set_bounds_screen(
    hwnd: HWND,
    screen_rect: RECT,
    _strategy: PinStrategy,
) -> Result<(), String> {
    unsafe {
        let x = screen_rect.left;
        let y = screen_rect.top;
        let w = screen_rect.right - screen_rect.left;
        let h = screen_rect.bottom - screen_rect.top;

        // Never disturb z-order during drag/resize bounds updates
        SetWindowPos(hwnd, None, x, y, w, h, SWP_NOACTIVATE | SWP_NOZORDER)
            .map_err(|e| format!("SetWindowPos bounds failed: {}", e))?;

        Ok(())
    }
}

/// Verifies whether the window is currently active.
pub fn verify(hwnd: HWND) -> bool {
    // SAFETY: Checking IsWindow on HWND
    unsafe { IsWindow(Some(hwnd)).as_bool() }
}
