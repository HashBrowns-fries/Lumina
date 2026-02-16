import { z } from 'zod';

// ============================================================================
// 基础类型定义
// ============================================================================

export const TermStatusSchema = z.number().int().min(0).max(99);

export const TextSourceTypeSchema = z.enum(['plain', 'epub', 'pdf']);

export const AIProviderSchema = z.enum(['gemini', 'deepseek', 'aliyun', 'ollama', 'qwen']);

// ============================================================================
// Language 模型
// ============================================================================

export const LanguageSchema = z.object({
  id: z.string(),
  name: z.string(),
  dictionaryUrl: z.string().url().or(z.string().startsWith('http')),
  kaikkiDownloaded: z.boolean().default(false),
  kaikkiGlossLang: z.string().optional(),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now())
});

export type Language = z.infer<typeof LanguageSchema>;

// ============================================================================
// Text/Document 模型
// ============================================================================

export const TextSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().optional(), // 可选，大内容存储在 chapters
  languageId: z.string(),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
  sourceType: TextSourceTypeSchema,
  format: z.enum(['txt', 'epub', 'pdf']).optional(),
  totalChapters: z.number().int().min(1).default(1),
  fileSize: z.number().default(0),
  coverUrl: z.string().optional(),
  author: z.string().optional(),
  isMigrated: z.boolean().default(false) // 标记是否从旧系统迁移
});

export type Text = z.infer<typeof TextSchema>;

// ============================================================================
// Chapter 模型
// ============================================================================

export const ChapterSchema = z.object({
  id: z.string(), // 格式: `${docId}:${index}`
  docId: z.string(),
  index: z.number().int().min(0),
  title: z.string(),
  content: z.string(),
  wordCount: z.number().int().optional(),
  createdAt: z.number().default(() => Date.now())
});

export type Chapter = z.infer<typeof ChapterSchema>;

// ============================================================================
// Reading Progress 模型
// ============================================================================

export const ReadingPositionSchema = z.object({
  chapterIndex: z.number().int().min(0),
  scrollTop: z.number().default(0),
  progress: z.number().min(0).max(1).default(0), // 0-1
  pageIndex: z.number().int().optional()
});

export type ReadingPosition = z.infer<typeof ReadingPositionSchema>;

export const ReadingProgressSchema = z.object({
  docId: z.string(),
  position: z.string(),
  updatedAt: z.number().default(() => Date.now()),
  totalReadTime: z.number().default(0) // 总阅读时间（分钟）
});

export type ReadingProgress = z.infer<typeof ReadingProgressSchema>;

// ============================================================================
// Term 模型
// ============================================================================

export const TermSchema = z.object({
  id: z.string(),
  text: z.string(),
  languageId: z.string(),
  translation: z.string(),
  status: TermStatusSchema.default(0),
  notes: z.string().default(''),
  parentId: z.string().optional(),
  image: z.string().optional(),
  
  // SRS 字段
  nextReview: z.number().optional(),
  lastReview: z.number().optional(),
  interval: z.number().default(0),
  easeFactor: z.number().default(2.5),
  reps: z.number().default(0),
  
  // 元数据
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
  
  // 查询统计
  queryCount: z.number().default(0),
  lastQueriedAt: z.number().optional()
});

export type Term = z.infer<typeof TermSchema>;

// ============================================================================
// AI Config 模型
// ============================================================================

export const AIConfigSchema = z.object({
  provider: AIProviderSchema,
  baseUrl: z.string().url().optional(),
  model: z.string(),
  apiKeys: z.record(z.string(), z.string()),
  fallbackProvider: AIProviderSchema.optional(),
  timeout: z.number().default(30000)
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

// ============================================================================
// User Settings 模型
// ============================================================================

export const UserSettingsSchema = z.object({
  id: z.string().default('default'),
  autoSaveOnClick: z.boolean().default(true),
  showRootFormsOnly: z.boolean().default(false),
  defaultLanguageId: z.string().optional(),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  fontSize: z.number().default(16),
  lineHeight: z.number().default(1.6),
  wordsPerPage: z.number().default(1000),
  aiConfig: AIConfigSchema.optional(),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now())
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

// ============================================================================
// App State 模型（顶层）
// ============================================================================

export const AppStateSchema = z.object({
  version: z.number().default(1),
  lastModified: z.number().default(() => Date.now()),
  languages: z.array(LanguageSchema),
  texts: z.array(TextSchema),
  terms: z.record(z.string(), TermSchema),
  currentTextId: z.string().optional(),
  settings: UserSettingsSchema
});

export type AppState = z.infer<typeof AppStateSchema>;

// ============================================================================
// 验证函数
// ============================================================================

export function validateLanguage(data: unknown): Language {
  return LanguageSchema.parse(data);
}

export function validateText(data: unknown): Text {
  return TextSchema.parse(data);
}

export function validateChapter(data: unknown): Chapter {
  return ChapterSchema.parse(data);
}

export function validateReadingProgress(data: unknown): ReadingProgress {
  return ReadingProgressSchema.parse(data);
}

export function validateTerm(data: unknown): Term {
  return TermSchema.parse(data);
}

export function validateAppState(data: unknown): AppState {
  return AppStateSchema.parse(data);
}

// ============================================================================
// 迁移辅助函数
// ============================================================================

export function migrateLegacyText(legacy: any): Text {
  return TextSchema.parse({
    id: legacy.id,
    title: legacy.title,
    languageId: legacy.languageId,
    createdAt: legacy.createdAt,
    updatedAt: legacy.createdAt,
    sourceType: legacy.sourceType || 'plain',
    format: legacy.sourceType === 'plain' ? 'txt' : legacy.sourceType,
    totalChapters: 1,
    isMigrated: true
  });
}

export function migrateLegacyTerm(legacy: any): Term {
  return TermSchema.parse({
    id: legacy.id,
    text: legacy.text,
    languageId: legacy.languageId,
    translation: legacy.translation,
    status: legacy.status,
    notes: legacy.notes,
    parentId: legacy.parentId,
    image: legacy.image,
    nextReview: legacy.nextReview,
    lastReview: legacy.lastReview,
    interval: legacy.interval,
    easeFactor: legacy.easeFactor,
    reps: legacy.reps,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}
