import Dexie, { Table } from 'dexie';
import { Term, UserSettings } from '../types';

export interface StoredDocument {
  id: string;               // 唯一标识，可用文件名+上传时间戳或UUID
  title: string;            // 文档标题（从EPUB获取或文件名）
  author?: string;          // 作者
  language?: string;        // 语言代码（如 "de"）
  format: 'epub' | 'pdf' | 'txt';
  coverUrl?: string;        // 封面图片（DataURL或路径）
  totalChapters: number;    // 总章节数（EPUB）或总页数（PDF）
  createdAt: number;        // 上传时间
  updatedAt: number;        // 最后阅读时间（用于排序）
  fileSize: number;         // 文件大小（可选）
}

export interface StoredChapter {
  id: string;               // 格式：`docId:chapterIndex` 或 UUID
  docId: string;            // 所属文档ID
  index: number;            // 章节序号（从0开始）
  title: string;            // 章节标题（EPUB从目录获取，PDF可为"第X页"）
  content: string;          // 章节内容（HTML或纯文本）
  wordCount?: number;       // 单词数（可选，用于统计）
  createdAt?: number;       // 创建时间
}

export interface ReadingProgress {
  docId: string;            // 文档ID
  chapterIndex: number;     // 当前章节索引
  position: string;         // 阅读位置（EPUB可存CFI，PDF可存页内坐标，简单实现可存scrollTop）
  updatedAt: number;        // 最后更新时间
}

export class LuminousLuteDB extends Dexie {
  // 现有表
  terms!: Table<Term, string>;
  settings!: Table<UserSettings, string>;
  
  // 新增表
  documents!: Table<StoredDocument, string>;
  chapters!: Table<StoredChapter, string>;
  readingProgress!: Table<ReadingProgress, string>;

  constructor() {
    super('LuminousLuteDB');
    
    // 版本1：原始应用表结构（仅terms和settings）
    this.version(1).stores({
      terms: 'id, languageId, status, nextReview, updatedAt',
      settings: 'id'
    });
    
    // 版本2：添加文档相关表
    this.version(2).stores({
      terms: 'id, languageId, status, nextReview, updatedAt',
      settings: 'id',
      documents: 'id, title, format, updatedAt',
      chapters: 'id, docId, index',
      readingProgress: 'docId'  // 每个文档一条进度
    }).upgrade(async (tx) => {
      console.debug('[StorageService] Upgrading database from version 1 to 2');
      // 这里可以添加数据迁移逻辑（如果需要）
    });
  }
}

// 单例实例
export const db = new LuminousLuteDB();

// 辅助函数：检查并升级数据库（处理现有用户从版本1升级到版本2）
export async function initializeDatabase(): Promise<void> {
  try {
    // 检查数据库是否已经打开
    if (db.isOpen()) {
      console.debug('[StorageService] Database already open');
      return;
    }
    
    // 打开数据库会触发版本升级
    await db.open();
    console.debug('[StorageService] Database initialized successfully');
  } catch (error) {
    console.error('[StorageService] Database initialization failed:', error);
    
    // 如果打开失败，尝试删除并重新创建（最后手段）
    const err = error as any;
    if (err.name === 'VersionChangeError' || err.name === 'OpenFailedError') {
      console.warn('[StorageService] Database error, trying to delete and recreate database');
      try {
        await db.delete();
        await db.open();
        console.debug('[StorageService] Database recreated successfully');
      } catch (recreateError) {
        console.error('[StorageService] Failed to recreate database:', recreateError);
        throw recreateError;
      }
    } else {
      throw error;
    }
  }
}

// 迁移现有文本数据（从idb-keyval迁移到新表）
export async function migrateLegacyTexts(
  legacyTexts: Array<{id: string, title: string, content: string, languageId: string, createdAt: number, sourceType: 'plain' | 'pdf' | 'epub', progress: number}>
): Promise<void> {
  try {
    await db.transaction('rw', db.documents, db.chapters, async () => {
      for (const text of legacyTexts) {
        // 检查是否已存在
        const existingDoc = await db.documents.get(text.id);
        if (existingDoc) continue;
        
        // 创建文档记录
        const doc: StoredDocument = {
          id: text.id,
          title: text.title,
          language: text.languageId,
          format: text.sourceType === 'plain' ? 'txt' : text.sourceType,
          totalChapters: 1, // 旧文本只有单章
          createdAt: text.createdAt,
          updatedAt: Date.now(),
          fileSize: 0
        };
        
        await db.documents.add(doc);
        
        // 创建章节记录
        const chapter: StoredChapter = {
          id: `${text.id}:0`,
          docId: text.id,
          index: 0,
          title: text.title,
          content: text.content
        };
        
        await db.chapters.add(chapter);
        
        // 创建阅读进度记录
        if (text.progress > 0) {
          const progress: ReadingProgress = {
            docId: text.id,
            chapterIndex: 0,
            position: JSON.stringify({ scrollTop: 0 }), // 简化位置
            updatedAt: Date.now()
          };
          await db.readingProgress.put(progress);
        }
      }
    });
    
    console.debug(`[StorageService] Migrated ${legacyTexts.length} legacy texts`);
  } catch (error) {
    console.error('[StorageService] Legacy text migration failed:', error);
    throw error;
  }
}