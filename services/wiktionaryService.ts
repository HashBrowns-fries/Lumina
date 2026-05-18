import { Language } from '../types';
import { sqliteDictionaryService } from './sqliteDictionaryService.ts';

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
  inflectionForms?: Array<{ form: string; tags?: string; normalizedForm?: string }>;
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

export const queryWiktionary = async (
  word: string,
  language: Language
): Promise<WiktionaryResponse> => {
  const cached = getFromCache(word, language);
  if (cached) return cached;

  try {
    const result = await sqliteDictionaryService.queryDictionary(word, language);
    if (result.success && result.entries.length > 0) {
      setToCache(word, language, result);
      return result;
    }
    const notFound = { success: true, entries: [], error: 'Word not found in dictionary' };
    setToCache(word, language, notFound);
    return notFound;
  } catch (error) {
    console.error('[WiktionaryService] Error:', error);
    return { success: false, entries: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const getWiktionaryUrl = async (word: string, language: Language): Promise<string> => {
  return `https://${language.id}.wiktionary.org/wiki/${encodeURIComponent(word)}`;
};

export const testWiktionaryConnection = async (): Promise<boolean> => {
  return sqliteDictionaryService.testConnection();
};

export const getDictionaryStats = async (languageCode: string): Promise<{
  wordCount: number;
  isLocal: boolean;
}> => {
  try {
    const count = await sqliteDictionaryService.getWordCount(languageCode);
    return { wordCount: count, isLocal: count > 0 };
  } catch {
    return { wordCount: 0, isLocal: false };
  }
};
