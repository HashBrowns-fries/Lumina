use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

// ============================================================================
// Data Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Term {
    pub id: String,
    pub text: String,
    pub languageId: String,
    pub translation: String,
    pub status: i32,  // 0=new, 1=learning, 2=mastered
    pub notes: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parentId: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    
    // SRS fields
    #[serde(default)]
    pub nextReview: i64,
    #[serde(default)]
    pub lastReview: i64,
    #[serde(default)]
    pub interval: i32,
    #[serde(default = "default_ease_factor")]
    pub easeFactor: f64,
    #[serde(default)]
    pub reps: i32,
    
    // Metadata
    #[serde(default = "default_timestamp")]
    pub createdAt: i64,
    #[serde(default = "default_timestamp")]
    pub updatedAt: i64,
    
    // Query statistics
    #[serde(default)]
    pub queryCount: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lastQueriedAt: Option<i64>,
}

fn default_ease_factor() -> f64 {
    2.5
}

fn default_timestamp() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[derive(Debug, Deserialize)]
pub struct TermInput {
    pub text: String,
    pub languageId: String,
    pub translation: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub parentId: Option<String>,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub status: Option<i32>,
    #[serde(default)]
    pub nextReview: Option<i64>,
    #[serde(default)]
    pub interval: Option<i32>,
    #[serde(default)]
    pub easeFactor: Option<f64>,
    #[serde(default)]
    pub reps: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct TermUpdates {
    #[serde(default)]
    pub translation: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<i32>,
    #[serde(default)]
    pub nextReview: Option<i64>,
    #[serde(default)]
    pub interval: Option<i32>,
    #[serde(default)]
    pub easeFactor: Option<f64>,
    #[serde(default)]
    pub reps: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TermUpdateEvent {
    pub action: String,
    pub term: Term,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TermsData {
    pub terms: Vec<Term>,
    pub version: String,
    pub updatedAt: i64,
}

// ============================================================================
// AppState for vocabulary
// ============================================================================

pub struct VocabularyState {
    pub terms_path: Mutex<PathBuf>,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_terms_path(app: &AppHandle) -> PathBuf {
    // Try to get the data directory from Tauri
    let base_dir = app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    
    base_dir.join("data").join("terms.json")
}

fn load_terms(terms_path: &PathBuf) -> TermsData {
    if terms_path.exists() {
        match fs::read_to_string(terms_path) {
            Ok(content) => {
                match serde_json::from_str::<TermsData>(&content) {
                    Ok(data) => data,
                    Err(_) => {
                        // Try old format (just array)
                        if let Ok(terms) = serde_json::from_str::<Vec<Term>>(&content) {
                            TermsData {
                                terms,
                                version: "1.0".to_string(),
                                updatedAt: chrono::Utc::now().timestamp_millis(),
                            }
                        } else {
                            TermsData {
                                terms: Vec::new(),
                                version: "1.0".to_string(),
                                updatedAt: chrono::Utc::now().timestamp_millis(),
                            }
                        }
                    }
                }
            }
            Err(_) => TermsData {
                terms: Vec::new(),
                version: "1.0".to_string(),
                updatedAt: chrono::Utc::now().timestamp_millis(),
            },
        }
    } else {
        TermsData {
            terms: Vec::new(),
            version: "1.0".to_string(),
            updatedAt: chrono::Utc::now().timestamp_millis(),
        }
    }
}

fn save_terms(terms_path: &PathBuf, data: &TermsData) -> Result<(), String> {
    // Ensure directory exists
    if let Some(parent) = terms_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize terms: {}", e))?;
    
    fs::write(terms_path, content)
        .map_err(|e| format!("Failed to write terms file: {}", e))?;
    
    Ok(())
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Save a new term (supports root + inflection)
#[tauri::command]
pub async fn save_term(
    app: AppHandle,
    state: State<'_, VocabularyState>,
    input: TermInput,
) -> Result<Vec<Term>, String> {
    let terms_path = state.terms_path.lock().unwrap().clone();
    let mut data = load_terms(&terms_path);
    
    let now = chrono::Utc::now().timestamp_millis();
    let mut saved_terms = Vec::new();
    
    // 1. Save main term (root form)
    let main_id = format!("{}:{}:{}", input.languageId, input.text.to_lowercase(), now);
    let main_term = Term {
        id: main_id.clone(),
        text: input.text.clone(),
        languageId: input.languageId.clone(),
        translation: input.translation.clone(),
        status: input.status.unwrap_or(0),
        notes: input.notes.clone(),
        parentId: input.parentId.clone(),
        image: input.image.clone(),
        nextReview: input.nextReview.unwrap_or(now + 24 * 60 * 60 * 1000),
        lastReview: 0,
        interval: input.interval.unwrap_or(0),
        easeFactor: input.easeFactor.unwrap_or(2.5),
        reps: input.reps.unwrap_or(0),
        createdAt: now,
        updatedAt: now,
        queryCount: 0,
        lastQueriedAt: None,
    };
    
    data.terms.push(main_term.clone());
    saved_terms.push(main_term.clone());
    
    // 2. Broadcast update
    let _ = app.emit("term-update", TermUpdateEvent {
        action: "add".to_string(),
        term: main_term,
        timestamp: now,
    });
    
    // Save to file
    data.updatedAt = now;
    save_terms(&terms_path, &data)?;
    
    Ok(saved_terms)
}

/// Get all terms
#[tauri::command]
pub async fn get_all_terms(
    state: State<'_, VocabularyState>,
) -> Result<Vec<Term>, String> {
    let terms_path = state.terms_path.lock().unwrap().clone();
    let data = load_terms(&terms_path);
    Ok(data.terms)
}

/// Delete a term by ID
#[tauri::command]
pub async fn delete_term(
    app: AppHandle,
    state: State<'_, VocabularyState>,
    id: String,
) -> Result<(), String> {
    let terms_path = state.terms_path.lock().unwrap().clone();
    let mut data = load_terms(&terms_path);
    
    let index = data.terms.iter().position(|t| t.id == id)
        .ok_or_else(|| "Term not found".to_string())?;
    
    let term = data.terms.remove(index);
    
    // Broadcast update
    let _ = app.emit("term-update", TermUpdateEvent {
        action: "delete".to_string(),
        term,
        timestamp: chrono::Utc::now().timestamp_millis(),
    });
    
    data.updatedAt = chrono::Utc::now().timestamp_millis();
    save_terms(&terms_path, &data)?;
    
    Ok(())
}

/// Update a term
#[tauri::command]
pub async fn update_term(
    app: AppHandle,
    state: State<'_, VocabularyState>,
    id: String,
    updates: TermUpdates,
) -> Result<Term, String> {
    let terms_path = state.terms_path.lock().unwrap().clone();
    let mut data = load_terms(&terms_path);
    
    let index = data.terms.iter_mut()
        .position(|t| t.id == id)
        .ok_or_else(|| "Term not found".to_string())?;
    
    let term = &mut data.terms[index];
    
    // Apply updates
    if let Some(translation) = updates.translation {
        term.translation = translation;
    }
    if let Some(notes) = updates.notes {
        term.notes = notes;
    }
    if let Some(status) = updates.status {
        term.status = status;
    }
    if let Some(nextReview) = updates.nextReview {
        term.nextReview = nextReview;
    }
    if let Some(interval) = updates.interval {
        term.interval = interval;
    }
    if let Some(easeFactor) = updates.easeFactor {
        term.easeFactor = easeFactor;
    }
    if let Some(reps) = updates.reps {
        term.reps = reps;
    }
    
    term.updatedAt = chrono::Utc::now().timestamp_millis();
    let term_clone = term.clone();
    
    // Broadcast update
    let _ = app.emit("term-update", TermUpdateEvent {
        action: "update".to_string(),
        term: term_clone.clone(),
        timestamp: term_clone.updatedAt,
    });
    
    data.updatedAt = chrono::Utc::now().timestamp_millis();
    save_terms(&terms_path, &data)?;
    
    Ok(term_clone)
}

/// Initialize vocabulary state
pub fn init_vocabulary_state(app: &AppHandle) -> VocabularyState {
    let terms_path = get_terms_path(app);
    VocabularyState {
        terms_path: Mutex::new(terms_path),
    }
}
