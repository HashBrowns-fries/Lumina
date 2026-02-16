import { unifiedDb, unifiedStorage } from './unifiedStorage';
import { db as oldDb } from './storageService';
import { get, set } from 'idb-keyval';
import { 
  Language, 
  Text, 
  Chapter, 
  ReadingProgress, 
  Term, 
  UserSettings,
  migrateLegacyText,
  migrateLegacyTerm 
} from './dataModels';
import { AppState } from '../types';

const MIGRATION_KEY = 'luminous-lute-migration-v3';

/**
 * 检查是否需要迁移
 */
export async function needsMigration(): Promise<boolean> {
  const migrated = await get(MIGRATION_KEY);
  return !migrated;
}

/**
 * 标记迁移完成
 */
export async function markMigrationComplete(): Promise<void> {
  await set(MIGRATION_KEY, {
    version: 3,
    migratedAt: Date.now()
  });
}

/**
 * 从旧 idb-keyval 加载应用状态
 */
async function loadLegacyState(): Promise<AppState | null> {
  try {
    const state = await get('luminous-lute-state');
    return state || null;
  } catch (error) {
    console.error('[Migration] Failed to load legacy state:', error);
    return null;
  }
}

/**
 * 从旧 IndexedDB 加载阅读进度
 */
async function loadLegacyReadingProgress(): Promise<Array<{docId: string, chapterIndex: number, position: string, updatedAt: number}>> {
  try {
    if (!oldDb.isOpen()) {
      await oldDb.open();
    }
    return await oldDb.readingProgress.toArray();
  } catch (error) {
    console.error('[Migration] Failed to load legacy reading progress:', error);
    return [];
  }
}

/**
 * 从旧 IndexedDB 加载章节
 */
async function loadLegacyChapters(): Promise<Array<{id: string; docId: string; index: number; title: string; content: string; wordCount?: number; createdAt?: number}>> {
  try {
    if (!oldDb.isOpen()) {
      await oldDb.open();
    }
    return await oldDb.chapters.toArray();
  } catch (error) {
    console.error('[Migration] Failed to load legacy chapters:', error);
    return [];
  }
}

/**
 * 执行数据迁移
 * 从版本 2 (分散存储) 迁移到版本 3 (统一存储)
 */
export async function migrateToV3(
  onProgress?: (progress: { current: number; total: number; phase: string }) => void
): Promise<{ success: boolean; message: string; stats: { languages: number; texts: number; chapters: number; terms: number } }> {
  console.log('[Migration] Starting migration to v3...');
  
  try {
    // 1. 加载旧数据
    onProgress?.({ current: 0, total: 100, phase: 'Loading legacy data...' });
    
    const legacyState = await loadLegacyState();
    if (!legacyState) {
      console.log('[Migration] No legacy state found, fresh install');
      await markMigrationComplete();
      return {
        success: true,
        message: 'No legacy data to migrate',
        stats: { languages: 0, texts: 0, chapters: 0, terms: 0 }
      };
    }

    const legacyProgress = await loadLegacyReadingProgress();
    const legacyChapters = await loadLegacyChapters();
    
    console.log('[Migration] Legacy data loaded:', {
      languages: legacyState.languages?.length || 0,
      texts: legacyState.texts?.length || 0,
      terms: Object.keys(legacyState.terms || {}).length,
      readingProgress: legacyProgress.length,
      chapters: legacyChapters.length
    });

    // 2. 迁移 Languages
    onProgress?.({ current: 10, total: 100, phase: 'Migrating languages...' });
    
    const languages: Language[] = (legacyState.languages || []).map(lang => ({
      id: lang.id,
      name: lang.name,
      dictionaryUrl: lang.dictionaryUrl,
      kaikkiDownloaded: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));

    if (languages.length > 0) {
      await unifiedDb.languages.bulkAdd(languages);
    }

    // 3. 迁移 Texts 和 Chapters
    onProgress?.({ current: 30, total: 100, phase: 'Migrating texts...' });
    
    const texts: Text[] = [];
    const chapters: Chapter[] = [];
    const readingProgress: ReadingProgress[] = [];

    for (let i = 0; i < legacyState.texts.length; i++) {
      const legacyText = legacyState.texts[i];
      
      // 迁移文本元数据
      const text = migrateLegacyText(legacyText);
      texts.push(text);

      // 查找对应的章节
      const textChapters = legacyChapters.filter(c => c.docId === legacyText.id);
      
      if (textChapters.length > 0) {
        // 使用已存储的章节
        chapters.push(...textChapters.map(c => ({
          id: c.id,
          docId: c.docId,
          index: c.index,
          title: c.title,
          content: c.content,
          wordCount: c.wordCount,
          createdAt: c.createdAt || Date.now()
        })));
        
        // 更新文本章节数
        text.totalChapters = textChapters.length;
      } else {
        // 创建单章（兼容旧数据）
        chapters.push({
          id: `${legacyText.id}:0`,
          docId: legacyText.id,
          index: 0,
          title: legacyText.title,
          content: legacyText.content || '',
          wordCount: legacyText.content?.split(/\s+/).length || 0,
          createdAt: Date.now()
        });
      }

      // 迁移阅读进度
      const progress = legacyProgress.find(p => p.docId === legacyText.id);
      if (progress || legacyText.progress > 0) {
        readingProgress.push({
          docId: legacyText.id,
          position: progress?.position || JSON.stringify({ chapterIndex: 0, scrollTop: 0, progress: legacyText.progress || 0 }),
          updatedAt: progress?.updatedAt || Date.now(),
          totalReadTime: 0
        });
      }

      onProgress?.({ 
        current: 30 + Math.round((i / legacyState.texts.length) * 30), 
        total: 100, 
        phase: `Migrating texts (${i + 1}/${legacyState.texts.length})...` 
      });
    }

    if (texts.length > 0) {
      await unifiedDb.texts.bulkAdd(texts);
    }
    if (chapters.length > 0) {
      await unifiedDb.chapters.bulkAdd(chapters);
    }
    if (readingProgress.length > 0) {
      await unifiedDb.readingProgress.bulkAdd(readingProgress);
    }

    // 4. 迁移 Terms
    onProgress?.({ current: 70, total: 100, phase: 'Migrating terms...' });
    
    const terms: Term[] = Object.values(legacyState.terms || {}).map(term => 
      migrateLegacyTerm(term)
    );

    if (terms.length > 0) {
      await unifiedDb.terms.bulkAdd(terms);
    }

    // 5. 迁移 Settings
    onProgress?.({ current: 90, total: 100, phase: 'Migrating settings...' });
    
    const settings: UserSettings = {
      id: 'default',
      autoSaveOnClick: legacyState.settings?.autoSaveOnClick ?? true,
      showRootFormsOnly: legacyState.settings?.showRootFormsOnly ?? false,
      defaultLanguageId: legacyState.languages?.[0]?.id,
      theme: 'auto',
      fontSize: 16,
      lineHeight: 1.6,
      wordsPerPage: 1000,
      aiConfig: legacyState.aiConfig ? {
        ...legacyState.aiConfig,
        apiKeys: legacyState.aiConfig.apiKeys || {},
        timeout: legacyState.aiConfig.timeout || 30000
      } : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await unifiedDb.settings.add(settings);

    // 6. 标记迁移完成
    onProgress?.({ current: 100, total: 100, phase: 'Migration complete!' });
    await markMigrationComplete();

    const stats = {
      languages: languages.length,
      texts: texts.length,
      chapters: chapters.length,
      terms: terms.length
    };

    console.log('[Migration] Migration completed successfully:', stats);

    return {
      success: true,
      message: `Migration completed: ${stats.texts} texts, ${stats.terms} terms, ${stats.languages} languages`,
      stats
    };

  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    return {
      success: false,
      message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stats: { languages: 0, texts: 0, chapters: 0, terms: 0 }
    };
  }
}

/**
 * 检查数据库状态
 */
export async function checkDatabaseStatus(): Promise<{
  oldDbExists: boolean;
  newDbExists: boolean;
  needsMigration: boolean;
  oldStats: { texts: number; terms: number };
  newStats: { texts: number; terms: number; languages: number };
}> {
  let oldDbExists = false;
  let oldTexts = 0;
  let oldTerms = 0;

  try {
    const legacyState = await loadLegacyState();
    if (legacyState) {
      oldDbExists = true;
      oldTexts = legacyState.texts?.length || 0;
      oldTerms = Object.keys(legacyState.terms || {}).length;
    }
  } catch {
    // 忽略错误
  }

  let newDbExists = false;
  let newTexts = 0;
  let newTerms = 0;
  let newLanguages = 0;

  try {
    if (unifiedDb.isOpen()) {
      newDbExists = true;
      newTexts = await unifiedDb.texts.count();
      newTerms = await unifiedDb.terms.count();
      newLanguages = await unifiedDb.languages.count();
    }
  } catch {
    // 忽略错误
  }

  const needsMigrationFlag = await needsMigration();

  return {
    oldDbExists,
    newDbExists,
    needsMigration: needsMigrationFlag && oldDbExists,
    oldStats: { texts: oldTexts, terms: oldTerms },
    newStats: { texts: newTexts, terms: newTerms, languages: newLanguages }
  };
}
