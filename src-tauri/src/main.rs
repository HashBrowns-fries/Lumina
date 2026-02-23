#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::thread;
use std::time::Duration;
use tauri::{Manager, Emitter, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent}};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_clipboard_manager::ClipboardExt;

mod floating;
mod db;
mod commands;

use floating::FloatingWindowManager;
use commands::{dictionary::*, sanskrit::*, vocabulary::*};

struct AppState {
    floating_manager: Mutex<Option<FloatingWindowManager>>,
    clipboard_monitoring: Mutex<Arc<AtomicBool>>,
}

fn get_log_path() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let log_dir = exe_dir.join("logs");
            if !log_dir.exists() {
                let _ = fs::create_dir_all(&log_dir);
            }
            return log_dir.join("lumina.log");
        }
    }
    PathBuf::from("lumina.log")
}

fn get_service_log_path() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let log_dir = exe_dir.join("logs");
            if !log_dir.exists() {
                let _ = fs::create_dir_all(&log_dir);
            }
            return log_dir.join("services.log");
        }
    }
    PathBuf::from("services.log")
}

fn write_log(msg: &str) {
    let log_path = get_log_path();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let timestamp = chrono_lite_timestamp();
        let _ = writeln!(file, "[{}] {}", timestamp, msg);
    }
    println!("{}", msg);
}

fn chrono_lite_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let hours = (secs / 3600) % 24;
    let mins = (secs / 60) % 60;
    let secs = secs % 60;
    format!("{:02}:{:02}:{:02}", hours, mins, secs)
}

fn find_base_path() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let scripts_path = exe_dir.join("scripts");
            if scripts_path.exists() {
                return exe_dir.to_path_buf();
            }

            let up_scripts_path = exe_dir.join("_up_").join("scripts");
            if up_scripts_path.exists() {
                return exe_dir.join("_up_");
            }
        }
    }

    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    write_log(&format!("回退到当前目录: {:?}", current_dir));
    current_dir
}

#[tauri::command]
fn start_backend_services() -> Result<String, String> {
    let base_path = find_base_path();
    let python_script = base_path.join("scripts").join("enhanced_sanskrit_api.py");

    write_log("========== 后端服务启动 ==========");
    write_log(&format!("基础路径：{:?}", base_path));
    write_log(&format!("Python 脚本：{:?}", python_script));

    // Try uv first (modern Python package manager), then fallback to python
    let python_cmd = if Command::new("uv").arg("--version").output().is_ok() {
        write_log("✓ uv detected (modern Python package manager)");
        "uv"
    } else if Command::new("python").arg("--version").output().is_ok() {
        let output = Command::new("python").arg("--version").output().unwrap();
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            write_log(&format!("✓ Python detected: {}", version.trim()));
        }
        "python"
    } else if Command::new("python3").arg("--version").output().is_ok() {
        let output = Command::new("python3").arg("--version").output().unwrap();
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            write_log(&format!("✓ Python3 detected: {}", version.trim()));
        }
        "python3"
    } else {
        write_log("✗ No Python interpreter found (tried: uv, python, python3)");
        write_log("⚠ Please install Python from https://python.org/ or https://astral.sh/uv");
        return Err("Python not found".to_string());
    };

    if python_script.exists() {
        let child = Command::new(python_cmd)
            .arg(&python_script)
            .current_dir(base_path.join("scripts"))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Failed to start Python");

        write_log(&format!("✓ Python service started (PID: {})", child.id()));

        std::thread::spawn(move || {
            if let Ok(output) = child.wait_with_output() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                if !stdout.is_empty() {
                    for line in stdout.lines() {
                        write_log(&format!("[python out] {}", line));
                    }
                }
                if !stderr.is_empty() {
                    for line in stderr.lines() {
                        write_log(&format!("[python err] {}", line));
                    }
                }
            }
        });
    } else {
        write_log("⚠ Python script not found, Sanskrit API will be unavailable");
    }

    write_log("========== 后端服务启动完成 ==========");

    Ok("服务已启动".to_string())
}

#[tauri::command]
fn stop_backend_services() -> Result<String, String> {
    Ok("服务已停止".to_string())
}

#[tauri::command]
fn get_service_status() -> Result<String, String> {
    Ok("运行中".to_string())
}

#[tauri::command]
async fn check_for_updates() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
async fn show_floating_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn hide_floating_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn toggle_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn toggle_floating_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating") {
        if window.is_visible().unwrap_or(false) {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn send_query_to_floating(app: tauri::AppHandle, query: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("floating") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        window.emit("new-query", query).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn read_clipboard_text(app: tauri::AppHandle) -> Result<String, String> {
    app.clipboard().read_text().map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_clipboard_monitor(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let monitoring = state.clipboard_monitoring.lock().unwrap().clone();
    monitoring.store(true, Ordering::SeqCst);
    
    let app_handle = app.clone();
    thread::spawn(move || {
        let mut last_clipboard = String::new();
        
        while monitoring.load(Ordering::SeqCst) {
            if let Ok(text) = app_handle.clipboard().read_text() {
                if !text.is_empty() && text != last_clipboard && text.len() < 200 {
                    last_clipboard = text.clone();
                    write_log(&format!("[Clipboard] Detected: {}", text));
                    
                    if let Some(window) = app_handle.get_webview_window("floating") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("new-query", text);
                    }
                }
            }
            thread::sleep(Duration::from_millis(800));
        }
        write_log("[Clipboard] Monitor stopped");
    });
    
    Ok(())
}

#[tauri::command]
async fn stop_clipboard_monitor(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let monitoring = state.clipboard_monitoring.lock().unwrap();
    monitoring.store(false, Ordering::SeqCst);
    Ok(())
}

fn main() {
    write_log("========== Lumina 应用启动 ==========");

    let log_path = get_log_path();
    write_log(&format!("日志文件: {:?}", log_path));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            floating_manager: Mutex::new(None),
            clipboard_monitoring: Mutex::new(Arc::new(AtomicBool::new(false))),
        })
        .manage(|app: &tauri::AppHandle| init_vocabulary_state(app))
        .invoke_handler(tauri::generate_handler![
            start_backend_services,
            stop_backend_services,
            get_service_status,
            check_for_updates,
            show_main_window,
            hide_main_window,
            toggle_main_window,
            show_floating_window,
            hide_floating_window,
            toggle_floating_window,
            send_query_to_floating,
            read_clipboard_text,
            start_clipboard_monitor,
            stop_clipboard_monitor,
            search_dictionary,
            get_dictionary_stats,
            get_available_languages,
            get_dictionary_suggestions,
            batch_query_dictionary,
            upload_dictionary_file,
            rescan_dictionary,
            remove_dictionary,
            delete_dictionary_file,
            sanskrit_split,
            sanskrit_transliterate,
            sanskrit_health,
            check_python_environment,
            process_text,
            save_term,
            get_all_terms,
            delete_term,
            update_term
        ])
        .setup(|app| {
            write_log("执行应用设置...");

            let _app_handle = app.handle().clone();
            
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyL);
            let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    write_log("检测到全局快捷键 Ctrl+Shift+L");
                    if let Some(window) = _app.get_webview_window("floating") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            });
            write_log("已注册全局快捷键 Ctrl+Shift+L");

            let show_main_item = MenuItem::with_id(app, "show_main", "Show Main Window", true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show", "Show Lumina Quick", true, None::<&str>)?;
            let toggle_item = MenuItem::with_id(app, "toggle", "Toggle (Ctrl+Shift+L)", true, None::<&str>)?;
            let separator = MenuItem::with_id(app, "separator", "Separator", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_main_item, &show_item, &toggle_item, &separator, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .tooltip("Lumina Quick (Ctrl+Shift+L)")
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show_main" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("floating") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "toggle" => {
                            if let Some(window) = app.get_webview_window("floating") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("floating") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;
            
            write_log("系统托盘已创建");

            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                write_log("开始启动后端服务...");
                let _ = start_backend_services();
            });

            let app_handle_for_clipboard = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(5));
                if let Some(state) = app_handle_for_clipboard.try_state::<AppState>() {
                    let monitoring = state.clipboard_monitoring.lock().unwrap().clone();
                    monitoring.store(true, Ordering::SeqCst);
                    
                    let mut last_clipboard = String::new();
                    write_log("[Clipboard] Starting clipboard monitor...");
                    
                    while monitoring.load(Ordering::SeqCst) {
                        if let Ok(text) = app_handle_for_clipboard.clipboard().read_text() {
                            if !text.is_empty() && text != last_clipboard && text.len() < 200 {
                                last_clipboard = text.clone();
                                write_log(&format!("[Clipboard] Detected: {}", text));
                                
                                if let Some(window) = app_handle_for_clipboard.get_webview_window("floating") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                    let _ = window.emit("new-query", text);
                                }
                            }
                        }
                        std::thread::sleep(Duration::from_millis(800));
                    }
                }
            });

            write_log("应用设置完成");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
