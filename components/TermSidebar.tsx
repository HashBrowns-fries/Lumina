

// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, FC, ReactNode, FormEvent } from 'react';
import { Term, TermStatus, Language, GeminiSuggestion, AIConfig, UserSettings } from '../types';
import { X, Sparkles, Save, Trash2, ExternalLink, Hash, Quote, Info, Check, Link as LinkIcon, Loader2, GitMerge, BookOpen, Globe, Book } from 'lucide-react';
import { analyzeTerm } from '../services/llmService';
import { queryWiktionary, WiktionaryEntry } from '../services/wiktionaryService';

const AI_CACHE_KEY = 'luminous_lute_ai_cache';

interface AICacheEntry {
  word: string;
  language: string;
  suggestion: GeminiSuggestion;
  timestamp: number;
}

const getCachedAI = (word: string, language: string): GeminiSuggestion | null => {
  try {
    const cacheData = sessionStorage.getItem(AI_CACHE_KEY);
    if (!cacheData) return null;
    
    const cache: AICacheEntry[] = JSON.parse(cacheData);
    const entry = cache.find(c => 
      c.word.toLowerCase() === word.toLowerCase() && 
      c.language.toLowerCase() === language.toLowerCase()
    );
    
    if (entry && Date.now() - entry.timestamp < 30 * 60 * 1000) {
      console.debug('[TermSidebar] Cache hit for:', word, language);
      return entry.suggestion;
    }
  } catch (e) {
    console.debug('[TermSidebar] Cache read error:', e);
  }
  return null;
};

const setCachedAI = (word: string, language: string, suggestion: GeminiSuggestion): void => {
  try {
    const cacheData = sessionStorage.getItem(AI_CACHE_KEY);
    let cache: AICacheEntry[] = cacheData ? JSON.parse(cacheData) : [];
    
    cache = cache.filter(c => 
      !(c.word.toLowerCase() === word.toLowerCase() && c.language.toLowerCase() === language.toLowerCase())
    );
    
    cache.push({ word, language, suggestion, timestamp: Date.now() });
    
    if (cache.length > 100) {
      cache = cache.slice(-100);
    }
    
    sessionStorage.setItem(AI_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.debug('[TermSidebar] Cache write error:', e);
  }
};

interface DictionaryEntryDisplayProps {
  entry: WiktionaryEntry;
}

const DictionaryEntryDisplay: React.FC<DictionaryEntryDisplayProps> = ({ entry }) => {
  const [showEtymology, setShowEtymology] = useState(false);
  const [showAllDefinitions, setShowAllDefinitions] = useState(false);
  const [showInflectionAnalysis, setShowInflectionAnalysis] = useState(false);
  
  // Helper function to format grammar for display in inflection analysis
  const formatGrammarForDisplay = (grammar: any): string => {
    if (!grammar) return '';
    
    if (typeof grammar === 'string') {
      return grammar;
    }
    
    if (typeof grammar === 'object' && grammar !== null) {
      const parts: string[] = [];
      
      // Format each grammar category with its values
      if (grammar.gender && Array.isArray(grammar.gender)) {
        parts.push(`gender: ${grammar.gender.join(', ')}`);
      }
      if (grammar.case && Array.isArray(grammar.case)) {
        parts.push(`case: ${grammar.case.join(', ')}`);
      }
      if (grammar.number && Array.isArray(grammar.number)) {
        parts.push(`number: ${grammar.number.join(', ')}`);
      }
      if (grammar.tense && Array.isArray(grammar.tense)) {
        parts.push(`tense: ${grammar.tense.join(', ')}`);
      }
      if (grammar.mood && Array.isArray(grammar.mood)) {
        parts.push(`mood: ${grammar.mood.join(', ')}`);
      }
      if (grammar.person && Array.isArray(grammar.person)) {
        parts.push(`person: ${grammar.person.join(', ')}`);
      }
      if (grammar.voice && Array.isArray(grammar.voice)) {
        parts.push(`voice: ${grammar.voice.join(', ')}`);
      }
      if (grammar.degree && Array.isArray(grammar.degree)) {
        parts.push(`degree: ${grammar.degree.join(', ')}`);
      }
      if (grammar.verbal && Array.isArray(grammar.verbal)) {
        parts.push(`verbal: ${grammar.verbal.join(', ')}`);
      }
      if (grammar.style && Array.isArray(grammar.style)) {
        parts.push(`style: ${grammar.style.join(', ')}`);
      }
      
      // Handle any other properties that might be arrays or single values
      for (const [key, value] of Object.entries(grammar)) {
        // Skip already handled categories
        if (['gender', 'case', 'number', 'tense', 'mood', 'person', 'voice', 'degree', 'verbal', 'style'].includes(key)) {
          continue;
        }
        
        if (Array.isArray(value)) {
          parts.push(`${key}: ${value.join(', ')}`);
        } else if (value !== null && value !== undefined) {
          parts.push(`${key}: ${value}`);
        }
      }
      
      return parts.join(', ');
    }
    
    return JSON.stringify(grammar);
  };
  
  // 词性标签颜色映射
  const posColors: Record<string, string> = {
    'noun': 'bg-blue-50 text-blue-700 border-blue-200',
    'verb': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'adj': 'bg-amber-50 text-amber-700 border-amber-200',
    'adjective': 'bg-amber-50 text-amber-700 border-amber-200',
    'adv': 'bg-purple-50 text-purple-700 border-purple-200',
    'adverb': 'bg-purple-50 text-purple-700 border-purple-200',
    'pron': 'bg-rose-50 text-rose-700 border-rose-200',
    'preposition': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'conjunction': 'bg-lime-50 text-lime-700 border-lime-200',
    'interjection': 'bg-pink-50 text-pink-700 border-pink-200',
    'article': 'bg-indigo-50 text-indigo-700 border-indigo-200'
  };
  
  const getPosColor = (pos: string = '') => {
    const posKey = pos.toLowerCase();
    for (const [key, color] of Object.entries(posColors)) {
      if (posKey.includes(key)) {
        return color;
      }
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };
  
  // 生成描述性标题
  const getEntryTitle = (entry: WiktionaryEntry): string => {
    const word = entry.word;
    const pos = entry.partOfSpeech || '';
    const entryType = entry.entryType;
    
    if (entryType === 'variant' && entry.rootWord && entry.rootWord.toLowerCase() !== word.toLowerCase()) {
      const inflectionType = entry.inflectionAnalysis?.inflectionType || 'inflection';
      return `${word} (${pos} · ${inflectionType})`;
    }
    
    if (entryType === 'root') {
      return `${word} (${pos} · root)`;
    }
    
    return `${word} (${pos})`;
  };
  
  // 获取词性显示文本
  const getPosDisplayText = (entry: WiktionaryEntry): string => {
    const pos = entry.partOfSpeech || '';
    const entryType = entry.entryType;
    
    if (entryType === 'variant') {
      if (entry.inflectionAnalysis?.inflectionType) {
        const inflectionType = entry.inflectionAnalysis.inflectionType;
        return `${pos} · ${inflectionType}`;
      }
      return `${pos} · inflection`;
    }
    
    if (entryType === 'root') {
      return `${pos} · root`;
    }
    
    return pos;
  };
  
  // 格式化定义显示 - 简洁显示
  const formatDefinitions = (definitions: string[]): string => {
    if (definitions.length === 0) return '';
    
    // 如果是单个简短定义，直接返回
    if (definitions.length === 1 && definitions[0].length < 100) {
      return definitions[0].replace(/^\d+\.\s*/, '');
    }
    
    // 多个简短定义，用分号连接
    if (definitions.every(def => def.length < 60)) {
      return definitions.map(def => def.replace(/^\d+\.\s*/, '')).join('; ');
    }
    
    // 返回第一个定义（如果需要显示更多，用户可点击展开）
    return definitions[0].replace(/^\d+\.\s*/, '');
  };
  
   return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-4">
        {/* 标题行 - 单词和词性 */}
        <div className="flex flex-wrap items-start gap-2 mb-2">
          <h3 className="text-lg font-bold text-slate-900 flex-1">{entry.word}</h3>
          {entry.partOfSpeech && (
            <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${getPosColor(entry.partOfSpeech)} shrink-0`}>
              {getPosDisplayText(entry)}
            </span>
          )}
        </div>
        
        {/* 关系指示器 - 紧凑显示 */}
        <div className="mb-3 space-y-1">
          {/* 变体形式显示根形式 */}
          {entry.entryType === 'variant' && entry.rootWord && entry.rootWord.toLowerCase() !== entry.word.toLowerCase() && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-indigo-400 font-bold">→</span>
              <span className="text-indigo-500 font-medium">Root form: </span>
              <span className="text-indigo-600 font-bold">{entry.rootWord}</span>
            </div>
          )}
          
          {/* 词根形式显示变体 */}
          {entry.entryType === 'root' && entry.variantOf && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-emerald-400 font-bold">↳</span>
              <span className="text-emerald-500 font-medium">Variant: </span>
              <span className="text-emerald-600 font-bold">{entry.variantOf}</span>
            </div>
          )}
          
          {/* 发音信息 */}
          {entry.pronunciation && (
            <div className="text-xs text-slate-500 font-mono">/{entry.pronunciation}/</div>
          )}
        </div>
        
        {/* 定义 - 简洁显示 */}
        {entry.definitions.length > 0 && (
          <div className="mt-2">
            <div className="text-sm text-slate-700 leading-relaxed">
              {(() => {
                const definitionsToShow = entry.definitions.slice(0, showAllDefinitions ? entry.definitions.length : 3);
                
                // 如果只有一个定义或定义都很短，合并显示
                if (definitionsToShow.length <= 3 && definitionsToShow.every(def => def.length < 60)) {
                  return (
                    <div>
                      {definitionsToShow.map((def, idx) => {
                        const cleanedDef = def.replace(/^\d+\.\s*/, ''); // 移除开头的数字编号
                        const isLast = idx === definitionsToShow.length - 1;
                        return (
                          <span key={idx}>
                            {cleanedDef}
                            {!isLast && '; '}
                          </span>
                        );
                      })}
                    </div>
                  );
                }
                
                // 否则显示为列表
                return (
                  <div className="space-y-1">
                    {definitionsToShow.map((def, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-xs font-bold text-slate-400 mt-0.5 shrink-0">{idx + 1}.</span>
                        <span className="flex-1">{def}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            {entry.definitions.length > 3 && (
              <button
                onClick={(e) => { e.preventDefault(); setShowAllDefinitions(!showAllDefinitions); }}
                className="text-xs font-bold text-indigo-500 hover:text-indigo-700 mt-2"
              >
                {showAllDefinitions ? 'Show less' : `Show ${entry.definitions.length - 3} more definitions`}
              </button>
            )}
          </div>
        )}
        
        {/* 词形变化分析描述 */}
        {entry.inflectionAnalysis?.description && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">{entry.inflectionAnalysis.description}</p>
          </div>
        )}
        
        {/* 详细词形变化分析（可折叠） */}
        {(entry.inflectionAnalysis || entry.selfInflectionAnalysis) && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              onClick={(e) => { e.preventDefault(); setShowInflectionAnalysis(!showInflectionAnalysis); }}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
            >
              <span>Inflection Details</span>
              <span className="text-slate-400">{showInflectionAnalysis ? '−' : '+'}</span>
            </button>
            {showInflectionAnalysis && (
              <div className="mt-2 space-y-2">
                {entry.inflectionAnalysis && (
                  <>
                    {entry.inflectionAnalysis.inflectionType && (
                      <div className="text-xs">
                        <span className="font-bold text-slate-500">Type: </span>
                        <span className="text-slate-700">{entry.inflectionAnalysis.inflectionType}</span>
                      </div>
                    )}
                    {entry.inflectionAnalysis.grammar && Object.keys(entry.inflectionAnalysis.grammar).length > 0 && (
                      <div className="text-xs">
                        <span className="font-bold text-slate-500">Grammar: </span>
                        <span className="text-slate-700">
                          {Object.entries(entry.inflectionAnalysis.grammar)
                            .filter(([_, value]) => value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0))
                            .map(([key, value]) => {
                              const formattedValue = Array.isArray(value) ? value.join(', ') : String(value);
                              return `${key}: ${formattedValue}`;
                            })
                            .join('; ')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* 词源（可折叠） */}
        {entry.etymology && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button
              onClick={(e) => { e.preventDefault(); setShowEtymology(!showEtymology); }}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
            >
              <span>Etymology</span>
              <span className="text-slate-400">{showEtymology ? '−' : '+'}</span>
            </button>
            {showEtymology && (
              <div className="mt-2">
                <p className="text-xs text-slate-600 leading-relaxed font-mono">{entry.etymology}</p>
              </div>
            )}
          </div>
        )}
        
        {/* 示例 */}
        {entry.examples && entry.examples.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Examples</h4>
            <div className="space-y-1">
              {entry.examples.slice(0, 2).map((example, idx) => (
                <div key={idx} className="text-xs text-slate-600 italic">"{example}"</div>
              ))}
            </div>
          </div>
        )}
        
        {/* 同义词和反义词 */}
        {(entry.synonyms && entry.synonyms.length > 0) || (entry.antonyms && entry.antonyms.length > 0) ? (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col gap-2">
              {entry.synonyms && entry.synonyms.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Synonyms</h4>
                  <div className="flex flex-wrap gap-1">
                    {entry.synonyms.slice(0, 3).map((syn, idx) => (
                      <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {entry.antonyms && entry.antonyms.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Antonyms</h4>
                  <div className="flex flex-wrap gap-1">
                    {entry.antonyms.slice(0, 3).map((ant, idx) => (
                      <span key={idx} className="text-xs bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100">
                        {ant}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

interface TermSidebarProps {
  word: string;
  sentence: string;
  language: Language;
  existingTerm?: Term;
  onSave: (term: Term, linkedChild?: Term) => void;
  onDeleteTerm?: (key: string) => void;
  allTerms: Record<string, Term>;
  onClose: () => void;
  aiConfig: AIConfig;
  isLinkingMode?: boolean;
  onToggleLinkMode?: () => void;
  aiSuggestion: GeminiSuggestion | null;
  isAiLoading: boolean;
  aiError: string | null;
  onAiSuggest: (targetWord: string, targetSentence: string) => Promise<void>;
  settings: UserSettings;
}

const TermSidebar: React.FC<TermSidebarProps> = ({ 
  word, 
  sentence, 
  language, 
  existingTerm, 
  onSave, 
  onDeleteTerm,
  allTerms,
  onClose,
  aiConfig,
  isLinkingMode,
  onToggleLinkMode,
  aiSuggestion,
  isAiLoading,
  aiError,
  onAiSuggest,
  settings
}) => {
  const [formData, setFormData] = useState<Partial<Term>>({
    text: word,
    translation: '',
    status: TermStatus.Learning1,
    notes: '',
    ...existingTerm
  });
  
   const [wiktionaryData, setWiktionaryData] = useState<WiktionaryEntry[] | null>(null);
  const [isLoadingWiktionary, setIsLoadingWiktionary] = useState(false);
  const [partOfSpeechFilter, setPartOfSpeechFilter] = useState<string>('all');
  const [showAllDictionaryEntries, setShowAllDictionaryEntries] = useState(false);
  const [expandedPosGroups, setExpandedPosGroups] = useState<Set<string>>(new Set());
  
  // 过滤按钮颜色映射
  const filterButtonColors: Record<string, string> = {
    'all': 'bg-indigo-100 text-indigo-700 border-indigo-300',
    'verb': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'noun': 'bg-blue-100 text-blue-700 border-blue-300',
    'adjective': 'bg-amber-100 text-amber-700 border-amber-300',
    'adverb': 'bg-purple-100 text-purple-700 border-purple-300',
    'other': 'bg-slate-100 text-slate-700 border-slate-300'
  };
  
   // 过滤文本颜色映射
  const filterTextColors: Record<string, string> = {
    'all': 'text-indigo-600',
    'verb': 'text-emerald-600',
    'noun': 'text-blue-600',
    'adjective': 'text-amber-600',
    'adverb': 'text-purple-600',
    'other': 'text-slate-600'
  };
  
  // 词性标签颜色映射 (用于分组标题)
  const posColors: Record<string, string> = {
    'noun': 'bg-blue-50 text-blue-700 border-blue-200',
    'verb': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'adj': 'bg-amber-50 text-amber-700 border-amber-200',
    'adjective': 'bg-amber-50 text-amber-700 border-amber-200',
    'adv': 'bg-purple-50 text-purple-700 border-purple-200',
    'adverb': 'bg-purple-50 text-purple-700 border-purple-200',
    'pron': 'bg-rose-50 text-rose-700 border-rose-200',
    'preposition': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'conjunction': 'bg-lime-50 text-lime-700 border-lime-200',
    'interjection': 'bg-pink-50 text-pink-700 border-pink-200',
    'article': 'bg-indigo-50 text-indigo-700 border-indigo-200'
  };
  
  const getPosColor = (pos: string = ''): string => {
    const posKey = pos.toLowerCase();
    for (const [key, color] of Object.entries(posColors)) {
      if (posKey.includes(key)) {
        return color;
      }
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };
  
  // Reset expanded state when word or filter changes
  useEffect(() => {
    setShowAllDictionaryEntries(false);
  }, [word, partOfSpeechFilter]);
  
  // Use a ref to track if we've already analyzed this specific word instance to prevent double-firing
  const analyzedWordRef = useRef<string | null>(null);
  const hasResultRef = useRef<boolean>(false);
  const isMountedRef = useRef(true);
  const autoSavedRef = useRef(false);
  
  // 检查词性是否匹配过滤条件
  const matchesPartOfSpeechFilter = (entry: WiktionaryEntry): boolean => {
    if (partOfSpeechFilter === 'all') return true;
    
    const pos = entry.partOfSpeech?.toLowerCase() || '';
    
    switch (partOfSpeechFilter) {
      case 'verb':
        return pos.includes('verb');
      case 'noun':
        return pos.includes('noun');
      case 'adjective':
        return pos.includes('adj') || pos.includes('adjective');
      case 'adverb':
        return pos.includes('adv') || pos.includes('adverb');
      case 'other':
        return !pos.includes('verb') && 
               !pos.includes('noun') && 
               !pos.includes('adj') && 
               !pos.includes('adjective') &&
               !pos.includes('adv') && 
               !pos.includes('adverb');
      default:
        return true;
    }
  };
  
  // Reset auto-saved flag when word changes
  useEffect(() => {
    autoSavedRef.current = false;
  }, [word]);

  // Helper function to render grammar analysis in a user-friendly format
  const renderGrammarAnalysis = (grammar: any): React.ReactNode => {
    if (!grammar) return 'No grammar analysis available';
    
    if (typeof grammar === 'string') {
      return <p className="text-sm text-slate-700 leading-relaxed font-medium">{grammar}</p>;
    }
    
    if (typeof grammar === 'object' && grammar !== null) {
      // Check if it's the DeepSeek object format
      if (grammar.morphologicalForm || grammar.tense || grammar.mood || grammar.case) {
        return (
          <div className="space-y-2">
            {grammar.morphologicalForm && (
              <div className="flex">
                <span className="w-32 text-xs font-bold text-slate-500 uppercase tracking-wider">Form:</span>
                <span className="flex-1 text-slate-700">{grammar.morphologicalForm}</span>
              </div>
            )}
            {grammar.tense && (
              <div className="flex">
                <span className="w-32 text-xs font-bold text-slate-500 uppercase tracking-wider">Tense:</span>
                <span className="flex-1 text-slate-700">{grammar.tense}</span>
              </div>
            )}
            {grammar.mood && (
              <div className="flex">
                <span className="w-32 text-xs font-bold text-slate-500 uppercase tracking-wider">Mood:</span>
                <span className="flex-1 text-slate-700">{grammar.mood}</span>
              </div>
            )}
            {grammar.case && (
              <div className="flex">
                <span className="w-32 text-xs font-bold text-slate-500 uppercase tracking-wider">Case:</span>
                <span className="flex-1 text-slate-700">{grammar.case}</span>
              </div>
            )}
            {(grammar.separablePrefix === 'Yes' || grammar.separablePrefix === true) && (
              <div className="flex">
                <span className="w-32 text-xs font-bold text-slate-500 uppercase tracking-wider">Separable:</span>
                <span className="flex-1 text-slate-700">Yes ({grammar.separablePrefix === 'Yes' ? 'Prefix separates' : 'Has separable prefix'})</span>
              </div>
            )}
            {(grammar.compound === 'Yes' || grammar.compound === true) && (
              <div className="flex">
                <span className="w-32 text-xs font-bold text-slate-500 uppercase tracking-wider">Compound:</span>
                <span className="flex-1 text-slate-700">Yes ({grammar.compound === 'Yes' ? 'Compound verb' : 'Compound word'})</span>
              </div>
            )}
            {grammar.gender && (
              <div className="flex">
                <span className="w-32 text-xs font-bold text-slate-500 uppercase tracking-wider">Gender:</span>
                <span className="flex-1 text-slate-700">{grammar.gender}</span>
              </div>
            )}
            {grammar.number && (
              <div className="flex">
                <span className="w-32 text-xs font-bold text-slate-500 uppercase tracking-wider">Number:</span>
                <span className="flex-1 text-slate-700">{grammar.number}</span>
              </div>
            )}
          </div>
        );
      }
      
      // Fallback: show as JSON
      return (
        <pre className="text-xs bg-slate-50 p-3 rounded-lg overflow-auto max-h-40">
          {JSON.stringify(grammar, null, 2)}
        </pre>
      );
    }
    
    return <p className="text-sm text-slate-700 leading-relaxed font-medium">Invalid grammar format</p>;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.debug('[TermSidebar] Component unmounting', {
        currentWord: word,
        analyzedWord: analyzedWordRef.current
      });
      isMountedRef.current = false;
    };
  }, [word]);

  const handleAiSuggestLocal = useCallback(async (targetWord: string, targetSentence: string) => {
    console.debug('[TermSidebar] handleAiSuggestLocal called:', {
      targetWord,
      targetSentenceLength: targetSentence.length,
      language: language?.name,
      provider: aiConfig?.provider || 'unknown'
    });
    
    if (!language || !language.name) {
      console.error('[TermSidebar] Language not configured:', language);
      return;
    }
    
    try {
      if (typeof onAiSuggest !== 'function') {
        console.error('[TermSidebar] onAiSuggest is not a function:', onAiSuggest);
        return;
      }
      await onAiSuggest(targetWord, targetSentence);
      hasResultRef.current = true;
    } catch (error) {
      console.error('[TermSidebar] Error calling parent AI suggest:', error);
    }
  }, [language, aiConfig, onAiSuggest]);

  // Fetch Wiktionary data when word changes - non-blocking
  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;
    
    const fetchWiktionaryData = async () => {
      if (!word || !language) return;
      
      console.debug('[TermSidebar] Fetching Wiktionary data for:', word);
      setIsLoadingWiktionary(true);
      
      try {
        // 创建AbortController以便在组件卸载时取消请求
        abortController = new AbortController();
        
        // 设置超时，避免长时间阻塞
        const timeoutId = setTimeout(() => {
          if (abortController) {
            abortController.abort();
          }
        }, 3000);
        
        const result = await queryWiktionary(word, language);
        clearTimeout(timeoutId);
        
        if (!isMounted) return;
        
        if (result.success && result.entries.length > 0) {
          console.debug('[TermSidebar] Wiktionary data received:', {
            entries: result.entries.length,
            definitions: result.entries[0].definitions.length,
            translations: result.entries[0].translations.length
          });
          setWiktionaryData(result.entries);
          
            // Update form data with Wiktionary definitions if no existing translation
            if (!existingTerm?.translation && result.entries.length > 0) {
              // 对条目进行排序：normal在前，root其次，variant最后（与显示逻辑一致）
              const sortedEntries = [...result.entries].sort((a, b) => {
                const aType = a.entryType || 'normal';
                const bType = b.entryType || 'normal';
                const typeOrder = { 'normal': 1, 'root': 2, 'variant': 3 };
                return (typeOrder[aType] || 4) - (typeOrder[bType] || 4);
              });
              
              // 寻找合适的条目用于翻译：优先选择root/normal条目，跳过只有变体解释的条目
              let translationEntry = sortedEntries[0];
              
              // 尝试找到第一个有实际定义的root或normal条目
              const suitableEntry = sortedEntries.find(entry => 
                (entry.entryType === 'root' || entry.entryType === 'normal') && 
                entry.definitions.length > 0 &&
                !entry.definitions[0]?.toLowerCase().includes('inflection of') &&
                !entry.definitions[0]?.toLowerCase().includes('plural of')
              );
              
              if (suitableEntry) {
                translationEntry = suitableEntry;
              } else {
                // 如果没有合适的root/normal条目，使用第一个有定义的条目
                const entryWithDefinitions = sortedEntries.find(entry => entry.definitions.length > 0);
                if (entryWithDefinitions) {
                  translationEntry = entryWithDefinitions;
                }
              }
              
              if (translationEntry.definitions.length > 0) {
                const definitions = translationEntry.definitions.join('; ');
                console.debug('[TermSidebar] Setting translation from dictionary entry:', {
                  word,
                  translationEntryType: translationEntry.entryType,
                  translationEntryWord: translationEntry.word,
                  definitionsCount: translationEntry.definitions.length,
                  firstDefinition: translationEntry.definitions[0]
                });
                const updates: Partial<Term> = {
                  translation: definitions
                };
                
                // 如果选择的条目与原词不同（例如选择了root条目），自动设置text为字典形式
                if (translationEntry.word.toLowerCase() !== word.toLowerCase()) {
                  // 设置text为字典形式
                  updates.text = translationEntry.word;
                  // 清除parentId，因为原词本身不需要parent
                  updates.parentId = undefined;
                }
                
                setFormData(prev => ({
                  ...prev,
                  ...updates
                }));
              }
            }
        } else {
          console.debug('[TermSidebar] No Wiktionary data found or API returned empty');
          setWiktionaryData(null);
        }
      } catch (error) {
        if (!isMounted) return;
        
        if (error.name === 'AbortError') {
          console.debug('[TermSidebar] Wiktionary fetch timeout');
        } else {
          console.error('[TermSidebar] Error fetching Wiktionary data:', error);
        }
        setWiktionaryData(null);
      } finally {
        if (isMounted) {
          setIsLoadingWiktionary(false);
        }
      }
    };
    
    // 延迟获取，避免阻塞初始渲染
    const timer = setTimeout(fetchWiktionaryData, 100);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [word, language, existingTerm?.translation]);

  // Form Reset Logic (disabled auto AI analysis)
  useEffect(() => {
    console.debug('[TermSidebar] Form reset triggered:', {
      word,
      existingTerm: !!existingTerm,
      hasParent: !!existingTerm?.parentId,
      language: language?.name
    });
    
    let initialData = existingTerm;
    
    // If the selected word is already a child, we want to edit the Parent concept
    if (existingTerm?.parentId && allTerms[existingTerm.parentId]) {
        console.debug('[TermSidebar] Using parent term instead');
        initialData = allTerms[existingTerm.parentId];
    }

    setFormData({
      text: word,
      translation: '',
      status: TermStatus.Learning1,
      notes: '',
      ...initialData // Overwrites text if parent loaded
    });
    
    // Reset AI analysis tracking
    analyzedWordRef.current = word;
    hasResultRef.current = false;
    
    console.debug('[TermSidebar] Form reset complete, auto-analysis disabled');
  }, [word, existingTerm, allTerms, language]);

  // Helper function to format grammar for notes
  const formatGrammarForNotes = (grammar: any): string => {
    if (!grammar) return '';
    
    if (typeof grammar === 'string') {
      return grammar;
    }
    
    if (typeof grammar === 'object' && grammar !== null) {
      // Format DeepSeek object format for notes
      const parts: string[] = [];
      
      if (grammar.morphologicalForm) parts.push(`Form: ${grammar.morphologicalForm}`);
      if (grammar.tense) parts.push(`Tense: ${grammar.tense}`);
      if (grammar.mood) parts.push(`Mood: ${grammar.mood}`);
      if (grammar.case) parts.push(`Case: ${grammar.case}`);
      if (grammar.separablePrefix === 'Yes' || grammar.separablePrefix === true) parts.push('Separable prefix verb');
      if (grammar.compound === 'Yes' || grammar.compound === true) parts.push('Compound word');
      if (grammar.gender) parts.push(`Gender: ${grammar.gender}`);
      if (grammar.number) parts.push(`Number: ${grammar.number}`);
      
      return parts.join(' | ');
    }
    
    return JSON.stringify(grammar);
   };

  // Update form data when AI suggestion arrives
  useEffect(() => {
    if (aiSuggestion && !existingTerm?.translation) {
      console.debug('[TermSidebar] Updating form data from AI suggestion', {
        currentWord: word,
        aiSuggestionWord: aiSuggestion.rootWord || 'unknown'
      });
      
      // Verify this suggestion is for the current word
      // Check if the suggestion's root word matches our current word (case-insensitive)
      const suggestionRootWord = String(aiSuggestion.rootWord || '').toLowerCase();
      const currentWordLower = word.toLowerCase();
      
      // Allow if: 
      // 1. Suggestion root word matches current word
      // 2. Or if we can't determine (empty root word)
      // 3. Or if it's a different form (e.g., "nahm" -> "nehmen")
      const isRelevantSuggestion = !suggestionRootWord || 
                                  suggestionRootWord === currentWordLower ||
                                  suggestionRootWord.includes(currentWordLower) ||
                                  currentWordLower.includes(suggestionRootWord);
      
      if (!isRelevantSuggestion) {
        console.warn('[TermSidebar] Ignoring AI suggestion for different word:', {
          currentWord: word,
          suggestionRootWord: suggestionRootWord,
          isRelevant: isRelevantSuggestion
        });
        return;
      }
      
      setFormData(prev => {
        const newTranslation = prev.translation ? prev.translation : aiSuggestion.translation;
        
        const grammarNote = formatGrammarForNotes(aiSuggestion.grammar);
        const newNotes = grammarNote && prev.notes?.includes(grammarNote) 
          ? prev.notes 
          : grammarNote 
            ? `${grammarNote}\n\n${prev.notes || ''}`.trim()
            : prev.notes;

        const updates: Partial<Term> = {
            ...prev,
            translation: newTranslation,
            notes: newNotes
        };

        // Handle Root Word detection (e.g. "nahm" -> "nehmen")
        const rootWordStr = String(aiSuggestion.rootWord || '');
        if (rootWordStr && rootWordStr.toLowerCase() !== word.toLowerCase()) {
            updates.text = rootWordStr;
            updates.parentId = undefined;
        } else {
            // Suggest parent ID if not already set
            updates.parentId = prev.parentId || (rootWordStr ? `${language.id}:${rootWordStr.toLowerCase()}` : undefined);
        }

        return updates;
      });
    }
  }, [aiSuggestion, word, language.id, existingTerm?.translation]);

  // Auto-save on click if enabled
  useEffect(() => {
    if (!settings?.autoSaveOnClick || existingTerm || autoSavedRef.current) return;
    const hasTranslation = formData.translation && formData.translation.trim() !== '';
    const hasData = wiktionaryData || aiSuggestion;
    if (hasTranslation && hasData) {
      const termToSave: Term = {
        id: existingTerm?.id || `${Date.now()}`,
        text: formData.text || word,
        translation: formData.translation || '',
        languageId: language.id,
        status: formData.status || TermStatus.Learning1,
        notes: formData.notes || '',
        image: formData.image,
        parentId: formData.parentId,
        nextReview: formData.nextReview,
        reps: formData.reps || 0,
      };
      onSave(termToSave);
      autoSavedRef.current = true;
      console.debug('[TermSidebar] Auto-saved term:', termToSave.text);
    }
  }, [settings?.autoSaveOnClick, existingTerm, formData.translation, formData.text, formData.status, formData.notes, formData.image, formData.parentId, formData.nextReview, formData.reps, wiktionaryData, aiSuggestion, word, language.id, onSave]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Prepare the Main Term (usually the Parent/Root)
    const mainTerm: Term = {
      id: existingTerm?.parentId ? (allTerms[existingTerm.parentId]?.id || `${Date.now()}`) : (existingTerm?.id || `${Date.now()}`),
      text: formData.text || word,
      languageId: language.id,
      translation: formData.translation || '',
      status: formData.status || TermStatus.Learning1,
      notes: formData.notes || '',
      parentId: formData.parentId,
      // Preserve image if it exists in data, though UI doesn't generate it anymore
      image: formData.image,
      // Preserve SRS data if updating
      interval: existingTerm?.interval,
      easeFactor: existingTerm?.easeFactor,
      reps: existingTerm?.reps,
      nextReview: existingTerm?.nextReview,
      lastReview: existingTerm?.lastReview,
    } as Term;

    let childTerm: Term | undefined;

    // 2. If the Main Term text differs from the selected text (e.g. "nehmen" vs "nahm")
    // We create/update the Child Term ("nahm") to link to the Parent ("nehmen")
    if ((mainTerm.text || '').toLowerCase() !== word.toLowerCase()) {
        const parentKey = `${language.id}:${mainTerm.text.toLowerCase()}`;
        childTerm = {
            id: existingTerm?.text.toLowerCase() === word.toLowerCase() ? existingTerm.id : `${Date.now()}_child`,
            text: word,
            languageId: language.id,
            translation: '-> ' + mainTerm.text,
            status: mainTerm.status, 
            notes: '',
            parentId: parentKey
        };
        // Ensure Main Term doesn't point to itself
        mainTerm.parentId = undefined;
    }

    if (typeof onSave !== 'function') {
      console.error('[TermSidebar] onSave is not a function:', onSave);
      return;
    }
    
    onSave(mainTerm, childTerm);
  };

  const parentTerm = formData.parentId ? allTerms[formData.parentId] : null;
  const isRootMode = (formData.text || '').toLowerCase() !== word.toLowerCase();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-white shadow-2xl animate-in slide-in-from-right-4 duration-300">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex flex-col flex-1 min-w-0 pr-4">
          <h2 className="font-black text-2xl text-slate-900 flex items-center gap-2 group">
            <span className="truncate">{word}</span>
            {existingTerm && (
              <span className="shrink-0 text-[8px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-100 uppercase tracking-[0.2em] font-black">
                Stored
              </span>
            )}
           </h2>
         </div>
        <button type="button" onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors shrink-0">
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="flex gap-2">
          <button 
            type="button" 
            onClick={onToggleLinkMode}
            className={`flex-1 py-4 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border
              ${isLinkingMode 
                ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}
            `}
            title="Link another fragment (e.g. separable prefix)"
          >
            <LinkIcon size={16} />
            {isLinkingMode ? 'Selecting' : 'Link Part'}
          </button>
        </div>



        {/* AI Analysis Trigger Button */}
        {!aiSuggestion && !isAiLoading && !aiError && (
          <div className="space-y-3">
            <button
              onClick={() => handleAiSuggestLocal(word, sentence)}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl px-5 py-4 font-bold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-95"
              disabled={isAiLoading}
            >
              <Sparkles size={20} />
              <span>Analyze with AI</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Get detailed grammar analysis, root word, and examples
            </p>
          </div>
        )}
        
        {/* Dictionary Content Display (Replaces Visual Anchor) */}
        {(aiSuggestion || isAiLoading || aiError) && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen size={12} /> Linguistic Analysis
                </span>
                {!isAiLoading && (
                  <button 
                    onClick={() => handleAiSuggestLocal(word, sentence)}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1"
                  >
                    <Sparkles size={12} /> Re-analyze
                  </button>
                )}
             </label>
               <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200">
                 {aiError ? (
                     <div className="p-6 space-y-4">
                         <div className="flex items-start gap-3">
                             <div className="shrink-0 mt-1 bg-rose-500/20 p-2 rounded-xl text-rose-400 border border-rose-500/30">
                                 <Info size={16} />
                             </div>
                             <div className="flex-1">
                                 <h4 className="text-[9px] font-black text-rose-400 uppercase tracking-[0.2em] mb-1.5">API Error</h4>
                                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                     {String(aiError)}
                                  </p>
                                 <button 
                                   onClick={() => handleAiSuggestLocal(word, sentence)}
                                    className="mt-3 text-[10px] font-bold text-slate-500 hover:text-indigo-500 uppercase tracking-widest flex items-center gap-1"
                                 >
                                   <Sparkles size={12} /> Retry Analysis
                                 </button>
                             </div>
                         </div>
                     </div>
                 ) : isAiLoading ? (
                      <div className="p-8 flex flex-col items-center justify-center text-slate-400 gap-3">
                         <Loader2 size={24} className="animate-spin text-indigo-500" />
                         <span className="text-[10px] uppercase tracking-widest">Searching Dictionaries...</span>
                     </div>
                 ) : (
                     <div className="p-6 space-y-5">
                         {/* Grammar / Linguistic Analysis */}
                         <div className="flex items-start gap-4">
                             <div className="shrink-0 mt-1 bg-indigo-500/20 p-2 rounded-xl text-indigo-400 border border-indigo-500/30">
                             <Info size={16} />
                             </div>
                              <div>
                              <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1.5">Linguistic Analysis</h4>
                               <div className="text-sm text-slate-700 leading-relaxed font-medium">
                                  {renderGrammarAnalysis(aiSuggestion?.grammar)}
                               </div>
                             </div>
                        </div>

                        {/* Examples */}
                         {aiSuggestion?.examples && aiSuggestion.examples.length > 0 && (
                            <div className="space-y-3 pt-5 border-t border-slate-200">
                             <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Quote size={12} /> Usage Examples
                             </h4>
                            <div className="space-y-2">
                                {aiSuggestion.examples.map((ex, i) => (
                                 <div key={i} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600 leading-relaxed font-medium italic">
                                    {ex}
                                 </div>
                                ))}
                            </div>
                            </div>
                        )}
                        
                        {/* Source Links (Grounding) */}
                         {aiSuggestion?.sources && aiSuggestion.sources.length > 0 && (
                            <div className="space-y-3 pt-5 border-t border-slate-200">
                                 <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Globe size={12} /> Sources
                                 </h4>
                                <div className="flex flex-wrap gap-2">
                                    {aiSuggestion.sources.map((source, i) => (
                                        <a 
                                            key={i} 
                                            href={source.uri} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                             className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-[10px] text-indigo-600 font-bold border border-slate-300 transition-colors truncate max-w-full"
                                        >
                                            <ExternalLink size={10} />
                                             {source.title || (() => {
                                               try {
                                                 return new URL(source.uri).hostname;
                                               } catch {
                                                 return 'source';
                                               }
                                             })()}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>
        )}

        {/* Dictionary Content - Dictionary Links */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Book size={12} /> Dictionary
            </label>
            <div className="flex items-center gap-3">
              {/* 用户自定义词典链接 */}
              {language.dictionaryUrl && (
                <a 
                  href={language.dictionaryUrl.replace('###', encodeURIComponent(word))}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-600 transition-colors flex items-center gap-1 normal-case tracking-normal font-bold text-sm"
                >
                  <ExternalLink size={12} />
                  Custom
                </a>
              )}
              {/* Wiktionary 链接 */}
              <a 
                href={`https://${language.id}.wiktionary.org/wiki/${encodeURIComponent(word)}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-1 normal-case tracking-normal font-bold text-sm"
              >
                <ExternalLink size={12} />
                Wiktionary
              </a>
            </div>
          </div>
          
           {/* Part of Speech Filter */}
           <div className="flex flex-wrap gap-1.5">
             {['all', 'verb', 'noun', 'adjective', 'adverb', 'other'].map((filter) => (
               <button
                 key={filter}
                 type="button"
                 onClick={() => setPartOfSpeechFilter(filter)}
                 className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full border transition-all ${
                   partOfSpeechFilter === filter
                     ? filterButtonColors[filter] || 'bg-slate-100 text-slate-700 border-slate-300'
                     : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                 }`}
               >
                 {filter === 'all' ? 'All' : 
                  filter === 'verb' ? 'Verbs' :
                  filter === 'noun' ? 'Nouns' :
                  filter === 'adjective' ? 'Adjectives' :
                  filter === 'adverb' ? 'Adverbs' : 'Other'}
               </button>
             ))}
            </div>
           
             {/* Filter stats */}
             {wiktionaryData && wiktionaryData.length > 0 && (() => {
               const filteredEntries = wiktionaryData.filter(matchesPartOfSpeechFilter);
               // Group entries by part of speech
               const entriesByPos = new Map<string, WiktionaryEntry[]>();
               filteredEntries.forEach(entry => {
                 const pos = entry.partOfSpeech || 'Unknown';
                 if (!entriesByPos.has(pos)) {
                   entriesByPos.set(pos, []);
                 }
                 entriesByPos.get(pos)!.push(entry);
               });
               const posGroups = Array.from(entriesByPos.entries());
               const groupCount = posGroups.length;
               const displayedGroupCount = showAllDictionaryEntries ? groupCount : Math.min(2, groupCount);
               const textColor = filterTextColors[partOfSpeechFilter] || 'text-indigo-600';
               const boldTextColor = textColor.replace('600', '700') || 'text-indigo-700';
               
               return (
                 <div className="flex items-center justify-between">
                   <div className="text-[10px] font-bold uppercase tracking-wider">
                     <span className="text-slate-400">Showing </span>
                     <span className={textColor}>{displayedGroupCount}</span>
                     <span className="text-slate-400"> of </span>
                     <span className={`${boldTextColor} font-black`}>{groupCount}</span>
                     <span className="text-slate-400"> groups</span>
                     <span className="text-slate-400"> ({filteredEntries.length} entries)</span>
                     {partOfSpeechFilter !== 'all' && (
                       <span className="text-slate-400 ml-1">({wiktionaryData.length} total entries)</span>
                     )}
                   </div>
                   {partOfSpeechFilter !== 'all' && (
                     <div className={`text-[8px] px-2 py-1 rounded-full ${filterButtonColors[partOfSpeechFilter] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                       {partOfSpeechFilter.toUpperCase()}
                     </div>
                   )}
                 </div>
               );
             })()}
           
            {/* Dictionary Details */}
           {isLoadingWiktionary ? (
             <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center">
               <Loader2 size={16} className="animate-spin text-indigo-500 mr-2" />
               <span className="text-xs text-slate-500">Loading dictionary data...</span>
             </div>
           ) : wiktionaryData && wiktionaryData.length > 0 ? (
                <div className="space-y-6">
                  {( () => {
                    // Filter and sort entries
                    const filteredEntries = wiktionaryData
                      .filter(matchesPartOfSpeechFilter)
                     .sort((a, b) => {
                         const aType = a.entryType || 'normal';
                         const bType = b.entryType || 'normal';
                         const typeOrder = { 'normal': 1, 'root': 2, 'variant': 3 };
                         return (typeOrder[aType] || 4) - (typeOrder[bType] || 4);
                       });
                    
                    // Group entries by part of speech
                    const entriesByPos = new Map<string, WiktionaryEntry[]>();
                    filteredEntries.forEach(entry => {
                      const pos = entry.partOfSpeech || 'Unknown';
                      if (!entriesByPos.has(pos)) {
                        entriesByPos.set(pos, []);
                      }
                      entriesByPos.get(pos)!.push(entry);
                    });
                    
                    // Convert to array of groups and sort by group size (largest first)
                    const posGroups = Array.from(entriesByPos.entries())
                      .sort(([, entriesA], [, entriesB]) => entriesB.length - entriesA.length);
                    
                    // Determine groups to display (if not showing all, limit to top 2 groups)
                    const groupDisplayCount = showAllDictionaryEntries ? posGroups.length : Math.min(2, posGroups.length);
                    const displayedGroups = posGroups.slice(0, groupDisplayCount);
                    
                    return (
                      <>
                        {displayedGroups.map(([pos, entries], groupIndex) => {
                          const isExpanded = expandedPosGroups.has(pos);
                          const entriesToShow = isExpanded ? entries : entries.slice(0, 1); // Show 1 entry if collapsed
                          const posColor = getPosColor(pos);
                          const posDisplayName = pos === 'Unknown' ? 'Other' : pos;
                          
                          return (
                            <div key={`${pos}-${groupIndex}`} className="space-y-3">
                              {/* Group header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${posColor}`}>
                                    {posDisplayName}
                                  </span>
                                  <span className="text-xs text-slate-500 font-bold">
                                    ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedPosGroups);
                                    if (isExpanded) {
                                      newExpanded.delete(pos);
                                    } else {
                                      newExpanded.add(pos);
                                    }
                                    setExpandedPosGroups(newExpanded);
                                  }}
                                  className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                                >
                                  {isExpanded ? 'Show less' : 'Show all'}
                                  <span className="text-indigo-400 font-bold">{isExpanded ? '−' : '+'}</span>
                                </button>
                              </div>
                              
                              {/* Group entries */}
                              <div className="space-y-4">
                                {entriesToShow.map((entry, entryIndex) => (
                                  <div key={`${entry.word}-${entry.partOfSpeech || 'default'}-${entryIndex}`} className="relative">
                                    {/* Entry number */}
                                    <div className="absolute -left-2 -top-2 w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-md">
                                      {entryIndex + 1}
                                    </div>
                                    <DictionaryEntryDisplay entry={entry} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Show more groups button */}
                        {posGroups.length > 2 && (
                          <div className="pt-2 flex justify-center">
                            <button
                              type="button"
                              onClick={() => setShowAllDictionaryEntries(!showAllDictionaryEntries)}
                              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border border-indigo-300 text-indigo-600 hover:text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 flex items-center gap-1.5 transition-all"
                            >
                              {showAllDictionaryEntries ? 'Show fewer groups' : `Show ${posGroups.length - 2} more groups`}
                              <span className="text-indigo-400 font-bold">{showAllDictionaryEntries ? '−' : '+'}</span>
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
               </div>
           ) : (
             <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
               <p className="text-xs text-slate-500 text-center">No dictionary data found</p>
             </div>
           )}
        </div>
        


        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Learning Level</label>
          <div className="flex justify-between items-center bg-slate-50 p-2 rounded-2xl border border-slate-100 gap-1">
            {[1, 2, 3, 4, 5, 99].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: s as TermStatus }))}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all
                  ${formData.status === s 
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' 
                    : 'text-slate-400 hover:text-slate-600'}
                `}
              >
                {s === 99 ? 'IGN' : s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Parent / Root Form</label>
          </div>
          <div className="relative">
            <Hash size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input 
              type="text"
              placeholder="Dictionary form (e.g. bequemen)"
              value={formData.text}
              onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-5 py-3.5 text-sm focus:outline-none focus:border-indigo-500 font-bold text-slate-700"
            />
            {isRootMode && (
              <div className="absolute -top-2 right-2">
                <span className="text-[8px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full uppercase font-bold">
                  Auto-detected
                </span>
              </div>
            )}
          </div>
          {parentTerm && !isRootMode && (
            <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs">
              <div className="flex items-center gap-2">
                <GitMerge size={12} className="text-emerald-500" />
                <span className="text-emerald-700 font-medium">Linked to dictionary form: <strong>{parentTerm.text}</strong></span>
              </div>
              <button 
                type="button" 
                onClick={() => setFormData(prev => ({ ...prev, parentId: undefined }))}
                className="text-emerald-400 hover:text-rose-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="h-20" />
      </div>

      <div className="p-6 bg-white border-t border-slate-100 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] space-y-3">
        {existingTerm && onDeleteTerm && (
          <button 
            type="button"
            onClick={() => {
              // 删除当前term及其所有变体
              const currentKey = `${language.id}:${existingTerm.text.toLowerCase()}`;
              const childKeys = Object.keys(allTerms).filter(key => {
                const term = allTerms[key];
                return term.parentId === currentKey;
              });
              
              // 首先删除子项
              childKeys.forEach(key => onDeleteTerm(key));
              // 然后删除当前项
              onDeleteTerm(currentKey);
              onClose();
            }}
            className="w-full bg-rose-50 text-rose-600 py-3 rounded-[20px] font-black text-[11px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 hover:bg-rose-100 hover:text-rose-700 transition-all active:scale-95 border border-rose-200"
          >
            <Trash2 size={16} strokeWidth={3} />
            Delete from Collection
          </button>
        )}
        <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[24px] font-black text-[11px] tracking-[0.3em] uppercase flex items-center justify-center gap-3 hover:bg-black hover:shadow-2xl transition-all active:scale-95">
          <Check size={18} strokeWidth={3} />
          {isRootMode ? 'Store Root & Link' : 'Store in Collection'}
        </button>
      </div>
    </form>
  );
};

export default TermSidebar;
