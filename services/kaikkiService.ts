import { browserDictionaryService } from './browserDictionaryService';

// Kaikki 支持的语言映射
const KAIKKI_LANGUAGE_MAP: Record<string, string> = {
  'de': 'German',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
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
  'tr': 'Turkish',
  'el': 'Greek',
  'he': 'Hebrew',
  'hi': 'Hindi',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'cs': 'Czech',
  'hu': 'Hungarian',
  'ro': 'Romanian',
  'id': 'Indonesian',
  'uk': 'Ukrainian'
};

// 可用的解释语言
export const GLOSS_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ru', name: 'Russian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' }
];

export interface KaikkiDownloadProgress {
  status: 'downloading' | 'processing' | 'importing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  entriesImported?: number;
}

export type ProgressCallback = (progress: KaikkiDownloadProgress) => void;

// 后端 API 地址
const BACKEND_API_URL = (() => {
  try {
    if (typeof window !== 'undefined' && (window as any).DICTIONARY_API_URL) {
      return (window as any).DICTIONARY_API_URL;
    }
    if (typeof process !== 'undefined' && process.env?.DICTIONARY_API_URL) {
      return process.env.DICTIONARY_API_URL;
    }
  } catch (error) {
    console.debug('[KaikkiService] Failed to read API URL from environment:', error);
  }
  return 'http://localhost:3003';
})();

/**
 * 从 Kaikki.org 下载词典数据（通过后端代理）
 * @param languageCode 语言代码 (如 'de', 'en')
 * @param glossLanguage 解释语言代码 (如 'en', 'zh')
 * @param onProgress 进度回调
 */
export async function downloadKaikkiDictionary(
  languageCode: string,
  glossLanguage: string = 'en',
  onProgress?: ProgressCallback
): Promise<{ success: boolean; entriesImported: number; error?: string }> {
  const kaikkiLang = KAIKKI_LANGUAGE_MAP[languageCode];
  
  if (!kaikkiLang) {
    return {
      success: false,
      entriesImported: 0,
      error: `Unsupported language: ${languageCode}`
    };
  }
  
  const glossLang = KAIKKI_LANGUAGE_MAP[glossLanguage] || 'English';
  
  try {
    onProgress?.({
      status: 'downloading',
      progress: 0,
      message: `Downloading ${kaikkiLang} dictionary from Kaikki.org...`
    });
    
    // 通过后端 API 代理下载
    const url = `${BACKEND_API_URL}/api/kaikki/download/${encodeURIComponent(kaikkiLang)}/${encodeURIComponent(glossLang)}`;
    
    console.debug('[KaikkiService] Downloading from backend:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }
    
    onProgress?.({
      status: 'completed',
      progress: 100,
      message: `Successfully imported ${result.entriesImported} entries!`,
      entriesImported: result.entriesImported
    });
    
    return {
      success: true,
      entriesImported: result.entriesImported
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KaikkiService] Download failed:', errorMessage);
    
    onProgress?.({
      status: 'error',
      progress: 0,
      message: `Download failed: ${errorMessage}`
    });
    
    return {
      success: false,
      entriesImported: 0,
      error: errorMessage
    };
  }
}

/**
 * 检查语言是否支持 Kaikki
 */
export function isKaikkiSupported(languageCode: string): boolean {
  return languageCode in KAIKKI_LANGUAGE_MAP;
}

/**
 * 获取 Kaikki 语言名称
 */
export function getKaikkiLanguageName(languageCode: string): string | null {
  return KAIKKI_LANGUAGE_MAP[languageCode] || null;
}

/**
 * 获取已下载的词典语言列表
 */
export async function getDownloadedLanguages(): Promise<string[]> {
  try {
    // 从 IndexedDB 查询已导入的语言
    const languages = new Set<string>();
    // 这里需要实现查询逻辑，暂时返回空数组
    return Array.from(languages);
  } catch (error) {
    console.error('[KaikkiService] Failed to get downloaded languages:', error);
    return [];
  }
}
