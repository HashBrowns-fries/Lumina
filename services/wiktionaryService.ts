import { Language } from '../types';
import { sqliteDictionaryService } from './sqliteDictionaryService.ts';
import { browserDictionaryService } from './browserDictionaryService.ts';
import { getDictionaryApiUrl } from './apiConfig';



// 开发环境模拟数据
const getMockDictionaryData = (word: string, language: Language): any => {
  console.debug('[WiktionaryService] Using mock data as fallback');
  
  const germanMockData: Record<string, any> = {
    'allein': {
      word: 'allein',
      language: 'German',
      partOfSpeech: 'adj/adv/conj',
      definitions: ['alone', 'only', 'solely'],
      translations: [],
      etymology: 'From Middle High German alein, from Old High German aleina.',
      pronunciation: 'IPA: /aˈlaɪ̯n/',
      examples: ['Er ist allein zu Hause.', 'Allein das Wissen hilft.'],
      synonyms: ['einzeln', 'isolierend', 'separat'],
      antonyms: ['gemeinsam', 'zusammen']
    }
  };
  
  const normalizedWord = word.toLowerCase();
  const mockEntry = germanMockData[normalizedWord];
  
  if (mockEntry && language.id === 'de') {
    return {
      success: true,
      entries: [mockEntry]
    };
  }
  
        const notFoundResponse = {
          success: true,
          entries: [],
          error: 'Word not found in dictionary'
        };
        setToCache(word, language, notFoundResponse);
        return notFoundResponse;
};

const BACKEND_API_URL = getDictionaryApiUrl();

export interface WiktionaryEntry {
  word: string;
  language: string;
  partOfSpeech?: string;
  definitions: string[];
  translations: string[];
  etymology?: string;
  pronunciation?: string;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  isInflection?: boolean;
  inflectionForm?: string;
  rootWord?: string;
  inflectionTags?: string;
  rootEntry?: WiktionaryEntry;
  // 新增字段用于区分不同形式
  entryType?: string; // 'variant', 'root', 'normal'
  normalizedWord?: string;
  inflectionAnalysis?: any;
  hasInflections?: boolean;
  variantOf?: string;
  selfInflectionAnalysis?: any;
}

export interface WiktionaryResponse {
  success: boolean;
  entries: WiktionaryEntry[];
  error?: string;
}

// 全局查询缓存
const queryCache = new Map<string, { response: WiktionaryResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟
const MAX_CACHE_SIZE = 1000;

// 缓存工具函数
function getCacheKey(word: string, language: Language): string {
  return `${language.id}:${word.toLowerCase()}`;
}

function getFromCache(word: string, language: Language): WiktionaryResponse | null {
  const cacheKey = getCacheKey(word, language);
  const cached = queryCache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  // 检查缓存是否过期
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    queryCache.delete(cacheKey);
    return null;
  }
  
  console.debug('[WiktionaryService] Cache hit for:', { word, language: language.name });
  return cached.response;
}

function setToCache(word: string, language: Language, response: WiktionaryResponse): void {
  const cacheKey = getCacheKey(word, language);
  
  // 清理过期缓存
  if (queryCache.size >= MAX_CACHE_SIZE) {
    clearExpiredCache();
  }
  
  // 如果仍然超过大小限制，删除最旧的条目
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) {
      queryCache.delete(oldestKey);
    }
  }
  
  queryCache.set(cacheKey, {
    response,
    timestamp: Date.now()
  });
  
  console.debug('[WiktionaryService] Cached response for:', { word, language: language.name });
}

function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      queryCache.delete(key);
    }
  }
}

/**
 * 查询后端API词典
 */
async function queryBackendDictionary(word: string, language: Language): Promise<WiktionaryResponse> {
  try {
    const url = `${BACKEND_API_URL}/api/dictionary/query/${language.id}/${encodeURIComponent(word)}`;
    console.debug('[WiktionaryService] Querying backend API:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`[WiktionaryService] Backend API error: ${response.status}`);
      throw new Error(`Backend API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 转换后端API响应格式为前端格式
    if (data.success && data.entries && data.entries.length > 0) {
      const entries = data.entries.map((entry: any) => ({
        word: entry.word,
        language: entry.language,
        partOfSpeech: entry.partOfSpeech,
        definitions: entry.definitions || [],
        translations: [], // 后端API不提供翻译
        etymology: entry.etymology,
        pronunciation: entry.pronunciation,
        examples: entry.examples || [],
        synonyms: entry.synonyms || [],
        antonyms: entry.antonyms || [],
        isInflection: entry.isInflection || false,
        inflectionForm: entry.inflectionForm,
        rootWord: entry.rootWord,
        inflectionTags: entry.inflectionTags,
        rootEntry: entry.rootEntry,
        // 新增字段用于区分不同形式
        entryType: entry.entryType, // 'variant', 'root', 'normal'
        normalizedWord: entry.normalizedWord,
        inflectionAnalysis: entry.inflectionAnalysis,
        hasInflections: entry.hasInflections,
        variantOf: entry.variantOf,
        selfInflectionAnalysis: entry.selfInflectionAnalysis
      }));
      
      return {
        success: true,
        entries
      };
    } else {
        const notFoundResponse = {
          success: true,
          entries: [],
          error: 'Word not found in dictionary'
        };
        setToCache(word, language, notFoundResponse);
        return notFoundResponse;
    }
  } catch (error) {
    console.debug('[WiktionaryService] Backend API query failed:', error);
    throw error;
  }
}

/**
 * 查询词典获取单词定义和翻译
 * 浏览器环境使用后端API，Node.js环境使用SQLite词典
 */
export const queryWiktionary = async (
  word: string,
  language: Language
): Promise<WiktionaryResponse> => {
  console.debug('[WiktionaryService] Querying dictionary for:', {
    word,
    language: language.name,
    languageCode: language.id,
    environment: typeof window === 'undefined' ? 'Node.js' : 'Browser'
  });

  // 检查缓存
  const cachedResponse = getFromCache(word, language);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    if (typeof window === 'undefined') {
      // Node.js环境：使用SQLite词典
      try {
        const dictionaryResult = await sqliteDictionaryService.queryDictionary(word, language);
        
        if (dictionaryResult.success && dictionaryResult.entries.length > 0) {
          console.debug('[WiktionaryService] Found in SQLite dictionary:', {
            word,
            entries: dictionaryResult.entries.length
          });
          setToCache(word, language, dictionaryResult);
          return dictionaryResult;
        }
        
        console.debug('[WiktionaryService] Word not found in SQLite dictionary:', word);
        return {
          success: true,
          entries: [],
          error: 'Word not found in dictionary'
        };
      } catch (sqliteError) {
        console.debug('[WiktionaryService] SQLite dictionary error:', sqliteError);
        return {
          success: false,
          entries: [],
          error: 'SQLite dictionary error'
        };
      }
    } else {
      // 浏览器环境：首先尝试后端API，失败时使用browserDictionaryService
      // 使用较短的超时，避免UI延迟
      try {
        const dictionaryResult = await Promise.race([
          queryBackendDictionary(word, language),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Backend dictionary timeout')), 2000)
          )
        ]);
        
        if (dictionaryResult.success && dictionaryResult.entries.length > 0) {
          console.debug('[WiktionaryService] Found in backend API');
          setToCache(word, language, dictionaryResult);
          return dictionaryResult;
        }
        
        console.debug('[WiktionaryService] Word not found in backend API:', word);
        return {
          success: true,
          entries: [],
          error: 'Word not found in dictionary'
        };
      } catch (backendError) {
        console.debug('[WiktionaryService] Backend API error, trying browser dictionary:', backendError);
        
        // 尝试使用browserDictionaryService作为备选
        try {
          const browserResult = await browserDictionaryService.queryDictionary(word, language);
          
          if (browserResult.success && browserResult.entries.length > 0) {
            console.debug('[WiktionaryService] Found in browser dictionary');
            setToCache(word, language, browserResult);
            return browserResult;
          }
          
          console.debug('[WiktionaryService] Word not found in browser dictionary:', word);
          
          // 如果没有找到，返回更友好的错误信息
          const notFoundResponse = {
            success: true,
            entries: [],
            error: 'Word not found in dictionary. Dictionary server may be offline.'
          };
          setToCache(word, language, notFoundResponse);
          return notFoundResponse;
        } catch (browserError) {
          console.debug('[WiktionaryService] Browser dictionary also failed:', browserError);
          
          // 检查是否为开发环境，如果是则使用模拟数据
          const isDevelopment = typeof window !== 'undefined' && 
                               (window.location.hostname === 'localhost' || 
                                window.location.hostname === '127.0.0.1');
          
           if (isDevelopment) {
             console.debug('[WiktionaryService] Development environment, using mock data');
             const mockResponse = getMockDictionaryData(word, language);
             setToCache(word, language, mockResponse);
             return mockResponse;
          }
          
          return {
            success: false,
            entries: [],
            error: 'Dictionary services unavailable. Please start the dictionary server or check connection.'
          };
        }
      }
    }
    
  } catch (error) {
    console.error('[WiktionaryService] Error querying dictionary:', error);
    return {
      success: false,
      entries: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * 获取单词的词典URL
 * 如果单词在词典中找到，返回Wiktionary URL
 */
export const getWiktionaryUrl = async (word: string, language: Language): Promise<string> => {
  try {
    // 根据环境选择词典服务
    let dictionaryUrl = '';
    
    if (typeof window === 'undefined') {
      // Node.js环境：使用SQLite词典
      const sqliteResult = await sqliteDictionaryService.queryDictionary(word, language);
      if (sqliteResult.success && sqliteResult.entries.length > 0) {
        dictionaryUrl = await sqliteDictionaryService.getDictionaryUrl(word, language);
      }
    } else {
      // 浏览器环境：总是返回Wiktionary URL
      dictionaryUrl = `https://${language.id}.wiktionary.org/wiki/${encodeURIComponent(word)}`;
    }
    
    return dictionaryUrl;
  } catch (error) {
    console.debug('[WiktionaryService] Failed to get dictionary URL:', error);
    return '';
  }
};

/**
 * 测试词典连接
 * Node.js环境测试SQLite连接，浏览器环境测试后端API连接
 */
export const testWiktionaryConnection = async (): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') {
      // Node.js环境：测试SQLite词典
      const sqliteConnected = await sqliteDictionaryService.testConnection();
      if (sqliteConnected) {
        console.debug('[WiktionaryService] SQLite dictionary connection successful');
        return true;
      }
    } else {
      // 浏览器环境：测试后端API连接
      try {
        const response = await fetch(`${BACKEND_API_URL}/health`, { 
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          console.debug('[WiktionaryService] Backend API connection successful');
          return true;
        }
      } catch (apiError) {
        console.debug('[WiktionaryService] Backend API test failed:', apiError);
      }
    }
    
    return false;
  } catch {
    return false;
  }
};

/**
 * 获取词典统计信息
 */
export const getDictionaryStats = async (languageCode: string): Promise<{
  wordCount: number;
  isLocal: boolean;
}> => {
  try {
    let wordCount = 0;
    let isLocal = false;
    
    if (typeof window === 'undefined') {
      // Node.js环境：获取SQLite词典统计
      wordCount = await sqliteDictionaryService.getWordCount(languageCode);
      isLocal = wordCount > 0;
    } else {
      // 浏览器环境：通过后端API获取统计
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/dictionary/stats/${languageCode}`);
        if (response.ok) {
          const stats = await response.json();
          wordCount = stats.wordCount || 0;
        }
      } catch (apiError) {
        console.debug('[WiktionaryService] Backend API stats request failed:', apiError);
      }
      // 浏览器环境始终使用API，不视为本地词典
      isLocal = false;
    }
    
    return {
      wordCount,
      isLocal
    };
  } catch (error) {
    console.error('[WiktionaryService] Error getting dictionary stats:', error);
    return {
      wordCount: 0,
      isLocal: false
    };
  }
};