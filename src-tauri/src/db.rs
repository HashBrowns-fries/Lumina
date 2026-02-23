use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DictionaryEntry {
    pub entry_id: Option<String>,
    pub text: String,
    pub language: String,
    pub translation: Option<String>,
    pub root_form: Option<String>,
    pub grammar: Option<String>,
    pub definition: Option<String>,
    pub details: Option<serde_json::Value>,
    pub link_part: Option<String>,
    pub inflections: Option<Vec<Inflection>>,
    pub etymology: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Inflection {
    pub form: String,
    pub tags: Option<String>,
    pub normalized_form: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryStats {
    pub word_count: i64,
    pub sense_count: i64,
    pub form_count: i64,
    pub synonym_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LanguageInfo {
    pub code: String,
    pub name: String,
    pub has_local: bool,
    pub word_count: i64,
    pub sense_count: i64,
    pub form_count: i64,
    pub path: Option<String>,
}

fn get_dict_dir() -> PathBuf {
    // Try multiple locations in order:
    // 1. Executable directory (for production builds)
    // 2. Project root (for development)
    // 3. Current directory fallback

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Check exe directory
            let exe_dict = exe_dir.join("dict");
            if exe_dict.exists() {
                return exe_dict;
            }

            // Check parent directory (for development: target/debug -> project root)
            if let Some(parent) = exe_dir.parent() {
                let parent_dict = parent.join("dict");
                if parent_dict.exists() {
                    return parent_dict;
                }
            }
        }
    }

    // Fallback to current directory
    PathBuf::from("dict")
}

pub fn get_connection(lang_code: &str) -> Result<Connection, String> {
    let dict_dir = get_dict_dir();

    if !dict_dir.exists() {
        return Err(format!(
            "Dictionary directory not found: {}",
            dict_dir.display()
        ));
    }

    // Map language names to codes for directory matching
    let name_to_code = [
        ("german", "de"),
        ("sanskrit", "sa"),
        ("english", "en"),
        ("french", "fr"),
        ("spanish", "es"),
        ("italian", "it"),
        ("portuguese", "pt"),
        ("russian", "ru"),
        ("chinese", "zh"),
        ("japanese", "ja"),
        ("korean", "ko"),
        ("arabic", "ar"),
    ];

    let mut db_path: Option<PathBuf> = None;

    if let Ok(entries) = std::fs::read_dir(&dict_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                // Check if directory name matches language code or name
                let matches = dir_name == lang_code
                    || name_to_code.iter().any(|(name, code)| {
                        (dir_name == *name && lang_code == *code)
                            || (dir_name == *code && lang_code == *code)
                    });

                if matches {
                    // Support both naming conventions
                    let patterns = vec![
                        format!("{}_dict.db", lang_code),
                        "dictionary.db".to_string(),
                        format!("{}_dict.db", dir_name),
                    ];

                    if let Ok(files) = std::fs::read_dir(&path) {
                        for file in files.flatten() {
                            let file_path = file.path();
                            if let Some(file_name) = file_path.file_name().and_then(|n| n.to_str())
                            {
                                if patterns.iter().any(|p| p == file_name) {
                                    db_path = Some(file_path);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if db_path.is_some() {
                break;
            }
        }
    }

    let db_path = db_path.ok_or_else(|| {
        format!(
            "Dictionary not found for language '{}'. Searched in {}",
            lang_code,
            dict_dir.display()
        )
    })?;

    Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))
}

fn normalize_word(word: &str) -> String {
    let mut normalized = word.to_string();

    let replacements = [
        ("ä", "ae"),
        ("Ä", "Ae"),
        ("ö", "oe"),
        ("Ö", "Oe"),
        ("ü", "ue"),
        ("Ü", "Ue"),
        ("ß", "ss"),
        ("ẞ", "Ss"),
        ("-", ""),
        ("/", ""),
    ];

    for (from, to) in replacements {
        normalized = normalized.replace(from, to);
    }

    normalized.to_lowercase()
}

fn extract_link_part(details: &Option<serde_json::Value>) -> Option<String> {
    if let Some(d) = details {
        if let Some(obj) = d.as_object() {
            if let Some(senses) = obj.get("senses") {
                if let Some(senses_arr) = senses.as_array() {
                    for sense in senses_arr {
                        if let Some(sense_obj) = sense.as_object() {
                            if let Some(parts) = sense_obj.get("partsOfSpeech") {
                                if let Some(parts_arr) = parts.as_array() {
                                    for part in parts_arr {
                                        if let Some(part_obj) = part.as_object() {
                                            if let Some(rels) = part_obj.get("relations") {
                                                if let Some(rels_arr) = rels.as_array() {
                                                    for rel in rels_arr {
                                                        if let Some(rel_obj) = rel.as_object() {
                                                            if let Some(rel_type) =
                                                                rel_obj.get("relType")
                                                            {
                                                                if rel_type == "linkedForm" {
                                                                    if let Some(targets) =
                                                                        rel_obj.get("targets")
                                                                    {
                                                                        if let Some(targets_arr) =
                                                                            targets.as_array()
                                                                        {
                                                                            if let Some(first) =
                                                                                targets_arr.first()
                                                                            {
                                                                                if let Some(
                                                                                    target_obj,
                                                                                ) = first
                                                                                    .as_object()
                                                                                {
                                                                                    if let Some(w) =
                                                                                        target_obj
                                                                                            .get(
                                                                                            "word",
                                                                                        )
                                                                                    {
                                                                                        return Some(w.to_string().trim_matches('"').to_string());
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

fn extract_etymology(details: &Option<serde_json::Value>) -> Option<String> {
    if let Some(d) = details {
        if let Some(obj) = d.as_object() {
            if let Some(etymology) = obj.get("etymology") {
                return Some(etymology.to_string().trim_matches('"').to_string());
            }
            if let Some(etymologies) = obj.get("etymologies") {
                if let Some(arr) = etymologies.as_array() {
                    if !arr.is_empty() {
                        return Some(arr[0].to_string().trim_matches('"').to_string());
                    }
                }
            }
        }
    }
    None
}

pub fn search_dictionary(word: &str, lang_code: &str) -> Result<Vec<DictionaryEntry>, String> {
    let conn = get_connection(lang_code)?;
    let normalized = normalize_word(word);
    let mut results: Vec<DictionaryEntry> = Vec::new();
    let mut seen_texts: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Step 1: Query dictionary table FIRST for exact match (base words like "du", "mich")
    let mut dictionary_id: Option<i64> = None;

    if let Ok(id) = conn.query_row(
        "SELECT id FROM dictionary WHERE word = ?1 LIMIT 1",
        params![word],
        |r| r.get::<_, i64>(0),
    ) {
        dictionary_id = Some(id);
    }

    // If not found, try normalized_word
    if dictionary_id.is_none() {
        if let Ok(id) = conn.query_row(
            "SELECT id FROM dictionary WHERE normalized_word = ?1 LIMIT 1",
            params![normalized],
            |r| r.get::<_, i64>(0),
        ) {
            dictionary_id = Some(id);
        }
    }

    // Step 2: Only if dictionary has no match, check forms table for inflections
    // Filter out error tags to avoid corrupted data
    let mut root_entry_id: Option<i64> = None;
    let mut inflection_tags: Vec<String> = Vec::new();

    if dictionary_id.is_none() {
        // Query forms table for exact form match (excluding error tags)
        if let Ok(mut forms_stmt) = conn.prepare(
            "SELECT dictionary_id, tags FROM forms 
             WHERE form = ?1 AND (tags IS NULL OR tags NOT LIKE '%error%')
             LIMIT 1",
        ) {
            if let Ok(row) = forms_stmt.query_row(params![word], |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, Option<String>>(1)?))
            }) {
                root_entry_id = Some(row.0);
                if let Some(tags) = row.1 {
                    inflection_tags.push(tags);
                }
            }
        }

        // If still not found, try normalized_form
        if root_entry_id.is_none() {
            if let Ok(mut forms_stmt) = conn.prepare(
                "SELECT dictionary_id, tags FROM forms 
                 WHERE normalized_form = ?1 AND (tags IS NULL OR tags NOT LIKE '%error%')
                 LIMIT 1",
            ) {
                if let Ok(row) = forms_stmt.query_row(params![normalized], |r| {
                    Ok((r.get::<_, i64>(0)?, r.get::<_, Option<String>>(1)?))
                }) {
                    root_entry_id = Some(row.0);
                    if let Some(tags) = row.1 {
                        inflection_tags.push(tags);
                    }
                }
            }
        }

        // Use forms result only if dictionary had no match
        if root_entry_id.is_some() {
            dictionary_id = root_entry_id;
        }
    }

    // 步骤 4: 获取词条完整信息
    if let Some(entry_id) = dictionary_id {
        let mut stmt = conn
            .prepare(
                "SELECT d.id, d.word, d.lang, d.lang_code, d.pos, d.etymology_text, d.pronunciation,
                        (SELECT GROUP_CONCAT(s.gloss, ' | ') FROM senses s WHERE s.dictionary_id = d.id) as definition,
                        d.normalized_word
                 FROM dictionary d
                 WHERE d.id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let entries = stmt
            .query_map(params![entry_id], |row| {
                let dict_word: String = row.get(1)?;
                let normalized_word: Option<String> = row.get(8)?;

                // 获取 IPA
                let ipa_from_sounds: Option<String> =
                    match conn.prepare("SELECT ipa FROM sounds WHERE dictionary_id = ?1 LIMIT 5") {
                        Ok(mut sounds_stmt) => sounds_stmt
                            .query_map(params![entry_id], |row| row.get::<_, Option<String>>(0))
                            .map(|rows| {
                                let ipa_list: Vec<String> =
                                    rows.filter_map(|r| r.ok().flatten()).collect();
                                if ipa_list.is_empty() {
                                    None
                                } else {
                                    Some(ipa_list.join("; "))
                                }
                            })
                            .unwrap_or_default(),
                        Err(_) => None,
                    };

                let ipa = ipa_from_sounds.or(row.get::<_, Option<String>>(6).unwrap_or(None));

                // 构建屈折信息（如果查询的词是屈折形式）
                let inflections_for_this: Option<Vec<Inflection>> =
                    if root_entry_id.is_some() && dict_word != word {
                        Some(vec![Inflection {
                            form: word.to_string(),
                            normalized_form: None,
                            tags: if inflection_tags.is_empty() {
                                None
                            } else {
                                Some(inflection_tags.join("; "))
                            },
                        }])
                    } else {
                        None
                    };

                Ok(DictionaryEntry {
                    entry_id: Some(entry_id.to_string()),
                    text: dict_word,
                    language: row.get(2)?,
                    translation: None,
                    root_form: normalized_word.clone(),
                    grammar: row.get::<_, Option<String>>(4)?,
                    definition: row.get::<_, Option<String>>(7)?,
                    details: None,
                    link_part: None,
                    inflections: inflections_for_this,
                    etymology: row.get::<_, Option<String>>(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for entry in entries.filter_map(|e| e.ok()) {
            if !seen_texts.contains(&entry.text) {
                seen_texts.insert(entry.text.clone());
                results.push(entry);
            }
        }
    }

    Ok(results)
}

fn search_inflections(
    conn: &Connection,
    word: &str,
    normalized: &str,
) -> Result<Vec<Inflection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT form, tags, normalized_form FROM forms 
             WHERE form = ?1 OR normalized_form = ?1 OR form = ?2 OR normalized_form = ?2
             LIMIT 20",
        )
        .map_err(|e| e.to_string())?;

    let inflections = stmt
        .query_map(params![word, normalized], |row| {
            Ok(Inflection {
                form: row.get(0)?,
                tags: row.get(1)?,
                normalized_form: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(inflections.filter_map(|i| i.ok()).collect())
}

pub fn get_language_stats(lang_code: &str) -> Result<DictionaryStats, String> {
    let conn = get_connection(lang_code)?;

    // Kaikki format
    let word_count: i64 = conn
        .query_row("SELECT COUNT(DISTINCT word) FROM dictionary", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);

    let sense_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM senses", [], |row| row.get(0))
        .unwrap_or(0);

    let form_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM forms", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(DictionaryStats {
        word_count,
        sense_count,
        form_count,
        synonym_count: 0,
    })
}

pub fn get_available_languages() -> Result<Vec<LanguageInfo>, String> {
    let dict_dir = get_dict_dir();
    let mut languages = Vec::new();

    eprintln!("[DICT] get_dict_dir returned: {:?}", dict_dir);
    eprintln!("[DICT] dict_dir.exists() = {}", dict_dir.exists());

    if !dict_dir.exists() {
        eprintln!("[DICT] Directory does not exist, returning empty list");
        return Ok(languages);
    }

    // Map directory names to language codes
    let name_to_code = [
        ("german", "de"),
        ("sanskrit", "sa"),
        ("english", "en"),
        ("french", "fr"),
        ("spanish", "es"),
        ("italian", "it"),
        ("portuguese", "pt"),
        ("russian", "ru"),
        ("chinese", "zh"),
        ("japanese", "ja"),
        ("korean", "ko"),
        ("arabic", "ar"),
    ];

    if let Ok(entries) = std::fs::read_dir(&dict_dir) {
        eprintln!("[DICT] Found entries in dict_dir");
        for entry in entries.flatten() {
            let path = entry.path();
            eprintln!("[DICT]   Entry: {:?} (is_dir={})", path, path.is_dir());
            if path.is_dir() {
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let dir_name_lower = dir_name.to_lowercase();

                // Try to map directory name to language code
                let lang_code = name_to_code
                    .iter()
                    .find(|(name, _)| *name == dir_name_lower || *name == dir_name)
                    .map(|(_, code)| *code)
                    .unwrap_or(dir_name);

                // Support both naming conventions
                let db_path = path.join("dictionary.db");
                let legacy_db_path = path.join(format!("{}_dict.db", lang_code));

                let actual_db_path = if db_path.exists() {
                    eprintln!(
                        "[DICT] Found dictionary.db for {} at {:?}",
                        lang_code, db_path
                    );
                    db_path
                } else if legacy_db_path.exists() {
                    eprintln!(
                        "[DICT] Found {}_dict.db for {} at {:?}",
                        lang_code, lang_code, legacy_db_path
                    );
                    legacy_db_path
                } else {
                    eprintln!("[DICT] No dictionary found for {} in {:?}", lang_code, path);
                    continue;
                };

                eprintln!("[DICT] Loading stats for {}...", lang_code);

                let name = match lang_code {
                    "de" => "German",
                    "sa" => "Sanskrit",
                    "en" => "English",
                    "fr" => "French",
                    "es" => "Spanish",
                    "it" => "Italian",
                    "pt" => "Portuguese",
                    "ru" => "Russian",
                    "zh" => "Chinese",
                    "ja" => "Japanese",
                    "ko" => "Korean",
                    "ar" => "Arabic",
                    _ => dir_name,
                }
                .to_string();

                let stats = get_language_stats(lang_code).unwrap_or(DictionaryStats {
                    word_count: 0,
                    sense_count: 0,
                    form_count: 0,
                    synonym_count: 0,
                });

                languages.push(LanguageInfo {
                    code: lang_code.to_string(),
                    name,
                    has_local: true,
                    word_count: stats.word_count,
                    sense_count: stats.sense_count,
                    form_count: stats.form_count,
                    path: Some(actual_db_path.to_string_lossy().to_string()),
                });
            }
        }
    }

    Ok(languages)
}

pub fn search_suggestions(
    prefix: &str,
    lang_code: &str,
    limit: usize,
) -> Result<Vec<(String, Option<String>)>, String> {
    let conn = get_connection(lang_code)?;

    // Kaikki format: dictionary table has 'word' and 'pos' columns
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT word, pos FROM dictionary 
             WHERE word LIKE ?1 
             ORDER BY word 
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let search_pattern = format!("{}%", prefix);
    let results = stmt
        .query_map(params![search_pattern, limit as i64], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(|e| e.to_string())?;

    Ok(results.filter_map(|r| r.ok()).collect())
}
