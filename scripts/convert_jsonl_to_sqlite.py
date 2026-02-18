#!/usr/bin/env python3
"""
将kaikki.org的JSONL格式词典数据转换为SQLite数据库

用法:
python convert_jsonl_to_sqlite.py kaikki.org-dictionary-German.jsonl German
python convert_jsonl_to_sqlite.py kaikki.org-dictionary-Latin.jsonl Latin

输出: dict/{language}/{language}_dict.db
"""

import json
import sqlite3
import os
import sys
import re
from pathlib import Path


def normalize_word(word):
    """
    规范化单词，用于查询和索引
    - 转换为小写
    - 移除变音符号（简单处理）
    - 移除非字母字符（保留连字符、空格等）
    """
    if not word:
        return ""

    # 转换为小写
    normalized = word.lower()

    # 移除变音符号（简单处理）
    replacements = {
        "ä": "a",
        "ö": "o",
        "ü": "u",
        "ß": "ss",
        "é": "e",
        "è": "e",
        "ê": "e",
        "á": "a",
        "à": "a",
        "â": "a",
        "ó": "o",
        "ò": "o",
        "ô": "o",
        "ú": "u",
        "ù": "u",
        "û": "u",
        "î": "i",
        "ï": "i",
        "ç": "c",
        "ñ": "n",
    }

    for orig, repl in replacements.items():
        normalized = normalized.replace(orig, repl)

    # 移除尾部的标点
    normalized = normalized.strip(".,;:!?\"'()[]{}")

    return normalized


def create_database_schema(db_path, language_code):
    """创建SQLite数据库表结构"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 启用外键支持
    cursor.execute("PRAGMA foreign_keys = ON")

    # 创建主词典表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dictionary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        normalized_word TEXT NOT NULL,
        lang_code TEXT NOT NULL,
        pos TEXT,
        etymology_text TEXT,
        pronunciation TEXT,
        synonyms TEXT,  -- JSON数组存储
        antonyms TEXT,  -- JSON数组存储
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 创建词义表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS senses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary_id INTEGER NOT NULL,
        sense_index INTEGER NOT NULL,
        gloss TEXT NOT NULL,
        example TEXT,
        FOREIGN KEY (dictionary_id) REFERENCES dictionary(id) ON DELETE CASCADE
    )
    """)

    # 创建词形变化表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary_id INTEGER NOT NULL,
        form TEXT NOT NULL,
        normalized_form TEXT NOT NULL,
        tags TEXT,  -- JSON数组存储或管道分隔
        FOREIGN KEY (dictionary_id) REFERENCES dictionary(id) ON DELETE CASCADE
    )
    """)

    # 创建同义词表（规范化存储）
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS synonyms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary_id INTEGER NOT NULL,
        synonym TEXT NOT NULL,
        FOREIGN KEY (dictionary_id) REFERENCES dictionary(id) ON DELETE CASCADE
    )
    """)

    # 创建反义词表（规范化存储）
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS antonyms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary_id INTEGER NOT NULL,
        antonym TEXT NOT NULL,
        FOREIGN KEY (dictionary_id) REFERENCES dictionary(id) ON DELETE CASCADE
    )
    """)

    # 创建发音表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dictionary_id INTEGER NOT NULL,
        ipa TEXT,
        audio_url TEXT,
        FOREIGN KEY (dictionary_id) REFERENCES dictionary(id) ON DELETE CASCADE
    )
    """)

    # 创建索引以提高查询性能
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dictionary_word ON dictionary(word)")
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_dictionary_normalized ON dictionary(normalized_word)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_dictionary_lang ON dictionary(lang_code)"
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_forms_form ON forms(form)")
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_forms_normalized ON forms(normalized_form)"
    )

    conn.commit()
    return conn


def extract_word_from_entry(entry):
    """从条目中提取单词"""
    # 尝试从多个字段提取单词
    if "word" in entry:
        return entry["word"]
    elif "forms" in entry and entry["forms"]:
        # 查找规范形式
        for form in entry["forms"]:
            if "canonical" in form.get("tags", []):
                return form["form"]
        # 如果没有规范形式，使用第一个形式
        return entry["forms"][0]["form"]
    else:
        # 从head_templates提取
        if "head_templates" in entry and entry["head_templates"]:
            head = entry["head_templates"][0]
            if "args" in head and "1" in head["args"]:
                return head["args"]["1"].split("<")[0]  # 移除变格信息
        return None


def extract_pos_from_entry(entry):
    """从条目中提取词性"""
    if "pos" in entry:
        return entry["pos"]
    return ""


def extract_senses(entry):
    """提取词义"""
    senses = []
    if "senses" in entry:
        for i, sense in enumerate(entry["senses"]):
            gloss = sense.get("glosses", [""])[0] if "glosses" in sense else ""
            if not gloss and "gloss" in sense:
                gloss = sense["gloss"]

            example = (
                sense.get("example", {}).get("text", "")
                if isinstance(sense.get("example"), dict)
                else ""
            )
            if not example and "example" in sense and isinstance(sense["example"], str):
                example = sense["example"]

            if gloss:  # 只添加有词义的条目
                senses.append({"sense_index": i, "gloss": gloss, "example": example})
    return senses


def extract_forms(entry, base_word):
    """提取词形变化"""
    forms = []
    if "forms" in entry:
        for form_data in entry["forms"]:
            form = form_data.get("form", "")
            if form:
                tags = form_data.get("tags", [])
                # 将标签列表转换为JSON字符串或管道分隔字符串
                tags_str = json.dumps(tags) if tags else None

                forms.append(
                    {
                        "form": form,
                        "normalized_form": normalize_word(form),
                        "tags": tags_str,
                    }
                )
    return forms


def extract_synonyms(entry):
    """提取同义词"""
    synonyms = []
    # kaikki.org数据中同义词可能在不同的字段
    # 这里简单实现，实际可能需要根据具体数据结构调整
    return synonyms


def extract_antonyms(entry):
    """提取反义词"""
    antonyms = []
    # kaikki.org数据中反义词可能在不同的字段
    return antonyms


def extract_sounds(entry):
    """提取发音"""
    sounds = []
    if "sounds" in entry:
        for sound in entry["sounds"]:
            ipa = sound.get("ipa", "")
            audio_url = sound.get("audio_url", "")
            if ipa or audio_url:
                sounds.append({"ipa": ipa, "audio_url": audio_url})
    return sounds


def extract_etymology(entry):
    """提取词源"""
    if "etymology_text" in entry:
        return entry["etymology_text"]
    return ""


def extract_pronunciation(entry):
    """提取发音信息"""
    # 从sounds中提取第一个IPA
    if "sounds" in entry and entry["sounds"]:
        for sound in entry["sounds"]:
            if "ipa" in sound and sound["ipa"]:
                return sound["ipa"]
    return ""


def process_jsonl_file(jsonl_path, language_code):
    """处理JSONL文件并导入数据库"""
    # 创建输出目录
    output_dir = Path(f"dict/{language_code}")
    output_dir.mkdir(parents=True, exist_ok=True)

    db_path = output_dir / f"{language_code.lower()}_dict.db"

    print(f"创建数据库: {db_path}")
    conn = create_database_schema(db_path, language_code)
    cursor = conn.cursor()

    # 读取JSONL文件
    print(f"处理文件: {jsonl_path}")

    entry_count = 0
    skipped_count = 0

    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            try:
                entry = json.loads(line.strip())

                # 提取单词
                word = extract_word_from_entry(entry)
                if not word:
                    skipped_count += 1
                    continue

                # 规范化单词
                normalized_word = normalize_word(word)

                # 提取词性
                pos = extract_pos_from_entry(entry)

                # 提取词义
                senses = extract_senses(entry)
                if not senses:
                    skipped_count += 1
                    continue  # 跳过没有词义的条目

                # 提取词形变化
                forms = extract_forms(entry, word)

                # 提取同义词和反义词
                synonyms = extract_synonyms(entry)
                antonyms = extract_antonyms(entry)

                # 提取发音
                sounds = extract_sounds(entry)

                # 提取词源
                etymology = extract_etymology(entry)

                # 提取发音文本
                pronunciation = extract_pronunciation(entry)

                # 插入主词典条目
                cursor.execute(
                    """
                    INSERT INTO dictionary 
                    (word, normalized_word, lang_code, pos, etymology_text, pronunciation, synonyms, antonyms)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        word,
                        normalized_word,
                        language_code,
                        pos,
                        etymology,
                        pronunciation,
                        json.dumps(synonyms) if synonyms else None,
                        json.dumps(antonyms) if antonyms else None,
                    ),
                )

                dictionary_id = cursor.lastrowid

                # 插入词义
                for sense in senses:
                    cursor.execute(
                        """
                        INSERT INTO senses (dictionary_id, sense_index, gloss, example)
                        VALUES (?, ?, ?, ?)
                    """,
                        (
                            dictionary_id,
                            sense["sense_index"],
                            sense["gloss"],
                            sense["example"],
                        ),
                    )

                # 插入词形变化
                for form in forms:
                    cursor.execute(
                        """
                        INSERT INTO forms (dictionary_id, form, normalized_form, tags)
                        VALUES (?, ?, ?, ?)
                    """,
                        (
                            dictionary_id,
                            form["form"],
                            form["normalized_form"],
                            form["tags"],
                        ),
                    )

                # 插入同义词
                for synonym in synonyms:
                    cursor.execute(
                        """
                        INSERT INTO synonyms (dictionary_id, synonym)
                        VALUES (?, ?)
                    """,
                        (dictionary_id, synonym),
                    )

                # 插入反义词
                for antonym in antonyms:
                    cursor.execute(
                        """
                        INSERT INTO antonyms (dictionary_id, antonym)
                        VALUES (?, ?)
                    """,
                        (dictionary_id, antonym),
                    )

                # 插入发音
                for sound in sounds:
                    cursor.execute(
                        """
                        INSERT INTO sounds (dictionary_id, ipa, audio_url)
                        VALUES (?, ?, ?)
                    """,
                        (dictionary_id, sound["ipa"], sound["audio_url"]),
                    )

                entry_count += 1

                if entry_count % 1000 == 0:
                    conn.commit()
                    print(f"已处理 {entry_count} 个条目...")

            except json.JSONDecodeError as e:
                print(f"第 {line_num} 行JSON解析错误: {e}")
                skipped_count += 1
            except Exception as e:
                print(f"第 {line_num} 行处理错误: {e}")
                skipped_count += 1

    # 最终提交
    conn.commit()

    print(f"\n处理完成!")
    print(f"成功导入: {entry_count} 个条目")
    print(f"跳过: {skipped_count} 个条目")
    print(f"数据库: {db_path}")

    # 显示统计信息
    cursor.execute("SELECT COUNT(*) FROM dictionary")
    dict_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM senses")
    senses_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM forms")
    forms_count = cursor.fetchone()[0]

    print(f"\n数据库统计:")
    print(f"  词典条目: {dict_count}")
    print(f"  词义: {senses_count}")
    print(f"  词形变化: {forms_count}")

    conn.close()
    return db_path


def main():
    if len(sys.argv) < 3:
        print("用法: python convert_jsonl_to_sqlite.py <jsonl文件> <语言代码>")
        print(
            "示例: python convert_jsonl_to_sqlite.py kaikki.org-dictionary-German.jsonl German"
        )
        print(
            "示例: python convert_jsonl_to_sqlite.py kaikki.org-dictionary-Latin.jsonl Latin"
        )
        sys.exit(1)

    jsonl_path = sys.argv[1]
    language_code = sys.argv[2]

    if not os.path.exists(jsonl_path):
        print(f"错误: 文件不存在: {jsonl_path}")
        sys.exit(1)

    try:
        db_path = process_jsonl_file(jsonl_path, language_code)
        print(f"\n数据库已创建: {db_path}")
        print(f"\n下一步:")
        print(f"1. 将数据库文件复制到 dict/{language_code}/ 目录")
        print(f"2. 运行 extract-test-data.py 提取测试数据")
        print(f"3. 启动应用测试词典功能")

    except Exception as e:
        print(f"处理过程中发生错误: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
