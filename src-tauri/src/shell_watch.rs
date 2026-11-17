use std::sync::atomic::{AtomicU32, Ordering};
use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use tracing::{debug, info};
use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, PostQuitMessage,
    RegisterClassW, RegisterWindowMessageW, SetTimer, TranslateMessage, MSG, WM_DESTROY,
    WM_DISPLAYCHANGE, WM_DPICHANGED, WM_SETTINGCHANGE, WM_TIMER, WNDCLASSW, WS_EX_TOOLWINDOW,
    WS_POPUP,
};

static TASKBAR_CREATED_MSG: AtomicU32 = AtomicU32::new(0);

pub fn start_shell_watch(app: AppHandle) {
    thread::spawn(move || {
        // SAFETY: Registering class and creating hidden window to receive shell broadcast events
        unsafe {
            let class_name = w!("NookShellWatch");

            let taskbar_msg = RegisterWindowMessageW(w!("TaskbarCreated"));
            TASKBAR_CREATED_MSG.store(taskbar_msg, Ordering::Relaxed);
            info!("Registered TaskbarCreated message ID: {}", taskbar_msg);

            let wc = WNDCLASSW {
                lpfnWndProc: Some(shell_watch_wndproc),
                lpszClassName: class_name,
                ..Default::default()
            };

            let _ = RegisterClassW(&wc);

            // Hidden top-level window (not HWND_MESSAGE, so it receives broadcasts)
            let hwnd = CreateWindowExW(
                WS_EX_TOOLWINDOW,
                class_name,
                w!("NookShellWatcher"),
                WS_POPUP,
                0,
                0,
                0,
                0,
                None,
                None,
                None,
                None,
            );

            if let Ok(hwnd) = hwnd {
                if hwnd.0 as isize != 0 {
                    info!("Shell watch hidden window created: {:?}", hwnd);

                    // 3-second safety net timer
                    let _ = SetTimer(Some(hwnd), 1, 3000, None);

                    let mut msg = MSG::default();
                    while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);

                        // Process custom TaskbarCreated or timer events
                        if msg.message == taskbar_msg && taskbar_msg != 0 {
                            info!("TaskbarCreated received! Explorer restarted. Recovering widgets...");
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                tokio::time::sleep(Duration::from_millis(1000)).await;
                                let _ = crate::windows::ensure_all_widgets(&app_clone);
                            });
                        } else if msg.message == WM_TIMER {
                            debug!("Shell watch 3s verify interval");
                            let _ = crate::windows::ensure_all_widgets(&app);
                        } else if msg.message == WM_DISPLAYCHANGE
                            || msg.message == WM_DPICHANGED
                            || msg.message == WM_SETTINGCHANGE
                        {
                            info!("Display or DPI change detected, relayouting all widgets");
                            let _ = crate::windows::relayout_all_widgets(&app);
                        }
                    }
                }
            }
        }
    });
}

unsafe extern "system" fn shell_watch_wndproc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_DESTROY => {
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}
