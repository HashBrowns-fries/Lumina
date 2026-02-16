// SQLite Dictionary Service - Pure JavaScript Version (CommonJS)

import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// 仅用于模拟 TS 接口结构，在 JS 中是多余的，但保留以供参考 (稍后会移除以简化代码)
/*
const DictionaryEntry = { ... };
const Sense = { ... };
const Form = { ... };
const Sound = { ... };
*/

class SQLiteDictionaryService {
  constructor() {
    this.dbPaths = new Map();
    this.connections = new Map();
    this.queryCache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
    this.MAX_CACHE_SIZE = 1000; // Maximum cache entries
    
    this.initializeDatabasePaths();
  }

  initializeDatabasePaths() {
    // Calculate project root correctly for Node.js CJS environment
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.join(__dirname, '..');
    
    // Map language codes to SQLite database file paths
    this.dbPaths.set('de', path.join(projectRoot, 'dict', 'German', 'german_dict.db'));
    // More languages can be added
  }

  getCacheKey(word, languageCode) {
    return `${languageCode}:${word.toLowerCase()}`;
  }

  getFromCache(word, languageCode) {
    const cacheKey = this.getCacheKey(word, languageCode);
    const cached = this.queryCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache has expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    console.log(`[SQLiteDictionary] Cache hit for: ${word} (${languageCode})`);
    return cached.response;
  }

  setToCache(word, languageCode, response) {
    const cacheKey = this.getCacheKey(word, languageCode);

    // Clean up expired cache
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      this.clearExpiredCache();
    }

    // If still over size limit, remove oldest entry
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

    console.log(`[SQLiteDictionary] Cached response for: ${word} (${languageCode})`);
  }

  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.queryCache.delete(key);
      }
    }
  }

  async getConnection(languageCode) {
    if (this.connections.has(languageCode)) {
      return this.connections.get(languageCode);
    }

    const dbPath = this.dbPaths.get(languageCode);
    if (!dbPath) {
      throw new Error(`No database file found for language: ${languageCode}`);
    }

    try {
      console.log(`[SQLiteDictionary] Connecting to database for ${languageCode} from ${dbPath}`);

      let db;

      if (typeof window !== 'undefined') {
        // Browser environment - SQLite not currently supported
        console.warn('[SQLiteDictionary] SQLite not supported in browser environment. Using fallback.');
        throw new Error('SQLite not supported in browser environment');
      } else {
        // Node.js environment - use sqlite3
        // Note: sqlite3 and sqlite modules are expected to be installed in server/node_modules
        const sqlite3Module = sqlite3; // sqlite3 is already imported

        db = await open({
          filename: dbPath,
          driver: sqlite3Module.Database
        });

        // Optimize settings
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

  normalizeWord(word) {
    // Same normalization logic as Python conversion script
    if (!word) return '';

    let normalized = word.toLowerCase();

    // Handle German special characters
    const replacements = {
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

    // Remove all non-alphanumeric characters (except hyphens)
    normalized = normalized.replace(/[^a-z0-9-]/g, '');

    return normalized;
  }

  isBaseForm(tags) {
    if (!tags) return false;
    
    try {
      let tagArray = [];
      if (typeof tags === 'string') {
        try {
          const jsonTags = JSON.parse(tags);
          if (Array.isArray(jsonTags)) {
            tagArray = jsonTags;
          }
        } catch (e) {
          // Not JSON, try pipe-separated
          tagArray = tags.split('|').filter(tag => tag.trim());
        }
      } else if (Array.isArray(tags)) {
        tagArray = tags;
      }
      
      // Check for base form indicators
      const baseFormIndicators = ['infinitive', 'nominative', 'positive', 'base'];
      const singularIndicators = ['singular'];
      
      // If any base form indicator is present
      for (const tag of tagArray) {
        const lowerTag = tag.toLowerCase();
        if (baseFormIndicators.some(indicator => lowerTag.includes(indicator))) {
          return true;
        }
      }
      
      // For nouns, nominative singular is base form
      if (tagArray.includes('nominative') && tagArray.includes('singular')) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[SQLiteDictionary] Error checking if tags indicate base form:', error);
      return false;
    }
  }

  async findAllMatches(word, languageCode) {
    const db = await this.getConnection(languageCode);
    const normalizedWord = this.normalizeWord(word);
    const matches = [];

    try {
      // First find all form matches (inflection forms)
      console.log(`[SQLiteDictionary] Checking forms table for "${word}" (normalized: "${normalizedWord}")`);
      const formMatches = await db.all(`
        SELECT DISTINCT d.*, f.tags, f.form as inflection_form 
        FROM dictionary d
        JOIN forms f ON d.id = f.dictionary_id
        WHERE f.normalized_form = ? OR f.form = ?
        ORDER BY d.pos, d.word
      `, [normalizedWord, word]);

      if (formMatches.length > 0) {
        console.log(`[SQLiteDictionary] Found ${formMatches.length} form matches`);
        for (const formMatch of formMatches) {
          matches.push({ 
            entry: {
              id: formMatch.id,
              word: formMatch.word,
              normalized_word: formMatch.normalized_word,
              pos: formMatch.pos,
              etymology_text: formMatch.etymology_text
            }, 
            isInflection: true,
            formTags: formMatch.tags,
            inflectionForm: formMatch.inflection_form
          });
        }
      } else {
        console.log(`[SQLiteDictionary] No form matches found for "${word}"`);
      }

      // Then find all direct dictionary matches
      const dictEntries = await db.all(`
        SELECT * FROM dictionary 
        WHERE normalized_word = ? OR word = ?
        ORDER BY pos, word
      `, [normalizedWord, word]);

      if (dictEntries.length > 0) {
        console.log(`[SQLiteDictionary] Found ${dictEntries.length} dictionary matches`);
        // Add dictionary matches that are not already covered by form matches
        // (by checking if the dictionary entry is already in matches)
        const existingIds = new Set(matches.map(m => m.entry.id));
        for (const entry of dictEntries) {
          if (!existingIds.has(entry.id)) {
            matches.push({ entry, isInflection: false });
          }
        }
      }

      console.log(`[SQLiteDictionary] Total matches found: ${matches.length}`);
      return matches;
    } catch (error) {
      console.error(`[SQLiteDictionary] Error finding matches for "${word}":`, error);
      return [];
    }
  }

  async getEntryDetails(entryId, languageCode) {
    const db = await this.getConnection(languageCode);

    try {
      const [senses, synonyms, antonyms, forms, sounds] = await Promise.all([
        // Get senses
        db.all(`
          SELECT gloss, example FROM senses 
          WHERE dictionary_id = ? 
          ORDER BY sense_index
        `, [entryId]),

        // Get synonyms
        db.all(`
          SELECT synonym FROM synonyms 
          WHERE dictionary_id = ?
        `, [entryId]),

        // Get antonyms
        db.all(`
          SELECT antonym FROM antonyms 
          WHERE dictionary_id = ?
        `, [entryId]),

        // Get forms
        db.all(`
          SELECT form, normalized_form, tags FROM forms 
          WHERE dictionary_id = ?
        `, [entryId]),

        // Get sounds
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

  convertToWiktionaryEntry(entry, details, language, originalWord, isInflection, formTags = null) {
    const definitions = details.senses.map(sense => sense.gloss);
    const examples = details.senses
      .map(sense => sense.example)
      .filter((example) => example !== null);

    // Extract primary pronunciation (IPA only)
    let pronunciation = '';
    if (details.sounds.length > 0) {
      const firstSound = details.sounds[0];
      if (firstSound.ipa) {
        pronunciation = `${firstSound.ipa}`; // Display only IPA without prefix
      }
      // Skip audio URLs, only show IPA
    }

    // Determine entry type
    let entryType = 'normal';
    let variantOf = undefined;
    let actualIsInflection = isInflection;
    
    // Check if this is actually a base form (e.g., infinitive, nominative singular)
    if (isInflection && formTags) {
      console.log(`[SQLiteDictionary] Checking if form is base: tags="${formTags}", word="${entry.word}"`);
      const isBase = this.isBaseForm(formTags);
      console.log(`[SQLiteDictionary] isBaseForm result: ${isBase}`);
      if (isBase) {
        actualIsInflection = false;
        entryType = 'normal';
        console.log(`[SQLiteDictionary] Setting as base form (normal entry): ${entry.word}`);
      } else {
        entryType = 'variant';
        console.log(`[SQLiteDictionary] Setting as variant form: ${entry.word}`);
        // For variant forms, rootWord is the dictionary form (entry.word)
        // variantOf is not set for variants
      }
    } else if (!isInflection && originalWord.toLowerCase() !== entry.word.toLowerCase()) {
      // This is a root form that was found for a different query word
      entryType = 'root';
      variantOf = originalWord;
      console.log(`[SQLiteDictionary] Setting as root form for variant: ${entry.word} (variant of: ${originalWord})`);
    }
    
    // For variant forms, we need to provide inflection analysis
    let inflectionAnalysis = undefined;
    if (actualIsInflection) {
      // Parse form tags to determine inflection type
      let inflectionType = 'inflection';
      if (formTags) {
        try {
          // Try parsing as JSON array first (e.g., '["genitive"]')
          const jsonTags = JSON.parse(formTags);
          if (Array.isArray(jsonTags) && jsonTags.length > 0) {
            inflectionType = jsonTags.join(' ');
          }
        } catch (e) {
          // If not JSON, parse as pipe-separated tags like "genitive|singular"
          const tags = formTags.split('|').filter(tag => tag.trim());
          if (tags.length > 0) {
            inflectionType = tags.join(' ');
          }
        }
      }
      
      inflectionAnalysis = {
        inflectionType: inflectionType,
        description: `${inflectionType} of ${entry.word}`
      };
    }
    
    return {
      word: entry.word,
      language: language.name,
      partOfSpeech: entry.pos || undefined,
      definitions: definitions.length > 0 ? definitions : [`${entry.pos || 'word'}: ${entry.word}`],
      translations: [], // SQLite dictionary doesn't contain translations
      etymology: entry.etymology_text || undefined,
      pronunciation: pronunciation || undefined,
      examples: examples.length > 0 ? examples : [],
      synonyms: details.synonyms,
      antonyms: details.antonyms,
      isInflection: actualIsInflection,
      inflectionForm: actualIsInflection ? originalWord : undefined,
      rootWord: actualIsInflection ? entry.word : undefined,
      entryType: entryType,
      variantOf: variantOf,
      inflectionAnalysis: inflectionAnalysis
    };
  }

  async queryDictionary(word, language) {
    console.log('[SQLiteDictionary] Querying dictionary for:', {
      word,
      language: language.name,
      languageCode: language.id
    });

    // Check cache
    const cachedResponse = this.getFromCache(word, language.id);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      // Find all matches
      const matchResults = await this.findAllMatches(word, language.id);

      if (matchResults.length === 0) {
        console.log('[SQLiteDictionary] No matches found for:', word);
        const notFoundResponse = {
          success: true,
          entries: [],
          error: 'Word not found in dictionary'
        };
        // Cache "not found" results to avoid repeated queries for non-existent words
        this.setToCache(word, language.id, notFoundResponse);
        return notFoundResponse;
      }

      console.log(`[SQLiteDictionary] Found ${matchResults.length} matches for:`, word);
      
      // Get detailed information for each match and convert to entries
      const entries = [];
      for (const matchResult of matchResults) {
        const { entry: dictEntry, isInflection, formTags, inflectionForm } = matchResult;
        console.log('[SQLiteDictionary] Processing entry:', dictEntry.word, 'isInflection:', isInflection, 'formTags:', formTags);
        
        // Get detailed information
        const details = await this.getEntryDetails(dictEntry.id, language.id);
        
        // Convert to Wiktionary entry format
        const wiktionaryEntry = this.convertToWiktionaryEntry(dictEntry, details, language, word, isInflection, formTags);
        entries.push(wiktionaryEntry);
      }

      const response = {
        success: true,
        entries: entries
      };

      // Cache successful query result
      this.setToCache(word, language.id, response);
      return response;

    } catch (error) {
      console.error('[SQLiteDictionary] Error querying dictionary:', error);
      const errorResponse = {
        success: false,
        entries: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      // Don't cache error responses
      return errorResponse;
    }
  }

  async searchWords(query, languageCode, limit = 20) {
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

  async getDictionaryUrl(word, language) {
    return `sqlite://dict/${language.id}/${encodeURIComponent(word)}`;
  }

  async testConnection() {
    try {
      // Test German database connection
      const db = await this.getConnection('de');
      const result = await db.get('SELECT COUNT(*) as count FROM dictionary');
      return result && result.count > 0;
    } catch {
      return false;
    }
  }

  async getWordCount(languageCode) {
    try {
      const db = await this.getConnection(languageCode);
      const result = await db.get('SELECT COUNT(*) as count FROM dictionary');
      return result?.count || 0;
    } catch {
      return 0;
    }
  }

  async getStatistics(languageCode) {
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

  async closeConnections() {
    for (const [languageCode, db] of this.connections) {
      try {
        await db.close();
        console.log(`[SQLiteDictionary] Closed connection for ${languageCode}`);
      } catch (error) {
        console.error(`[SQLiteDictionary] Error closing connection for ${languageCode}:`, error);
      }
    }
    this.connections.clear();
  }
}

// Export singleton instance
export const sqliteDictionaryService = new SQLiteDictionaryService();
export const createDictionaryService = () => new SQLiteDictionaryService();