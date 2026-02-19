// SQLite Dictionary Service - Pure JavaScript Version (CommonJS)

import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import { promisify } from 'util';

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

  // Convert SLP1 to Devanagari using vidyut API
  async slp1ToDevanagari(text) {
    if (!text || text.length === 0) return text;
    
    // Don't convert if already Devanagari
    if (/[\u0900-\u097F]/.test(text)) return text;
    
    try {
      const response = await fetch('http://localhost:3006/api/sanskrit/transliterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          fromScheme: 'slp1',
          toScheme: 'devanagari'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.transliterated) {
          return data.transliterated;
        }
      }
    } catch (e) {
      console.warn('[SQLiteDictionary] transliterate API failed, using fallback:', e.message);
    }
    
    // Fallback: simple character-by-character conversion
    const simpleMap = {
      'a': 'अ', 'A': 'आ', 'i': 'इ', 'I': 'ई', 'u': 'उ', 'U': 'ऊ',
      'r': 'ऋ', 'R': 'ॠ',
      'e': 'ए', 'o': 'ओ',
      'M': 'ं', 'H': 'ः',
      'k': 'क', 'K': 'ख', 'g': 'ग', 'G': 'घ', 'N': 'ङ',
      'c': 'च', 'C': 'छ', 'j': 'ज', 'J': 'झ', 'Y': 'ञ',
      'w': 'ट', 'W': 'ठ', 'q': 'ड', 'Q': 'ढ', 'R': 'ण',
      't': 'त', 'T': 'थ', 'd': 'द', 'D': 'ध', 'n': 'न',
      'p': 'प', 'P': 'फ', 'b': 'ब', 'B': 'भ', 'm': 'म',
      'y': 'य', 'l': 'ल', 'v': 'व',
      'S': 'श', 'z': 'ष', 's': 'स', 'h': 'ह'
    };
    
    let result = '';
    for (const char of text) {
      result += simpleMap[char] || char;
    }
    return result;
  }

  initializeDatabasePaths() {
    // Calculate project root correctly for Node.js CJS environment
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.join(__dirname, '..');
    const dictDir = path.join(projectRoot, 'dict');
    
    console.log(`[SQLiteDictionary] 扫描词典目录: ${dictDir}`);
    
    try {
      // 检查dict目录是否存在
      if (!fs.existsSync(dictDir)) {
        console.warn(`[SQLiteDictionary] 词典目录不存在: ${dictDir}`);
        return;
      }
      
      // 读取dict目录中的所有子目录
      const languageDirs = fs.readdirSync(dictDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      console.log(`[SQLiteDictionary] 找到语言目录: ${languageDirs.join(', ')}`);
      
      let foundCount = 0;
      
      // 遍历每个语言目录，查找数据库文件
      for (const langDir of languageDirs) {
        const fullLangDir = path.join(dictDir, langDir);
        
        try {
          // 查找该目录下的 *_dict.db 文件
          const files = fs.readdirSync(fullLangDir);
          const dbFiles = files.filter(file => file.endsWith('_dict.db'));
          
          for (const dbFile of dbFiles) {
            const dbPath = path.join(fullLangDir, dbFile);
            
            // 从文件名提取语言代码
            // 支持两种格式:
            // 1. {iso_code}_dict.db (例如: de_dict.db, sa_dict.db) - 推荐格式
            // 2. {language_name}_dict.db (例如: german_dict.db, sanskrit_dict.db) - 旧格式兼容
            let isoCode = null;
            
            // 尝试匹配ISO代码格式
            const isoMatch = dbFile.match(/^([a-z]{2})_dict\.db$/);
            if (isoMatch) {
              isoCode = isoMatch[1];
            } else {
              // 尝试从语言名称映射到ISO代码
              const langMatch = dbFile.match(/^([a-zA-Z]+)_dict\.db$/);
              if (langMatch) {
                const languageName = langMatch[1].toLowerCase();
                // 简单的语言名称到ISO代码映射
                const languageToCode = {
                  'german': 'de',
                  'sanskrit': 'sa',
                  'english': 'en',
                  'french': 'fr',
                  'spanish': 'es',
                  'italian': 'it',
                  'portuguese': 'pt',
                  'russian': 'ru',
                  'chinese': 'zh',
                  'japanese': 'ja',
                  'korean': 'ko',
                  'arabic': 'ar',
                  'dutch': 'nl',
                  'polish': 'pl',
                  'swedish': 'sv',
                  'danish': 'da',
                  'finnish': 'fi',
                  'norwegian': 'no',
                  'latin': 'la',
                  'turkish': 'tr',
                  'greek': 'el',
                  'hebrew': 'he',
                  'hindi': 'hi',
                  'thai': 'th',
                  'vietnamese': 'vi'
                };
                
                isoCode = languageToCode[languageName];
                if (isoCode) {
                  console.log(`[SQLiteDictionary] 映射语言名称: ${languageName} -> ${isoCode}`);
                }
              }
            }
            
            if (isoCode) {
              // 检查数据库文件是否可访问
              if (fs.existsSync(dbPath)) {
                this.dbPaths.set(isoCode, dbPath);
                console.log(`[SQLiteDictionary] 注册语言: ${isoCode} -> ${dbPath}`);
                foundCount++;
              }
            } else {
              console.warn(`[SQLiteDictionary] 无法识别数据库文件语言: ${dbFile} (应为 {iso_code}_dict.db 格式)`);
            }
          }
        } catch (error) {
          console.warn(`[SQLiteDictionary] 读取语言目录时出错 ${langDir}:`, error.message);
        }
      }
      
      // 如果没有找到任何数据库，添加默认的德语数据库（向后兼容）
      if (foundCount === 0) {
        const defaultPath = path.join(projectRoot, 'dict', 'German', 'german_dict.db');
        if (fs.existsSync(defaultPath)) {
          this.dbPaths.set('de', defaultPath);
          console.log(`[SQLiteDictionary] 注册默认语言: de -> ${defaultPath}`);
        }
      }
      
      console.log(`[SQLiteDictionary] 已注册 ${this.dbPaths.size} 种语言的词典数据库`);
      
      // 打印已注册的语言
      for (const [code, dbPath] of this.dbPaths) {
        console.log(`  - ${code}: ${dbPath}`);
      }
      
    } catch (error) {
      console.error('[SQLiteDictionary] 初始化数据库路径时出错:', error);
      // 在错误情况下仍设置默认路径
      const defaultPath = path.join(projectRoot, 'dict', 'German', 'german_dict.db');
      if (fs.existsSync(defaultPath)) {
        this.dbPaths.set('de', defaultPath);
      }
    }
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

    // Preserve original case for dictionary lookups
    let normalized = word;

    // Handle German special characters (case-insensitive)
    const replacements = [
      ['ä', 'ae'], ['Ä', 'Ae'],
      ['ö', 'oe'], ['Ö', 'Oe'],
      ['ü', 'ue'], ['Ü', 'Ue'],
      ['ß', 'ss'], ['ẞ', 'Ss'],
      ['é', 'e'], ['è', 'e'], ['ê', 'e'],
      ['É', 'E'], ['È', 'E'], ['Ê', 'E'],
      ['á', 'a'], ['à', 'a'], ['â', 'a'],
      ['Á', 'A'], ['À', 'A'], ['Â', 'A'],
      ['ó', 'o'], ['ò', 'o'], ['ô', 'o'],
      ['Ó', 'O'], ['Ò', 'O'], ['Ô', 'O'],
      ['ú', 'u'], ['ù', 'u'], ['û', 'u'],
      ['Ú', 'U'], ['Ù', 'U'], ['Û', 'U'],
      ['ï', 'i'], ['î', 'i'],
      ['Ï', 'I'], ['Î', 'I'],
      ['ç', 'c'], ['Ç', 'C'],
      ['ñ', 'n'], ['Ñ', 'N']
    ];

    for (const [oldChar, newChar] of replacements) {
      normalized = normalized.replace(new RegExp(oldChar, 'g'), newChar);
    }

    // Remove all non-alphanumeric characters (except hyphens)
    normalized = normalized.replace(/[^a-zA-Z0-9-]/g, '');

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

  getEntryPriorityScore(match) {
    let score = 0;
    
    // Higher priority for base forms
    if (match.isBaseForm) {
      score += 100;
    }
    
    // Higher priority for non-inflections
    if (!match.isInflection) {
      score += 50;
    }
    
    // Priority for entries with etymology
    if (match.entry.etymology_text && match.entry.etymology_text.trim()) {
      score += 30;
    }
    
    // Priority for entries with pronunciation
    if (match.entry.pronunciation && match.entry.pronunciation.trim()) {
      score += 20;
    }
    
    // Lower ID might indicate main entry (but this is weak)
    score += Math.max(0, 1000 - match.entry.id) / 1000;
    
    return score;
  }

  async findAllMatches(word, languageCode) {
    const db = await this.getConnection(languageCode);
    const normalizedWord = this.normalizeWord(word);
    let matches = [];

    // For Sanskrit (sa), also try Devanagari lookup
    let devanagariWord = word;
    let devanagariNormalized = normalizedWord;
    if (languageCode === 'sa') {
      devanagariWord = await this.slp1ToDevanagari(word);
      devanagariNormalized = await this.slp1ToDevanagari(normalizedWord);
      console.log(`[SQLiteDictionary] Converted "${word}" to Devanagari: "${devanagariWord}"`);
    }

    try {
      // First find all form matches (inflection forms)
      console.log(`[SQLiteDictionary] Checking forms table for "${word}" (normalized: "${normalizedWord}")`);
      
      // For Sanskrit, also search using Devanagari form
      let formQuery = `
        SELECT DISTINCT d.*, f.tags, f.form as inflection_form 
        FROM dictionary d
        JOIN forms f ON d.id = f.dictionary_id
        WHERE (f.normalized_form = ? OR f.form = ?)
        AND f.form NOT LIKE '%''%'
        ORDER BY d.pos, d.word
      `;
      let formParams = [normalizedWord, word];
      
      if (languageCode === 'sa' && devanagariWord !== word) {
        formQuery = `
          SELECT DISTINCT d.*, f.tags, f.form as inflection_form 
          FROM dictionary d
          JOIN forms f ON d.id = f.dictionary_id
          WHERE (f.normalized_form = ? OR f.form = ? OR f.normalized_form = ? OR f.form = ?)
          AND f.form NOT LIKE '%''%'
          ORDER BY d.pos, d.word
        `;
        formParams = [normalizedWord, word, devanagariNormalized, devanagariWord];
      }
      
      const formMatches = await db.all(formQuery, formParams);

      if (formMatches.length > 0) {
        console.log(`[SQLiteDictionary] Found ${formMatches.length} form matches`);
        // Use a Map to deduplicate by entry id and tags combination
        const uniqueMatches = new Map();
        for (const formMatch of formMatches) {
          let isBaseForm = this.isBaseForm(formMatch.tags);
          // Special case: if form is identical to the base word but tagged as inflection,
          // it's likely a data error (e.g., "Haus" tagged as "genitive")
          if (!isBaseForm && formMatch.inflection_form === formMatch.word) {
            console.log(`[SQLiteDictionary] Correcting data error: "${formMatch.inflection_form}" identical to base word "${formMatch.word}" but tagged as inflection, treating as base form`);
            isBaseForm = true;
          }
          const key = `${formMatch.id}:${formMatch.tags || ''}:${isBaseForm}`;
          if (!uniqueMatches.has(key)) {
            uniqueMatches.set(key, { 
              entry: {
                id: formMatch.id,
                word: formMatch.word,
                normalized_word: formMatch.normalized_word,
                pos: formMatch.pos,
                etymology_text: formMatch.etymology_text
              }, 
              isInflection: !isBaseForm,
              isBaseForm: isBaseForm,
              formTags: formMatch.tags,
              inflectionForm: formMatch.inflection_form
            });
          }
        }
        
        console.log(`[SQLiteDictionary] After deduplication: ${uniqueMatches.size} unique form matches`);
        for (const match of uniqueMatches.values()) {
          matches.push(match);
        }
      } else {
        console.log(`[SQLiteDictionary] No form matches found for "${word}"`);
      }

      // Then find all direct dictionary matches
      let dictQuery = `
        SELECT * FROM dictionary 
        WHERE normalized_word = ? OR word = ?
        ORDER BY pos, word
      `;
      let dictParams = [normalizedWord, word];
      
      if (languageCode === 'sa' && devanagariNormalized !== normalizedWord) {
        dictQuery = `
          SELECT * FROM dictionary 
          WHERE normalized_word = ? OR word = ? OR normalized_word = ? OR word = ?
          ORDER BY pos, word
        `;
        dictParams = [normalizedWord, word, devanagariNormalized, devanagariWord];
      }
      
      const dictEntries = await db.all(dictQuery, dictParams);

      if (dictEntries.length > 0) {
        console.log(`[SQLiteDictionary] Found ${dictEntries.length} dictionary matches`);
        // Add dictionary matches that are not already covered by form matches
        // (by checking if the dictionary entry is already in matches)
        const existingIds = new Set(matches.map(m => m.entry.id));
        
        // Also check if we already have a form match for this exact word as an inflection
        // (e.g., "Hauses" as inflection of "Haus" should not also appear as separate dictionary entry)
        const hasInflectionMatch = matches.some(m => 
          m.isInflection && !m.isBaseForm && m.inflectionForm === word
        );
        
        for (const entry of dictEntries) {
          // Skip if this entry is already covered by a form match
          if (existingIds.has(entry.id)) {
            continue;
          }
          
          // Skip if we already have an inflection match for this exact word
          // (e.g., "Hauses" should be shown as inflection of "Haus", not as separate entry)
          if (hasInflectionMatch && entry.word === word) {
            console.log(`[SQLiteDictionary] Skipping dictionary entry for "${word}" because it's already covered as an inflection`);
            continue;
          }
          
          matches.push({ entry, isInflection: false, isBaseForm: true });
        }
      }

      // Final deduplication: keep different inflection forms with different tags
      const deduplicatedMatches = [];
      const entryKeyMap = new Map(); // key -> best match index
      
      for (const match of matches) {
        const word = match.entry.word;
        const pos = match.entry.pos || '';
        const tags = match.formTags || '';
        
        // Create key: for inflections, include tags to distinguish different forms
        // For base forms, just use word:pos since tags don't matter
        let key;
        if (match.isInflection && !match.isBaseForm) {
          key = `${word}:${pos}:${tags}`;
        } else {
          key = `${word}:${pos}`;
        }
        
        if (!entryKeyMap.has(key)) {
          entryKeyMap.set(key, deduplicatedMatches.length);
          deduplicatedMatches.push(match);
        } else {
          const existingIndex = entryKeyMap.get(key);
          const existingMatch = deduplicatedMatches[existingIndex];
          
          // Choose the better entry based on priority
          // 1. Prefer root/base form over variants
          // 2. Prefer entries with etymology
          // 3. Prefer entries with pronunciation
          // 4. Prefer lower ID (assume main entry)
          
          const currentScore = this.getEntryPriorityScore(match);
          const existingScore = this.getEntryPriorityScore(existingMatch);
          
          if (currentScore > existingScore) {
            deduplicatedMatches[existingIndex] = match;
          }
        }
      }
      
      console.log(`[SQLiteDictionary] After deduplication: ${deduplicatedMatches.length} unique entries (was ${matches.length})`);
      matches = deduplicatedMatches;

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

  convertToWiktionaryEntry(entry, details, language, originalWord, isInflection, formTags = null, isBaseForm = false) {
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

    // Determine if this is actually an inflection or base form
    const actualIsInflection = isInflection && !isBaseForm;
    
    // Always include tags if available
    let inflectionAnalysis = undefined;
    let tags = formTags || undefined;
    
    if (actualIsInflection && formTags) {
      // Parse form tags to display them directly
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
    
    // Determine entry type
    let entryType = 'normal';
    if (actualIsInflection) {
      entryType = 'variant';
    } else if (isBaseForm) {
      entryType = 'root';
    }

    // Determine which word to display
    const displayWord = actualIsInflection ? originalWord : entry.word;
    
    // Create root entry for inflection forms
    let rootEntry = undefined;
    if (actualIsInflection && entry.word && entry.word !== displayWord) {
      rootEntry = {
        word: entry.word,
        language: language.name,
        source: 'local_db',
        partOfSpeech: entry.pos || undefined,
        definitions: definitions.length > 0 ? definitions : [`${entry.pos || 'word'}: ${entry.word}`],
        translations: [], // SQLite dictionary doesn't contain translations
        etymology: entry.etymology_text || undefined,
        pronunciation: pronunciation || undefined,
        examples: examples.length > 0 ? examples : [],
        synonyms: details.synonyms,
        antonyms: details.antonyms,
        isInflection: false,
        entryType: 'root',
        tags: undefined,
        inflectionAnalysis: undefined
      };
    }
    
    return {
      word: displayWord,
      language: language.name,
      source: 'local_db',
      partOfSpeech: entry.pos || undefined,
      definitions: definitions.length > 0 ? definitions : [`${entry.pos || 'word'}: ${displayWord}`],
      translations: [], // SQLite dictionary doesn't contain translations
      etymology: entry.etymology_text || undefined,
      pronunciation: pronunciation || undefined,
      examples: examples.length > 0 ? examples : [],
      synonyms: details.synonyms,
      antonyms: details.antonyms,
      isInflection: actualIsInflection,
      inflectionForm: actualIsInflection ? originalWord : undefined,
      rootWord: actualIsInflection ? entry.word : undefined,
      rootEntry: rootEntry,
      tags: tags,
      inflectionAnalysis: inflectionAnalysis,
      entryType: entryType // 'variant', 'root', 'normal'
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
      const rootEntriesMap = new Map(); // Track root entries to avoid duplicates
      
      for (const matchResult of matchResults) {
        const { entry: dictEntry, isInflection, formTags, inflectionForm, isBaseForm = false } = matchResult;
        console.log('[SQLiteDictionary] Processing entry:', dictEntry.word, 'isInflection:', isInflection, 'isBaseForm:', isBaseForm, 'formTags:', formTags);
        
        // Get detailed information
        const details = await this.getEntryDetails(dictEntry.id, language.id);
        
        // Convert to Wiktionary entry format
        const wiktionaryEntry = this.convertToWiktionaryEntry(dictEntry, details, language, word, isInflection, formTags, isBaseForm);
        entries.push(wiktionaryEntry);
        
        // Track root entries for inclusion as standalone entries
        if (wiktionaryEntry.rootEntry) {
          const rootKey = `${wiktionaryEntry.rootEntry.word}:${wiktionaryEntry.rootEntry.partOfSpeech || ''}`;
          if (!rootEntriesMap.has(rootKey)) {
            rootEntriesMap.set(rootKey, wiktionaryEntry.rootEntry);
          }
        }
      }
      
      // Add root entries as standalone entries if they're not already in the list
      for (const rootEntry of rootEntriesMap.values()) {
        // Check if this root entry already exists in entries
        const alreadyExists = entries.some(entry => 
          entry.word === rootEntry.word && 
          entry.partOfSpeech === rootEntry.partOfSpeech
        );
        
        if (!alreadyExists) {
          console.log(`[SQLiteDictionary] Adding root entry as standalone: ${rootEntry.word} (${rootEntry.partOfSpeech})`);
          entries.push(rootEntry);
        }
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

  getAvailableLanguages() {
    // 返回所有可用语言的ISO代码列表
    return Array.from(this.dbPaths.keys());
  }

  async getLanguagesInfo() {
    // 返回所有可用语言的详细信息
    const languages = [];
    
    for (const [languageCode, dbPath] of this.dbPaths) {
      try {
        const stats = await this.getStatistics(languageCode);
        languages.push({
          code: languageCode,
          path: dbPath,
          wordCount: stats.wordCount,
          senseCount: stats.senseCount,
          formCount: stats.formCount,
          synonymCount: stats.synonymCount
        });
      } catch (error) {
        console.warn(`[SQLiteDictionary] 无法获取语言 ${languageCode} 的统计信息:`, error.message);
        languages.push({
          code: languageCode,
          path: dbPath,
          wordCount: 0,
          senseCount: 0,
          formCount: 0,
          synonymCount: 0
        });
      }
    }
    
    return languages;
  }

  async rescanDictionaryPaths() {
    console.log('[SQLiteDictionary] 重新扫描词典目录...');
    
    // 保存旧的连接
    const oldDbPaths = new Map(this.dbPaths);
    
    // 清空当前映射
    this.dbPaths.clear();
    
    // 重新初始化
    this.initializeDatabasePaths();
    
    console.log(`[SQLiteDictionary] 重新扫描完成，发现 ${this.dbPaths.size} 种语言`);
    
    // 关闭不再需要的连接
    for (const [languageCode, db] of this.connections) {
      if (!this.dbPaths.has(languageCode)) {
        try {
          await db.close();
          this.connections.delete(languageCode);
          console.log(`[SQLiteDictionary] 关闭已删除语言的连接: ${languageCode}`);
        } catch (error) {
          console.error(`[SQLiteDictionary] 关闭连接时出错 ${languageCode}:`, error);
        }
      }
    }
    
    return {
      success: true,
      oldCount: oldDbPaths.size,
      newCount: this.dbPaths.size,
      languages: Array.from(this.dbPaths.keys())
    };
  }

  async removeDictionary(languageCode) {
    console.log(`[SQLiteDictionary] 尝试移除词典: ${languageCode}`);
    
    if (!this.dbPaths.has(languageCode)) {
      return {
        success: false,
        error: `Language '${languageCode}' not found in dictionary registry`
      };
    }
    
    const dbPath = this.dbPaths.get(languageCode);
    
    try {
      // 关闭该语言的数据库连接
      if (this.connections.has(languageCode)) {
        const db = this.connections.get(languageCode);
        await db.close();
        this.connections.delete(languageCode);
        console.log(`[SQLiteDictionary] 关闭数据库连接: ${languageCode}`);
      }
      
      // 从注册表中移除
      this.dbPaths.delete(languageCode);
      
      console.log(`[SQLiteDictionary] 已从注册表移除: ${languageCode}`);
      
      return {
        success: true,
        languageCode,
        dbPath,
        message: `Dictionary '${languageCode}' removed from registry`
      };
      
    } catch (error) {
      console.error(`[SQLiteDictionary] 移除词典时出错 ${languageCode}:`, error);
      return {
        success: false,
        languageCode,
        error: error.message
      };
    }
  }

  async deleteDictionaryFile(languageCode) {
    console.log(`[SQLiteDictionary] 尝试删除词典文件: ${languageCode}`);
    
    if (!this.dbPaths.has(languageCode)) {
      return {
        success: false,
        error: `Language '${languageCode}' not found in dictionary registry`
      };
    }
    
    const dbPath = this.dbPaths.get(languageCode);
    
    try {
      // 关闭连接
      if (this.connections.has(languageCode)) {
        const db = this.connections.get(languageCode);
        await db.close();
        this.connections.delete(languageCode);
      }
      
      // 删除数据库文件
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log(`[SQLiteDictionary] 已删除数据库文件: ${dbPath}`);
      }
      
      // 删除相关的临时文件
      const shmPath = `${dbPath}-shm`;
      const walPath = `${dbPath}-wal`;
      
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
        console.log(`[SQLiteDictionary] 已删除临时文件: ${shmPath}`);
      }
      
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
        console.log(`[SQLiteDictionary] 已删除临时文件: ${walPath}`);
      }
      
      // 从注册表中移除
      this.dbPaths.delete(languageCode);
      
      console.log(`[SQLiteDictionary] 词典文件已完全删除: ${languageCode}`);
      
      return {
        success: true,
        languageCode,
        dbPath,
        message: `Dictionary file for '${languageCode}' deleted successfully`
      };
      
    } catch (error) {
      console.error(`[SQLiteDictionary] 删除词典文件时出错 ${languageCode}:`, error);
      return {
        success: false,
        languageCode,
        error: error.message
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