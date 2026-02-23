use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};

#[derive(Debug, Serialize, Deserialize)]
pub struct SanskritSplitResult {
    pub success: bool,
    pub action: String,
    pub mode: String,
    pub word: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn sanskrit_split(word: String, mode: String) -> Result<SanskritSplitResult, String> {
    if word.trim().is_empty() {
        return Ok(SanskritSplitResult {
            success: false,
            action: "split".to_string(),
            mode: mode.clone(),
            word,
            result: None,
            error: Some("Empty word".to_string()),
        });
    }

    let output = Command::new("python")
        .args(&[
            "scripts/sanskrit_cli.py",
            "--action", "split",
            "--word", &word,
            "--mode", &mode,
            "--json"
        ])
        .current_dir(std::env::current_exe().unwrap_or_default().parent().unwrap_or(std::path::Path::new(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                match serde_json::from_str::<serde_json::Value>(&stdout) {
                    Ok(result) => Ok(SanskritSplitResult {
                        success: true,
                        action: "split".to_string(),
                        mode,
                        word,
                        result: Some(result),
                        error: None,
                    }),
                    Err(e) => Ok(SanskritSplitResult {
                        success: false,
                        action: "split".to_string(),
                        mode,
                        word,
                        result: None,
                        error: Some(format!("Failed to parse result: {}", e)),
                    }),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Ok(SanskritSplitResult {
                    success: false,
                    action: "split".to_string(),
                    mode,
                    word,
                    result: None,
                    error: Some(stderr.to_string()),
                })
            }
        }
        Err(e) => Ok(SanskritSplitResult {
            success: false,
            action: "split".to_string(),
            mode,
            word,
            result: None,
            error: Some(format!("Failed to run Python: {}", e)),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransliterateResult {
    pub success: bool,
    pub action: String,
    pub original: String,
    pub transliterated: Option<String>,
    pub from_scheme: String,
    pub to_scheme: String,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn sanskrit_transliterate(text: String, from_scheme: String, to_scheme: String) -> Result<TransliterateResult, String> {
    if text.trim().is_empty() {
        return Ok(TransliterateResult {
            success: false,
            action: "transliterate".to_string(),
            original: text,
            transliterated: None,
            from_scheme: from_scheme.clone(),
            to_scheme: to_scheme.clone(),
            error: Some("Empty text".to_string()),
        });
    }

    let output = Command::new("python")
        .args(&[
            "scripts/sanskrit_cli.py",
            "--action", "transliterate",
            "--text", &text,
            "--from-scheme", &from_scheme,
            "--to-scheme", &to_scheme,
            "--json"
        ])
        .current_dir(std::env::current_exe().unwrap_or_default().parent().unwrap_or(std::path::Path::new(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                match serde_json::from_str::<serde_json::Value>(&stdout) {
                    Ok(result) => {
                        let transliterated = result.get("transliterated")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        
                        Ok(TransliterateResult {
                            success: result.get("success").and_then(|v| v.as_bool()).unwrap_or(true),
                            action: "transliterate".to_string(),
                            original: text,
                            transliterated,
                            from_scheme,
                            to_scheme,
                            error: None,
                        })
                    }
                    Err(e) => Ok(TransliterateResult {
                        success: false,
                        action: "transliterate".to_string(),
                        original: text,
                        transliterated: None,
                        from_scheme,
                        to_scheme,
                        error: Some(format!("Failed to parse result: {}", e)),
                    }),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Ok(TransliterateResult {
                    success: false,
                    action: "transliterate".to_string(),
                    original: text,
                    transliterated: None,
                    from_scheme,
                    to_scheme,
                    error: Some(stderr.to_string()),
                })
            }
        }
        Err(e) => Ok(TransliterateResult {
            success: false,
            action: "transliterate".to_string(),
            original: text,
            transliterated: None,
            from_scheme,
            to_scheme,
            error: Some(format!("Failed to run Python: {}", e)),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SanskritHealthResult {
    pub success: bool,
    pub action: String,
    pub vidyut_available: bool,
    pub sandhi_splitter_available: bool,
    pub chedaka_available: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn sanskrit_health() -> Result<SanskritHealthResult, String> {
    let output = Command::new("python")
        .args(&[
            "scripts/sanskrit_cli.py",
            "--action", "health",
            "--json"
        ])
        .current_dir(std::env::current_exe().unwrap_or_default().parent().unwrap_or(std::path::Path::new(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                match serde_json::from_str::<serde_json::Value>(&stdout) {
                    Ok(result) => {
                        Ok(SanskritHealthResult {
                            success: result.get("success").and_then(|v| v.as_bool()).unwrap_or(true),
                            action: "health".to_string(),
                            vidyut_available: result.get("vidyut_available").and_then(|v| v.as_bool()).unwrap_or(false),
                            sandhi_splitter_available: result.get("sandhi_splitter_available").and_then(|v| v.as_bool()).unwrap_or(false),
                            chedaka_available: result.get("chedaka_available").and_then(|v| v.as_bool()).unwrap_or(false),
                            error: None,
                        })
                    }
                    Err(_) => Ok(SanskritHealthResult {
                        success: false,
                        action: "health".to_string(),
                        vidyut_available: false,
                        sandhi_splitter_available: false,
                        chedaka_available: false,
                        error: Some("Failed to parse health result".to_string()),
                    }),
                }
            } else {
                Ok(SanskritHealthResult {
                    success: false,
                    action: "health".to_string(),
                    vidyut_available: false,
                    sandhi_splitter_available: false,
                    chedaka_available: false,
                    error: Some("Python script failed".to_string()),
                })
            }
        }
        Err(e) => Ok(SanskritHealthResult {
            success: false,
            action: "health".to_string(),
            vidyut_available: false,
            sandhi_splitter_available: false,
            chedaka_available: false,
            error: Some(format!("Failed to run Python: {}", e)),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PythonEnvironmentCheck {
    pub available: bool,
    pub version: Option<String>,
    pub vidyut_available: bool,
    pub sandhi_splitter_available: bool,
    pub chedaka_available: bool,
}

#[tauri::command]
pub async fn check_python_environment() -> Result<PythonEnvironmentCheck, String> {
    let python_check = Command::new("python")
        .arg("--version")
        .output();

    let version = match &python_check {
        Ok(output) => {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        }
        Err(_) => None,
    };

    let available = python_check.is_ok() && version.is_some();

    let mut vidyut_available = false;
    let mut sandhi_splitter_available = false;
    let mut chedaka_available = false;

    if available {
        let packages_check = Command::new("python")
            .args(&["-c", "import vidyut; import sandhi_splitter; import chedaka; print('ok')"])
            .output();

        if let Ok(output) = packages_check {
            let stdout = String::from_utf8_lossy(&output.stdout);
            vidyut_available = stdout.contains("ok") || Command::new("python")
                .args(&["-c", "import vidyut"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);

            sandhi_splitter_available = Command::new("python")
                .args(&["-c", "import sandhi_splitter"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);

            chedaka_available = Command::new("python")
                .args(&["-c", "import chedaka"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);
        }
    }

    Ok(PythonEnvironmentCheck {
        available,
        version,
        vidyut_available,
        sandhi_splitter_available,
        chedaka_available,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Segment {
    pub original: String,
    pub split: Option<Vec<String>>,
    pub lemma: Option<String>,
    pub morphology: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub success: bool,
    pub text: String,
    pub segments: Vec<Segment>,
    pub analysis: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn process_text(text: String) -> Result<ProcessResult, String> {
    if text.trim().is_empty() {
        return Ok(ProcessResult {
            success: false,
            text,
            segments: vec![],
            analysis: None,
            error: Some("Empty text".to_string()),
        });
    }

    let script_path = std::path::PathBuf::from("scripts/enhanced_sanskrit_api.py");
    
    if !script_path.exists() {
        return Err("Enhanced Sanskrit API script not found".to_string());
    }

    let output = Command::new("python")
        .args(&[
            "scripts/enhanced_sanskrit_api.py",
            "--action", "process",
            "--text", &text,
            "--json"
        ])
        .current_dir(std::env::current_exe().unwrap_or_default().parent().unwrap_or(std::path::Path::new(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                match serde_json::from_str::<serde_json::Value>(&stdout) {
                    Ok(result) => {
                        let segments = result.get("segments")
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|item| {
                                        serde_json::from_value::<Segment>(item.clone()).ok()
                                    })
                                    .collect()
                            })
                            .unwrap_or_default();

                        Ok(ProcessResult {
                            success: result.get("success").and_then(|v| v.as_bool()).unwrap_or(true),
                            text,
                            segments,
                            analysis: Some(result),
                            error: None,
                        })
                    }
                    Err(e) => Ok(ProcessResult {
                        success: false,
                        text,
                        segments: vec![],
                        analysis: None,
                        error: Some(format!("Failed to parse result: {}", e)),
                    }),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Ok(ProcessResult {
                    success: false,
                    text,
                    segments: vec![],
                    analysis: None,
                    error: Some(stderr.to_string()),
                })
            }
        }
        Err(e) => Ok(ProcessResult {
            success: false,
            text,
            segments: vec![],
            analysis: None,
            error: Some(format!("Failed to run Python: {}", e)),
        }),
    }
}
