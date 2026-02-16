#!/usr/bin/env python3
"""
从SQLite数据库提取测试数据用于浏览器词典
"""

import sqlite3
import json
import os


def extract_test_data():
    # 数据库路径
    db_path = os.path.join("dict", "German", "german_dict.db")

    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        print("请先运行 convert_jsonl_to_sqlite.py 创建SQLite数据库")
        return

    # 连接到数据库
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 测试用的单词列表
    test_words = [
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
    ]

    # 提取数据
    extracted_data = []

    for word in test_words:
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
                "lang_code": entry["lang_code"] or "de",
                "pos": entry["pos"] or "",
                "etymology_text": entry["etymology_text"] or "",
                "pronunciation": entry["pronunciation"] or "",
                "synonyms": json.loads(entry["synonyms"]) if entry["synonyms"] else [],
                "antonyms": json.loads(entry["antonyms"]) if entry["antonyms"] else [],
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
            print(f"✓ 提取: {word} ({entry['pos']}) - {len(data_entry['senses'])} 词义")
        else:
            print(f"✗ 未找到: {word}")

    # 保存到文件
    output_file = os.path.join("public", "test-dictionary-data.json")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(extracted_data, f, ensure_ascii=False, indent=2)

    print(f"\n已提取 {len(extracted_data)} 个词条到 {output_file}")

    # 显示示例
    print("\n示例数据:")
    for i, entry in enumerate(extracted_data[:5]):
        print(f"{i + 1}. {entry['word']} ({entry['pos']})")
        if entry["senses"]:
            print(f"   词义: {entry['senses'][0]['gloss'][:100]}...")

    conn.close()

    # 生成浏览器导入脚本
    generate_browser_script(extracted_data)


def generate_browser_script(data):
    """生成浏览器端导入脚本"""
    script_content = (
        """
/**
 * 浏览器端测试词典数据导入
 */

import { browserDictionaryService } from '../services/browserDictionaryService';

// 测试数据
const TEST_DATA = """
        + json.dumps(data, ensure_ascii=False, indent=2)
        + """;

/**
 * 导入测试数据到IndexedDB
 */
export async function importTestDictionaryData() {
  try {
    console.log('开始导入测试词典数据...');
    
    // 清空现有数据
    await browserDictionaryService.clearDatabase();
    
    // 导入测试数据
    const success = await browserDictionaryService.importData(TEST_DATA);
    
    if (success) {
      console.log(`成功导入 ${TEST_DATA.length} 个测试词条`);
      
      // 验证导入
      const testWords = ['allein', 'Geschichte', 'Kommunikation', 'bequem', 'Haus'];
      for (const word of testWords) {
        const result = await browserDictionaryService.queryDictionary(word, { 
          id: 'de', 
          name: 'German' 
        });
        if (result.success && result.entries.length > 0) {
          console.log(`✓ "${word}" 查询成功`);
        } else {
          console.log(`✗ "${word}" 未找到`);
        }
      }
      
      return true;
    } else {
      console.error('导入测试数据失败');
      return false;
    }
    
  } catch (error) {
    console.error('导入测试词典数据失败:', error);
    return false;
  }
}

/**
 * 检查是否需要导入数据
 */
export async function checkAndImportDictionaryData() {
  try {
    // 检查当前有多少词条
    const wordCount = await browserDictionaryService.getWordCount('de');
    
    if (wordCount < 10) {  // 如果词条太少，导入测试数据
      console.log(`词典只有 ${wordCount} 个词条，导入测试数据...`);
      return await importTestDictionaryData();
    } else {
      console.log(`词典已有 ${wordCount} 个词条，跳过导入`);
      return true;
    }
    
  } catch (error) {
    console.error('检查词典数据失败:', error);
    return false;
  }
}
"""
    )

    script_file = os.path.join("src", "utils", "dictionaryTestImporter.ts")
    os.makedirs(os.path.dirname(script_file), exist_ok=True)

    with open(script_file, "w", encoding="utf-8") as f:
        f.write(script_content)

    print(f"\n已生成浏览器导入脚本: {script_file}")


if __name__ == "__main__":
    extract_test_data()
