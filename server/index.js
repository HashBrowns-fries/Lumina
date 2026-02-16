import express from 'express';
import cors from 'cors';
import { sqliteDictionaryService } from './sqliteDictionaryService.js';

const app = express();
const port = process.env.PORT || 3006;

// 启用 CORS
app.use(cors());
app.use(express.json());

// 创建词典服务实例
const dictionaryService = sqliteDictionaryService;

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
    const stats = await dictionaryService.getStatistics('de'); // 示例语言代码
    res.json({
      success: true,
      stats,
      totalLanguages: 1 // 示例语言数量
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

    const result = await dictionaryService.queryDictionary(word, { id: languageCode, name: 'German' }); // 示例语言

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
      const result = await dictionaryService.queryDictionary(word, { id: languageCode, name: 'German' }); // 示例语言
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
app.get('/api/dictionary/languages', (req, res) => {
  const available = [{ code: 'de', hasLocal: true }]; // 示例语言
  res.json({
    success: true,
    languages: available
  });
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
  console.log(`\nReady to serve!\n`);
});
