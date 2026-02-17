import { Language } from '../types';
import { WiktionaryEntry, WiktionaryResponse } from './wiktionaryService.ts';

interface DictionaryEntry {
  id: number;
  word: string;
  normalized_word: string;
  lang: string;
  lang_code: string;
  pos: string | null;
  etymology_text: string | null;
  pronunciation: string | null;
}

interface Sense {
  gloss: string;
  example: string | null;
}

interface Form {
  form: string;
  normalized_form: string;
  tags: string | null;
}

interface Sound {
  ipa: string | null;
  audio_url: string | null;
}

export class SQLiteDictionaryService {
  private dbPaths: Map<string, string> = new Map();
  private connections: Map<string, any> = new Map();
  private queryCache: Map<string, { response: WiktionaryResponse; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private readonly MAX_CACHE_SIZE = 1000; // 最大缓存条目数

  constructor() {
    this.initializeDatabasePaths();
  }

  private initializeDatabasePaths(): void {
    // 映射语言代码到SQLite数据库文件路径
    this.dbPaths.set('de', 'dict/German/german_dict.db');
    // 可以添加更多语言
  }

  private getCacheKey(word: string, languageCode: string): string {
    return `${languageCode}:${word.toLowerCase()}`;
  }

  private getFromCache(word: string, languageCode: string): WiktionaryResponse | null {
    const cacheKey = this.getCacheKey(word, languageCode);
    const cached = this.queryCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.queryCache.delete(cacheKey);
      return null;
    }
    
    console.debug(`[SQLiteDictionary] Cache hit for: ${word} (${languageCode})`);
    return cached.response;
  }

  private setToCache(word: string, languageCode: string, response: WiktionaryResponse): void {
    const cacheKey = this.getCacheKey(word, languageCode);
    
    // 清理过期缓存
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      this.clearExpiredCache();
    }
    
    // 如果仍然超过大小限制，删除最旧的条目
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }
    
    this.queryCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
    
    console.debug(`[SQLiteDictionary] Cached response for: ${word} (${languageCode})`);
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.queryCache.delete(key);
      }
    }
  }

  private async getConnection(languageCode: string): Promise<any> {
    if (this.connections.has(languageCode)) {
      return this.connections.get(languageCode);
    }

    const dbPath = this.dbPaths.get(languageCode);
    if (!dbPath) {
      throw new Error(`No database file found for language: ${languageCode}`);
    }

    try {
      console.debug(`[SQLiteDictionary] Connecting to database for ${languageCode} from ${dbPath}`);
      
      let db: any;
      
      if (typeof window !== 'undefined') {
        // 浏览器环境 - 当前不支持SQLite
        // 可以未来实现使用SQL.js或IndexedDB
        console.warn('[SQLiteDictionary] SQLite not supported in browser environment. Using fallback.');
        throw new Error('SQLite not supported in browser environment');
      } else {
      // Node.js环境 - 使用sqlite3
      const sqlite3 = await import('sqlite3');
      const { open } = await import('sqlite');
      
      // 确保sqlite3.Database可用
      const sqlite3Module = sqlite3.default || sqlite3;
      
      db = await open({
        filename: dbPath,
        driver: sqlite3Module.Database
      });
        
        // 优化设置
        await db.exec('PRAGMA journal_mode = WAL');
        await db.exec('PRAGMA synchronous = NORMAL');
        await db.exec('PRAGMA cache_size = -20000');
      }

      this.connections.set(languageCode, db);
      return db;
    } catch (error) {
      console.error(`[SQLiteDictionary] Error connecting to database for ${languageCode}:`, error);
      throw error;
    }
  }

  private normalizeWord(word: string): string {
    // 与Python转换脚本相同的标准化逻辑
    if (!word) return '';
    
    let normalized = word.toLowerCase();
    
    // 处理德语特殊字符
    const replacements: Record<string, string> = {
      'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
      'é': 'e', 'è': 'e', 'ê': 'e',
      'á': 'a', 'à': 'a', 'â': 'a',
      'ó': 'o', 'ò': 'o', 'ô': 'o',
      'ú': 'u', 'ù': 'u', 'û': 'u',
      'ï': 'i', 'î': 'i',
      'ç': 'c', 'ñ': 'n'
    };
    
    for (const [oldChar, newChar] of Object.entries(replacements)) {
      normalized = normalized.replace(new RegExp(oldChar, 'g'), newChar);
    }
    
    // 移除所有非字母数字字符（除了连字符）
    normalized = normalized.replace(/[^a-z0-9-]/g, '');
    
    return normalized;
  }

  private async findExactMatch(word: string, languageCode: string): Promise<{ entry: DictionaryEntry, isInflection: boolean } | null> {
    const db = await this.getConnection(languageCode);
    const normalizedWord = this.normalizeWord(word);
    
    try {
      // 首先尝试精确匹配单词
      const entry = await db.get(`
        SELECT * FROM dictionary 
        WHERE normalized_word = ? OR word = ?
        LIMIT 1
      `, [normalizedWord, word]);
      
      if (entry) {
        return { entry, isInflection: false };
      }
      
      // 如果没有找到，尝试匹配词形变化
      const formEntry = await db.get(`
        SELECT d.* FROM dictionary d
        JOIN forms f ON d.id = f.dictionary_id
        WHERE f.normalized_form = ? OR f.form = ?
        LIMIT 1
      `, [normalizedWord, word]);
      
      if (formEntry) {
        return { entry: formEntry, isInflection: true };
      }
      
      return null;
    } catch (error) {
      console.error(`[SQLiteDictionary] Error finding exact match for "${word}":`, error);
      return null;
    }
  }

  private async getEntryDetails(entryId: number, languageCode: string): Promise<{
    senses: Sense[];
    synonyms: string[];
    antonyms: string[];
    forms: Form[];
    sounds: Sound[];
  }> {
    const db = await this.getConnection(languageCode);
    
    try {
      const [senses, synonyms, antonyms, forms, sounds] = await Promise.all([
        // 获取词义
        db.all(`
          SELECT gloss, example FROM senses 
          WHERE dictionary_id = ? 
          ORDER BY sense_index
        `, [entryId]),
        
        // 获取同义词
        db.all(`
          SELECT synonym FROM synonyms 
          WHERE dictionary_id = ?
        `, [entryId]),
        
        // 获取反义词
        db.all(`
          SELECT antonym FROM antonyms 
          WHERE dictionary_id = ?
        `, [entryId]),
        
        // 获取词形变化
        db.all(`
          SELECT form, normalized_form, tags FROM forms 
          WHERE dictionary_id = ?
        `, [entryId]),
        
        // 获取发音
        db.all(`
          SELECT ipa, audio_url FROM sounds 
          WHERE dictionary_id = ?
        `, [entryId])
      ]);
      
      return {
        senses: senses.map(s => ({ gloss: s.gloss, example: s.example })),
        synonyms: synonyms.map(s => s.synonym),
        antonyms: antonyms.map(a => a.antonym),
        forms: forms.map(f => ({ 
          form: f.form, 
          normalized_form: f.normalized_form, 
          tags: f.tags 
        })),
        sounds: sounds.map(s => ({ ipa: s.ipa, audio_url: s.audio_url }))
      };
    } catch (error) {
      console.error(`[SQLiteDictionary] Error getting details for entry ${entryId}:`, error);
      return {
        senses: [],
        synonyms: [],
        antonyms: [],
        forms: [],
        sounds: []
      };
    }
  }

  private convertToWiktionaryEntry(
    entry: DictionaryEntry, 
    details: ReturnType<typeof this.getEntryDetails> extends Promise<infer T> ? T : never,
    language: Language,
    originalWord: string,
    isInflection: boolean
  ): WiktionaryEntry {
    const definitions = details.senses.map(sense => sense.gloss);
    const examples = details.senses
      .map(sense => sense.example)
      .filter((example): example is string => example !== null);
    
    // 提取主要发音
    let pronunciation = '';
    if (details.sounds.length > 0) {
      const firstSound = details.sounds[0];
      if (firstSound.ipa) {
        pronunciation = `IPA: ${firstSound.ipa}`;
      } else if (firstSound.audio_url) {
        pronunciation = `Audio: ${firstSound.audio_url}`;
      }
    }
    
    return {
      word: entry.word,
      language: language.name,
      partOfSpeech: entry.pos || undefined,
      definitions: definitions.length > 0 ? definitions : [`${entry.pos || 'word'}: ${entry.word}`],
      translations: [], // SQLite词典不包含翻译
      etymology: entry.etymology_text || undefined,
      pronunciation: pronunciation || undefined,
      examples: examples.length > 0 ? examples : [],
      synonyms: details.synonyms,
      antonyms: details.antonyms,
      isInflection: isInflection,
      inflectionForm: isInflection ? originalWord : undefined,
      rootWord: isInflection ? entry.word : undefined
    };
  }

  public async queryDictionary(
    word: string,
    language: Language
  ): Promise<WiktionaryResponse> {
    console.debug('[SQLiteDictionary] Querying dictionary for:', {
      word,
      language: language.name,
      languageCode: language.id
    });

    // 检查缓存
    const cachedResponse = this.getFromCache(word, language.id);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      // 查找精确匹配
      const matchResult = await this.findExactMatch(word, language.id);
      
      if (!matchResult) {
        console.debug('[SQLiteDictionary] No exact match found for:', word);
        const notFoundResponse = {
          success: true,
          entries: [],
          error: 'Word not found in dictionary'
        };
        // 缓存"未找到"的结果，避免重复查询不存在的单词
        this.setToCache(word, language.id, notFoundResponse);
        return notFoundResponse;
      }

      const { entry: dictEntry, isInflection } = matchResult;
      console.debug('[SQLiteDictionary] Found entry:', dictEntry.word, 'isInflection:', isInflection);
      
      // 获取详细信息
      const details = await this.getEntryDetails(dictEntry.id, language.id);
      
      const response = {
        success: true,
        entries: [this.convertToWiktionaryEntry(dictEntry, details, language, word, isInflection)]
      };

      // 缓存成功查询结果
      this.setToCache(word, language.id, response);
      return response;

    } catch (error) {
      console.error('[SQLiteDictionary] Error querying dictionary:', error);
      const errorResponse = {
        success: false,
        entries: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      // 不缓存错误响应
      return errorResponse;
    }
  }

  public async searchWords(
    query: string,
    languageCode: string,
    limit: number = 20
  ): Promise<Array<{ word: string; pos: string | null }>> {
    try {
      const db = await this.getConnection(languageCode);
      const normalizedQuery = this.normalizeWord(query);
      
      const results = await db.all(`
        SELECT word, pos FROM dictionary 
        WHERE normalized_word LIKE ? OR word LIKE ?
        ORDER BY 
          CASE 
            WHEN word LIKE ? THEN 1
            WHEN normalized_word LIKE ? THEN 2
            ELSE 3
          END,
          LENGTH(word)
        LIMIT ?
      `, [
        `${normalizedQuery}%`,
        `${query}%`,
        `${query}%`,
        `${normalizedQuery}%`,
        limit
      ]);
      
      return results;
    } catch (error) {
      console.error('[SQLiteDictionary] Error searching words:', error);
      return [];
    }
  }

  public async getDictionaryUrl(word: string, language: Language): Promise<string> {
    return `sqlite://dict/${language.id}/${encodeURIComponent(word)}`;
  }

  public async testConnection(): Promise<boolean> {
    try {
      // 测试德语数据库连接
      const db = await this.getConnection('de');
      const result = await db.get('SELECT COUNT(*) as count FROM dictionary');
      return result && result.count > 0;
    } catch {
      return false;
    }
  }

  public async getWordCount(languageCode: string): Promise<number> {
    try {
      const db = await this.getConnection(languageCode);
      const result = await db.get('SELECT COUNT(*) as count FROM dictionary');
      return result?.count || 0;
    } catch {
      return 0;
    }
  }

  public async getStatistics(languageCode: string): Promise<{
    wordCount: number;
    senseCount: number;
    formCount: number;
    synonymCount: number;
  }> {
    try {
      const db = await this.getConnection(languageCode);
      
      const [dictResult, senseResult, formResult, synonymResult] = await Promise.all([
        db.get('SELECT COUNT(*) as count FROM dictionary'),
        db.get('SELECT COUNT(*) as count FROM senses'),
        db.get('SELECT COUNT(*) as count FROM forms'),
        db.get('SELECT COUNT(*) as count FROM synonyms')
      ]);
      
      return {
        wordCount: dictResult?.count || 0,
        senseCount: senseResult?.count || 0,
        formCount: formResult?.count || 0,
        synonymCount: synonymResult?.count || 0
      };
    } catch (error) {
      console.error('[SQLiteDictionary] Error getting statistics:', error);
      return {
        wordCount: 0,
        senseCount: 0,
        formCount: 0,
        synonymCount: 0
      };
    }
  }

  public async closeConnections(): Promise<void> {
    for (const [languageCode, db] of this.connections) {
      try {
        await db.close();
        console.debug(`[SQLiteDictionary] Closed connection for ${languageCode}`);
      } catch (error) {
        console.error(`[SQLiteDictionary] Error closing connection for ${languageCode}:`, error);
      }
    }
    this.connections.clear();
  }
}

// 导出单例实例
export const sqliteDictionaryService = new SQLiteDictionaryService();