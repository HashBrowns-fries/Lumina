/**
 * 从SQLite数据库导入数据到IndexedDB
 * 用于浏览器环境使用本地词典数据
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 配置
const SQLITE_DB_PATH = path.join(__dirname, '..', 'dict', 'German', 'german_dict.db');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'dictionary-data.json');

/**
 * 从SQLite数据库提取词典数据
 */
function extractDataFromSQLite() {
  console.log(`从SQLite数据库提取数据: ${SQLITE_DB_PATH}`);
  
  if (!fs.existsSync(SQLITE_DB_PATH)) {
    console.error(`SQLite数据库文件不存在: ${SQLITE_DB_PATH}`);
    console.log('请先运行 convert_jsonl_to_sqlite.py 创建SQLite数据库');
    process.exit(1);
  }

  const db = new Database(SQLITE_DB_PATH, { readonly: true });
  
  try {
    // 获取总词条数
    const totalEntries = db.prepare('SELECT COUNT(*) as count FROM dictionary').get().count;
    console.log(`总词条数: ${totalEntries.toLocaleString()}`);
    
    // 获取总词义数
    const totalSenses = db.prepare('SELECT COUNT(*) as count FROM senses').get().count;
    console.log(`总词义数: ${totalSenses.toLocaleString()}`);
    
    // 分批提取数据（避免内存溢出）
    const BATCH_SIZE = 10000;
    const totalBatches = Math.ceil(totalEntries / BATCH_SIZE);
    
    console.log(`开始提取数据，共 ${totalBatches} 批，每批 ${BATCH_SIZE} 个词条...`);
    
    const allData = [];
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const offset = batch * BATCH_SIZE;
      
      // 查询词条
      const entries = db.prepare(`
        SELECT d.*, 
               GROUP_CONCAT(s.gloss, '|') as glosses,
               GROUP_CONCAT(s.example, '|') as examples
        FROM dictionary d
        LEFT JOIN senses s ON d.id = s.dictionary_id
        GROUP BY d.id
        LIMIT ? OFFSET ?
      `).all(BATCH_SIZE, offset);
      
      // 转换格式为IndexedDB可导入的格式
      for (const entry of entries) {
        const dataEntry = {
          word: entry.word,
          lang_code: entry.lang_code || 'de',
          pos: entry.pos || '',
          etymology_text: entry.etymology_text || '',
          pronunciation: entry.pronunciation || '',
          synonyms: entry.synonyms ? JSON.parse(entry.synonyms) : [],
          antonyms: entry.antonyms ? JSON.parse(entry.antonyms) : [],
          senses: []
        };
        
        // 处理词义
        if (entry.glosses && entry.glosses !== 'null') {
          const glosses = entry.glosses.split('|');
          const examples = entry.examples ? entry.examples.split('|') : [];
          
          for (let i = 0; i < glosses.length; i++) {
            if (glosses[i] && glosses[i] !== 'null') {
              dataEntry.senses.push({
                gloss: glosses[i],
                example: examples[i] && examples[i] !== 'null' ? examples[i] : ''
              });
            }
          }
        }
        
        allData.push(dataEntry);
      }
      
      console.log(`提取进度: ${Math.min(offset + BATCH_SIZE, totalEntries).toLocaleString()}/${totalEntries.toLocaleString()} 词条`);
      
      // 每批保存一次，避免内存占用过高
      if (batch % 10 === 0 || batch === totalBatches - 1) {
        console.log(`当前内存使用: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      }
    }
    
    console.log(`数据提取完成，共 ${allData.length.toLocaleString()} 个词条`);
    
    // 保存到JSON文件
    console.log(`保存到文件: ${OUTPUT_FILE}`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2));
    console.log(`文件保存完成，大小: ${Math.round(fs.statSync(OUTPUT_FILE).size / 1024 / 1024)}MB`);
    
    // 生成统计信息
    const totalWords = allData.length;
    const totalSensesInData = allData.reduce((sum, entry) => sum + entry.senses.length, 0);
    
    console.log('\n=== 统计信息 ===');
    console.log(`词条总数: ${totalWords.toLocaleString()}`);
    console.log(`词义总数: ${totalSensesInData.toLocaleString()}`);
    console.log(`平均每个词条词义数: ${(totalSensesInData / totalWords).toFixed(2)}`);
    
    // 示例数据
    console.log('\n=== 示例数据（前5个词条）===');
    for (let i = 0; i < Math.min(5, allData.length); i++) {
      const entry = allData[i];
      console.log(`${i + 1}. ${entry.word} (${entry.pos}) - ${entry.senses.length} 个词义`);
      if (entry.senses.length > 0) {
        console.log(`   示例词义: ${entry.senses[0].gloss.substring(0, 100)}...`);
      }
    }
    
    return allData.length;
    
  } finally {
    db.close();
  }
}

/**
 * 生成浏览器导入脚本
 */
function generateBrowserImportScript() {
  const scriptContent = `
/**
 * 浏览器端词典数据导入脚本
 * 将SQLite数据导入到IndexedDB
 */

import { browserDictionaryService } from '../services/browserDictionaryService';

// 导入词典数据
async function importDictionaryData() {
  try {
    console.log('开始导入词典数据到IndexedDB...');
    
    // 从服务器加载数据
    const response = await fetch('/dictionary-data.json');
    if (!response.ok) {
      throw new Error(\`加载数据失败: \${response.status}\`);
    }
    
    const data = await response.json();
    console.log(\`加载了 \${data.length.toLocaleString()} 个词条\`);
    
    // 清空现有数据
    await browserDictionaryService.clearDatabase();
    
    // 分批导入数据（避免IndexedDB事务过大）
    const BATCH_SIZE = 5000;
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);
    
    let importedCount = 0;
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, data.length);
      const batchData = data.slice(start, end);
      
      const success = await browserDictionaryService.importData(batchData);
      
      if (success) {
        importedCount += batchData.length;
        console.log(\`导入进度: \${importedCount.toLocaleString()}/\${data.length.toLocaleString()} (\${Math.round((importedCount / data.length) * 100)}%)\`);
      } else {
        console.error(\`第 \${batch + 1} 批导入失败\`);
        break;
      }
    }
    
    if (importedCount === data.length) {
      console.log('词典数据导入完成！');
      
      // 测试导入的数据
      const testWords = ['allein', 'Geschichte', 'Kommunikation', 'Haus', 'Buch'];
      for (const word of testWords) {
        const result = await browserDictionaryService.queryDictionary(word, { 
          id: 'de', 
          name: 'German' 
        });
        if (result.success && result.entries.length > 0) {
          console.log(\`✓ "\${word}" 查询成功: \${result.entries[0].definitions[0].substring(0, 50)}...\`);
        } else {
          console.log(\`✗ "\${word}" 未找到\`);
        }
      }
      
      return true;
    } else {
      console.error(\`导入不完整: \${importedCount}/\${data.length}\`);
      return false;
    }
    
  } catch (error) {
    console.error('导入词典数据失败:', error);
    return false;
  }
}

// 自动导入（开发环境）
if (process.env.NODE_ENV === 'development') {
  importDictionaryData().then(success => {
    if (success) {
      console.log('开发环境词典数据导入完成');
    } else {
      console.warn('开发环境词典数据导入失败，将使用空词典');
    }
  });
}

export { importDictionaryData };
`;

  const scriptPath = path.join(__dirname, '..', 'src', 'utils', 'dictionaryImporter.ts');
  console.log(`生成浏览器导入脚本: ${scriptPath}`);
  fs.writeFileSync(scriptPath, scriptContent);
  console.log('浏览器导入脚本生成完成');
}

/**
 * 生成HTML页面用于手动导入
 */
function generateImportPage() {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luminous Lute - Dictionary Import</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    
    .container {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 30px;
      margin-top: 20px;
    }
    
    h1 {
      color: #333;
      border-bottom: 2px solid #4CAF50;
      padding-bottom: 10px;
    }
    
    .status {
      margin: 20px 0;
      padding: 15px;
      border-radius: 4px;
      display: none;
    }
    
    .status.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
      display: block;
    }
    
    .status.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      display: block;
    }
    
    .status.info {
      background: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
      display: block;
    }
    
    .progress {
      width: 100%;
      height: 20px;
      background: #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      margin: 20px 0;
    }
    
    .progress-bar {
      height: 100%;
      background: #4CAF50;
      width: 0%;
      transition: width 0.3s;
    }
    
    button {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      margin-right: 10px;
    }
    
    button:hover {
      background: #45a049;
    }
    
    button:disabled {
      background: #cccccc;
      cursor: not-allowed;
    }
    
    .stats {
      background: white;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
      border-left: 4px solid #4CAF50;
    }
    
    .test-results {
      margin-top: 20px;
    }
    
    .test-item {
      padding: 10px;
      margin: 5px 0;
      background: white;
      border-radius: 4px;
    }
    
    .test-item.success {
      border-left: 4px solid #4CAF50;
    }
    
    .test-item.error {
      border-left: 4px solid #f44336;
    }
  </style>
</head>
<body>
  <h1>Luminous Lute - Dictionary Import</h1>
  
  <div class="container">
    <p>This page allows you to import German dictionary data into your browser's IndexedDB for offline use.</p>
    
    <div class="stats">
      <h3>Dictionary Information</h3>
      <p><strong>Language:</strong> German (de)</p>
      <p><strong>Total words:</strong> <span id="wordCount">Loading...</span></p>
      <p><strong>Status:</strong> <span id="dbStatus">Checking...</span></p>
    </div>
    
    <div id="status" class="status"></div>
    
    <div class="progress">
      <div id="progressBar" class="progress-bar"></div>
    </div>
    <div id="progressText">0%</div>
    
    <button id="importBtn" onclick="importDictionary()">Import Dictionary Data</button>
    <button id="clearBtn" onclick="clearDictionary()">Clear Dictionary</button>
    <button id="testBtn" onclick="testDictionary()">Test Dictionary</button>
    
    <div id="testResults" class="test-results"></div>
  </div>
  
  <script>
    // 从服务器加载词典服务
    async function loadDictionaryService() {
      try {
        // 动态导入词典服务
        const module = await import('/src/services/browserDictionaryService.ts');
        return module.browserDictionaryService;
      } catch (error) {
        console.error('Failed to load dictionary service:', error);
        return null;
      }
    }
    
    let dictionaryService = null;
    
    // 初始化
    async function init() {
      dictionaryService = await loadDictionaryService();
      
      if (dictionaryService) {
        // 检查连接
        const connected = await dictionaryService.testConnection();
        document.getElementById('dbStatus').textContent = connected ? 'Connected' : 'Not connected';
        
        // 获取词条数
        const wordCount = await dictionaryService.getWordCount('de');
        document.getElementById('wordCount').textContent = wordCount.toLocaleString();
      }
    }
    
    // 显示状态消息
    function showStatus(message, type = 'info') {
      const statusDiv = document.getElementById('status');
      statusDiv.textContent = message;
      statusDiv.className = 'status ' + type;
    }
    
    // 更新进度
    function updateProgress(percent) {
      const progressBar = document.getElementById('progressBar');
      const progressText = document.getElementById('progressText');
      
      progressBar.style.width = percent + '%';
      progressText.textContent = Math.round(percent) + '%';
    }
    
    // 导入词典数据
    async function importDictionary() {
      if (!dictionaryService) {
        showStatus('Dictionary service not loaded', 'error');
        return;
      }
      
      const importBtn = document.getElementById('importBtn');
      importBtn.disabled = true;
      
      try {
        showStatus('Loading dictionary data from server...', 'info');
        
        // 从服务器加载数据
        const response = await fetch('/dictionary-data.json');
        if (!response.ok) {
          throw new Error(\`Failed to load data: \${response.status}\`);
        }
        
        const data = await response.json();
        showStatus(\`Loaded \${data.length.toLocaleString()} words, starting import...\`, 'info');
        
        // 清空现有数据
        await dictionaryService.clearDatabase();
        
        // 分批导入
        const BATCH_SIZE = 5000;
        const totalBatches = Math.ceil(data.length / BATCH_SIZE);
        
        let importedCount = 0;
        
        for (let batch = 0; batch < totalBatches; batch++) {
          const start = batch * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, data.length);
          const batchData = data.slice(start, end);
          
          const success = await dictionaryService.importData(batchData);
          
          if (success) {
            importedCount += batchData.length;
            const percent = (importedCount / data.length) * 100;
            updateProgress(percent);
            showStatus(\`Imported \${importedCount.toLocaleString()}/\${data.length.toLocaleString()} words (\${Math.round(percent)}%)\`, 'info');
          } else {
            throw new Error(\`Failed to import batch \${batch + 1}\`);
          }
        }
        
        showStatus(\`Successfully imported \${importedCount.toLocaleString()} words!\`, 'success');
        
        // 更新词条数显示
        const wordCount = await dictionaryService.getWordCount('de');
        document.getElementById('wordCount').textContent = wordCount.toLocaleString();
        
      } catch (error) {
        showStatus(\`Import failed: \${error.message}\`, 'error');
        console.error('Import error:', error);
      } finally {
        importBtn.disabled = false;
      }
    }
    
    // 清空词典
    async function clearDictionary() {
      if (!dictionaryService) return;
      
      const clearBtn = document.getElementById('clearBtn');
      clearBtn.disabled = true;
      
      try {
        await dictionaryService.clearDatabase();
        showStatus('Dictionary cleared successfully', 'success');
        
        // 更新词条数显示
        document.getElementById('wordCount').textContent = '0';
        
      } catch (error) {
        showStatus(\`Failed to clear dictionary: \${error.message}\`, 'error');
      } finally {
        clearBtn.disabled = false;
      }
    }
    
    // 测试词典
    async function testDictionary() {
      if (!dictionaryService) return;
      
      const testBtn = document.getElementById('testBtn');
      testBtn.disabled = true;
      
      const testResults = document.getElementById('testResults');
      testResults.innerHTML = '<h3>Test Results:</h3>';
      
      const testWords = ['allein', 'Geschichte', 'Kommunikation', 'Haus', 'Buch', 'Auto', 'Computer', 'Wasser'];
      
      for (const word of testWords) {
        const result = await dictionaryService.queryDictionary(word, { 
          id: 'de', 
          name: 'German' 
        });
        
        const testItem = document.createElement('div');
        testItem.className = 'test-item ' + (result.success && result.entries.length > 0 ? 'success' : 'error');
        
        if (result.success && result.entries.length > 0) {
          const definition = result.entries[0].definitions[0];
          testItem.innerHTML = \`
            <strong>\${word}</strong>: \${definition.substring(0, 100)}\${definition.length > 100 ? '...' : ''}
          \`;
        } else {
          testItem.innerHTML = \`
            <strong>\${word}</strong>: Not found in dictionary
          \`;
        }
        
        testResults.appendChild(testItem);
      }
      
      testBtn.disabled = false;
    }
    
    // 页面加载完成后初始化
    window.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>
`;

  const htmlPath = path.join(__dirname, '..', 'public', 'import-dictionary.html');
  console.log(`生成导入页面: ${htmlPath}`);
  fs.writeFileSync(htmlPath, htmlContent);
  console.log('导入页面生成完成');
}

// 主函数
async function main() {
  console.log('=== Luminous Lute Dictionary Import Tool ===\n');
  
  try {
    // 1. 从SQLite提取数据
    const wordCount = extractDataFromSQLite();
    
    // 2. 生成浏览器导入脚本
    generateBrowserImportScript();
    
    // 3. 生成导入页面
    generateImportPage();
    
    console.log('\n=== 完成 ===');
    console.log(`已提取 ${wordCount.toLocaleString()} 个词条到 ${OUTPUT_FILE}`);
    console.log(`访问 http://localhost:3000/import-dictionary.html 进行导入`);
    console.log('\n下一步:');
    console.log('1. 运行开发服务器: npm run dev');
    console.log('2. 访问导入页面导入词典数据');
    console.log('3. 测试浏览器词典功能');
    
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = { extractDataFromSQLite, generateBrowserImportScript, generateImportPage };