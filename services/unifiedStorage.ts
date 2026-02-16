import Dexie, { Table } from 'dexie';
import { 
  Language, 
  Text, 
  Chapter, 
  ReadingProgress, 
  Term, 
  UserSettings,
  LanguageSchema,
  TextSchema,
  ChapterSchema,
  ReadingProgressSchema,
  TermSchema,
  UserSettingsSchema
} from './dataModels';

/**
 * 统一的 LuminousLute 数据库
 * 版本 3: 统一所有用户数据
 */
export class UnifiedLuminousLuteDB extends Dexie {
  // 表定义
  languages!: Table<Language, string>;
  texts!: Table<Text, string>;
  chapters!: Table<Chapter, string>;
  readingProgress!: Table<ReadingProgress, string>;
  terms!: Table<Term, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super('LuminousLuteDB');
    
    // 版本 3: 统一架构
    this.version(3).stores({
      languages: 'id, name, kaikkiDownloaded',
      texts: 'id, title, languageId, sourceType, updatedAt',
      chapters: 'id, docId, index',
      readingProgress: 'docId',
      terms: 'id, languageId, status, nextReview',
      settings: 'id'
    });
  }
}

// 单例实例
export const unifiedDb = new UnifiedLuminousLuteDB();

// ============================================================================
// 通用 CRUD 操作
// ============================================================================

export class UnifiedStorageService {
  private db: UnifiedLuminousLuteDB;

  constructor() {
    this.db = unifiedDb;
  }

  // ==========================================================================
  // Language 操作
  // ==========================================================================
  
  async getAllLanguages(): Promise<Language[]> {
    return await this.db.languages.toArray();
  }

  async addLanguage(language: Language): Promise<string> {
    const validated = LanguageSchema.parse(language);
    return await this.db.languages.add(validated);
  }

  async updateLanguage(id: string, updates: Partial<Language>): Promise<void> {
    await this.db.languages.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  async deleteLanguage(id: string): Promise<void> {
    await this.db.languages.delete(id);
  }

  // ==========================================================================
  // Text 操作
  // ==========================================================================
  
  async getAllTexts(): Promise<Text[]> {
    return await this.db.texts.toArray();
  }

  async getTextById(id: string): Promise<Text | undefined> {
    return await this.db.texts.get(id);
  }

  async addText(text: Text): Promise<string> {
    const validated = TextSchema.parse(text);
    return await this.db.texts.add(validated);
  }

  async updateText(id: string, updates: Partial<Text>): Promise<void> {
    await this.db.texts.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  async deleteText(id: string): Promise<void> {
    // 级联删除关联数据
    await this.db.transaction('rw', 
      this.db.texts, 
      this.db.chapters, 
      this.db.readingProgress, 
      async () => {
        await this.db.texts.delete(id);
        await this.db.chapters.where('docId').equals(id).delete();
        await this.db.readingProgress.delete(id);
      }
    );
  }

  // ==========================================================================
  // Chapter 操作
  // ==========================================================================
  
  async getChaptersByDocId(docId: string): Promise<Chapter[]> {
    return await this.db.chapters
      .where('docId')
      .equals(docId)
      .sortBy('index');
  }

  async getChapterById(id: string): Promise<Chapter | undefined> {
    return await this.db.chapters.get(id);
  }

  async addChapter(chapter: Chapter): Promise<string> {
    const validated = ChapterSchema.parse(chapter);
    return await this.db.chapters.add(validated);
  }

  async addChapters(chapters: Chapter[]): Promise<void> {
    const validated = chapters.map(c => ChapterSchema.parse(c));
    await this.db.chapters.bulkAdd(validated);
  }

  async updateChapter(id: string, updates: Partial<Chapter>): Promise<void> {
    await this.db.chapters.update(id, updates);
  }

  async deleteChaptersByDocId(docId: string): Promise<void> {
    await this.db.chapters.where('docId').equals(docId).delete();
  }

  // ==========================================================================
  // Reading Progress 操作
  // ==========================================================================
  
  async getReadingProgress(docId: string): Promise<ReadingProgress | undefined> {
    return await this.db.readingProgress.get(docId);
  }

  async saveReadingProgress(
    docId: string, 
    position: { chapterIndex: number; scrollTop: number; progress: number }
  ): Promise<void> {
    const progress: ReadingProgress = {
      docId,
      position: JSON.stringify(position),
      updatedAt: Date.now(),
      totalReadTime: 0
    };
    
    const validated = ReadingProgressSchema.parse(progress);
    await this.db.readingProgress.put(validated);
    
    // 同时更新文本的 updatedAt
    await this.db.texts.update(docId, { updatedAt: Date.now() });
  }

  async getAllReadingProgress(): Promise<ReadingProgress[]> {
    return await this.db.readingProgress.toArray();
  }

  // ==========================================================================
  // Term 操作
  // ==========================================================================
  
  async getAllTerms(): Promise<Term[]> {
    return await this.db.terms.toArray();
  }

  async getTermsByLanguage(languageId: string): Promise<Term[]> {
    return await this.db.terms
      .where('languageId')
      .equals(languageId)
      .toArray();
  }

  async getTermById(id: string): Promise<Term | undefined> {
    return await this.db.terms.get(id);
  }

  async addTerm(term: Term): Promise<string> {
    const validated = TermSchema.parse(term);
    return await this.db.terms.add(validated);
  }

  async updateTerm(id: string, updates: Partial<Term>): Promise<void> {
    await this.db.terms.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }

  async deleteTerm(id: string): Promise<void> {
    await this.db.terms.delete(id);
  }

  async getTermsForReview(languageId: string, before: number): Promise<Term[]> {
    return await this.db.terms
      .where({ languageId, status: 1 })
      .filter(term => (term.nextReview || 0) < before)
      .toArray();
  }

  // ==========================================================================
  // Settings 操作
  // ==========================================================================
  
  async getSettings(): Promise<UserSettings | undefined> {
    return await this.db.settings.get('default');
  }

  async saveSettings(settings: Partial<UserSettings>): Promise<void> {
    const existing = await this.getSettings();
    const merged = {
      ...existing,
      ...settings,
      id: 'default',
      updatedAt: Date.now()
    };
    
    const validated = UserSettingsSchema.parse(merged);
    await this.db.settings.put(validated);
  }

  // ==========================================================================
  // 批量操作
  // ==========================================================================
  
  async exportAllData(): Promise<{
    languages: Language[];
    texts: Text[];
    chapters: Chapter[];
    readingProgress: ReadingProgress[];
    terms: Term[];
    settings: UserSettings | undefined;
    exportTime: number;
    version: number;
  }> {
    const [languages, texts, chapters, readingProgress, terms, settings] = await Promise.all([
      this.getAllLanguages(),
      this.getAllTexts(),
      this.db.chapters.toArray(),
      this.getAllReadingProgress(),
      this.getAllTerms(),
      this.getSettings()
    ]);

    return {
      languages,
      texts,
      chapters,
      readingProgress,
      terms,
      settings,
      exportTime: Date.now(),
      version: 3
    };
  }

  async importAllData(data: {
    languages?: Language[];
    texts?: Text[];
    chapters?: Chapter[];
    readingProgress?: ReadingProgress[];
    terms?: Term[];
    settings?: UserSettings;
  }): Promise<void> {
    await this.db.transaction('rw',
      [this.db.languages, this.db.texts, this.db.chapters, this.db.readingProgress, this.db.terms, this.db.settings],
      async () => {
        // 清空现有数据
        await Promise.all([
          this.db.languages.clear(),
          this.db.texts.clear(),
          this.db.chapters.clear(),
          this.db.readingProgress.clear(),
          this.db.terms.clear(),
          this.db.settings.clear()
        ]);

        // 导入新数据
        if (data.languages?.length) {
          await this.db.languages.bulkAdd(data.languages);
        }
        if (data.texts?.length) {
          await this.db.texts.bulkAdd(data.texts);
        }
        if (data.chapters?.length) {
          await this.db.chapters.bulkAdd(data.chapters);
        }
        if (data.readingProgress?.length) {
          await this.db.readingProgress.bulkAdd(data.readingProgress);
        }
        if (data.terms?.length) {
          await this.db.terms.bulkAdd(data.terms);
        }
        if (data.settings) {
          await this.db.settings.add(data.settings);
        }
      }
    );
  }

  // ==========================================================================
  // 统计信息
  // ==========================================================================
  
  async getStats(): Promise<{
    languages: number;
    texts: number;
    chapters: number;
    terms: number;
    totalWords: number;
  }> {
    const [languages, texts, chapters, terms] = await Promise.all([
      this.db.languages.count(),
      this.db.texts.count(),
      this.db.chapters.count(),
      this.db.terms.count()
    ]);

    // 计算总词数
    const allChapters = await this.db.chapters.toArray();
    const totalWords = allChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);

    return {
      languages,
      texts,
      chapters,
      terms,
      totalWords
    };
  }
}

// 导出单例
export const unifiedStorage = new UnifiedStorageService();
