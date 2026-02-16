// Unified Storage Exports
export { unifiedDb, unifiedStorage, UnifiedStorageService } from './unifiedStorage';
export type { UnifiedLuminousLuteDB } from './unifiedStorage';

// Data Models
export {
  LanguageSchema,
  TextSchema,
  ChapterSchema,
  ReadingProgressSchema,
  TermSchema,
  UserSettingsSchema,
  AppStateSchema,
  validateLanguage,
  validateText,
  validateChapter,
  validateReadingProgress,
  validateTerm,
  validateAppState,
  migrateLegacyText,
  migrateLegacyTerm
} from './dataModels';
export type {
  Language,
  Text,
  Chapter,
  ReadingProgress,
  ReadingPosition,
  Term,
  UserSettings,
  AppState
} from './dataModels';

// Migration Service
export {
  migrateToV3,
  needsMigration,
  checkDatabaseStatus,
  markMigrationComplete
} from './migrationService';

// Legacy exports (for backward compatibility)
export { db, initializeDatabase } from './storageService';
export type { StoredDocument, StoredChapter } from './storageService';
