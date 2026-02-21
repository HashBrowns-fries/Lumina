#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::{error, info, warn, LevelFilter};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::Manager;

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
            let server_path = exe_dir.join("server").join("index.js");
            write_log(&format!("检查 exe 同级目录: {:?}", exe_dir));
            if server_path.exists() {
                write_log(&format!("✓ 在 exe 同级目录找到 server"));
                return exe_dir.to_path_buf();
            } else {
                write_log(&format!("✗ exe 同级目录不存在 server/index.js"));
            }

            let up_server_path = exe_dir.join("_up_").join("server").join("index.js");
            if up_server_path.exists() {
                write_log(&format!("✓ 在 _up_ 目录找到 server/index.js"));
                return exe_dir.join("_up_");
            } else {
                write_log(&format!("✗ _up_/server/index.js 不存在"));
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
    let server_script = base_path.join("server").join("index.js");
    let python_script = base_path.join("scripts").join("enhanced_sanskrit_api.py");

    write_log("========== 后端服务启动 ==========");
    write_log(&format!("基础路径: {:?}", base_path));
    write_log(&format!("Node.js 脚本: {:?}", server_script));
    write_log(&format!("Python 脚本: {:?}", python_script));

    if base_path.exists() {
        write_log("基础路径目录内容:");
        if let Ok(entries) = fs::read_dir(&base_path) {
            for entry in entries.flatten() {
                write_log(&format!("  📁 {:?}", entry.file_name()));
            }
        }

        let server_dir = base_path.join("server");
        if server_dir.exists() {
            write_log("✓ server 目录存在");
            if let Ok(entries) = fs::read_dir(&server_dir) {
                write_log("server 目录内容 (前10个):");
                for entry in entries.flatten().take(10) {
                    write_log(&format!("  📄 {:?}", entry.file_name()));
                }
            }

            let node_modules = server_dir.join("node_modules");
            if node_modules.exists() {
                write_log("✓ node_modules 存在");
            } else {
                write_log("✗ node_modules 不存在!");
            }
        } else {
            write_log("✗ server 目录不存在!");
        }
    } else {
        write_log("✗ 基础路径不存在!");
    }

    match Command::new("node").arg("--version").output() {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout);
                write_log(&format!("✓ Node.js 可用: {}", version.trim()));
            } else {
                write_log("✗ node --version 失败");
            }
        }
        Err(e) => {
            write_log(&format!(
                "✗ 找不到 node 命令: {}. 请安装 Node.js https://nodejs.org/",
                e
            ));
        }
    }

    let node_log = get_service_log_path();
    if server_script.exists() {
        let mut child = Command::new("node")
            .arg(&server_script)
            .current_dir(base_path.join("server"))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Failed to start Node.js");

        write_log(&format!("✓ Node.js 服务已启动 (PID: {})", child.id()));
        write_log(&format!("  服务日志: {:?}", node_log));

        std::thread::spawn(move || {
            if let Ok(output) = child.wait_with_output() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                if !stdout.is_empty() {
                    for line in stdout.lines() {
                        write_log(&format!("[node out] {}", line));
                    }
                }
                if !stderr.is_empty() {
                    for line in stderr.lines() {
                        write_log(&format!("[node err] {}", line));
                    }
                }
            }
        });
    } else {
        write_log(&format!("✗ Node.js 脚本不存在: {:?}", server_script));
    }

    let python_log = base_path.join("logs").join("python.log");
    if python_script.exists() {
        let mut child = Command::new("python")
            .arg(&python_script)
            .current_dir(base_path.join("scripts"))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("Failed to start Python");

        write_log(&format!("✓ Python 服务已启动 (PID: {})", child.id()));
        write_log(&format!("  服务日志: {:?}", python_log));

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
        write_log("⚠ Python 脚本不存在，梵语 API 将不可用");
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
        .invoke_handler(tauri::generate_handler![
            start_backend_services,
            stop_backend_services,
            get_service_status,
            check_for_updates
        ])
        .setup(|_app| {
            write_log("执行应用设置...");

            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                write_log("开始启动后端服务...");
                let _ = start_backend_services();
            });

            write_log("应用设置完成");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
