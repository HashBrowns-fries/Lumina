import { Language } from '../types';
import { WiktionaryEntry, WiktionaryResponse } from './wiktionaryService';

interface DictionaryEntry {
  word: string;
  lang: string;
  lang_code: string;
  pos?: string;
  senses: Array<{
    glosses: string[];
    examples?: Array<{text: string; translation?: string}>;
    synonyms?: string[];
    antonyms?: string[];
  }>;
  etymology_text?: string;
  pronunciation?: string;
  sounds?: Array<{ipa?: string; audio?: string}>;
  head_templates?: Array<{name: string; expansion: string}>;
  forms?: Array<{form: string; tags: string[]}>;
}

export class LocalDictionaryService {
  private dictionaryCache: Map<string, DictionaryEntry[]> = new Map();
  private dictionaryPaths: Map<string, string> = new Map();
  private initialized = false;

  constructor() {
    this.initializeDictionaryPaths();
  }

  private initializeDictionaryPaths(): void {
    // 映射语言代码到词典文件路径
    this.dictionaryPaths.set('de', 'dict/German/kaikki.org-dictionary-German.jsonl');
    // 可以添加更多语言
  }

  private async loadDictionary(languageCode: string): Promise<DictionaryEntry[]> {
    const filePath = this.dictionaryPaths.get(languageCode);
    if (!filePath) {
      throw new Error(`No dictionary file found for language: ${languageCode}`);
    }

    if (this.dictionaryCache.has(languageCode)) {
      return this.dictionaryCache.get(languageCode)!;
    }

    try {
      console.debug(`[LocalDictionary] Loading dictionary for ${languageCode} from ${filePath}`);
      
      // 对于大文件，我们只加载前10000个词条作为缓存
      const maxEntries = 10000;
      const entries: DictionaryEntry[] = [];
      
      if (typeof window !== 'undefined') {
        // 浏览器环境 - 使用fetch并限制大小
        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error(`Failed to load dictionary file: ${response.status}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get response reader');
        }
        
        let content = '';
        let done = false;
        
        while (!done && entries.length < maxEntries) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          
          if (value) {
            content += new TextDecoder().decode(value);
            
            // 处理已读取的内容
            const lines = content.split('\n');
            content = lines.pop() || ''; // 保留未完成的行
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const entry = JSON.parse(line) as DictionaryEntry;
                  entries.push(entry);
                  
                  if (entries.length >= maxEntries) {
                    break;
                  }
                } catch (error) {
                  console.warn(`[LocalDictionary] Failed to parse line: ${line.substring(0, 100)}`);
                }
              }
            }
          }
        }
        
        reader.cancel();
      } else {
        // Node.js环境 - 使用流式读取
        const fs = await import('fs');
        const path = await import('path');
        const fullPath = path.join(process.cwd(), filePath);
        
        await new Promise<void>((resolve, reject) => {
          const stream = fs.createReadStream(fullPath, { encoding: 'utf-8' });
          let buffer = '';
          
          stream.on('data', (chunk: string) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留未完成的行
            
            for (const line of lines) {
              if (line.trim() && entries.length < maxEntries) {
                try {
                  const entry = JSON.parse(line) as DictionaryEntry;
                  entries.push(entry);
                } catch (error) {
                  console.warn(`[LocalDictionary] Failed to parse line: ${line.substring(0, 100)}`);
                }
              }
              
              if (entries.length >= maxEntries) {
                stream.destroy();
                break;
              }
            }
          });
          
          stream.on('end', () => {
            // 处理最后一行
            if (buffer.trim() && entries.length < maxEntries) {
              try {
                const entry = JSON.parse(buffer.trim()) as DictionaryEntry;
                entries.push(entry);
              } catch (error) {
                console.warn(`[LocalDictionary] Failed to parse final line: ${buffer.substring(0, 100)}`);
              }
            }
            resolve();
          });
          
          stream.on('error', reject);
          stream.on('close', resolve);
        });
      }

      console.debug(`[LocalDictionary] Loaded ${entries.length} entries for ${languageCode}`);
      this.dictionaryCache.set(languageCode, entries);
      return entries;
    } catch (error) {
      console.error(`[LocalDictionary] Error loading dictionary for ${languageCode}:`, error);
      throw error;
    }
  }

  private normalizeWord(word: string): string {
    // 移除变音符号，转换为小写，处理特殊字符
    return word
      .toLowerCase()
      .normalize('NFD') // 分解变音符号
      .replace(/[\u0300-\u036f]/g, '') // 移除变音符号
      .replace(/[^a-z0-9äöüß]/g, ''); // 只保留字母数字和德语特殊字符
  }

  private findExactMatch(entries: DictionaryEntry[], word: string): DictionaryEntry | null {
    const normalizedWord = this.normalizeWord(word);
    
    // 首先尝试精确匹配
    for (const entry of entries) {
      if (this.normalizeWord(entry.word) === normalizedWord) {
        return entry;
      }
    }

    // 如果没有找到，尝试匹配词形变化
    for (const entry of entries) {
      if (entry.forms) {
        for (const form of entry.forms) {
          if (this.normalizeWord(form.form) === normalizedWord) {
            return entry;
          }
        }
      }
    }

    return null;
  }

  private findPartialMatches(entries: DictionaryEntry[], word: string): DictionaryEntry[] {
    const normalizedWord = this.normalizeWord(word);
    const matches: DictionaryEntry[] = [];

    for (const entry of entries) {
      const entryWord = this.normalizeWord(entry.word);
      
      // 检查是否以查询词开头
      if (entryWord.startsWith(normalizedWord) || normalizedWord.startsWith(entryWord)) {
        matches.push(entry);
      }
      
      // 检查词形变化
      if (entry.forms) {
        for (const form of entry.forms) {
          const formWord = this.normalizeWord(form.form);
          if (formWord.startsWith(normalizedWord) || normalizedWord.startsWith(formWord)) {
            matches.push(entry);
            break;
          }
        }
      }
    }

    return matches.slice(0, 10); // 限制返回数量
  }

  private convertToWiktionaryEntry(entry: DictionaryEntry, language: Language): WiktionaryEntry {
    const definitions: string[] = [];
    const examples: string[] = [];
    const synonyms: string[] = [];
    const antonyms: string[] = [];
    const translations: string[] = [];

    // 提取定义
    if (entry.senses && entry.senses.length > 0) {
      for (const sense of entry.senses) {
        if (sense.glosses && sense.glosses.length > 0) {
          definitions.push(...sense.glosses);
        }
        if (sense.examples) {
          examples.push(...sense.examples.map(ex => ex.text));
        }
        if (sense.synonyms) {
          synonyms.push(...sense.synonyms);
        }
        if (sense.antonyms) {
          antonyms.push(...sense.antonyms);
        }
      }
    }

    // 提取发音
    let pronunciation = '';
    if (entry.sounds && entry.sounds.length > 0) {
      const ipa = entry.sounds.find(s => s.ipa)?.ipa;
      if (ipa) {
        pronunciation = `IPA: ${ipa}`;
      }
    }

    // 提取词源
    const etymology = entry.etymology_text || '';

    return {
      word: entry.word,
      language: language.name,
      partOfSpeech: entry.pos,
      definitions: definitions.length > 0 ? definitions : [`${entry.pos || 'word'}: ${entry.word}`],
      translations,
      etymology,
      pronunciation,
      examples: examples.length > 0 ? examples : [],
      synonyms: synonyms.length > 0 ? synonyms : [],
      antonyms: antonyms.length > 0 ? antonyms : []
    };
  }

  public async queryDictionary(
    word: string,
    language: Language
  ): Promise<WiktionaryResponse> {
    console.debug('[LocalDictionary] Querying dictionary for:', {
      word,
      language: language.name,
      languageCode: language.id
    });

    try {
      // 首先在缓存中查找
      const cachedEntries = this.dictionaryCache.get(language.id);
      if (cachedEntries) {
        const exactMatch = this.findExactMatch(cachedEntries, word);
        if (exactMatch) {
          console.debug('[LocalDictionary] Found exact match in cache:', exactMatch.word);
          return {
            success: true,
            entries: [this.convertToWiktionaryEntry(exactMatch, language)]
          };
        }
      }

      // 如果缓存中没有，尝试流式搜索整个文件
      console.debug('[LocalDictionary] Searching in full dictionary file...');
      const filePath = this.dictionaryPaths.get(language.id);
      if (!filePath) {
        throw new Error(`No dictionary file found for language: ${language.id}`);
      }

      if (typeof window !== 'undefined') {
        // 浏览器环境 - 无法流式搜索大文件，返回未找到
        console.debug('[LocalDictionary] Browser environment, cannot stream large file');
        return {
          success: true,
          entries: [],
          error: 'Word not found in local dictionary (browser limitation)'
        };
      } else {
        // Node.js环境 - 流式搜索
        const fs = await import('fs');
        const path = await import('path');
        const fullPath = path.join(process.cwd(), filePath);
        
        const normalizedWord = this.normalizeWord(word);
        let foundEntry: DictionaryEntry | null = null;
        
        await new Promise<void>((resolve, reject) => {
          const stream = fs.createReadStream(fullPath, { encoding: 'utf-8' });
          let buffer = '';
          
          stream.on('data', (chunk: string) => {
            if (foundEntry) return; // 已经找到，跳过
            
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const entry = JSON.parse(line) as DictionaryEntry;
                  
                  // 检查是否匹配
                  if (this.normalizeWord(entry.word) === normalizedWord) {
                    foundEntry = entry;
                    stream.destroy();
                    break;
                  }
                  
                  // 检查词形变化
                  if (entry.forms) {
                    for (const form of entry.forms) {
                      if (this.normalizeWord(form.form) === normalizedWord) {
                        foundEntry = entry;
                        stream.destroy();
                        break;
                      }
                    }
                  }
                } catch (error) {
                  // 忽略解析错误
                }
              }
            }
          });
          
          stream.on('end', () => {
            // 检查最后一行
            if (buffer.trim() && !foundEntry) {
              try {
                const entry = JSON.parse(buffer.trim()) as DictionaryEntry;
                if (this.normalizeWord(entry.word) === normalizedWord) {
                  foundEntry = entry;
                }
              } catch (error) {
                // 忽略解析错误
              }
            }
            resolve();
          });
          
          stream.on('error', reject);
          stream.on('close', resolve);
        });
        
        if (foundEntry) {
          console.debug('[LocalDictionary] Found exact match in file:', foundEntry.word);
          return {
            success: true,
            entries: [this.convertToWiktionaryEntry(foundEntry, language)]
          };
        }
      }

      // 没有找到任何匹配
      console.debug('[LocalDictionary] No matches found for word:', word);
      return {
        success: true,
        entries: [],
        error: 'Word not found in local dictionary'
      };

    } catch (error) {
      console.error('[LocalDictionary] Error querying dictionary:', error);
      return {
        success: false,
        entries: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async getDictionaryUrl(word: string, language: Language): Promise<string> {
    // 本地词典没有URL，返回空字符串或本地文件路径
    return `local://dict/${language.id}/${encodeURIComponent(word)}`;
  }

  public async testConnection(): Promise<boolean> {
    try {
      // 测试德语词典是否可加载
      const entries = await this.loadDictionary('de');
      return entries.length > 0;
    } catch {
      return false;
    }
  }

  public async getWordCount(languageCode: string): Promise<number> {
    try {
      const entries = await this.loadDictionary(languageCode);
      return entries.length;
    } catch {
      return 0;
    }
  }

  public async searchWords(
    query: string,
    languageCode: string,
    limit: number = 20
  ): Promise<DictionaryEntry[]> {
    try {
      const entries = await this.loadDictionary(languageCode);
      const normalizedQuery = this.normalizeWord(query);
      const results: DictionaryEntry[] = [];

      for (const entry of entries) {
        const entryWord = this.normalizeWord(entry.word);
        
        if (entryWord.includes(normalizedQuery)) {
          results.push(entry);
          if (results.length >= limit) {
            break;
          }
        }
      }

      return results;
    } catch (error) {
      console.error('[LocalDictionary] Error searching words:', error);
      return [];
    }
  }
}

// 导出单例实例
export const localDictionaryService = new LocalDictionaryService();