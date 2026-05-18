#!/usr/bin/env python3
"""
Dictionary Download API - handles download, decompress, and convert pipeline
Runs on port 3011
"""

import os
import sys
import gzip
import json
import threading
import tempfile
from pathlib import Path

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

# Add scripts dir to path for importing convert module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from convert_jsonl_to_sqlite import process_jsonl_file, ISO_TO_LANGUAGE_NAME

app = Flask(__name__)
CORS(app)

# Track download progress per language
download_status = {}

def get_dict_dir():
    """Find the dict directory relative to project root"""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    dict_dir = project_root / "dict"
    dict_dir.mkdir(exist_ok=True)
    return dict_dir


def do_install(language_code, language_name, url):
    """Background task: download, decompress, convert"""
    status = download_status[language_code]
    
    try:
        # Step 1: Download
        status.update(stage="downloading", progress=0, message="Starting download...")
        
        resp = requests.get(url, stream=True, headers={"User-Agent": "LuminousLute/1.5.0"})
        resp.raise_for_status()
        
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        chunks = []
        
        for chunk in resp.iter_content(chunk_size=1048576):
            chunks.append(chunk)
            downloaded += len(chunk)
            if total > 0:
                pct = downloaded / total
                mb_done = downloaded / 1048576
                mb_total = total / 1048576
                status.update(
                    stage="downloading",
                    progress=pct,
                    message=f"{mb_done:.1f} / {mb_total:.1f} MB"
                )
        
        body = b"".join(chunks)
        del chunks
        
        # Step 2: Decompress
        status.update(stage="decompressing", progress=0, message="Decompressing...")
        
        tmp_dir = Path(tempfile.mkdtemp(prefix="luminous_dict_"))
        jsonl_path = tmp_dir / f"{language_code}_extract.jsonl"
        
        is_gzip = len(body) >= 2 and body[0] == 0x1F and body[1] == 0x8B
        
        if is_gzip:
            decompressed = gzip.decompress(body)
            jsonl_path.write_bytes(decompressed)
            del decompressed
        else:
            jsonl_path.write_bytes(body)
        del body
        
        status.update(stage="decompressing", progress=1.0, message="Decompressed")
        
        # Step 3: Convert to SQLite
        status.update(stage="converting", progress=0, message="Converting to SQLite...")
        
        dict_dir = get_dict_dir()
        lang_dir_name = ISO_TO_LANGUAGE_NAME.get(language_code, language_name)
        target_dir = dict_dir / lang_dir_name
        target_dir.mkdir(parents=True, exist_ok=True)
        target_db = str(target_dir / f"{language_code}_dict.db")
        
        # Change to project root so relative paths in convert script work
        os.chdir(str(dict_dir.parent))
        
        process_jsonl_file(str(jsonl_path), language_code, target_db)
        
        # Cleanup
        jsonl_path.unlink(missing_ok=True)
        tmp_dir.rmdir()
        
        status.update(stage="done", progress=1.0, message="Dictionary installed successfully!")
        
    except Exception as e:
        status.update(stage="error", progress=0, message=str(e))


@app.route("/api/dictionary/install", methods=["POST"])
def install_dictionary():
    data = request.json
    language_code = data.get("languageCode")
    language_name = data.get("languageName")
    url = data.get("url")
    
    if not all([language_code, language_name, url]):
        return jsonify({"error": "Missing languageCode, languageName, or url"}), 400
    
    if language_code in download_status and download_status[language_code].get("stage") in ("downloading", "decompressing", "converting"):
        return jsonify({"error": "Already installing this dictionary"}), 409
    
    download_status[language_code] = {
        "stage": "downloading",
        "progress": 0,
        "message": "Starting...",
        "language_code": language_code,
    }
    
    thread = threading.Thread(target=do_install, args=(language_code, language_name, url), daemon=True)
    thread.start()
    
    return jsonify({"status": "started", "language_code": language_code})


@app.route("/api/dictionary/status/<language_code>")
def get_status(language_code):
    status = download_status.get(language_code)
    if not status:
        return jsonify({"stage": "idle"})
    return jsonify(status)


@app.route("/api/dictionary/status")
def get_all_status():
    return jsonify(download_status)


@app.route("/api/dictionary/installed")
def get_installed():
    """List installed dictionaries with word counts"""
    import sqlite3
    dict_dir = get_dict_dir()
    installed = []
    if dict_dir.exists():
        for lang_dir in dict_dir.iterdir():
            if lang_dir.is_dir():
                for db_file in lang_dir.glob("*_dict.db"):
                    code = db_file.stem.replace("_dict", "")
                    word_count = 0
                    sense_count = 0
                    form_count = 0
                    try:
                        db_str = str(db_file.resolve())
                        conn = sqlite3.connect(db_str)
                        c = conn.cursor()
                        c.execute("SELECT COUNT(*) FROM dictionary")
                        word_count = c.fetchone()[0]
                        try:
                            c.execute("SELECT COUNT(*) FROM senses")
                            sense_count = c.fetchone()[0]
                        except Exception:
                            pass
                        try:
                            c.execute("SELECT COUNT(*) FROM forms")
                            form_count = c.fetchone()[0]
                        except Exception:
                            pass
                        conn.close()
                    except Exception as e:
                        print(f"[WARN] Failed to query {db_file}: {e}")
                    installed.append({
                        "code": code,
                        "name": lang_dir.name,
                        "path": str(db_file),
                        "size_mb": db_file.stat().st_size / 1048576,
                        "word_count": word_count,
                        "sense_count": sense_count,
                        "form_count": form_count,
                    })
    return jsonify(installed)


ISO_TO_LANG_NAME = {
    "de": "German", "en": "English", "es": "Spanish", "fr": "French",
    "it": "Italian", "pt": "Portuguese", "ru": "Russian", "zh": "Chinese",
    "ja": "Japanese", "ko": "Korean", "nl": "Dutch", "pl": "Polish",
    "tr": "Turkish", "el": "Greek", "hi": "Hindi", "sa": "Sanskrit",
    "th": "Thai", "vi": "Vietnamese", "id": "Indonesian", "ms": "Malay",
    "cs": "Czech", "ku": "Kurdish", "simple": "Simple English",
}


def find_dict_db(lang_code):
    """Find the .db file for a language code"""
    import sqlite3
    dict_dir = get_dict_dir()
    if not dict_dir.exists():
        return None
    for lang_dir in dict_dir.iterdir():
        if not lang_dir.is_dir():
            continue
        dir_lower = lang_dir.name.lower()
        lang_name = ISO_TO_LANG_NAME.get(lang_code, "").lower()
        if dir_lower == lang_code or dir_lower == lang_name:
            db = lang_dir / f"{lang_code}_dict.db"
            if db.exists():
                return str(db.resolve())
    return None


@app.route("/api/dictionary/search")
def search_word():
    """Search for a word in the dictionary"""
    import sqlite3
    word = request.args.get("word", "").strip()
    lang = request.args.get("language", "").strip()
    if not word or not lang:
        return jsonify({"success": False, "entries": [], "error": "Missing word or language"}), 400

    db_path = find_dict_db(lang)
    if not db_path:
        return jsonify({"success": True, "entries": [], "error": f"No dictionary for {lang}"})

    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        # Direct match
        c.execute("""
            SELECT d.id, d.word, d.pos, d.etymology_text, d.pronunciation
            FROM dictionary d WHERE d.word = ? OR d.normalized_word = ?
            LIMIT 20
        """, (word, word.lower()))
        rows = c.fetchall()

        # Fallback: form match
        if not rows:
            c.execute("""
                SELECT DISTINCT d.id, d.word, d.pos, d.etymology_text, d.pronunciation
                FROM forms f JOIN dictionary d ON f.dictionary_id = d.id
                WHERE f.form = ? OR f.normalized_form = ?
                LIMIT 20
            """, (word, word.lower()))
            rows = c.fetchall()

        entries = []
        for row in rows:
            did, w, pos, etym, pron = row
            c.execute("SELECT gloss, example FROM senses WHERE dictionary_id = ?", (did,))
            senses = c.fetchall()
            c.execute("SELECT form, tags FROM forms WHERE dictionary_id = ? LIMIT 20", (did,))
            forms = c.fetchall()

            entries.append({
                "word": w,
                "language": lang,
                "partOfSpeech": pos,
                "definitions": [s[0] for s in senses if s[0]],
                "translations": [],
                "etymology": etym or None,
                "pronunciation": pron or None,
                "examples": [s[1] for s in senses if s[1]],
                "inflectionForms": [{"form": f[0], "tags": f[1]} for f in forms],
            })

        conn.close()
        return jsonify({"success": True, "entries": entries})
    except Exception as e:
        return jsonify({"success": False, "entries": [], "error": str(e)})


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "dictionary-download"})


if __name__ == "__main__":
    print("Dictionary Download API starting on port 3011...")
    app.run(host="0.0.0.0", port=3011, debug=False)
