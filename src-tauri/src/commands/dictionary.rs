use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read as IoRead, Write as IoWrite};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use crate::db::{self, DictionaryEntry, DictionaryStats, LanguageInfo};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub success: bool,
    pub entries: Vec<DictionaryEntry>,
    pub source: String,
    pub query: String,
    pub language: String,
}

#[tauri::command]
pub async fn search_dictionary(word: String, language: String) -> Result<SearchResult, String> {
    if word.trim().is_empty() {
        return Ok(SearchResult {
            success: true,
            entries: vec![],
            source: "local".to_string(),
            query: word,
            language: language.clone(),
        });
    }

    // Skip SQLite for Sanskrit - use only Sanskrit processing
    if language == "sa" {
        return Ok(SearchResult {
            success: true,
            entries: vec![],
            source: "sanskrit-only".to_string(),
            query: word,
            language,
        });
    }

    match db::search_dictionary(&word, &language) {
        Ok(entries) => {
            Ok(SearchResult {
                success: true,
                entries,
                source: "local".to_string(),
                query: word,
                language,
            })
        }
        Err(_e) => {
            Ok(SearchResult {
                success: false,
                entries: vec![],
                source: "error".to_string(),
                query: word,
                language,
            })
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatsResult {
    pub success: bool,
    pub stats: Option<DictionaryStats>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_dictionary_stats(language: String) -> Result<StatsResult, String> {
    match db::get_language_stats(&language) {
        Ok(stats) => Ok(StatsResult {
            success: true,
            stats: Some(stats),
            error: None,
        }),
        Err(e) => Ok(StatsResult {
            success: false,
            stats: None,
            error: Some(e),
        }),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LanguagesResult {
    pub success: bool,
    pub languages: Vec<LanguageInfo>,
    pub total: usize,
}

#[tauri::command]
pub async fn get_available_languages() -> Result<LanguagesResult, String> {
    eprintln!("[CMD] get_available_languages called");
    
    match db::get_available_languages() {
        Ok(languages) => {
            let total = languages.len();
            eprintln!("[CMD] Found {} languages", total);
            for lang in &languages {
                eprintln!("[CMD]   - {}: {} words, has_local={}", lang.code, lang.word_count, lang.has_local);
            }
            Ok(LanguagesResult {
                success: true,
                languages,
                total,
            })
        }
        Err(e) => {
            eprintln!("[CMD] Error: {}", e);
            Err(e)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Suggestion {
    pub word: String,
    pub pos: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SuggestResult {
    pub suggestions: Vec<Suggestion>,
    pub source: String,
}

#[tauri::command]
pub async fn get_dictionary_suggestions(prefix: String, language: String) -> Result<SuggestResult, String> {
    match db::search_suggestions(&prefix, &language, 10) {
        Ok(results) => Ok(SuggestResult {
            suggestions: results.into_iter().map(|(word, pos)| Suggestion { word, pos }).collect(),
            source: "local".to_string(),
        }),
        Err(_e) => Ok(SuggestResult {
            suggestions: vec![],
            source: "error".to_string(),
        }),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchQueryResult {
    pub success: bool,
    pub results: HashMap<String, Vec<DictionaryEntry>>,
    pub found: usize,
    pub total: usize,
}

#[tauri::command]
pub async fn batch_query_dictionary(
    words: Vec<String>,
    language: String,
) -> Result<BatchQueryResult, String> {
    if language == "sa" {
        return Ok(BatchQueryResult {
            success: true,
            results: HashMap::new(),
            found: 0,
            total: words.len(),
        });
    }

    let mut results = HashMap::new();
    let mut found = 0;

    for word in &words {
        match db::search_dictionary(word, &language) {
            Ok(entries) => {
                if !entries.is_empty() {
                    found += 1;
                    results.insert(word.clone(), entries);
                }
            }
            Err(_) => {}
        }
    }

    Ok(BatchQueryResult {
        success: true,
        results,
        found,
        total: words.len(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResult {
    pub success: bool,
    pub message: String,
    pub file_path: Option<String>,
    pub file_type: Option<String>,
}

fn get_dict_dir() -> PathBuf {
    // Try multiple locations in order:
    // 1. Executable directory
    // 2. Executable _up_/dict (bundled builds)
    // 3. Ancestors of exe (dev: target/debug -> target -> src-tauri -> project root)
    // 4. CWD and CWD parent (dev: src-tauri -> project root)

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_dict = exe_dir.join("dict");
            if exe_dict.exists() {
                return exe_dict;
            }

            let up_dict = exe_dir.join("_up_").join("dict");
            if up_dict.exists() {
                return up_dict;
            }

            // Walk up from exe to find dict/ (handles target/debug/.. chains)
            let mut ancestor = exe_dir.to_path_buf();
            for _ in 0..4 {
                if let Some(parent) = ancestor.parent() {
                    let d = parent.join("dict");
                    if d.exists() {
                        return d;
                    }
                    ancestor = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }

    // Check CWD and parent (in tauri dev, CWD = src-tauri/)
    if let Ok(cwd) = std::env::current_dir() {
        let cwd_dict = cwd.join("dict");
        if cwd_dict.exists() {
            return cwd_dict;
        }
        if let Some(parent) = cwd.parent() {
            let parent_dict = parent.join("dict");
            if parent_dict.exists() {
                return parent_dict;
            }
        }
    }

    PathBuf::from("dict")
}

#[tauri::command]
pub async fn upload_dictionary_file(
    _app: AppHandle,
    language_code: String,
    language_name: String,
    file_path: String,
) -> Result<UploadResult, String> {
    if language_code.len() < 2 || language_code.len() > 3 {
        return Err("Valid language code (2-3 characters) is required".to_string());
    }

    let src_path = PathBuf::from(&file_path);
    
    if !src_path.exists() {
        return Err("File not found".to_string());
    }

    let ext = src_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or("Invalid file extension")?;

    if !["db", "sqlite", "jsonl", "json"].contains(&ext.as_str()) {
        return Err("Only .db, .sqlite, .jsonl, and .json files are allowed".to_string());
    }

    let dict_dir = get_dict_dir();
    if !dict_dir.exists() {
        fs::create_dir_all(&dict_dir)
            .map_err(|e| format!("Failed to create dict directory: {}", e))?;
    }

    let target_dir = dict_dir.join(&language_name);
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create language directory: {}", e))?;
    }

    let (target_file_name, file_type) = if ext == "db" || ext == "sqlite" {
        (format!("{}_dict.db", language_code), "sqlite".to_string())
    } else {
        let target_db_name = format!("{}_dict.db", language_code);
        let target_db_path = target_dir.join(&target_db_name);

        let base_path = std::env::current_exe()
            .unwrap_or_default()
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .to_path_buf();
        let script_path = base_path.join("scripts").join("convert_jsonl_to_sqlite.py");

        if script_path.exists() {
            use std::process::{Command, Stdio};
            let output = Command::new("python")
                .args(&[
                    script_path.to_string_lossy().as_ref(),
                    "--input", &file_path,
                    "--output", &target_db_path.to_string_lossy(),
                ])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output();

            match output {
                Ok(out) => {
                    if out.status.success() {
                        (target_db_name, "jsonl-converted".to_string())
                    } else {
                        let stderr = String::from_utf8_lossy(&out.stderr);
                        return Err(format!("Failed to convert JSONL: {}", stderr));
                    }
                }
                Err(e) => return Err(format!("Failed to run conversion script: {}", e)),
            }
        } else {
            return Err("JSONL conversion script not found".to_string());
        }
    };

    if ext == "db" || ext == "sqlite" {
        let target_path = target_dir.join(&target_file_name);
        
        if target_path.exists() {
            fs::remove_file(&target_path)
                .map_err(|e| format!("Failed to remove existing file: {}", e))?;
        }

        fs::copy(&src_path, &target_path)
            .map_err(|e| format!("Failed to copy file: {}", e))?;
    }

    Ok(UploadResult {
        success: true,
        message: format!("Dictionary uploaded successfully for {}", language_name),
        file_path: Some(target_dir.join(&target_file_name).to_string_lossy().to_string()),
        file_type: Some(file_type),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RescanResult {
    pub success: bool,
    pub old_count: usize,
    pub new_count: usize,
    pub languages: Vec<String>,
}

#[tauri::command]
pub async fn rescan_dictionary() -> Result<RescanResult, String> {
    match db::get_available_languages() {
        Ok(languages) => {
            let language_codes: Vec<String> = languages.iter().map(|l| l.code.clone()).collect();
            Ok(RescanResult {
                success: true,
                old_count: 0,
                new_count: languages.len(),
                languages: language_codes,
            })
        }
        Err(e) => Err(format!("Failed to rescan: {}", e)),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoveResult {
    pub success: bool,
    pub language_code: String,
    pub message: String,
}

#[tauri::command]
pub async fn remove_dictionary(language_code: String) -> Result<RemoveResult, String> {
    let dict_dir = get_dict_dir();
    let language_dir = dict_dir.join(&language_code);
    
    if language_dir.exists() {
        fs::remove_dir_all(&language_dir)
            .map_err(|e| format!("Failed to remove dictionary directory: {}", e))?;
        
        Ok(RemoveResult {
            success: true,
            language_code,
            message: "Dictionary removed successfully".to_string(),
        })
    } else {
        Err(format!("Dictionary for '{}' not found", language_code))
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteResult {
    pub success: bool,
    pub language_code: String,
    pub file_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub async fn delete_dictionary_file(language_code: String) -> Result<DeleteResult, String> {
    let dict_dir = get_dict_dir();
    
    let mut deleted_file: Option<String> = None;
    
    if let Ok(entries) = fs::read_dir(&dict_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let pattern = format!("{}_dict.db", language_code);
                if let Ok(files) = fs::read_dir(&path) {
                    for file in files.flatten() {
                        let file_path = file.path();
                        if let Some(file_name) = file_path.file_name().and_then(|n| n.to_str()) {
                            if file_name == pattern {
                                fs::remove_file(&file_path)
                                    .map_err(|e| format!("Failed to delete file: {}", e))?;
                                deleted_file = Some(file_path.to_string_lossy().to_string());
                                break;
                            }
                        }
                    }
                }
            }
            if deleted_file.is_some() {
                break;
            }
        }
    }

    if let Some(file_path) = deleted_file {
        Ok(DeleteResult {
            success: true,
            language_code,
            file_path: Some(file_path),
            message: "Dictionary file deleted successfully".to_string(),
        })
    } else {
        Err(format!("Dictionary file for '{}' not found", language_code))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub stage: String,
    pub progress: f64,
    pub message: String,
    pub language_code: String,
}

#[tauri::command]
pub async fn download_dictionary(
    app: AppHandle,
    url: String,
    language_code: String,
    language_name: String,
) -> Result<UploadResult, String> {
    use flate2::read::GzDecoder;
    use futures_util::StreamExt;

    let emit_progress = |stage: &str, progress: f64, message: &str| {
        let _ = app.emit("dictionary-download-progress", DownloadProgress {
            stage: stage.to_string(),
            progress,
            message: message.to_string(),
            language_code: language_code.clone(),
        });
    };

    // Step 1: Download
    emit_progress("downloading", 0.0, "Starting download...");

    let client = reqwest::Client::builder()
        .user_agent("LuminousLute/1.5.0")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut body_bytes: Vec<u8> = Vec::new();

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        body_bytes.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;
        if total_size > 0 {
            let pct = (downloaded as f64 / total_size as f64).min(1.0);
            let mb_done = downloaded as f64 / 1_048_576.0;
            let mb_total = total_size as f64 / 1_048_576.0;
            emit_progress("downloading", pct, &format!("{:.1} / {:.1} MB", mb_done, mb_total));
        }
    }

    // Step 2: Decompress (if gzip) or use raw JSONL
    let temp_dir = std::env::temp_dir().join("luminous_lute_dict");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let jsonl_path = temp_dir.join(format!("{}_extract.jsonl", language_code));

    let is_gzip = body_bytes.len() >= 2 && body_bytes[0] == 0x1F && body_bytes[1] == 0x8B;

    if is_gzip {
        emit_progress("decompressing", 0.0, "Decompressing .gz file...");
        let mut decoder = GzDecoder::new(&body_bytes[..]);
        let mut outfile = fs::File::create(&jsonl_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        let mut buf = vec![0u8; 1_048_576];
        loop {
            let n = decoder.read(&mut buf)
                .map_err(|e| format!("Decompress error: {}", e))?;
            if n == 0 { break; }
            outfile.write_all(&buf[..n])
                .map_err(|e| format!("Write error: {}", e))?;
        }
    } else {
        emit_progress("decompressing", 1.0, "File already decompressed, saving...");
        fs::write(&jsonl_path, &body_bytes)
            .map_err(|e| format!("Failed to write JSONL: {}", e))?;
    }
    drop(body_bytes);

    emit_progress("converting", 0.0, "Converting to SQLite database...");

    // Step 3: Convert JSONL → SQLite
    let dict_dir = get_dict_dir();
    let target_dir = dict_dir.join(&language_name);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create dict directory: {}", e))?;

    let target_db = target_dir.join(format!("{}_dict.db", language_code));

    let base_path = std::env::current_exe()
        .unwrap_or_default()
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf();

    // Try multiple script locations (exe dir, bundled, CWD, CWD parent for dev mode)
    let cwd = std::env::current_dir().unwrap_or_default();
    let script_candidates = vec![
        base_path.join("scripts").join("convert_jsonl_to_sqlite.py"),
        base_path.join("_up_").join("scripts").join("convert_jsonl_to_sqlite.py"),
        cwd.join("scripts").join("convert_jsonl_to_sqlite.py"),
        cwd.parent().unwrap_or(&cwd).join("scripts").join("convert_jsonl_to_sqlite.py"),
    ];

    let script_path = script_candidates.iter()
        .find(|p| p.exists())
        .ok_or("Conversion script not found. Please ensure convert_jsonl_to_sqlite.py is in scripts/")?;

    let script_args = vec![
        script_path.to_string_lossy().to_string(),
        "--input".to_string(),
        jsonl_path.to_string_lossy().to_string(),
        "--output".to_string(),
        target_db.to_string_lossy().to_string(),
    ];

    // Try uv first (works on this system), then python3, then python
    let python_cmds = ["uv", "python3", "python"];
    let mut output = None;
    for cmd in &python_cmds {
        let args: Vec<String> = if *cmd == "uv" {
            let mut a = vec!["run".to_string(), "python".to_string()];
            a.extend(script_args.clone());
            a
        } else {
            script_args.clone()
        };
        if let Ok(o) = std::process::Command::new(cmd)
            .args(&args)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .output()
        {
            if o.status.success() {
                output = Some(o);
                break;
            }
        }
    }
    let output = output.ok_or("Failed to run conversion: no Python interpreter found (tried python, python3, uv run python)")?;

    // Cleanup temp files
    let _ = fs::remove_file(&jsonl_path);
    let _ = fs::remove_dir(&temp_dir);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        emit_progress("error", 0.0, &format!("Conversion failed: {}", stderr));
        return Err(format!("Conversion failed: {}", stderr));
    }

    emit_progress("done", 1.0, "Dictionary installed successfully!");

    Ok(UploadResult {
        success: true,
        message: format!("Dictionary for {} downloaded and installed", language_name),
        file_path: Some(target_db.to_string_lossy().to_string()),
        file_type: Some("downloaded-jsonl-converted".to_string()),
    })
}
