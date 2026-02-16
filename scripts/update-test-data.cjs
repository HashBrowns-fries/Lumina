/**
 * 更新测试数据，添加更多常见德语单词
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 数据库路径
const DB_PATH = path.join(__dirname, '..', 'dict', 'German', 'german_dict.db');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'test-dictionary-data.json');

// 扩展的测试单词列表 - 包含更多常见德语单词
const EXTENDED_TEST_WORDS = [
  // 原有单词
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
  'Restaurant', 'Hotel', 'Krankenhaus', 'Polizei', 'Feuerwehr',
  
  // 新增常见单词
  'Zukunft', 'fand', 'noch', 'schon', 'sehr', 'auch', 'immer', 'wieder', 'dann', 'jetzt',
  'sein', 'haben', 'werden', 'können', 
  'müssen', 'sagen', 'machen', 'gehen', 'kommen', 'sehen',
  'geben', 'bleiben', 'heißen', 'finden', 'denken', 'wissen',
  'lassen', 'stehen', 'liegen', 'leben', 'heißen', 'lieben',
  'glauben', 'wollen', 'brauchen', 'fühlen', 'halten', 'bitten',
  'danken', 'helfen', 'hoffen', 'lachen', 'reden', 'schreiben',
  'lesen', 'hören', 'spielen', 'arbeiten', 'essen', 'trinken',
  'schlafen', 'wachsen', 'sterben', 'gewinnen', 'verlieren',
  'kaufen', 'verkaufen', 'bauen', 'reisen', 'studieren',
  'lehren', 'lernen', 'unterrichten', 'verstehen', 'erklären',
  'zeigen', 'suchen', 'finden', 'verlieren', 'vergessen',
  'erinnern', 'entscheiden', 'wählen', 'gewinnen', 'verlieren',
  
  // 更多名词
  'Mutter', 'Vater', 'Bruder', 'Schwester', 'Familie',
  'Freundin', 'Kollege', 'Nachbar', 'Bürger', 'Menschheit',
  'Natur', 'Umwelt', 'Welt', 'Universum', 'Sonne', 'Mond',
  'Stern', 'Erde', 'Luft', 'Feuer', 'Wasser', 'Eis', 'Schnee',
  'Regen', 'Wolke', 'Wind', 'Sturm', 'Donner', 'Blitz',
  'Temperatur', 'Jahreszeit', 'Frühling', 'Sommer', 'Herbst',
  'Winter', 'Tag', 'Morgen', 'Abend', 'Nacht', 'Dämmerung',
  'Zeit', 'Uhr', 'Stunde', 'Minute', 'Sekunde', 'Jahrhundert',
  
  // 形容词
  'groß', 'klein', 'alt', 'neu', 'jung', 'alt', 'schön',
  'hässlich', 'gut', 'schlecht', 'richtig', 'falsch', 'wahr',
  'falsch', 'leicht', 'schwer', 'schnell', 'langsam', 'heiß',
  'kalt', 'warm', 'kühl', 'trocken', 'nass', 'hart', 'weich',
  'stark', 'schwach', 'reich', 'arm', 'glücklich', 'traurig',
  'fröhlich', 'wütend', 'ruhig', 'laut', 'leise', 'hell',
  'dunkel', 'klar', 'undeutlich', 'einfach', 'kompliziert',
  
  // 用户测试过的单词
  'bequem', 'fand', 'Zukunft'
];

function updateTestData() {
  console.log(`从SQLite数据库提取扩展测试数据: ${DB_PATH}`);
  
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
    if (index >= EXTENDED_TEST_WORDS.length) {
      // 所有单词处理完成
      db.close();
      saveData(extractedData);
      return;
    }
    
    const word = EXTENDED_TEST_WORDS[index];
    
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
  console.log(`开始提取 ${EXTENDED_TEST_WORDS.length} 个测试单词...`);
  processNextWord(0);
}

function saveData(data) {
  console.log(`\n提取完成，共 ${data.length} 个词条`);
  
  // 保存到JSON文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`已保存到: ${OUTPUT_FILE}`);
  
  // 显示统计
  console.log('\n=== 统计信息 ===');
  console.log(`总词条数: ${data.length}`);
  
  // 按词性分类统计
  const posStats = {};
  data.forEach(entry => {
    const pos = entry.pos || 'unknown';
    posStats[pos] = (posStats[pos] || 0) + 1;
  });
  
  console.log('\n词性分布:');
  Object.entries(posStats).forEach(([pos, count]) => {
    console.log(`  ${pos}: ${count}`);
  });
  
  // 显示示例
  console.log('\n=== 示例数据 ===');
  const sampleWords = ['Zukunft', 'fand', 'bequem', 'sein', 'haben'];
  sampleWords.forEach(word => {
    const entry = data.find(e => e.word === word);
    if (entry) {
      console.log(`${word} (${entry.pos}):`);
      if (entry.senses.length > 0) {
        console.log(`  ${entry.senses[0].gloss.substring(0, 100)}...`);
      }
    }
  });
}

// 运行主函数
updateTestData();