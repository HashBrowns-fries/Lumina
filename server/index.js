import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { sqliteDictionaryService } from './sqliteDictionaryService.js';

const app = express();
const port = process.env.PORT || 3006;

// 启用 CORS
app.use(cors());
app.use(express.json());

// 创建词典服务实例
const dictionaryService = sqliteDictionaryService;

// 语言代码到名称的映射（支持动态添加）
const languageMap = {
  'de': 'German',
  'sa': 'Sanskrit',
  'en': 'English',
  'fr': 'French',
  'es': 'Spanish',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'nl': 'Dutch',
  'pl': 'Polish',
  'sv': 'Swedish',
  'da': 'Danish',
  'fi': 'Finnish',
  'no': 'Norwegian',
  'la': 'Latin',
  'tr': 'Turkish',
  'el': 'Greek',
  'he': 'Hebrew',
  'hi': 'Hindi',
  'th': 'Thai',
  'vi': 'Vietnamese'
};

// 获取项目根目录和dict目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const dictDir = path.join(projectRoot, 'dict');

// 确保dict目录存在
if (!fs.existsSync(dictDir)) {
  fs.mkdirSync(dictDir, { recursive: true });
}

// 配置multer文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 文件将先上传到临时目录
    const tempDir = path.join(projectRoot, 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // 保留原始文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 文件过滤器：只允许.db和.jsonl文件
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.db', '.sqlite', '.jsonl', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .db, .sqlite, .jsonl, and .json files are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max file size
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Luminous Lute Dictionary API'
  });
});

// 获取所有可用词典统计
app.get('/api/dictionary/stats', async (req, res) => {
  try {
    const languagesInfo = await dictionaryService.getLanguagesInfo();
    
    const statsByLanguage = {};
    let totalWords = 0;
    let totalSenses = 0;
    let totalForms = 0;
    let totalSynonyms = 0;
    
    for (const info of languagesInfo) {
      statsByLanguage[info.code] = {
        wordCount: info.wordCount,
        senseCount: info.senseCount,
        formCount: info.formCount,
        synonymCount: info.synonymCount,
        languageName: languageMap[info.code] || info.code
      };
      
      totalWords += info.wordCount;
      totalSenses += info.senseCount;
      totalForms += info.formCount;
      totalSynonyms += info.synonymCount;
    }
    
    res.json({
      success: true,
      statsByLanguage,
      totalLanguages: languagesInfo.length,
      totals: {
        wordCount: totalWords,
        senseCount: totalSenses,
        formCount: totalForms,
        synonymCount: totalSynonyms
      }
    });
  } catch (error) {
    console.error('Error getting all stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取特定语言词典统计
app.get('/api/dictionary/stats/:languageCode', async (req, res) => {
  try {
    const { languageCode } = req.params;
    const stats = await dictionaryService.getStatistics(languageCode);
    res.json({
      success: true,
      ...stats,
      hasLocal: true // 示例：假设本地数据库总是存在
    });
  } catch (error) {
    console.error('Error getting dictionary stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// 主查询端点：本地 + Kaikki 后备
app.get('/api/dictionary/query/:languageCode/:word', async (req, res) => {
  try {
    const { languageCode, word } = req.params;
    console.log(`[API] Query: "${word}" (${languageCode})`);

    const result = await dictionaryService.queryDictionary(word, { id: languageCode, name: languageMap[languageCode] || languageCode });

    // 记录查询来源
    if (result.success && result.entries.length > 0) {
      console.log(`[API] Found "${word}" from ${result.source}: ${result.entries.length} entries`);
    } else {
      console.log(`[API] "${word}" not found in ${languageCode}, result:`, JSON.stringify(result));
    }

    res.json(result);
  } catch (error) {
    console.error('Error querying dictionary:', error);
    res.status(500).json({ 
      success: false,
      entries: [],
      error: error.message 
    });
  }
});

// 批量查询（POST）
app.post('/api/dictionary/batch-query', async (req, res) => {
  try {
    const { languageCode, words } = req.body;

    if (!languageCode || !Array.isArray(words)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    console.log(`[API] Batch query for ${words.length} words (${languageCode})`);

    const results = {};
    for (const word of words) {
    const result = await dictionaryService.queryDictionary(word, { id: languageCode, name: languageMap[languageCode] || languageCode });
      if (result.success && result.entries.length > 0) {
        results[word] = result;
      }
    }

    res.json({
      success: true,
      results,
      found: Object.keys(results).length,
      total: words.length
    });
  } catch (error) {
    console.error('Error in batch query:', error);
    res.status(500).json({ error: error.message });
  }
});

// 搜索建议
app.get('/api/dictionary/suggest/:languageCode/:prefix', async (req, res) => {
  try {
    const { languageCode, prefix } = req.params;

    if (!true) { // 示例：假设本地数据库总是存在
      return res.json({ suggestions: [], source: 'none' });
    }

    const suggestions = await dictionaryService.searchWords(prefix, languageCode, 10);

    res.json({ 
      suggestions: suggestions.map(row => ({
        word: row.word,
        pos: row.pos
      })),
      source: 'local'
    });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取可用的本地语言列表
app.get('/api/dictionary/languages', async (req, res) => {
  try {
    const availableLanguages = dictionaryService.getAvailableLanguages();
    const languagesInfo = await dictionaryService.getLanguagesInfo();
    
    const languages = languagesInfo.map(info => ({
      code: info.code,
      name: languageMap[info.code] || info.code,
      hasLocal: true,
      wordCount: info.wordCount,
      senseCount: info.senseCount,
      formCount: info.formCount,
      path: info.path
    }));
    
    res.json({
      success: true,
      languages,
      total: languages.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting available languages:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      languages: []
    });
  }
});

// 重新扫描词典目录
app.post('/api/dictionary/rescan', async (req, res) => {
  try {
    const result = await dictionaryService.rescanDictionaryPaths();
    res.json({
      success: true,
      oldCount: result.oldCount,
      newCount: result.newCount,
      languages: result.languages,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error rescanning dictionary paths:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// 从注册表移除词典（保留文件）
app.delete('/api/dictionary/:languageCode', async (req, res) => {
  try {
    const { languageCode } = req.params;
    const result = await dictionaryService.removeDictionary(languageCode);
    
    if (result.success) {
      res.json({
        success: true,
        languageCode: result.languageCode,
        dbPath: result.dbPath,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error removing dictionary:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// 完全删除词典文件
app.delete('/api/dictionary/:languageCode/file', async (req, res) => {
  try {
    const { languageCode } = req.params;
    const result = await dictionaryService.deleteDictionaryFile(languageCode);
    
    if (result.success) {
      res.json({
        success: true,
        languageCode: result.languageCode,
        dbPath: result.dbPath,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error deleting dictionary file:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// 上传词典文件（SQLite或JSONL）
app.post('/api/dictionary/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { languageCode, languageName } = req.body;
    
    if (!languageCode || languageCode.length < 2 || languageCode.length > 3) {
      // 清理上传的文件
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Valid language code (2-3 characters) is required'
      });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const tempFilePath = req.file.path;
    
    console.log(`[Dictionary Upload] Processing file: ${req.file.originalname}, language: ${languageCode}, size: ${req.file.size} bytes`);
    
    // 确定目标目录和文件名
    const languageDirName = languageName || languageMap[languageCode] || languageCode;
    const targetDir = path.join(dictDir, languageDirName);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    let targetFilePath;
    let fileType;
    
    if (ext === '.db' || ext === '.sqlite') {
      // SQLite数据库文件：直接复制
      fileType = 'sqlite';
      const targetFileName = `${languageCode}_dict.db`;
      targetFilePath = path.join(targetDir, targetFileName);
      
      // 如果目标文件已存在，先删除
      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
      }
      
      // 复制文件
      fs.copyFileSync(tempFilePath, targetFilePath);
      console.log(`[Dictionary Upload] Copied SQLite database to: ${targetFilePath}`);
      
    } else if (ext === '.jsonl' || ext === '.json') {
      // JSONL文件：需要转换
      fileType = 'jsonl';
      return res.status(501).json({
        success: false,
        error: 'JSONL conversion not yet implemented. Please convert to SQLite first using the conversion script.'
      });
    } else {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type'
      });
    }
    
    // 清理临时文件
    fs.unlinkSync(tempFilePath);
    
    // 重新扫描词典目录以注册新词典
    const scanResult = await dictionaryService.rescanDictionaryPaths();
    
    res.json({
      success: true,
      languageCode,
      fileType,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      targetPath: targetFilePath,
      scanResult: {
        oldCount: scanResult.oldCount,
        newCount: scanResult.newCount,
        languages: scanResult.languages
      },
      message: `Dictionary '${languageCode}' uploaded successfully`
    });
    
  } catch (error) {
    console.error('Error uploading dictionary:', error);
    
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// 检查Python环境
app.get('/api/dictionary/check-python', async (req, res) => {
  try {
    console.log('Checking Python environment...');
    
    // 尝试运行 python --version
    const pythonProcess = spawn('python', ['--version']);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      const output = (stdout || stderr).trim();
      const versionMatch = output.match(/Python (\d+\.\d+\.\d+)/);
      
      // 检查常见的错误消息
      const errorMessages = [
        'Python was not found',
        'is not recognized',
        'command not found',
        'No such file or directory'
      ];
      
      const hasError = errorMessages.some(msg => output.includes(msg));
      
      if (code === 0 && versionMatch && !hasError) {
        // Python可用且有有效版本号
        const versionNumber = versionMatch[1];
        
        res.json({
          success: true,
          available: true,
          version: versionNumber,
          fullOutput: output,
          message: `Python ${versionNumber} is available`
        });
      } else if (versionMatch && !hasError) {
        // 有版本号但没有错误（可能非零退出码但仍有版本信息）
        const versionNumber = versionMatch[1];
        
        res.json({
          success: true,
          available: true,
          version: versionNumber,
          fullOutput: output,
          message: `Python ${versionNumber} is available (exit code: ${code})`,
          warning: 'Python check returned non-zero exit code'
        });
      } else {
        // Python不可用或版本号无法提取
        res.json({
          success: true,
          available: false,
          version: null,
          error: 'Python not found or not in PATH',
          fullOutput: output || 'No output',
          exitCode: code,
          message: 'Python is not available. Please install Python 3.7+ and add it to PATH.',
          installationGuide: {
            windows: 'Download from https://www.python.org/downloads/ and check "Add Python to PATH" during installation',
            macos: 'brew install python or download from https://www.python.org/downloads/',
            linux: 'sudo apt-get install python3 or use your package manager'
          }
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Error checking Python:', error);
      res.json({
        success: true,
        available: false,
        error: error.message,
        message: 'Failed to check Python installation',
        installationGuide: {
          windows: 'Download from https://www.python.org/downloads/ and check "Add Python to PATH" during installation',
          macos: 'brew install python or download from https://www.python.org/downloads/',
          linux: 'sudo apt-get install python3 or use your package manager'
        }
      });
    });
    
  } catch (error) {
    console.error('Error in Python check endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Internal server error while checking Python'
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`\n=== Luminous Lute Dictionary API ===`);
  console.log(`Server running at http://localhost:${port}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /api/dictionary/stats              - All dictionary stats`);
  console.log(`  GET  /api/dictionary/stats/:lang        - Specific language stats`);
  console.log(`  GET  /api/dictionary/query/:lang/:word  - Query word (local only)`);
  console.log(`  GET  /api/dictionary/suggest/:lang/:pre - Suggestions`);
  console.log(`  GET  /api/dictionary/languages          - Available languages`);
  console.log(`  GET  /api/dictionary/check-python       - Check Python environment`);
  console.log(`  POST /api/dictionary/rescan             - Rescan dictionary directories`);
  console.log(`  POST /api/dictionary/upload             - Upload dictionary file`);
  console.log(`  DELETE /api/dictionary/:lang            - Remove dictionary from registry`);
  console.log(`  DELETE /api/dictionary/:lang/file       - Delete dictionary file`);
  console.log(`\nReady to serve!\n`);
});
