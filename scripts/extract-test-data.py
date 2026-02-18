#!/usr/bin/env python3
"""
从SQLite数据库提取测试数据用于浏览器词典
支持自定义语言和测试词

用法:
python extract-test-data.py --language de  # 德语（默认）
python extract-test-data.py --language la  # 拉丁语
python extract-test-data.py --language en --words "hello,world,book"  # 自定义测试词
python extract-test-data.py --language fr --words-file test_words.txt  # 从文件读取测试词
python extract-test-data.py --db-path custom/dict.db --language xx  # 自定义数据库路径
"""

import sqlite3
import json
import os
import sys
import argparse
import random

# 各语言的默认测试词列表
DEFAULT_TEST_WORDS = {
    "de": [  # 德语
        "allein",
        "Geschichte",
        "Kommunikation",
        "Haus",
        "Buch",
        "Auto",
        "Computer",
        "Wasser",
        "bequem",
        "gut",
        "schön",
        "Freund",
        "Arbeit",
        "Zeit",
        "Mensch",
        "Kind",
        "Tag",
        "Nacht",
        "Jahr",
        "Monat",
        "Woche",
        "Stunde",
        "Minute",
        "Sekunde",
        "Land",
        "Stadt",
        "Dorf",
        "Straße",
        "Platz",
        "Garten",
        "Zimmer",
        "Fenster",
        "Tür",
        "Tisch",
        "Stuhl",
        "Bett",
        "Lampe",
        "Bild",
        "Buch",
        "Zeitung",
        "Zeitschrift",
        "Fernsehen",
        "Radio",
        "Telefon",
        "Handy",
        "Internet",
        "Computer",
        "Programm",
        "Software",
        "Hardware",
        "Daten",
        "Information",
        "Wissen",
        "Lernen",
        "Lehren",
        "Schule",
        "Universität",
        "Studium",
        "Prüfung",
        "Note",
        "Lehrer",
        "Professor",
        "Student",
        "Schüler",
        "Klasse",
        "Unterricht",
        "Büro",
        "Fabrik",
        "Geschäft",
        "Markt",
        "Kaufhaus",
        "Restaurant",
        "Hotel",
        "Krankenhaus",
        "Polizei",
        "Feuerwehr",
    ],
    "en": [  # 英语
        "hello",
        "world",
        "book",
        "time",
        "person",
        "year",
        "day",
        "thing",
        "man",
        "woman",
        "child",
        "school",
        "life",
        "eye",
        "hand",
        "part",
        "place",
        "work",
        "week",
        "case",
        "point",
        "government",
        "company",
        "number",
        "group",
        "problem",
        "fact",
        "be",
        "have",
        "do",
        "say",
        "get",
        "make",
        "go",
        "know",
        "take",
        "see",
        "come",
        "think",
        "look",
        "want",
        "give",
        "use",
        "find",
        "tell",
        "ask",
        "work",
        "seem",
        "feel",
        "try",
        "leave",
        "call",
        "good",
        "new",
        "first",
        "last",
        "long",
        "great",
        "little",
        "own",
        "other",
        "old",
        "right",
        "big",
        "high",
        "different",
        "small",
        "large",
        "next",
        "early",
        "young",
        "important",
        "few",
        "public",
        "bad",
        "same",
        "able",
        "the",
        "and",
        "a",
        "to",
        "of",
        "in",
        "is",
        "you",
        "that",
        "it",
        "he",
        "was",
        "for",
        "on",
        "are",
        "as",
        "with",
        "his",
        "they",
        "at",
        "be",
        "this",
        "from",
        "or",
        "one",
        "had",
        "by",
        "word",
        "but",
        "not",
        "what",
        "all",
        "were",
        "when",
        "your",
        "can",
        "said",
        "there",
        "use",
        "each",
        "which",
        "she",
        "how",
        "their",
        "will",
        "up",
        "out",
        "about",
        "many",
        "then",
        "them",
        "these",
        "so",
        "some",
        "her",
        "would",
        "make",
        "like",
        "him",
        "into",
        "time",
        "has",
        "look",
        "two",
        "more",
        "write",
        "go",
        "see",
        "number",
        "no",
        "way",
        "could",
        "people",
        "my",
        "than",
        "first",
        "water",
        "been",
        "call",
        "who",
        "oil",
        "its",
        "now",
        "find",
        "long",
        "down",
        "day",
        "did",
        "get",
        "come",
        "made",
        "may",
        "part",
    ],
    "la": [  # 拉丁语
        "aquila",
        "liber",
        "domus",
        "amicus",
        "tempus",
        "homo",
        "annus",
        "dies",
        "res",
        "vir",
        "femina",
        "puer",
        "schola",
        "vita",
        "oculus",
        "manus",
        "pars",
        "locus",
        "opus",
        "hebdomas",
        "casus",
        "punctum",
        "imperium",
        "societas",
        "numerus",
        "grex",
        "problema",
        "factum",
        "esse",
        "habere",
        "facere",
        "dicere",
        "accipere",
        "facere",
        "ire",
        "scire",
        "capere",
        "videre",
        "venire",
        "cogitare",
        "spectare",
        "velle",
        "dare",
        "uti",
        "invenire",
        "narrare",
        "rogare",
        "laborare",
        "videri",
        "sentire",
        "conari",
        "relinquere",
        "vocare",
        "bonus",
        "novus",
        "primus",
        "ultimus",
        "longus",
        "magnus",
        "parvus",
        "proprius",
        "alius",
        "vetus",
        "rectus",
        "magnus",
        "altus",
        "diversus",
        "parvus",
        "grandis",
        "proximus",
        "maturus",
        "iuvenis",
        "gravis",
        "pauci",
        "publicus",
        "malus",
        "idem",
        "potens",
        "et",
        "ad",
        "de",
        "in",
        "est",
        "tu",
        "ille",
        "is",
        "ille",
        "erat",
        "pro",
        "in",
        "sunt",
        "ut",
        "cum",
        "suus",
        "illi",
        "apud",
        "esse",
        "hic",
        "ab",
        "aut",
        "unus",
        "habebat",
        "per",
        "verbum",
        "sed",
        "non",
        "quid",
        "omnis",
        "erant",
        "quando",
        "tuus",
        "posse",
        "dixit",
        "ibi",
        "uti",
        "quisque",
        "qui",
        "ea",
        "quomodo",
        "eorum",
        "voluntas",
        "sur sum",
        "ex",
        "circa",
        "multi",
        "tum",
        "eos",
        "hi",
        "ita",
        "aliquis",
        "eius",
        "vellet",
        "facere",
        "amare",
        "eum",
        "in",
        "tempus",
        "habet",
        "spectare",
        "duo",
        "plus",
        "scribere",
        "ire",
        "videre",
        "numerus",
        "non",
        "via",
        "posset",
        "populus",
        "meus",
        "quam",
        "primus",
        "aqua",
        "fuit",
        "vocare",
        "quis",
        "oleum",
        "eius",
        "nunc",
        "invenire",
        "longus",
        "deorsum",
        "dies",
        "fecit",
        "accipere",
        "venire",
        "factus",
        "posse",
        "pars",
    ],
    "fr": [  # 法语
        "bonjour",
        "monde",
        "livre",
        "temps",
        "personne",
        "année",
        "jour",
        "chose",
        "homme",
        "femme",
        "enfant",
        "école",
        "vie",
        "œil",
        "main",
        "partie",
        "lieu",
        "travail",
        "semaine",
        "cas",
        "point",
        "gouvernement",
        "entreprise",
        "nombre",
        "groupe",
        "problème",
        "fait",
        "être",
        "avoir",
        "faire",
        "dire",
        "obtenir",
        "faire",
        "aller",
        "savoir",
        "prendre",
        "voir",
        "venir",
        "penser",
        "regarder",
        "vouloir",
        "donner",
        "utiliser",
        "trouver",
        "dire",
        "demander",
        "travailler",
        "sembler",
        "sentir",
        "essayer",
        "quitter",
        "appeler",
    ],
    "es": [  # 西班牙语
        "hola",
        "mundo",
        "libro",
        "tiempo",
        "persona",
        "año",
        "día",
        "cosa",
        "hombre",
        "mujer",
        "niño",
        "escuela",
        "vida",
        "ojo",
        "mano",
        "parte",
        "lugar",
        "trabajo",
        "semana",
        "caso",
        "punto",
        "gobierno",
        "empresa",
        "número",
        "grupo",
        "problema",
        "hecho",
        "ser",
        "tener",
        "hacer",
        "decir",
        "obtener",
        "hacer",
        "ir",
        "saber",
        "tomar",
        "ver",
        "venir",
        "pensar",
        "mirar",
        "querer",
        "dar",
        "usar",
        "encontrar",
        "decir",
        "preguntar",
        "trabajar",
        "parecer",
        "sentir",
        "intentar",
        "dejar",
        "llamar",
    ],
    "zh": [  # 中文
        "你好",
        "世界",
        "书",
        "时间",
        "人",
        "年",
        "日",
        "东西",
        "男人",
        "女人",
        "孩子",
        "学校",
        "生活",
        "眼睛",
        "手",
        "部分",
        "地方",
        "工作",
        "星期",
        "情况",
        "点",
        "政府",
        "公司",
        "数字",
        "组",
        "问题",
        "事实",
        "是",
        "有",
        "做",
        "说",
        "得到",
        "做",
        "去",
        "知道",
        "拿",
        "看",
        "来",
        "想",
        "看",
        "想要",
        "给",
        "用",
        "找到",
        "告诉",
        "问",
        "工作",
        "似乎",
        "感觉",
        "尝试",
        "离开",
        "叫",
    ],
}


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="从SQLite词典数据库提取测试数据",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --language de                     # 提取德语测试数据
  %(prog)s -l la                             # 提取拉丁语测试数据
  %(prog)s -l en --words "hello,world,book"  # 使用自定义测试词
  %(prog)s -l fr --words-file words.txt      # 从文件读取测试词
  %(prog)s --db-path custom/dict.db -l xx    # 自定义数据库路径
  %(prog)s -l de --output my-test-data.json  # 自定义输出文件
  %(prog)s -l de --count 50                  # 随机提取50个词
        """,
    )

    parser.add_argument(
        "--language", "-l", type=str, default="de", help="语言代码 (默认: de)"
    )

    parser.add_argument(
        "--db-path",
        type=str,
        help="SQLite数据库文件路径 (默认: dict/{language}/{language}_dict.db)",
    )

    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="public/test-dictionary-data.json",
        help="输出JSON文件路径 (默认: public/test-dictionary-data.json)",
    )

    parser.add_argument("--words", "-w", type=str, help="以逗号分隔的测试词列表")

    parser.add_argument(
        "--words-file", type=str, help="包含测试词列表的文件 (每行一个词)"
    )

    parser.add_argument(
        "--count",
        "-c",
        type=int,
        default=0,
        help="如果没有提供测试词，从数据库随机抽取的词数 (0表示使用默认测试词)",
    )

    parser.add_argument(
        "--no-browser-script", action="store_true", help="不生成浏览器导入脚本"
    )

    parser.add_argument("--verbose", "-v", action="store_true", help="显示详细输出")

    return parser.parse_args()


def get_test_words(args, db_cursor=None):
    """获取测试词列表"""
    # 1. 如果指定了--words参数
    if args.words:
        return [word.strip() for word in args.words.split(",")]

    # 2. 如果指定了--words-file参数
    if args.words_file:
        if not os.path.exists(args.words_file):
            print(f"警告: 测试词文件不存在: {args.words_file}")
        else:
            with open(args.words_file, "r", encoding="utf-8") as f:
                words = [line.strip() for line in f if line.strip()]
                if words:
                    return words

    # 3. 如果指定了--count参数且大于0，从数据库随机抽取
    if args.count > 0 and db_cursor:
        try:
            db_cursor.execute(
                "SELECT word FROM dictionary ORDER BY RANDOM() LIMIT ?", (args.count,)
            )
            random_words = [row[0] for row in db_cursor.fetchall()]
            if random_words:
                print(f"从数据库随机抽取 {len(random_words)} 个词")
                return random_words
        except Exception as e:
            print(f"警告: 无法从数据库随机抽取词: {e}")

    # 4. 使用默认测试词列表
    language = args.language.lower()
    if language in DEFAULT_TEST_WORDS:
        return DEFAULT_TEST_WORDS[language]

    # 5. 如果没有对应语言的默认列表，尝试使用通用测试词
    print(f"警告: 没有语言 '{language}' 的默认测试词列表")

    # 尝试从数据库获取一些常用词
    if db_cursor:
        try:
            db_cursor.execute("SELECT word FROM dictionary ORDER BY RANDOM() LIMIT 20")
            fallback_words = [row[0] for row in db_cursor.fetchall()]
            if fallback_words:
                print(f"使用数据库中的 {len(fallback_words)} 个随机词")
                return fallback_words
        except Exception as e:
            print(f"警告: 无法从数据库获取随机词: {e}")

    # 6. 最后的备用词列表
    return ["test", "example", "word", "hello", "world"]


def get_database_path(args):
    """获取数据库文件路径"""
    if args.db_path:
        return args.db_path

    # 默认路径: dict/{language}/{language}_dict.db
    language = args.language.lower()
    db_name = f"{language}_dict.db"
    return os.path.join("dict", language.capitalize(), db_name)


def extract_test_data(args):
    """从SQLite数据库提取测试数据"""
    # 获取数据库路径
    db_path = get_database_path(args)

    if not os.path.exists(db_path):
        print(f"错误: 数据库文件不存在: {db_path}")
        print("请先运行 convert_jsonl_to_sqlite.py 创建SQLite数据库")
        print(
            f"示例: python convert_jsonl_to_sqlite.py kaikki.org-dictionary-{args.language.capitalize()}.jsonl {args.language.capitalize()}"
        )
        return None

    # 连接到数据库
    if args.verbose:
        print(f"连接数据库: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 获取测试词列表
    test_words = get_test_words(args, cursor)

    if args.verbose:
        print(f"使用 {len(test_words)} 个测试词")
        if len(test_words) <= 20:
            print(f"测试词: {', '.join(test_words)}")

    # 提取数据
    extracted_data = []
    found_count = 0

    for word in test_words:
        try:
            cursor.execute(
                """
                SELECT d.*, 
                       GROUP_CONCAT(s.gloss, '|') as glosses,
                       GROUP_CONCAT(s.example, '|') as examples
                FROM dictionary d
                LEFT JOIN senses s ON d.id = s.dictionary_id
                WHERE d.word = ? COLLATE NOCASE
                GROUP BY d.id
                LIMIT 1
                """,
                (word,),
            )

            row = cursor.fetchone()
            if row:
                entry = dict(row)

                # 构建数据格式
                data_entry = {
                    "word": entry["word"],
                    "lang_code": entry.get("lang_code") or args.language,
                    "pos": entry.get("pos") or "",
                    "etymology_text": entry.get("etymology_text") or "",
                    "pronunciation": entry.get("pronunciation") or "",
                    "synonyms": json.loads(synonyms)
                    if (synonyms := entry.get("synonyms")) and synonyms != "null"
                    else [],
                    "antonyms": json.loads(antonyms)
                    if (antonyms := entry.get("antonyms")) and antonyms != "null"
                    else [],
                    "senses": [],
                }

                # 处理词义
                if entry["glosses"] and entry["glosses"] != "null":
                    glosses = entry["glosses"].split("|")
                    examples = entry["examples"].split("|") if entry["examples"] else []

                    for i, gloss in enumerate(glosses):
                        if gloss and gloss != "null":
                            sense = {
                                "gloss": gloss,
                                "example": examples[i]
                                if i < len(examples) and examples[i] != "null"
                                else "",
                            }
                            data_entry["senses"].append(sense)

                extracted_data.append(data_entry)
                found_count += 1
                if args.verbose:
                    print(
                        f"✓ 提取: {word} ({entry['pos']}) - {len(data_entry['senses'])} 词义"
                    )
            else:
                if args.verbose:
                    print(f"✗ 未找到: {word}")
        except Exception as e:
            print(f"错误: 处理词 '{word}' 时出错: {e}")

    # 保存到文件
    output_file = args.output
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(extracted_data, f, ensure_ascii=False, indent=2)

    print(f"\n提取完成!")
    print(f"数据库: {db_path}")
    print(f"测试词总数: {len(test_words)}")
    print(f"成功提取: {found_count} 个词条")
    print(f"输出文件: {output_file}")

    # 显示示例
    if extracted_data:
        print("\n示例数据:")
        for i, entry in enumerate(extracted_data[:5]):
            print(f"{i + 1}. {entry['word']} ({entry['pos']})")
            if entry["senses"]:
                gloss_preview = entry["senses"][0]["gloss"]
                if len(gloss_preview) > 80:
                    gloss_preview = gloss_preview[:77] + "..."
                print(f"   词义: {gloss_preview}")

    conn.close()

    # 生成浏览器导入脚本
    if not args.no_browser_script and extracted_data:
        generate_browser_script(extracted_data, args.language, args.output)

    return extracted_data


def generate_browser_script(data, language_code, output_file):
    """生成浏览器端导入脚本"""
    language_name = {
        "de": "German",
        "en": "English",
        "la": "Latin",
        "fr": "French",
        "es": "Spanish",
        "zh": "Chinese",
    }.get(language_code, language_code.capitalize())

    # 确定脚本文件路径
    script_file = os.path.join("src", "utils", "dictionaryTestImporter.ts")
    if language_code != "de":  # 如果不是德语，创建语言特定的文件
        script_file = os.path.join(
            "src", "utils", f"dictionaryTestImporter_{language_code}.ts"
        )

    # 选择一些测试词用于验证
    test_words_for_validation = []
    for entry in data[:5]:
        if entry["word"]:
            test_words_for_validation.append(entry["word"])

    if not test_words_for_validation:
        test_words_for_validation = ["test", "example"]

    script_content = f"""
/**
 * 浏览器端测试词典数据导入 - {language_name}
 * 生成自: {output_file}
 */

import {{ browserDictionaryService }} from '../services/browserDictionaryService';

// 测试数据
const TEST_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};

/**
 * 导入测试数据到IndexedDB
 */
export async function importTestDictionaryData() {{
  try {{
    console.log('开始导入{language_name}测试词典数据...');
    
    // 清空现有数据
    await browserDictionaryService.clearDatabase();
    
    // 导入测试数据
    const success = await browserDictionaryService.importData(TEST_DATA);
    
    if (success) {{
      console.log(`成功导入 ${{TEST_DATA.length}} 个{language_name}测试词条`);
      
      // 验证导入
      const testWords = {json.dumps(test_words_for_validation)};
      for (const word of testWords) {{
        const result = await browserDictionaryService.queryDictionary(word, {{ 
          id: '{language_code}', 
          name: '{language_name}' 
        }});
        if (result.success && result.entries.length > 0) {{
          console.log(`✓ "${{word}}" 查询成功`);
        }} else {{
          console.log(`✗ "${{word}}" 未找到`);
        }}
      }}
      
      return true;
    }} else {{
      console.error('导入测试数据失败');
      return false;
    }}
    
  }} catch (error) {{
    console.error('导入测试词典数据失败:', error);
    return false;
  }}
}}

/**
 * 检查是否需要导入数据
 */
export async function checkAndImportDictionaryData() {{
  try {{
    // 检查当前有多少词条
    const wordCount = await browserDictionaryService.getWordCount('{language_code}');
    
    if (wordCount < 10) {{  // 如果词条太少，导入测试数据
      console.log(`{language_name}词典只有 ${{wordCount}} 个词条，导入测试数据...`);
      return await importTestDictionaryData();
    }} else {{
      console.log(`{language_name}词典已有 ${{wordCount}} 个词条，跳过导入`);
      return true;
    }}
    
  }} catch (error) {{
    console.error('检查词典数据失败:', error);
    return false;
  }}
}}
"""

    os.makedirs(os.path.dirname(script_file), exist_ok=True)

    with open(script_file, "w", encoding="utf-8") as f:
        f.write(script_content)

    print(f"\n已生成浏览器导入脚本: {script_file}")
    print(f"语言: {language_name} ({language_code})")


def main():
    """主函数"""
    args = parse_arguments()

    print(f"提取 {args.language} 词典测试数据")
    print("=" * 50)

    data = extract_test_data(args)

    if data:
        print("\n" + "=" * 50)
        print("完成!")
        print(f"使用以下命令测试导入:")
        print(f"  npm run dev")
        print(f"然后在浏览器控制台运行:")
        print(f"  importTestDictionaryData()")
        if args.language != "de":
            print(f"  (或导入 {args.language} 版本的函数)")
    else:
        print("\n提取失败!")
        sys.exit(1)


if __name__ == "__main__":
    main()
