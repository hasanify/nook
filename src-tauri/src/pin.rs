use tracing::info;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    DeleteMenu, GetMenuItemCount, GetSystemMenu, GetWindowLongPtrW, IsWindow, SetParent,
    SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, GWL_STYLE, HWND_BOTTOM, HWND_TOPMOST,
    MF_BYPOSITION, SC_KEYMENU, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    SWP_NOZORDER, WM_NCDESTROY, WM_SYSCOMMAND, WM_SYSKEYDOWN, WS_CHILD, WS_CLIPCHILDREN,
    WS_CLIPSIBLINGS, WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_POPUP, WS_SYSMENU,
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

/// Sets widget as a top-level tool window pinned at `HWND_BOTTOM`.
pub fn attach_bottom(hwnd: HWND, _opacity: f32) -> Result<PinStrategy, String> {
    // SAFETY: Setting top-level tool window at HWND_BOTTOM
    unsafe {
        let _ = SetParent(hwnd, None);

        let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        style = (style & !(WS_CHILD.0 as isize | WS_SYSMENU.0 as isize))
            | WS_POPUP.0 as isize
            | WS_CLIPSIBLINGS.0 as isize
            | WS_CLIPCHILDREN.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_STYLE, style);

        let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        ex_style = (ex_style | WS_EX_TOOLWINDOW.0 as isize | WS_EX_NOACTIVATE.0 as isize)
            & !(WS_EX_APPWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style);

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
        WM_SYSCOMMAND if (wparam.0 & 0xFFF0) == SC_KEYMENU as usize => return LRESULT(0),
        WM_SYSKEYDOWN if wparam.0 == 0x20 => return LRESULT(0),
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

/// Applies screen-space rect to the window without modifying z-order.
pub fn set_bounds_screen(
    hwnd: HWND,
    screen_rect: RECT,
    _strategy: PinStrategy,
) -> Result<(), String> {
    // SAFETY: Setting top-level window geometry without altering Z-order
    unsafe {
        let x = screen_rect.left;
        let y = screen_rect.top;
        let w = screen_rect.right - screen_rect.left;
        let h = screen_rect.bottom - screen_rect.top;

        SetWindowPos(hwnd, None, x, y, w, h, SWP_NOZORDER | SWP_NOACTIVATE)
            .map_err(|e| format!("SetWindowPos bounds failed: {}", e))?;

        Ok(())
    }
}

/// Verifies whether the window is currently active.
pub fn verify(hwnd: HWND) -> bool {
    // SAFETY: Checking IsWindow on HWND
    unsafe { IsWindow(Some(hwnd)).as_bool() }
}
