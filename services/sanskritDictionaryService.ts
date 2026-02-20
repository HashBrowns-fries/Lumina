import { Language } from '../types';
import { WiktionaryResponse, WiktionaryEntry, queryWiktionary } from './wiktionaryService.ts';
import { getDictionaryApiUrl } from './apiConfig';

export interface SplitPartResult {
    originalPart: string;
    normalizedPart: string;
    dictionaryEntry: WiktionaryResponse | null;
    grammaticalInfo: {
        case?: string;
        number?: string;
        gender?: string;
        sandhiRule?: string;
    };
    confidence: number;
    position: number;
}

export interface SplitQueryResult {
    originalWord: string;
    splitParts: SplitPartResult[];
    combinedAnalysis: {
        compoundMeaning?: string;
        grammaticalStructure: string;
        sandhiRulesApplied: string[];
    };
    queryTime: number;
}

export class SanskritDictionaryService {
    private cache: Map<string, { data: SplitQueryResult; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 10 * 60 * 1000; // 10分钟

    /**
     * 基础的Sandhi拆分规则
     */
    private basicSandhiSplit(word: string): string[] {
        // 简化的Sandhi拆分规则
        // 这里实现一些常见的Sandhi拆分模式
        
        const commonSplits: Record<string, string[]> = {
            // 示例：रामायणम् -> राम + अयन + अम्
            'रामायणम्': ['राम', 'अयन', 'अम्'],
            'गन्तास्मस्': ['गम्', 'तास्मस्'],
            'पद्धति': ['पद्', 'हति'],
            'नष्ट': ['नश्', 'त'],
            'विवाह': ['वि', 'वाह'],
            'रक्षित': ['रक्ष्', 'इत'],
            'क्षत्र': ['क्षत्र'],
            'अवि': ['अवि'],
            'प्राणिन्': ['प्राण', 'इन्'],
            'भिक्षुणी': ['भिक्षु', 'णी'],
            'प्रायश्चित्त': ['प्रायश्', 'चित्त'],
            'उच्च': ['उच्च'],
            'राहु': ['राहु'],
        };

        // 如果已知拆分，返回它
        if (commonSplits[word]) {
            return commonSplits[word];
        }

        // 尝试基于常见模式拆分
        const patterns = [
            // 元音连写 (Vowel Sandhi)
            /([अ-औ])([अ-औ])/g,
            // 辅音连写 (Consonant Sandhi)
            /([क-ह]्?)([अ-औ])/g,
            // 常见后缀
            /(.+)([अइउएओ]म्)$/,  // -am, -im, -um 等
            /(.+)([अइउएओ]ः)$/,  // -ah, -ih, -uh 等
            /(.+)([अइउएओ]न्)$/, // -an, -in, -un 等
        ];

        for (const pattern of patterns) {
            const match = word.match(pattern);
            if (match) {
                // 简单拆分：第一部分和第二部分
                return [match[1], match[2]].filter(Boolean);
            }
        }

        // 无法拆分，返回原词
        return [word];
    }

    /**
     * 使用后端API拆分Sandhi复合词
     */
    private async splitSandhiUsingAPI(word: string, mode: 'sandhi' | 'morpheme' = 'morpheme'): Promise<string[]> {
        try {
            const BACKEND_API_URL = getDictionaryApiUrl();
            
            console.debug('[SanskritDictionary] Calling sandhi split API for:', word, 'mode:', mode);
            
            const response = await fetch(`${BACKEND_API_URL}/api/sanskrit/split`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ word, mode }),
            });
            
            if (!response.ok) {
                console.warn(`[SanskritDictionary] API error: ${response.status}`);
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.result && data.result.parts) {
                console.debug('[SanskritDictionary] API split result:', data.result.parts);
                return data.result.parts;
            } else {
                console.warn('[SanskritDictionary] API returned unsuccessful response:', data);
                throw new Error('API returned unsuccessful response');
            }
            
        } catch (error) {
            console.debug('[SanskritDictionary] API split failed, falling back to rule-based:', error);
            // 回退到基于规则的拆分
            return this.basicSandhiSplit(word);
        }
    }

    /**
     * 分析拆分部分的语法信息
     */
    private analyzeGrammaticalInfo(part: string, position: number, totalParts: number): any {
        const info: any = {};
        
        // 基于常见模式猜测语法信息
        if (part.endsWith('म्')) {
            info.case = '宾格';
            info.number = '单数';
            info.gender = '中性';
        } else if (part.endsWith('ः')) {
            info.case = '主格';
            info.number = '单数';
        } else if (part.endsWith('न्')) {
            info.number = '单数';
        }
        
        // 基于位置猜测
        if (position === 0) {
            info.sandhiRule = '起始部分';
        } else if (position === totalParts - 1) {
            info.sandhiRule = '结尾部分';
        } else {
            info.sandhiRule = '中间部分';
        }
        
        return info;
    }

    /**
     * 查询梵语单词（带Sandhi拆分）
     */
    async querySanskrit(
        word: string,
        language: Language,
        context?: string
    ): Promise<SplitQueryResult> {
        console.debug('[SanskritDictionary] Querying Sanskrit word:', word);
        
        const startTime = Date.now();
        
        // 检查缓存
        const cacheKey = `sa:${word}:${context || ''}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        
        try {
            // 1. 进行Sandhi拆分（优先使用API，失败时回退到规则）
            const splitParts = await this.splitSandhiUsingAPI(word);
            console.debug('[SanskritDictionary] Split result:', splitParts);
            
            // 2. 并行查询每个拆分部分
            const splitPartResults = await this.querySplitParts(splitParts, language);
            
            // 3. 分析复合词整体意义
            const combinedAnalysis = await this.analyzeCompoundMeaning(splitPartResults, word);
            
            const result: SplitQueryResult = {
                originalWord: word,
                splitParts: splitPartResults,
                combinedAnalysis,
                queryTime: Date.now() - startTime
            };
            
            // 缓存结果
            this.setToCache(cacheKey, result);
            
            return result;
            
        } catch (error) {
            console.error('[SanskritDictionary] Error querying Sanskrit:', error);
            
            // 错误时返回基础结果
            return {
                originalWord: word,
                splitParts: [],
                combinedAnalysis: {
                    grammaticalStructure: '分析失败',
                    sandhiRulesApplied: []
                },
                queryTime: Date.now() - startTime
            };
        }
    }
    
    /**
     * 查询每个拆分部分
     */
    private async querySplitParts(
        parts: string[],
        language: Language
    ): Promise<SplitPartResult[]> {
        const queryPromises = parts.map(async (part, index) => {
            try {
                // 查询词典 - 使用统一的查询服务，会自动通过后端API查询
                const dictionaryResult = await queryWiktionary(
                    part,
                    language
                );
                
                // 提取语法信息
                const grammaticalInfo = this.analyzeGrammaticalInfo(part, index, parts.length);
                
                // 计算置信度（基于是否找到词典条目）
                const confidence = dictionaryResult.success && dictionaryResult.entries.length > 0 
                    ? 0.9 
                    : 0.5;
                
                return {
                    originalPart: part,
                    normalizedPart: this.normalizeSanskrit(part),
                    dictionaryEntry: dictionaryResult.success ? dictionaryResult : null,
                    grammaticalInfo,
                    confidence,
                    position: index
                };
            } catch (error) {
                console.error(`[SanskritDictionary] Error querying part "${part}":`, error);
                
                return {
                    originalPart: part,
                    normalizedPart: this.normalizeSanskrit(part),
                    dictionaryEntry: null,
                    grammaticalInfo: this.analyzeGrammaticalInfo(part, index, parts.length),
                    confidence: 0.3,
                    position: index
                };
            }
        });
        
        return Promise.all(queryPromises);
    }
    
    /**
     * 分析复合词整体意义
     */
    private async analyzeCompoundMeaning(
        parts: SplitPartResult[],
        originalWord: string
    ): Promise<{ compoundMeaning?: string; grammaticalStructure: string; sandhiRulesApplied: string[] }> {
        
        // 收集各部分的意义
        const meanings = parts.map(part => {
            if (part.dictionaryEntry?.entries?.[0]?.definitions?.[0]) {
                return part.dictionaryEntry.entries[0].definitions[0];
            }
            return part.originalPart;
        });
        
        // 推导复合词义
        let compoundMeaning: string | undefined;
        
        if (parts.length === 1) {
            compoundMeaning = meanings[0];
        } else if (parts.length === 2) {
            // 常见的复合词类型
            const [first, second] = meanings;
            compoundMeaning = `${first}的${second}`;
        } else {
            compoundMeaning = meanings.join(' + ');
        }
        
        // 分析语法结构
        let grammaticalStructure = '未知结构';
        if (parts.length >= 2) {
            grammaticalStructure = '复合词 (Samāsa)';
            
            // 基于常见模式判断复合词类型
            if (parts.some(p => p.originalPart.endsWith('म्'))) {
                grammaticalStructure = '宾格复合词';
            } else if (parts.some(p => p.originalPart.endsWith('ः'))) {
                grammaticalStructure = '主格复合词';
            }
        }
        
        // 提取应用的Sandhi规则
        const sandhiRulesApplied: string[] = [];
        if (parts.length > 1) {
            sandhiRulesApplied.push(`拆分为 ${parts.length} 个部分`);
        }
        
        // 添加基于特定模式的规则
        if (originalWord.includes('ाय')) {
            sandhiRulesApplied.push('可能应用了 Guṇa 规则');
        }
        if (originalWord.includes('ौ') || originalWord.includes('ै')) {
            sandhiRulesApplied.push('可能应用了 Vṛddhi 规则');
        }
        
        return {
            compoundMeaning,
            grammaticalStructure,
            sandhiRulesApplied
        };
    }
    
    /**
     * 梵语规范化
     */
    private normalizeSanskrit(word: string): string {
        if (!word) return '';
        
        let normalized = word;
        
        // 移除变音符号
        normalized = normalized.replace(/[\u0900-\u0903\u093A-\u094F]/g, '');
        
        // 标准化Unicode
        normalized = normalized.normalize('NFC');
        
        // 移除标点
        normalized = normalized.replace(/[।॥.,;:!?'"()\[\]{}]/g, '');
        
        // 修剪空白
        normalized = normalized.trim();
        
        return normalized;
    }
    
    /**
     * 缓存管理
     */
    private getFromCache(key: string): SplitQueryResult | null {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    private setToCache(key: string, data: SplitQueryResult): void {
        // 清理过期缓存
        if (this.cache.size >= 500) {
            this.clearExpiredCache();
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    private clearExpiredCache(): void {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * 批量查询优化
     */
    async batchQuerySanskrit(
        words: string[],
        language: Language,
        context?: string
    ): Promise<Map<string, SplitQueryResult>> {
        // 去重
        const uniqueWords = [...new Set(words)];
        
        // 并行查询所有单词
        const queryPromises = uniqueWords.map(word => 
            this.querySanskrit(word, language, context)
        );
        
        const results = await Promise.all(queryPromises);
        
        // 构建结果映射
        const resultMap = new Map<string, SplitQueryResult>();
        uniqueWords.forEach((word, index) => {
            resultMap.set(word, results[index]);
        });
        
        return resultMap;
    }
}

// 导出单例实例
export const sanskritDictionaryService = new SanskritDictionaryService();