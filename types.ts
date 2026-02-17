
export enum TermStatus {
  New = 0,
  Learning1 = 1,
  Learning2 = 2,
  Learning3 = 3,
  Learning4 = 4,
  WellKnown = 5,
  Ignored = 99
}

export type AIProvider = 'gemini' | 'deepseek' | 'aliyun' | 'ollama' | 'qwen';

export interface AIConfig {
  provider: AIProvider;
  baseUrl?: string;
  model: string;
  apiKeys?: Record<string, string>;
  fallbackProvider?: AIProvider;  // 备用API提供商
  timeout?: number;  // 自定义超时时间（毫秒）
}

export interface Language {
  id: string;
  name: string;
  dictionaryUrl: string; // e.g., https://en.wiktionary.org/wiki/###
}

export interface Term {
  id: string;
  text: string;
  languageId: string;
  translation: string;
  status: TermStatus;
  notes: string;
  parentId?: string; // ID of the parent term
  image?: string; // base64 or URL
  
  // SRS Fields
  nextReview?: number; // Timestamp
  lastReview?: number; // Timestamp
  interval?: number;   // Current interval in days
  easeFactor?: number; // SM-2 ease factor (default 2.5)
  reps?: number;       // Number of successful consecutive reviews
}

export type TextSourceType = 'plain' | 'epub' | 'pdf';

export interface Text {
  id: string;
  title: string;
  content: string;
  languageId: string;
  createdAt: number;
  sourceType: TextSourceType;
  progress: number; // 0 to 1 scroll percentage
}

export interface UserSettings {
  autoSaveOnClick: boolean;
  showRootFormsOnly: boolean;
}

export interface AppState {
  languages: Language[];
  texts: Text[];
  terms: Record<string, Term>; // key is languageId + ":" + lowercase text
  currentTextId?: string;
  aiConfig: AIConfig;
  settings: UserSettings;
}

export interface GeminiSuggestion {
  translation: string;
  definition?: string; // Primary definition from dictionary
  grammar: string | object; // Specific contextual grammar analysis (can be string or object)
  explanation?: string; // Brief explanation of the word in context
  rootWord?: string;
  examples: string[];
  sources?: { uri: string; title: string }[];
}
