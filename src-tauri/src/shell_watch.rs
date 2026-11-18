use std::sync::atomic::{AtomicU32, Ordering};
use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use tracing::info;
use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetClassNameW, GetMessageW, PostQuitMessage,
    RegisterClassW, RegisterWindowMessageW, TranslateMessage, EVENT_SYSTEM_FOREGROUND, MSG,
    WINEVENT_OUTOFCONTEXT, WM_DESTROY, WM_DISPLAYCHANGE, WM_DPICHANGED, WM_SETTINGCHANGE,
    WNDCLASSW, WS_EX_TOOLWINDOW, WS_POPUP,
};

static TASKBAR_CREATED_MSG: AtomicU32 = AtomicU32::new(0);

unsafe extern "system" fn win_event_proc(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _event_thread: u32,
    _event_time: u32,
) {
    if event == EVENT_SYSTEM_FOREGROUND {
        let mut class_name = [0u16; 64];
        let len = GetClassNameW(hwnd, &mut class_name);
        if len > 0 {
            let name = String::from_utf16_lossy(&class_name[..len as usize]);
            if name == "WorkerW" || name == "Progman" {
                if let Some(app) = crate::get_app_handle() {
                    crate::windows::restack_bottom_widgets(app);
                }
            }
        }
    }
}

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

                    let hook = SetWinEventHook(
                        EVENT_SYSTEM_FOREGROUND,
                        EVENT_SYSTEM_FOREGROUND,
                        None,
                        Some(win_event_proc),
                        0,
                        0,
                        WINEVENT_OUTOFCONTEXT,
                    );

                    let mut msg = MSG::default();
                    while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);

                        // Process custom TaskbarCreated (Explorer restarted)
                        if msg.message == taskbar_msg && taskbar_msg != 0 {
                            info!("TaskbarCreated received! Explorer restarted. Recovering widgets...");
                            let app_clone = app.clone();
                            tauri::async_runtime::spawn(async move {
                                tokio::time::sleep(Duration::from_millis(1500)).await;
                                let _ = crate::windows::ensure_all_widgets(&app_clone);
                            });
                        } else if msg.message == WM_DISPLAYCHANGE
                            || msg.message == WM_DPICHANGED
                            || msg.message == WM_SETTINGCHANGE
                        {
                            info!("Display or DPI change detected, relayouting all widgets");
                            let app_clone = app.clone();
                            let _ = app.run_on_main_thread(move || {
                                let _ = crate::windows::relayout_all_widgets(&app_clone);
                            });
                        }
                    }

                    if !hook.is_invalid() {
                        let _ = UnhookWinEvent(hook);
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
