/**
 * 从SQLite数据库提取测试数据用于浏览器词典
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 数据库路径
const DB_PATH = path.join(__dirname, '..', 'dict', 'German', 'german_dict.db');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'test-dictionary-data.json');

// 测试用的单词列表
const TEST_WORDS = [
  'allein', 'Geschichte', 'Kommunikation', 'Haus', 'Buch',
  'Auto', 'Computer', 'Wasser', 'bequem', 'gut', 'schön',
  'Freund', 'Arbeit', 'Zeit', 'Mensch', 'Kind', 'Tag',
  'Nacht', 'Jahr', 'Monat', 'Woche', 'Stunde', 'Minute',
  'Sekunde', 'Land', 'Stadt', 'Dorf', 'Straße', 'Platz',
  'Garten', 'Zimmer', 'Fenster', 'Tür', 'Tisch', 'Stuhl',
  'Bett', 'Lampe', 'Bild', 'Buch', 'Zeitung', 'Zeitschrift',
  'Fernsehen', 'Radio', 'Telefon', 'Handy', 'Internet',
  'Computer', 'Programm', 'Software', 'Hardware', 'Daten',
  'Information', 'Wissen', 'Lernen', 'Lehren', 'Schule',
  'Universität', 'Studium', 'Prüfung', 'Note', 'Lehrer',
  'Professor', 'Student', 'Schüler', 'Klasse', 'Unterricht',
  'Büro', 'Fabrik', 'Geschäft', 'Markt', 'Kaufhaus',
  'Restaurant', 'Hotel', 'Krankenhaus', 'Polizei', 'Feuerwehr'
];

function extractTestData() {
  console.log(`从SQLite数据库提取测试数据: ${DB_PATH}`);
  
  if (!fs.existsSync(DB_PATH)) {
    console.error(`SQLite数据库文件不存在: ${DB_PATH}`);
    console.log('请先运行 convert_jsonl_to_sqlite.py 创建SQLite数据库');
    process.exit(1);
  }

  // 打开数据库
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('打开数据库失败:', err.message);
      process.exit(1);
    }
  });

  const extractedData = [];
  let processed = 0;
  
  // 对每个测试单词提取数据
  function processNextWord(index) {
    if (index >= TEST_WORDS.length) {
      // 所有单词处理完成
      db.close();
      saveData(extractedData);
      return;
    }
    
    const word = TEST_WORDS[index];
    
    db.get(`
      SELECT d.*, 
             GROUP_CONCAT(s.gloss, '|') as glosses,
             GROUP_CONCAT(s.example, '|') as examples
      FROM dictionary d
      LEFT JOIN senses s ON d.id = s.dictionary_id
      WHERE LOWER(d.word) = LOWER(?)
      GROUP BY d.id
      LIMIT 1
    `, [word], (err, row) => {
      if (err) {
        console.error(`查询单词 "${word}" 失败:`, err.message);
        processNextWord(index + 1);
        return;
      }
      
      if (row) {
        const entry = {
          word: row.word,
          lang_code: row.lang_code || 'de',
          pos: row.pos || '',
          etymology_text: row.etymology_text || '',
          pronunciation: row.pronunciation || '',
          synonyms: row.synonyms ? JSON.parse(row.synonyms) : [],
          antonyms: row.antonyms ? JSON.parse(row.antonyms) : [],
          senses: []
        };
        
        // 处理词义
        if (row.glosses && row.glosses !== 'null') {
          const glosses = row.glosses.split('|');
          const examples = row.examples ? row.examples.split('|') : [];
          
          for (let i = 0; i < glosses.length; i++) {
            if (glosses[i] && glosses[i] !== 'null') {
              entry.senses.push({
                gloss: glosses[i],
                example: examples[i] && examples[i] !== 'null' ? examples[i] : ''
              });
            }
          }
        }
        
        extractedData.push(entry);
        console.log(`✓ 提取: ${word} (${row.pos || 'unknown'}) - ${entry.senses.length} 词义`);
      } else {
        console.log(`✗ 未找到: ${word}`);
      }
      
      processed++;
      processNextWord(index + 1);
    });
  }
  
  // 开始处理
  console.log(`开始提取 ${TEST_WORDS.length} 个测试单词...`);
  processNextWord(0);
}

function saveData(data) {
  console.log(`\n提取完成，共 ${data.length} 个词条`);
  
  // 保存到JSON文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`已保存到: ${OUTPUT_FILE}`);
  
  // 显示示例
  console.log('\n示例数据:');
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const entry = data[i];
    console.log(`${i + 1}. ${entry.word} (${entry.pos})`);
    if (entry.senses.length > 0) {
      console.log(`   词义: ${entry.senses[0].gloss.substring(0, 100)}...`);
    }
  }
  
  // 生成浏览器导入脚本
  generateBrowserScript(data);
}

function generateBrowserScript(data) {
  const scriptContent = `
/**
 * 浏览器端测试词典数据导入
 */

import { browserDictionaryService } from '../services/browserDictionaryService';

// 测试数据
const TEST_DATA = ${JSON.stringify(data, null, 2)};

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
      console.log(\`成功导入 \${TEST_DATA.length} 个测试词条\`);
      
      // 验证导入
      const testWords = ['allein', 'Geschichte', 'Kommunikation', 'bequem', 'Haus'];
      for (const word of testWords) {
        const result = await browserDictionaryService.queryDictionary(word, { 
          id: 'de', 
          name: 'German' 
        });
        if (result.success && result.entries.length > 0) {
          console.log(\`✓ "\${word}" 查询成功\`);
        } else {
          console.log(\`✗ "\${word}" 未找到\`);
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
      console.log(\`词典只有 \${wordCount} 个词条，导入测试数据...\`);
      return await importTestDictionaryData();
    } else {
      console.log(\`词典已有 \${wordCount} 个词条，跳过导入\`);
      return true;
    }
    
  } catch (error) {
    console.error('检查词典数据失败:', error);
    return false;
  }
}
`;
  
  const scriptFile = path.join(__dirname, '..', 'src', 'utils', 'dictionaryTestImporter.ts');
  fs.writeFileSync(scriptFile, scriptContent, 'utf8');
  console.log(`\n已生成浏览器导入脚本: ${scriptFile}`);
}

// 运行主函数
extractTestData();