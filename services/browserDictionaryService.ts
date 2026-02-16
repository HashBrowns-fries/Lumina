import { Language } from '../types';
import { WiktionaryEntry, WiktionaryResponse } from './wiktionaryService';

/**
 * 浏览器环境下的词典服务
 * 使用IndexedDB存储词典数据，支持离线查询
 */
export class BrowserDictionaryService {
  private dbName = 'luminous-lute-dictionary';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('[BrowserDictionary] IndexedDB not available');
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建存储对象
        if (!db.objectStoreNames.contains('dictionary')) {
          const store = db.createObjectStore('dictionary', { keyPath: 'id' });
          store.createIndex('word', 'word', { unique: true });
          store.createIndex('normalizedWord', 'normalizedWord', { unique: false });
          store.createIndex('langCode', 'langCode', { unique: false });
          store.createIndex('pos', 'pos', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('senses')) {
          const store = db.createObjectStore('senses', { keyPath: 'id' });
          store.createIndex('dictionaryId', 'dictionaryId', { unique: false });
        }
      };

      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      this.initialized = true;
      console.debug('[BrowserDictionary] Initialized successfully');
      
      // 检查数据库是否为空，如果是则加载测试数据
      await this.checkAndLoadTestData();
    } catch (error) {
      console.error('[BrowserDictionary] Initialization error:', error);
    }
  }

  private normalizeWord(word: string): string {
    if (!word) return '';
    
    let normalized = word.toLowerCase();
    
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
    
    normalized = normalized.replace(/[^a-z0-9-]/g, '');
    return normalized;
  }

  private async queryIndexedDB<T>(
    storeName: string,
    indexName: string,
    key: IDBValidKey
  ): Promise<T | null> {
    if (!this.db) {
      await this.initialize();
      if (!this.db) return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromIndex<T>(
    storeName: string,
    indexName: string,
    key: IDBValidKey
  ): Promise<T[]> {
    if (!this.db) {
      await this.initialize();
      if (!this.db) return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(key);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  public async queryDictionary(
    word: string,
    language: Language
  ): Promise<WiktionaryResponse> {
    console.debug('[BrowserDictionary] Querying dictionary for:', {
      word,
      language: language.name,
      languageCode: language.id
    });

    try {
      if (!this.db) {
        await this.initialize();
        if (!this.db) {
          return {
            success: false,
            entries: [],
            error: 'IndexedDB not available'
          };
        }
      }

      const normalizedWord = this.normalizeWord(word);
      
      // 查询单词
      const entry = await this.queryIndexedDB<any>('dictionary', 'word', word) ||
                   await this.queryIndexedDB<any>('dictionary', 'normalizedWord', normalizedWord);

      if (!entry) {
        return {
          success: true,
          entries: [],
          error: 'Word not found in browser dictionary'
        };
      }

      // 查询词义
      const senses = await this.getAllFromIndex<any>('senses', 'dictionaryId', entry.id);

      const definitions = senses.map(sense => sense.gloss).filter(Boolean);
      const examples = senses.map(sense => sense.example).filter(Boolean);

      const wiktionaryEntry: WiktionaryEntry = {
        word: entry.word,
        language: language.name,
        partOfSpeech: entry.pos || undefined,
        definitions: definitions.length > 0 ? definitions : [`${entry.pos || 'word'}: ${entry.word}`],
        translations: [],
        etymology: entry.etymology_text || undefined,
        pronunciation: entry.pronunciation || undefined,
        examples: examples.length > 0 ? examples : [],
        synonyms: entry.synonyms ? JSON.parse(entry.synonyms) : [],
        antonyms: entry.antonyms ? JSON.parse(entry.antonyms) : []
      };

      return {
        success: true,
        entries: [wiktionaryEntry]
      };

    } catch (error) {
      console.error('[BrowserDictionary] Error querying dictionary:', error);
      return {
        success: false,
        entries: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async importData(data: any[]): Promise<boolean> {
    console.log(`[BrowserDictionary] Starting import of ${data.length} entries`);
    
    if (!this.db) {
      console.error('[BrowserDictionary] Database not available for import');
      return false;
    }

    try {
      // 第一步：获取所有已存在的单词和最大ID
      const [existingWords, nextEntryId, nextSenseId] = await Promise.all([
        this.getAllExistingWords(),
        this.getMaxEntryId().then(id => id + 1).catch(() => 1),
        this.getMaxSenseId().then(id => id + 1).catch(() => 1)
      ]);
      
      console.log(`[BrowserDictionary] Found ${existingWords.size} existing words, next IDs: entry=${nextEntryId}, sense=${nextSenseId}`);
      
      // 第二步：分批导入数据（避免事务过大）
      const BATCH_SIZE = 50;
      const batches = Math.ceil(data.length / BATCH_SIZE);
      let totalImported = 0;
      
      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, data.length);
        const batchData = data.slice(start, end);
        
        const batchImported = await this.importBatch(
          batchData, 
          existingWords, 
          nextEntryId + totalImported,
          nextSenseId
        );
        
        totalImported += batchImported;
        console.log(`[BrowserDictionary] Batch ${batchIndex + 1}/${batches}: imported ${batchImported} entries (total: ${totalImported})`);
      }
      
      console.log(`[BrowserDictionary] Import completed: ${totalImported}/${data.length} entries imported`);
      return totalImported > 0;
      
    } catch (error) {
      console.error('[BrowserDictionary] Error importing data:', error);
      return false;
    }
  }

  /**
   * 获取所有已存在的单词
   */
  private async getAllExistingWords(): Promise<Set<string>> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(new Set());
        return;
      }
      
      const transaction = this.db.transaction(['dictionary'], 'readonly');
      const store = transaction.objectStore('dictionary');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const entries = request.result;
        const wordSet = new Set<string>();
        entries.forEach(entry => {
          wordSet.add(entry.word.toLowerCase());
        });
        resolve(wordSet);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 导入一批数据
   */
  private async importBatch(
    batchData: any[],
    existingWords: Set<string>,
    startEntryId: number,
    startSenseId: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(0);
        return;
      }
      
      const transaction = this.db.transaction(['dictionary', 'senses'], 'readwrite');
      const dictionaryStore = transaction.objectStore('dictionary');
      const sensesStore = transaction.objectStore('senses');
      
      let entryId = startEntryId;
      let senseId = startSenseId;
      let importedCount = 0;
      
      transaction.oncomplete = () => {
        resolve(importedCount);
      };
      
      transaction.onerror = () => {
        console.error('[BrowserDictionary] Batch transaction error:', transaction.error);
        reject(transaction.error);
      };
      
      // 处理批处理中的每个条目
      for (const entry of batchData) {
        const wordLower = entry.word.toLowerCase();
        
        // 跳过已存在的单词
        if (existingWords.has(wordLower)) {
          continue;
        }
        
        // 添加词条
        const dictionaryEntry = {
          id: entryId,
          word: entry.word,
          normalizedWord: this.normalizeWord(entry.word),
          langCode: entry.lang_code || 'de',
          pos: entry.pos || '',
          etymology_text: entry.etymology_text || '',
          pronunciation: entry.pronunciation || '',
          synonyms: JSON.stringify(entry.synonyms || []),
          antonyms: JSON.stringify(entry.antonyms || [])
        };

        try {
          dictionaryStore.add(dictionaryEntry);
        } catch (error) {
          console.error(`[BrowserDictionary] Error adding word "${entry.word}":`, error);
          continue;
        }

        // 添加词义
        if (entry.senses && Array.isArray(entry.senses)) {
          for (let i = 0; i < entry.senses.length; i++) {
            const sense = entry.senses[i];
            if (sense.gloss) {
              try {
                sensesStore.add({
                  id: senseId++,
                  dictionaryId: entryId,
                  senseIndex: i,
                  gloss: sense.gloss,
                  example: sense.example || ''
                });
              } catch (error) {
                console.error(`[BrowserDictionary] Error adding sense for "${entry.word}":`, error);
              }
            }
          }
        }

        entryId++;
        importedCount++;
        existingWords.add(wordLower); // 添加到已存在集合，避免同一批中重复
      }
      
      // 如果没有导入任何条目，立即完成事务
      if (importedCount === 0) {
        resolve(0);
      }
    });
  }

  public async getDictionaryUrl(word: string, language: Language): Promise<string> {
    return `indexeddb://dict/${language.id}/${encodeURIComponent(word)}`;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.initialize();
      return this.db !== null;
    } catch {
      return false;
    }
  }

  public async getWordCount(languageCode: string): Promise<number> {
    try {
      if (!this.db) {
        await this.initialize();
        if (!this.db) return 0;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['dictionary'], 'readonly');
        const store = transaction.objectStore('dictionary');
        const index = store.index('langCode');
        const request = index.count(languageCode);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return 0;
    }
  }

  public async clearDatabase(): Promise<boolean> {
    try {
      if (!this.db) return true;

      const transaction = this.db.transaction(['dictionary', 'senses'], 'readwrite');
      const dictionaryStore = transaction.objectStore('dictionary');
      const sensesStore = transaction.objectStore('senses');

      dictionaryStore.clear();
      sensesStore.clear();

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      return true;
    } catch (error) {
      console.error('[BrowserDictionary] Error clearing database:', error);
      return false;
    }
  }

  /**
   * 获取最大的词条ID
   */
  private async getMaxEntryId(): Promise<number> {
    if (!this.db) return 0;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['dictionary'], 'readonly');
      const store = transaction.objectStore('dictionary');
      const request = store.openCursor(null, 'prev'); // 从后向前找最后一个
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          resolve(cursor.value.id);
        } else {
          resolve(0);
        }
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get max entry ID'));
      };
    });
  }

  /**
   * 获取最大的词义ID
   */
  private async getMaxSenseId(): Promise<number> {
    if (!this.db) return 0;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['senses'], 'readonly');
      const store = transaction.objectStore('senses');
      const request = store.openCursor(null, 'prev'); // 从后向前找最后一个
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          resolve(cursor.value.id);
        } else {
          resolve(0);
        }
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get max sense ID'));
      };
    });
  }

  /**
   * 根据单词获取词条
   */
  private async getEntryByWord(word: string): Promise<any | null> {
    if (!this.db) return null;
    
    const normalizedWord = this.normalizeWord(word);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['dictionary'], 'readonly');
      const store = transaction.objectStore('dictionary');
      const index = store.index('word');
      const request = index.get(word);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          // 也尝试用规范化单词查询
          const normalizedRequest = store.index('normalizedWord').get(normalizedWord);
          normalizedRequest.onsuccess = () => resolve(normalizedRequest.result || null);
          normalizedRequest.onerror = () => reject(normalizedRequest.error);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 检查数据库是否为空，如果是则加载测试数据
   */
  private async checkAndLoadTestData(): Promise<void> {
    try {
      if (!this.db) return;

      // 检查是否有数据
      const wordCount = await this.getWordCount('de');
      
      if (wordCount < 10) {
        console.log('[BrowserDictionary] Dictionary is empty or has few entries, loading test data...');
        await this.loadTestData();
      } else {
        console.debug(`[BrowserDictionary] Dictionary already has ${wordCount} words, skipping test data load`);
      }
    } catch (error) {
      console.warn('[BrowserDictionary] Error checking/loading test data:', error);
    }
  }

  /**
   * 加载测试数据
   */
  private async loadTestData(): Promise<boolean> {
    try {
      console.log('[BrowserDictionary] Loading test data from /test-dictionary-data.json');
      
      const response = await fetch('/test-dictionary-data.json');
      if (!response.ok) {
        console.warn(`[BrowserDictionary] Failed to load test data: ${response.status}`);
        return false;
      }
      
      const allTestData = await response.json();
      console.log(`[BrowserDictionary] Loaded ${allTestData.length} entries from file`);
      
      // 只取前50个常用单词（避免IndexedDB事务过大）
      const testData = allTestData.slice(0, 50);
      console.log(`[BrowserDictionary] Using first ${testData.length} entries for browser dictionary`);
      
      // 导入测试数据
      const success = await this.importData(testData);
      
      if (success) {
        console.log(`[BrowserDictionary] Successfully imported ${testData.length} test entries`);
        
        // 验证导入
        const testWords = ['allein', 'Haus', 'gut', 'Zukunft', 'fand', 'bequem', 'noch'];
        let foundCount = 0;
        
        for (const word of testWords) {
          const result = await this.queryDictionary(word, { 
            id: 'de', 
            name: 'German',
            dictionaryUrl: 'https://de.wiktionary.org/wiki/###'
          });
          if (result.success && result.entries.length > 0) {
            console.log(`[BrowserDictionary] ✓ Test word "${word}" found`);
            foundCount++;
          } else {
            console.log(`[BrowserDictionary] ✗ Test word "${word}" not found`);
          }
        }
        
        console.log(`[BrowserDictionary] Test complete: ${foundCount}/${testWords.length} words found`);
        return foundCount > 0;
        
      } else {
        console.error('[BrowserDictionary] Failed to import test data');
        return false;
      }
      
    } catch (error) {
      console.error('[BrowserDictionary] Error loading test data:', error);
      return false;
    }
  }
}

// 导出单例实例
export const browserDictionaryService = new BrowserDictionaryService();