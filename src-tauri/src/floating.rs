use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};

pub struct FloatingWindowManager {
    enabled: AtomicBool,
}

impl FloatingWindowManager {
    pub fn new() -> Self {
        Self {
            enabled: AtomicBool::new(true),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::SeqCst);
    }

    pub fn show_floating_window(&self, app: &AppHandle) -> Result<(), String> {
        if let Some(window) = app.get_webview_window("floating") {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn hide_floating_window(&self, app: &AppHandle) -> Result<(), String> {
        if let Some(window) = app.get_webview_window("floating") {
            window.hide().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn send_query(&self, app: &AppHandle, query: String) -> Result<(), String> {
        if let Some(window) = app.get_webview_window("floating") {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            window.emit("new-query", query).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn toggle_window(&self, app: &AppHandle) -> Result<(), String> {
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
}

impl Default for FloatingWindowManager {
    fn default() -> Self {
        Self::new()
    }
}
