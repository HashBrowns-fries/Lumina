#!/usr/bin/env python3
"""
词典数据管理工具

功能:
1. 列出所有可用的词典
2. 添加新词典（从kaikki.org JSONL文件转换）
3. 删除词典
4. 检查词典完整性
5. 更新词典信息

用法:
python manage_dictionaries.py list
python manage_dictionaries.py add <jsonl_file> <iso_code>
python manage_dictionaries.py remove <iso_code>
python manage_dictionaries.py check <iso_code>
python manage_dictionaries.py stats
"""

import json
import sqlite3
import os
import sys
import re
from pathlib import Path
import shutil
import argparse

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
DICT_DIR = PROJECT_ROOT / "dict"

# ISO语言代码到语言名称的映射
ISO_TO_LANGUAGE_NAME = {
    "de": "German",
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "nl": "Dutch",
    "pl": "Polish",
    "sv": "Swedish",
    "da": "Danish",
    "fi": "Finnish",
    "no": "Norwegian",
    "la": "Latin",
    "tr": "Turkish",
    "el": "Greek",
    "he": "Hebrew",
    "hi": "Hindi",
    "sa": "Sanskrit",
    "th": "Thai",
    "vi": "Vietnamese",
}


def get_available_dictionaries():
    """获取所有可用的词典"""
    dictionaries = []

    if not DICT_DIR.exists():
        print(f"错误: 词典目录不存在: {DICT_DIR}")
        return dictionaries

    # 扫描所有语言目录
    for lang_dir in DICT_DIR.iterdir():
        if not lang_dir.is_dir():
            continue

        # 查找该目录下的所有 *_dict.db 文件
        for db_file in lang_dir.glob("*_dict.db"):
            # 从文件名提取ISO代码
            iso_match = db_file.name.match(r"^([a-z]{2})_dict\.db$")
            if iso_match:
                iso_code = iso_match.group(1)
                language_name = ISO_TO_LANGUAGE_NAME.get(iso_code, iso_code.upper())

                # 获取数据库统计信息
                stats = get_database_stats(db_file)

                dictionaries.append(
                    {
                        "iso_code": iso_code,
                        "language_name": language_name,
                        "db_path": str(db_file),
                        "directory": str(lang_dir),
                        "size_mb": db_file.stat().st_size / (1024 * 1024),
                        "word_count": stats.get("word_count", 0),
                        "sense_count": stats.get("sense_count", 0),
                        "form_count": stats.get("form_count", 0),
                        "last_modified": db_file.stat().st_mtime,
                    }
                )

    return sorted(dictionaries, key=lambda x: x["language_name"])


def get_database_stats(db_path):
    """获取数据库统计信息"""
    stats = {"word_count": 0, "sense_count": 0, "form_count": 0, "synonym_count": 0}

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 检查表是否存在并获取统计
        tables = ["dictionary", "senses", "forms", "synonyms"]
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                key = f"{table}_count" if table != "dictionary" else "word_count"
                stats[key] = count
            except sqlite3.OperationalError:
                # 表不存在
                pass

        conn.close()
    except Exception as e:
        print(f"警告: 无法读取数据库统计信息 {db_path}: {e}")

    return stats


def list_dictionaries(verbose=False):
    """列出所有词典"""
    dictionaries = get_available_dictionaries()

    if not dictionaries:
        print("未找到任何词典数据库")
        print(f"\n提示: 使用以下命令添加词典:")
        print(f"  python manage_dictionaries.py add <jsonl_file> <iso_code>")
        print(f"\n例如:")
        print(
            f"  python manage_dictionaries.py add kaikki.org-dictionary-English.jsonl en"
        )
        return

    print(f"\n可用词典 ({len(dictionaries)} 种语言):")
    print("=" * 80)

    for i, d in enumerate(dictionaries, 1):
        print(f"{i:2d}. {d['iso_code']:4s} - {d['language_name']:15s}")
        print(f"    文件: {d['db_path']}")
        print(f"    大小: {d['size_mb']:.1f} MB")
        print(
            f"    词条: {d['word_count']:,d}  词义: {d['sense_count']:,d}  词形: {d['form_count']:,d}"
        )

        if verbose:
            from datetime import datetime

            last_mod = datetime.fromtimestamp(d["last_modified"]).strftime(
                "%Y-%m-%d %H:%M:%S"
            )
            print(f"    修改: {last_mod}")
            print(f"    目录: {d['directory']}")

        print()


def add_dictionary(jsonl_path, iso_code):
    """添加新词典"""
    # 检查ISO代码是否有效
    if iso_code not in ISO_TO_LANGUAGE_NAME:
        print(f"警告: ISO代码 '{iso_code}' 不在标准映射中")
        language_name = input(f"请输入 '{iso_code}' 对应的语言名称: ").strip()
        if not language_name:
            language_name = iso_code.capitalize()
        ISO_TO_LANGUAGE_NAME[iso_code] = language_name
    else:
        language_name = ISO_TO_LANGUAGE_NAME[iso_code]

    # 检查JSONL文件是否存在
    jsonl_file = Path(jsonl_path)
    if not jsonl_file.exists():
        print(f"错误: JSONL文件不存在: {jsonl_path}")
        return False

    # 创建语言目录
    language_dir = DICT_DIR / language_name
    language_dir.mkdir(parents=True, exist_ok=True)

    # 数据库文件路径
    db_file = language_dir / f"{iso_code}_dict.db"

    if db_file.exists():
        print(f"警告: 数据库文件已存在: {db_file}")
        response = input("是否覆盖? (y/N): ").strip().lower()
        if response != "y":
            print("操作取消")
            return False

    print(f"\n添加词典:")
    print(f"  ISO代码: {iso_code}")
    print(f"  语言名称: {language_name}")
    print(f"  JSONL文件: {jsonl_file}")
    print(f"  数据库文件: {db_file}")
    print(f"  语言目录: {language_dir}")

    # 调用转换脚本
    print(f"\n开始转换...")

    # 这里应该调用convert_jsonl_to_sqlite.py
    # 为了简化，我们直接导入并调用其函数
    try:
        # 添加scripts目录到Python路径
        scripts_dir = Path(__file__).parent
        sys.path.insert(0, str(scripts_dir))

        from convert_jsonl_to_sqlite import process_jsonl_file

        db_path = process_jsonl_file(str(jsonl_file), iso_code)

        print(f"\n词典添加成功!")
        print(f"数据库: {db_path}")

        # 显示统计信息
        stats = get_database_stats(db_path)
        print(f"\n统计信息:")
        print(f"  词条数: {stats['word_count']:,d}")
        print(f"  词义数: {stats['sense_count']:,d}")
        print(f"  词形数: {stats['form_count']:,d}")
        print(f"  同义词数: {stats.get('synonym_count', 0):,d}")

        return True

    except ImportError as e:
        print(f"错误: 无法导入转换脚本: {e}")
        print(
            f"请手动运行: python scripts/convert_jsonl_to_sqlite.py {jsonl_path} {iso_code}"
        )
        return False
    except Exception as e:
        print(f"转换过程中出错: {e}")
        import traceback

        traceback.print_exc()
        return False


def remove_dictionary(iso_code):
    """删除词典"""
    dictionaries = get_available_dictionaries()

    # 查找匹配的词典
    target_dicts = [d for d in dictionaries if d["iso_code"] == iso_code]

    if not target_dicts:
        print(f"错误: 找不到ISO代码为 '{iso_code}' 的词典")
        return False

    for d in target_dicts:
        print(f"\n找到词典:")
        print(f"  ISO代码: {d['iso_code']}")
        print(f"  语言名称: {d['language_name']}")
        print(f"  数据库文件: {d['db_path']}")
        print(f"  大小: {d['size_mb']:.1f} MB")
        print(f"  词条数: {d['word_count']:,d}")

        response = input(f"\n确认删除此词典? (y/N): ").strip().lower()
        if response != "y":
            print("操作取消")
            continue

        try:
            # 删除数据库文件
            db_path = Path(d["db_path"])
            if db_path.exists():
                db_path.unlink()
                print(f"已删除数据库文件: {db_path}")

            # 删除相关的-shm和-wal文件
            for ext in ["-shm", "-wal"]:
                ext_file = db_path.with_name(db_path.name + ext)
                if ext_file.exists():
                    ext_file.unlink()

            # 检查目录是否为空，如果是则删除
            lang_dir = db_path.parent
            if lang_dir.exists() and not any(lang_dir.iterdir()):
                lang_dir.rmdir()
                print(f"已删除空目录: {lang_dir}")

            print(f"词典 '{d['language_name']}' ({iso_code}) 已成功删除")

        except Exception as e:
            print(f"删除词典时出错: {e}")
            return False

    return True


def check_dictionary(iso_code):
    """检查词典完整性"""
    dictionaries = get_available_dictionaries()

    # 查找匹配的词典
    target_dicts = [d for d in dictionaries if d["iso_code"] == iso_code]

    if not target_dicts:
        print(f"错误: 找不到ISO代码为 '{iso_code}' 的词典")
        return False

    for d in target_dicts:
        print(f"\n检查词典: {d['language_name']} ({iso_code})")
        print("=" * 60)

        db_path = Path(d["db_path"])

        # 检查文件是否存在
        if not db_path.exists():
            print(f"错误: 数据库文件不存在: {db_path}")
            return False

        print(f"✓ 数据库文件存在")
        print(f"  路径: {db_path}")
        print(f"  大小: {d['size_mb']:.1f} MB")

        # 检查数据库完整性
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            # 检查必需的表
            required_tables = ["dictionary", "senses", "forms"]
            missing_tables = []

            for table in required_tables:
                cursor.execute(
                    f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"
                )
                if not cursor.fetchone():
                    missing_tables.append(table)

            if missing_tables:
                print(f"✗ 缺少必需的表: {', '.join(missing_tables)}")
                conn.close()
                return False

            print(f"✓ 所有必需的表都存在")

            # 检查数据完整性
            cursor.execute("SELECT COUNT(*) FROM dictionary")
            word_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM senses")
            sense_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM forms")
            form_count = cursor.fetchone()[0]

            print(f"✓ 数据统计:")
            print(f"  词条数: {word_count:,d}")
            print(f"  词义数: {sense_count:,d}")
            print(f"  词形数: {form_count:,d}")

            if word_count == 0:
                print("警告: 词典中没有词条!")

            if sense_count == 0:
                print("警告: 词典中没有词义!")

            # 检查示例查询
            cursor.execute("SELECT word FROM dictionary LIMIT 5")
            sample_words = cursor.fetchall()

            if sample_words:
                print(f"✓ 示例词条: {', '.join([w[0] for w in sample_words])}")

            conn.close()

        except sqlite3.Error as e:
            print(f"✗ 数据库错误: {e}")
            return False

        print(f"\n词典完整性检查通过!")
        return True


def show_statistics():
    """显示总体统计信息"""
    dictionaries = get_available_dictionaries()

    if not dictionaries:
        print("未找到任何词典数据库")
        return

    total_size_mb = sum(d["size_mb"] for d in dictionaries)
    total_words = sum(d["word_count"] for d in dictionaries)
    total_senses = sum(d["sense_count"] for d in dictionaries)
    total_forms = sum(d["form_count"] for d in dictionaries)

    print(f"\n词典数据总体统计:")
    print("=" * 80)
    print(f"语言数量: {len(dictionaries)}")
    print(f"总大小: {total_size_mb:.1f} MB")
    print(f"总词条数: {total_words:,d}")
    print(f"总词义数: {total_senses:,d}")
    print(f"总词形数: {total_forms:,d}")
    print()

    # 按语言显示详细统计
    print(
        f"{'语言':<15} {'ISO':<5} {'大小(MB)':<10} {'词条数':<12} {'词义数':<12} {'词形数':<12}"
    )
    print("-" * 80)

    for d in sorted(dictionaries, key=lambda x: x["size_mb"], reverse=True):
        print(
            f"{d['language_name']:<15} {d['iso_code']:<5} {d['size_mb']:<10.1f} "
            f"{d['word_count']:<12,d} {d['sense_count']:<12,d} {d['form_count']:<12,d}"
        )

    print()


def main():
    parser = argparse.ArgumentParser(description="词典数据管理工具")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    # list 命令
    list_parser = subparsers.add_parser("list", help="列出所有可用词典")
    list_parser.add_argument(
        "-v", "--verbose", action="store_true", help="显示详细信息"
    )

    # add 命令
    add_parser = subparsers.add_parser("add", help="添加新词典")
    add_parser.add_argument("jsonl_file", help="kaikki.org JSONL文件路径")
    add_parser.add_argument("iso_code", help="ISO语言代码 (如: de, en, fr)")

    # remove 命令
    remove_parser = subparsers.add_parser("remove", help="删除词典")
    remove_parser.add_argument("iso_code", help="要删除的词典的ISO语言代码")

    # check 命令
    check_parser = subparsers.add_parser("check", help="检查词典完整性")
    check_parser.add_argument("iso_code", help="要检查的词典的ISO语言代码")

    # stats 命令
    stats_parser = subparsers.add_parser("stats", help="显示总体统计信息")

    args = parser.parse_args()

    if args.command == "list":
        list_dictionaries(args.verbose)
    elif args.command == "add":
        add_dictionary(args.jsonl_file, args.iso_code)
    elif args.command == "remove":
        remove_dictionary(args.iso_code)
    elif args.command == "check":
        check_dictionary(args.iso_code)
    elif args.command == "stats":
        show_statistics()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
