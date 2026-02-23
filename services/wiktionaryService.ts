import { Language } from '../types';
import { sqliteDictionaryService } from './sqliteDictionaryService.ts';
import { browserDictionaryService } from './browserDictionaryService.ts';
import { invoke } from '@tauri-apps/api/core';

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
  entryType?: string;
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

const queryCache = new Map<string, { response: WiktionaryResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

function getCacheKey(word: string, language: Language): string {
  return `${language.id}:${word.toLowerCase()}`;
}

function getFromCache(word: string, language: Language): WiktionaryResponse | null {
  const cached = queryCache.get(getCacheKey(word, language));
  if (!cached || Date.now() - cached.timestamp > CACHE_TTL) {
    return null;
  }
  return cached.response;
}

function setToCache(word: string, language: Language, response: WiktionaryResponse): void {
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }
  queryCache.set(getCacheKey(word, language), { response, timestamp: Date.now() });
}

async function queryTauriDictionary(word: string, language: Language): Promise<WiktionaryResponse> {
  try {
    const result: any = await invoke('search_dictionary', { word, language: language.id });
    
    if (result.success && result.entries && result.entries.length > 0) {
      const entries = result.entries.map((entry: any) => {
        // 解析 inflectionAnalysis
        let inflectionAnalysis = null;
        let hasInflections = false;
        
        if (entry.inflections && Array.isArray(entry.inflections)) {
          inflectionAnalysis = {
            inflections: entry.inflections.map((inf: any) => ({
              form: inf.form,
              tags: inf.tags ? JSON.parse(inf.tags) : [],
              normalized_form: inf.normalized_form
            }))
          };
          hasInflections = true;
        }
        
        return {
          word: entry.text,
          language: entry.language,
          partOfSpeech: entry.grammar || null,
          definitions: entry.definition ? [entry.definition] : [],
          translations: [],
          etymology: entry.etymology || null,
          pronunciation: null,
          examples: [],
          synonyms: [],
          antonyms: [],
          isInflection: false,
          inflectionForm: null,
          rootWord: entry.root_form || null,
          inflectionTags: null,
          rootEntry: null,
          entryType: 'normal',
          normalizedWord: entry.root_form || null,
          inflectionAnalysis,
          hasInflections,
          variantOf: null,
          selfInflectionAnalysis: null
        };
      });
      
      return { success: true, entries };
    }
    
    return { success: true, entries: [], error: 'Word not found in dictionary' };
  } catch (error) {
    console.debug('[WiktionaryService] Tauri query failed:', error);
    throw error;
  }
}

export const queryWiktionary = async (
  word: string,
  language: Language
): Promise<WiktionaryResponse> => {
  const cached = getFromCache(word, language);
  if (cached) return cached;

  try {
    if (typeof window === 'undefined') {
      const result = await sqliteDictionaryService.queryDictionary(word, language);
      if (result.success && result.entries.length > 0) {
        setToCache(word, language, result);
        return result;
      }
      return { success: true, entries: [], error: 'Word not found' };
    } else {
      const result = await queryTauriDictionary(word, language);
      if (result.success && result.entries.length > 0) {
        setToCache(word, language, result);
        return result;
      }
      const notFound = { success: true, entries: [], error: 'Word not found in dictionary' };
      setToCache(word, language, notFound);
      return notFound;
    }
  } catch (error) {
    console.error('[WiktionaryService] Error:', error);
    return { success: false, entries: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const getWiktionaryUrl = async (word: string, language: Language): Promise<string> => {
  return `https://${language.id}.wiktionary.org/wiki/${encodeURIComponent(word)}`;
};

export const testWiktionaryConnection = async (): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') {
      return await sqliteDictionaryService.testConnection();
    }
    return true;
  } catch {
    return false;
  }
};

export const getDictionaryStats = async (languageCode: string): Promise<{
  wordCount: number;
  isLocal: boolean;
}> => {
  try {
    if (typeof window === 'undefined') {
      const count = await sqliteDictionaryService.getWordCount(languageCode);
      return { wordCount: count, isLocal: count > 0 };
    }
    const result: any = await invoke('get_dictionary_stats', { language: languageCode });
    return {
      wordCount: result.success && result.stats ? result.stats.wordCount : 0,
      isLocal: result.success
    };
  } catch {
    return { wordCount: 0, isLocal: false };
  }
};
