import { Language } from '../types';
import { WiktionaryEntry, WiktionaryResponse } from './wiktionaryService.ts';

const DICT_API_BASE = 'http://localhost:3011';

export class SQLiteDictionaryService {
  private queryCache: Map<string, { response: WiktionaryResponse; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 1000;

  private getCacheKey(word: string, languageCode: string): string {
    return `${languageCode}:${word.toLowerCase()}`;
  }

  private getFromCache(word: string, languageCode: string): WiktionaryResponse | null {
    const key = this.getCacheKey(word, languageCode);
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.queryCache.delete(key);
      return null;
    }
    return cached.response;
  }

  private setToCache(word: string, languageCode: string, response: WiktionaryResponse): void {
    const key = this.getCacheKey(word, languageCode);
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      const oldest = this.queryCache.keys().next().value;
      if (oldest) this.queryCache.delete(oldest);
    }
    this.queryCache.set(key, { response, timestamp: Date.now() });
  }

  public async queryDictionary(
    word: string,
    language: Language
  ): Promise<WiktionaryResponse> {
    const cached = this.getFromCache(word, language.id);
    if (cached) return cached;

    try {
      const url = `${DICT_API_BASE}/api/dictionary/search?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language.id)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.success) {
        return { success: false, entries: [], error: data.error || 'Search failed' };
      }

      const entries: WiktionaryEntry[] = (data.entries || []).map((e: any) => ({
        word: e.word,
        language: e.language || language.name,
        partOfSpeech: e.partOfSpeech || undefined,
        definitions: e.definitions || [],
        translations: e.translations || [],
        etymology: e.etymology || undefined,
        pronunciation: e.pronunciation || undefined,
        examples: e.examples || [],
        synonyms: [],
        antonyms: [],
        inflectionForms: e.inflectionForms || [],
      }));

      const response: WiktionaryResponse = {
        success: true,
        entries,
        error: entries.length === 0 ? 'Word not found in dictionary' : undefined,
      };

      this.setToCache(word, language.id, response);
      return response;
    } catch (error) {
      console.error('[SQLiteDictionary] API error:', error);
      return {
        success: false,
        entries: [],
        error: error instanceof Error ? error.message : 'Dictionary API unavailable',
      };
    }
  }

  public async searchWords(
    query: string,
    languageCode: string,
    _limit: number = 20
  ): Promise<Array<{ word: string; pos: string | null }>> {
    try {
      const url = `${DICT_API_BASE}/api/dictionary/search?word=${encodeURIComponent(query)}&language=${encodeURIComponent(languageCode)}`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.entries || []).map((e: any) => ({ word: e.word, pos: e.partOfSpeech || null }));
    } catch {
      return [];
    }
  }

  public async getDictionaryUrl(word: string, language: Language): Promise<string> {
    return `sqlite://dict/${language.id}/${encodeURIComponent(word)}`;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${DICT_API_BASE}/health`);
      const data = await res.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  public async getWordCount(languageCode: string): Promise<number> {
    try {
      const res = await fetch(`${DICT_API_BASE}/api/dictionary/installed`);
      const installed = await res.json();
      const lang = installed.find((d: any) => d.code === languageCode);
      return lang?.word_count || 0;
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
      const res = await fetch(`${DICT_API_BASE}/api/dictionary/installed`);
      const installed = await res.json();
      const lang = installed.find((d: any) => d.code === languageCode);
      return {
        wordCount: lang?.word_count || 0,
        senseCount: lang?.sense_count || 0,
        formCount: lang?.form_count || 0,
        synonymCount: 0,
      };
    } catch {
      return { wordCount: 0, senseCount: 0, formCount: 0, synonymCount: 0 };
    }
  }

  public async closeConnections(): Promise<void> {
    this.queryCache.clear();
  }
}

export const sqliteDictionaryService = new SQLiteDictionaryService();
