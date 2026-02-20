import { Language } from '../types';
import { getSanskritApiUrl } from './apiConfig';

/**
 * 支持的转写方案
 */
export type TransliterationScheme = 
  | 'devanagari'
  | 'iast'
  | 'slp1'
  | 'harvardkyoto'
  | 'itrans'
  | 'wx'
  | 'velthuis'
  | 'iso15919'
  | 'bengali'
  | 'gujarati'
  | 'gurmukhi'
  | 'kannada'
  | 'malayalam'
  | 'oriya'
  | 'tamil'
  | 'telugu';

/**
 * 转写结果
 */
export interface TransliterationResult {
  success: boolean;
  original: string;
  transliterated: string;
  from_scheme: string;
  to_scheme: string;
  error?: string;
}

/**
 * 语法分析片段
 */
export interface SanskritSegment {
  original: string;
  unsandhied: string;
  lemma: string;
  tag: string;
  meanings: string[];
}

/**
 * 分析结果
 */
export interface AnalyzeResult {
  success: boolean;
  input: string;
  segments: SanskritSegment[];
  segment_count: number;
  sandhi_rules?: string[];
  processing_time_ms: number;
  error?: string;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  status: string;
  dharmamitra: boolean;
  transliterate: boolean;
}

/**
 * 梵语API服务 - 基于 Dharma Mitra
 */
export class SanskritService {
  private baseUrl: string;

  constructor(baseUrl: string = getSanskritApiUrl()) {
    this.baseUrl = baseUrl;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('健康检查失败:', error);
      return {
        status: 'unreachable',
        dharmamitra: false,
        transliterate: false,
      };
    }
  }

  /**
   * 转写文本
   */
  async transliterate(
    text: string,
    from: TransliterationScheme = 'devanagari',
    to: TransliterationScheme = 'iast'
  ): Promise<TransliterationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/transliterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, from, to }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('转写失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        original: text,
        transliterated: '',
        from_scheme: from,
        to_scheme: to,
      };
    }
  }

  /**
   * 分析梵语文本
   */
  async analyze(text: string): Promise<AnalyzeResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('分析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        input: text,
        segments: [],
        segment_count: 0,
        processing_time_ms: 0,
      };
    }
  }
}

// 导出单例
export const sanskritService = new SanskritService();
