

// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Term, TermStatus, Language, GeminiSuggestion, AIConfig, UserSettings } from '../types';
import { X, Sparkles, Save, Trash2, ExternalLink, Hash, Quote, Check, Link as LinkIcon, Loader2, BookOpen, Book, FileText, AlertCircle, RefreshCw, Braces, ArrowRight, Globe, Filter, Volume2, Languages, Info, Quote as QuoteIcon, Layers, GitMerge, Puzzle } from 'lucide-react';
import { queryWiktionary, WiktionaryEntry } from '../services/wiktionaryService.ts';
import { sanskritService, AnalyzeResult, SanskritSegment, TransliterationResult } from '../services/enhancedSanskritService';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SHAKESPEARE = 'VWXYZABCDEFGHIJKLMNOPQRSTU';

function rot13(str: string): string {
  return str.replace(/[A-Z]/gi, (c) => {
    const idx = ALPHABET.indexOf(c.toUpperCase());
    return idx === -1 ? c : SHAKESPEARE[idx] + (c === c.toLowerCase() ? '' : '');
  });
}


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
  onAiSuggest: (targetWord: string, targetSentence: string, pipelineData?: any) => Promise<void>;
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
    reps: 0,
    ...existingTerm
  });
  
  const [wiktionaryData, setWiktionaryData] = useState<WiktionaryEntry[] | null>(null);
  const [isLoadingWiktionary, setIsLoadingWiktionary] = useState(false);
  
  // Wiktionary filter state
  const [posFilter, setPosFilter] = useState<string>('all');
  const [showInflections, setShowInflections] = useState(true);
  
  // Theme color mapping
  const getThemeClasses = () => {
    const theme = settings?.theme || 'auto';
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-slate-900', text: 'text-slate-100', border: 'border-slate-700',
          cardBg: 'bg-slate-800', hoverBg: 'hover:bg-slate-700',
          mutedText: 'text-slate-400', mutedBg: 'bg-slate-800/50',
          navBg: 'bg-slate-800/80', inputBg: 'bg-slate-700',
          buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
          buttonSecondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
          accent: 'indigo', accentBg: 'bg-indigo-600', accentText: 'text-indigo-400'
        };
      case 'night':
        return {
          bg: 'bg-indigo-950', text: 'text-indigo-100', border: 'border-indigo-800',
          cardBg: 'bg-indigo-900', hoverBg: 'hover:bg-indigo-800',
          mutedText: 'text-indigo-400', mutedBg: 'bg-indigo-900/50',
          navBg: 'bg-indigo-900/80', inputBg: 'bg-indigo-900',
          buttonPrimary: 'bg-indigo-700 text-white hover:bg-indigo-800',
          buttonSecondary: 'bg-indigo-800 text-indigo-100 hover:bg-indigo-700',
          accent: 'indigo', accentBg: 'bg-indigo-600', accentText: 'text-indigo-400'
        };
      case 'contrast':
        return {
          bg: 'bg-black', text: 'text-white', border: 'border-white',
          cardBg: 'bg-gray-900', hoverBg: 'hover:bg-gray-800',
          mutedText: 'text-gray-400', mutedBg: 'bg-gray-900/50',
          navBg: 'bg-black/80', inputBg: 'bg-gray-900',
          buttonPrimary: 'bg-white text-black hover:bg-gray-200',
          buttonSecondary: 'bg-gray-900 text-white hover:bg-gray-800',
          accent: 'white', accentBg: 'bg-white', accentText: 'text-white'
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200',
          cardBg: 'bg-amber-100', hoverBg: 'hover:bg-amber-200',
          mutedText: 'text-amber-700', mutedBg: 'bg-amber-100/50',
          navBg: 'bg-amber-100/80', inputBg: 'bg-amber-50',
          buttonPrimary: 'bg-amber-600 text-white hover:bg-amber-700',
          buttonSecondary: 'bg-amber-200 text-amber-900 hover:bg-amber-300',
          accent: 'amber', accentBg: 'bg-amber-600', accentText: 'text-amber-600'
        };
      case 'paper':
        return {
          bg: 'bg-stone-50', text: 'text-stone-800', border: 'border-stone-200',
          cardBg: 'bg-stone-100', hoverBg: 'hover:bg-stone-200',
          mutedText: 'text-stone-600', mutedBg: 'bg-stone-100/50',
          navBg: 'bg-stone-100/80', inputBg: 'bg-stone-50',
          buttonPrimary: 'bg-stone-600 text-white hover:bg-stone-700',
          buttonSecondary: 'bg-stone-200 text-stone-800 hover:bg-stone-300',
          accent: 'stone', accentBg: 'bg-stone-600', accentText: 'text-stone-600'
        };
      default:
        return {
          bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-200',
          cardBg: 'bg-white', hoverBg: 'hover:bg-slate-100',
          mutedText: 'text-slate-500', mutedBg: 'bg-slate-50',
          navBg: 'bg-white/80', inputBg: 'bg-slate-50',
          buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
          buttonSecondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          accent: 'indigo', accentBg: 'bg-indigo-600', accentText: 'text-indigo-600'
        };
    }
  };
  
  const theme = getThemeClasses();

  // Process and filter Wiktionary data
  const processedWiktionaryData = useMemo(() => {
    if (!wiktionaryData || wiktionaryData.length === 0) return null;
    
    let entries = [...wiktionaryData];
    
    // Remove duplicate definitions
    const seen = new Set<string>();
    entries = entries.filter(entry => {
      const key = `${entry.word}-${entry.partOfSpeech}-${entry.definitions.join('|')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Filter by part of speech
    if (posFilter !== 'all') {
      entries = entries.filter(entry => {
        if (!entry.partOfSpeech) return posFilter === 'other';
        const pos = entry.partOfSpeech.toLowerCase();
        switch (posFilter) {
          case 'noun': return pos.includes('noun') || pos.includes('n.');
          case 'verb': return pos.includes('verb') || pos.includes('v.');
          case 'adj': return pos.includes('adj') || pos.includes('adjective');
          case 'adv': return pos.includes('adv') || pos.includes('adverb');
          default: return true;
        }
      });
    }
    
    // Sort: root/normal first, then variants
    const typeOrder: Record<string, number> = { 'root': 0, 'normal': 1, 'variant': 2 };
    entries.sort((a, b) => {
      const aType = typeOrder[a.entryType || 'normal'] ?? 3;
      const bType = typeOrder[b.entryType || 'normal'] ?? 3;
      return aType - bType;
    });
    
    return entries;
  }, [wiktionaryData, posFilter]);

  // Get available part of speech filters from data
  const availablePosFilters = useMemo(() => {
    if (!wiktionaryData) return [];
    const posSet = new Set<string>();
    wiktionaryData.forEach(entry => {
      if (entry.partOfSpeech) {
        const pos = entry.partOfSpeech.toLowerCase();
        if (pos.includes('noun') || pos.includes('n.')) posSet.add('noun');
        else if (pos.includes('verb') || pos.includes('v.')) posSet.add('verb');
        else if (pos.includes('adj')) posSet.add('adj');
        else if (pos.includes('adv')) posSet.add('adv');
      }
    });
    return Array.from(posSet);
  }, [wiktionaryData]);
  
  // 梵语处理状态
  const [sanskritAnalysisResult, setSanskritAnalysisResult] = useState<AnalyzeResult | null>(null);
  const [isProcessingSanskrit, setIsProcessingSanskrit] = useState(false);
  const [sanskritError, setSanskritError] = useState<string | null>(null);
  const [showSanskritAnalysis, setShowSanskritAnalysis] = useState(false);
  
  // 梵语转写状态
  const [transliterations, setTransliterations] = useState<Record<string, string>>({});
  const [isLoadingTransliteration, setIsLoadingTransliteration] = useState(false);
  
  const sidebarRef = useRef<HTMLFormElement>(null);
  
  const analyzedWordRef = useRef<string | null>(null);
  const hasResultRef = useRef<boolean>(false);
  const isMountedRef = useRef(true);
  const autoSavedRef = useRef(false);
  
  // Reset auto-saved flag when word changes
  useEffect(() => {
    autoSavedRef.current = false;
  }, [word]);

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
      languageId: language?.id,
      provider: aiConfig?.provider || 'unknown'
    });
    
    if (!language || !language.name) {
      console.error('[TermSidebar] Language not configured:', language);
      return;
    }
    
    try {
      // 梵语情况：调用 LLM API 结合句子上下文进行详细分析
      if (language.id === 'sa') {
        // 准备 pipeline 数据供 LLM 使用
        const pipelineData = sanskritAnalysisResult?.success ? {
          segments: sanskritAnalysisResult.segments?.map(seg => ({
            text: seg.unsandhied,
            lemma: seg.lemma,
            meaning: seg.meanings?.[0]
          })),
          normalizedText: targetWord
        } : undefined;
        
        // 调用 LLM 进行梵语分析
        await onAiSuggest(targetWord, targetSentence, pipelineData);
        hasResultRef.current = true;
        autoSavedRef.current = true;
        return;
      }
      
      // 非梵语语言使用原有逻辑
      if (typeof onAiSuggest !== 'function') {
        console.error('[TermSidebar] onAiSuggest is not a function:', onAiSuggest);
        return;
      }
      await onAiSuggest(targetWord, targetSentence);
      hasResultRef.current = true;
      autoSavedRef.current = true;
      await onAiSuggest(targetWord, targetSentence);
      // 阻止自动保存 - 用户应该手动保存AI分析结果
      hasResultRef.current = true;
      autoSavedRef.current = true;
    } catch (error) {
      console.error('[TermSidebar] Error calling AI suggest:', error);
    }
  }, [language, aiConfig, onAiSuggest, sanskritAnalysisResult]);

  // Fetch Wiktionary data when word changes - non-blocking
  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;
    
    const fetchWiktionaryData = async () => {
      if (!word || !language) return;
      if (language.id === 'sa') return; // Sanskrit handled by pipeline
      
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
    
    // Reset Sanskrit processing when word changes or language is not Sanskrit
    setSanskritAnalysisResult(null);
    setShowSanskritAnalysis(false);
    setSanskritError(null);
    setIsProcessingSanskrit(false);
    setTransliterations({});
    if (language?.id === 'sa') {
      console.debug('[TermSidebar] Sanskrit processing reset for new Sanskrit word:', word);
    } else {
      console.debug('[TermSidebar] Sanskrit processing reset (non-Sanskrit language)');
    }
    
    console.debug('[TermSidebar] Form reset complete, auto-analysis disabled');
  }, [word, existingTerm, allTerms, language]);

  // 梵语转写函数
  const loadTransliterations = async (text: string) => {
    if (!text.trim() || language?.id !== 'sa') return;
    
    setIsLoadingTransliteration(true);
    try {
      const schemes = ['iast', 'slp1', 'harvardkyoto', 'devanagari'];
      const results: Record<string, string> = {};
      
      for (const scheme of schemes) {
        try {
          const result = await sanskritService.transliterate(text, 'devanagari', scheme as any);
          if (result.success) {
            results[scheme] = result.transliterated;
          }
        } catch (e) {
          console.debug(`Transliteration failed for ${scheme}:`, e);
        }
      }
      
      if (Object.keys(results).length > 0) {
        setTransliterations(results);
      }
    } catch (e) {
      console.debug('Failed to load transliterations:', e);
    }
    setIsLoadingTransliteration(false);
  };

  // 梵语处理函数
  const processSanskritText = async (text: string) => {
    if (!text.trim() || language?.id !== 'sa') return;
    
    setIsProcessingSanskrit(true);
    setSanskritError(null);
    
    try {
      console.debug('[TermSidebar] Processing Sanskrit text:', text);
      const result = await sanskritService.analyze(text);
      
      // 提取分析结果填充表单
      if (result.success && result.segments) {
        let analysisText = '';
        let translationText = '';
        
        for (const seg of result.segments) {
          const dmTag = seg.tag || '';
          const dmMeanings = seg.meanings || [];
          const text = seg.unsandhied || '';
          const originalText = seg.original || text;
          
          if (text) {
            const displayText = originalText !== text ? `${originalText} → ${text}` : text;
            analysisText += `\n${displayText}`;
            
            if (dmTag) {
              analysisText += `\n  Grammar: ${dmTag}`;
            }
            
            if (dmMeanings.length > 0) {
              analysisText += `\n  Meanings: ${dmMeanings.slice(0, 2).join('; ')}`;
              if (!translationText) {
                translationText = dmMeanings[0];
              }
            }
          }
        }
        
        // 填充表单数据
        setFormData(prev => ({
          ...prev,
          translation: translationText || prev.translation,
          notes: `${prev.notes || ''}\n\nDharma Mitra 分析结果\n${analysisText.trim()}`.trim()
        }));
      }
      
      setSanskritAnalysisResult(result);
      setShowSanskritAnalysis(true);
      console.debug('[TermSidebar] Sanskrit analysis result:', result);
    } catch (error) {
      console.error('[TermSidebar] Sanskrit processing error:', error);
      setSanskritError(error instanceof Error ? error.message : '梵语处理失败');
    } finally {
      setIsProcessingSanskrit(false);
    }
  };

  // 当语言是梵语且文本变化时自动处理
  useEffect(() => {
    if (language?.id === 'sa' && word.trim() && !sanskritAnalysisResult) {
      const timer = setTimeout(() => {
        processSanskritText(word);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [word, language?.id]);

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
        
        // Build notes including Chinese translation
        let notesContent = '';
        if (aiSuggestion.chineseTranslation) {
          notesContent += `【中文翻译】${aiSuggestion.chineseTranslation}\n\n`;
        }
        if (grammarNote) {
          notesContent += `${grammarNote}\n`;
        }
        
        const newNotes = notesContent && prev.notes?.includes(notesContent.slice(0, 50))
          ? prev.notes 
          : notesContent
            ? `${notesContent}${prev.notes || ''}`.trim()
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
    // Don't auto-save when AI suggestion is received (user should manually save after AI analysis)
    const hasTranslation = formData.translation && formData.translation.trim() !== '';
    const hasData = wiktionaryData;
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
       reps: formData.reps ?? existingTerm?.reps ?? 0,
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
            parentId: parentKey,
            reps: mainTerm.reps
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
     <form 
       ref={sidebarRef}
       onSubmit={handleSubmit} 
       className={`flex flex-col h-full ${theme.cardBg} shadow-2xl animate-in slide-in-from-right-4 duration-300 relative ${theme.border} border-r`}
      >
       
       <div className={`p-6 border-b flex items-center justify-between ${theme.cardBg} sticky top-0 z-10`}>
        <div className="flex flex-col flex-1 min-w-0 pr-4">
          <h2 className={`font-black text-2xl flex items-center gap-2 group ${theme.text}`}>
            <span className="truncate">{word}</span>
            {existingTerm && (
              <span className={`shrink-0 text-[8px] ${theme.accentBg}/10 ${theme.accentText} px-2 py-1 rounded-full border ${theme.accentBg}/20 uppercase tracking-[0.2em] font-black`}>
                Stored
              </span>
            )}
           </h2>
         </div>
        <button type="button" onClick={onClose} className={`p-2.5 hover:${theme.hoverBg} rounded-full ${theme.mutedText} transition-colors shrink-0`}>
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 space-y-8 ${theme.bg}`}>
        <div className="flex gap-2">
          <button 
            type="button" 
            onClick={onToggleLinkMode}
            className={`flex-1 py-4 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border
              ${isLinkingMode 
                ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' 
                : `${theme.mutedBg} ${theme.border} ${theme.mutedText} ${theme.hoverBg}`}
            `}
            title="Link another fragment (e.g. separable prefix)"
          >
            <LinkIcon size={16} />
            {isLinkingMode ? 'Selecting' : 'Link Part'}
          </button>
        </div>

        {/* Sanskrit Analysis Display - Dharma Mitra Based */}
        {language?.id === 'sa' && showSanskritAnalysis && sanskritAnalysisResult && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles size={12} /> Dharma Mitra Analysis
              </label>
              <button 
                onClick={() => setShowSanskritAnalysis(false)}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
              >
                Hide
              </button>
            </div>

            {/* Word Header */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-900 font-serif mb-1">
                  {word}
                </div>
                <div className="text-sm text-purple-700 font-mono">
                  {sanskritAnalysisResult.input || word}
                </div>
              </div>
              
              {/* Transliterations */}
              {isLoadingTransliteration ? (
                <div className="mt-3 text-center text-xs text-purple-400">Loading transliterations...</div>
              ) : Object.keys(transliterations).length > 0 ? (
                <div className="mt-3 pt-3 border-t border-purple-100 space-y-1.5">
                  <div className="text-[9px] font-bold text-purple-400 uppercase tracking-wider text-center mb-2">Transliteration</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {transliterations.iast && (
                      <div className="bg-white/50 rounded px-2 py-1">
                        <span className="text-purple-400 font-bold">IAST:</span> <span className="font-mono text-purple-800">{transliterations.iast}</span>
                      </div>
                    )}
                    {transliterations.slp1 && (
                      <div className="bg-white/50 rounded px-2 py-1">
                        <span className="text-purple-400 font-bold">SLP1:</span> <span className="font-mono text-purple-800">{transliterations.slp1}</span>
                      </div>
                    )}
                    {transliterations.harvardkyoto && (
                      <div className="bg-white/50 rounded px-2 py-1">
                        <span className="text-purple-400 font-bold">HK:</span> <span className="font-mono text-purple-800">{transliterations.harvardkyoto}</span>
                      </div>
                    )}
                    {transliterations.devanagari && (
                      <div className="bg-white/50 rounded px-2 py-1 col-span-2">
                        <span className="text-purple-400 font-bold">Devanagari:</span> <span className="font-serif text-purple-800">{transliterations.devanagari}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => loadTransliterations(word)}
                  className="mt-3 text-xs text-purple-500 hover:text-purple-700 underline"
                >
                  Show transliterations
                </button>
              )}
            </div>

            {/* Sandhi Analysis Section */}
            {sanskritAnalysisResult.segments && sanskritAnalysisResult.segments.length > 1 && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                <div className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2 mb-3">
                  <Layers size={12} /> Sandhi Analysis
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {sanskritAnalysisResult.segments.map((seg, idx) => (
                    <React.Fragment key={idx}>
                      <span className="bg-white px-3 py-1.5 rounded-lg border border-amber-200 font-mono text-sm font-bold text-amber-800">
                        {seg.original}
                      </span>
                      {idx < sanskritAnalysisResult.segments.length - 1 && (
                        <span className="text-amber-400 font-bold">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="mt-3 text-center text-xs text-amber-600">
                  Original: <span className="font-bold">{word}</span> → {sanskritAnalysisResult.segments.map(s => s.original).join(' + ')}
                </div>
              </div>
            )}

            {/* Segment Cards - Each word from Dharma Mitra */}
            <div className="space-y-3">
              {sanskritAnalysisResult.segments?.map((segment: SanskritSegment, segIdx: number) => {
                const dmTag = segment.tag || '';
                const dmMeanings = segment.meanings || [];
                const text = segment.unsandhied || '';
                const lemma = segment.lemma || '';
                
                return (
                  <div key={segIdx} className="bg-white rounded-2xl border border-purple-200 overflow-hidden">
                    {/* Segment Header */}
                    <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {segIdx + 1}
                          </div>
                          <div>
                            <div className="text-base font-mono font-bold text-purple-900">
                              {text}
                            </div>
                            {lemma && lemma !== text && (
                              <div className="text-xs text-purple-600">
                                Lemma: {lemma}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dharma Mitra Grammar */}
                    {dmTag && (
                      <div className="px-4 py-3 border-b border-purple-100">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen size={12} className="text-purple-600" />
                          <span className="text-[10px] font-bold text-purple-700 uppercase">Grammar</span>
                        </div>
                        <div className="text-sm text-purple-800">
                          {dmTag}
                        </div>
                      </div>
                    )}

                    {/* Dharma Mitra Meanings */}
                    {dmMeanings.length > 0 && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Book size={12} className="text-indigo-600" />
                          <span className="text-[10px] font-bold text-indigo-700 uppercase">Meanings</span>
                        </div>
                        <ul className="space-y-2">
                          {dmMeanings.slice(0, 5).map((meaning: string, mIdx: number) => (
                            <li key={mIdx} className="text-sm text-slate-700 leading-relaxed whitespace-normal break-words">
                              <span className="text-indigo-400 font-bold mr-2">{mIdx + 1}.</span>
                              {meaning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* No data */}
                    {!dmTag && dmMeanings.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        No analysis available
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

         {/* Sanskrit Processing Loading State */}
         {language?.id === 'sa' && isProcessingSanskrit && (
           <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <label className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
               <Sparkles size={12} /> Processing with Dharma Mitra...
             </label>
             <div className="bg-white rounded-2xl border border-purple-200 p-6 flex flex-col items-center justify-center">
               <Loader2 size={24} className="animate-spin text-purple-500 mb-3" />
               <div className="text-xs text-slate-500">
                 Analyzing Sanskrit text...
               </div>
            </div>
           </div>
         )}

         {/* Sanskrit Processing Error */}
         {language?.id === 'sa' && sanskritError && (
           <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <label className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] flex items-center gap-2">
               <AlertCircle size={12} /> Processing Error
             </label>
             <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4">
               <p className="text-sm text-rose-700">{sanskritError}</p>
               <button
                 onClick={() => processSanskritText(word)}
                 className="mt-3 text-xs font-bold text-rose-600 hover:text-rose-800 uppercase tracking-widest"
               >
                 Retry
               </button>
             </div>
           </div>
         )}

         {/* Sanskrit Processing Error */}
         {language?.id === 'sa' && sanskritError && (
           <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
               <AlertCircle size={12} /> Sanskrit Processing Error
             </label>
             <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4">
               <div className="flex items-start gap-3">
                 <AlertCircle size={16} className="text-rose-500 mt-0.5" />
                 <div className="flex-1">
                   <p className="text-sm text-rose-700">{sanskritError}</p>
                   <button 
                     onClick={() => processSanskritText(word)}
                     className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                   >
                     <RefreshCw size={12} /> Retry
                   </button>
                 </div>
               </div>
             </div>
           </div>
         )}

          {/* Sanskrit Processing Trigger Button */}
          {language?.id === 'sa' && !showSanskritAnalysis && !isProcessingSanskrit && !sanskritError && !sanskritAnalysisResult && (
           <div className="space-y-3">
              <button
                onClick={() => processSanskritText(word)}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl px-5 py-4 font-bold hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 active:scale-95"
                disabled={isProcessingSanskrit}
              >
                <Braces size={20} />
                <span>Analyze Sanskrit Text</span>
              </button>
            </div>
          )}

          {/* Sanskrit AI Analysis Display - Shows detailed Sanskrit-specific analysis */}
          {language?.id === 'sa' && aiSuggestion && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Sparkles size={12} /> Sanskrit AI Analysis
                </label>
                <button 
                  onClick={() => handleAiSuggestLocal(word, sentence)}
                  className="text-[10px] font-bold text-purple-400 hover:text-purple-600 uppercase tracking-widest flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Re-analyze
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-purple-200 overflow-hidden">
                {/* Translation */}
                {aiSuggestion.translation && (
                  <div className="p-4 border-b border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Book size={14} className="text-emerald-500" />
                      <h4 className="text-xs font-bold text-slate-700">Translation (英文)</h4>
                    </div>
                    <div className="text-sm text-slate-700">
                      {aiSuggestion.translation}
                    </div>
                  </div>
                )}

                {/* Chinese Translation */}
                {aiSuggestion.chineseTranslation && (
                  <div className="p-4 border-b border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Book size={14} className="text-rose-500" />
                      <h4 className="text-xs font-bold text-slate-700">中文翻译</h4>
                    </div>
                    <div className="text-sm text-slate-700">
                      {aiSuggestion.chineseTranslation}
                    </div>
                  </div>
                )}

                {/* Root Word / Etymology */}
                {aiSuggestion.rootWord && (
                  <div className="p-4 border-b border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers size={14} className="text-amber-500" />
                      <h4 className="text-xs font-bold text-slate-700">Root / Etymology</h4>
                    </div>
                    <div className="text-sm text-slate-700">
                      {aiSuggestion.rootWord}
                    </div>
                  </div>
                )}

                {/* Explanation */}
                {aiSuggestion.explanation && (
                  <div className="p-4 border-b border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Info size={14} className="text-indigo-500" />
                      <h4 className="text-xs font-bold text-slate-700">Explanation</h4>
                    </div>
                    <div className="text-sm text-slate-600">
                      {aiSuggestion.explanation}
                    </div>
                  </div>
                )}

                {/* Examples */}
                {aiSuggestion.examples && aiSuggestion.examples.length > 0 && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Quote size={14} className="text-purple-500" />
                      <h4 className="text-xs font-bold text-slate-700">Examples</h4>
                    </div>
                    <div className="space-y-2">
                      {aiSuggestion.examples.slice(0, 3).map((example: string, idx: number) => (
                        <div key={idx} className="text-sm text-slate-600 bg-slate-50 p-2 rounded italic">
                          {example}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


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
        
        {/* Dictionary Content Display (Local Dictionary + AI Analysis) - PROMINENT WIKTIONARY SECTION */}
        {(wiktionaryData || isLoadingWiktionary || aiSuggestion || isAiLoading || aiError) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* PROMINENT WIKTIONARY SECTION */}
            {processedWiktionaryData && processedWiktionaryData.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`text-[10px] font-black ${theme.accentText} uppercase tracking-[0.2em] flex items-center gap-2`}>
                    <BookOpen size={12} /> Dictionary Results
                  </label>
                  <button 
                    onClick={() => queryWiktionary(word, language).then(r => { if(r.success) setWiktionaryData(r.entries); })}
                    className={`text-[10px] font-bold ${theme.mutedText} hover:${theme.accentText} uppercase tracking-widest flex items-center gap-1`}
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>
                
                {/* Filter Controls */}
                {availablePosFilters.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter size={12} className={theme.mutedText} />
                    <button
                      onClick={() => setPosFilter('all')}
                      className={`px-2 py-1 text-[10px] rounded-lg transition-colors ${posFilter === 'all' ? theme.accentBg + ' text-white' : theme.mutedBg + ' ' + theme.mutedText}`}
                    >
                      All
                    </button>
                    {availablePosFilters.map(pos => (
                      <button
                        key={pos}
                        onClick={() => setPosFilter(pos)}
                        className={`px-2 py-1 text-[10px] rounded-lg capitalize transition-colors ${posFilter === pos ? theme.accentBg + ' text-white' : theme.mutedBg + ' ' + theme.mutedText}`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Wiktionary Entries */}
                <div className={`${theme.cardBg} rounded-3xl overflow-hidden border ${theme.border} shadow-sm`}>
                  {processedWiktionaryData.slice(0, 5).map((entry, idx) => (
                    <div key={`entry-${idx}`} className={`p-4 ${idx > 0 ? `border-t ${theme.border}` : ''}`}>
                      {/* Entry Header: Word, POS, IPA, Root */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-lg font-bold ${theme.text}`}>
                            {entry.word}
                          </span>
                          {entry.entryType === 'root' && (
                            <span className="text-[8px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase font-bold flex items-center gap-1">
                              <Puzzle size={10} /> Root
                            </span>
                          )}
                          {entry.entryType === 'variant' && (
                            <span className="text-[8px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase font-bold">
                              Variant
                            </span>
                          )}
                          {entry.isInflection && (
                            <span className="text-[8px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full uppercase font-bold flex items-center gap-1">
                              <ArrowRight size={10} /> Inflection
                            </span>
                          )}
                        </div>
                        {entry.pronunciation && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                            <Volume2 size={12} />
                            {entry.pronunciation.replace(/^\[|\]$/g, '')}
                          </div>
                        )}
                      </div>
                      
                      {/* Part of Speech */}
                      {entry.partOfSpeech ? (
                        <div className="mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.accentText} bg-indigo-50 px-2 py-0.5 rounded`}>
                            {entry.partOfSpeech}
                          </span>
                        </div>
                      ) : null}
                      
                      {/* Root Word */}
                      {(entry.rootWord || entry.rootEntry) ? (
                        <div className="flex items-center gap-2 mb-2 text-xs">
                          <Puzzle size={12} className="text-amber-500" />
                          <span className={theme.mutedText}>Root:</span>
                          <span className={`font-bold ${theme.text}`}>
                            {entry.rootWord || entry.rootEntry?.word}
                          </span>
                        </div>
                      ) : null}
                      
                      {/* Etymology */}
                      {entry.etymology ? (
                        <div className={`mb-2 p-2 rounded-lg ${theme.mutedBg} text-xs`}>
                          <div className="flex items-center gap-1 mb-1">
                            <Layers size={12} className="text-purple-500" />
                            <span className="font-bold text-purple-600">Etymology</span>
                          </div>
                          <p className={theme.mutedText}>{entry.etymology}</p>
                        </div>
                      ) : null}
                      
                      {/* Definitions */}
                      {entry.definitions && entry.definitions.length > 0 ? (
                        <div className="space-y-1">
                          {entry.definitions.slice(0, 4).filter(def => def && def.trim && def.trim()).map((def, defIdx) => (
                            <div key={`def-${defIdx}`} className={`text-sm leading-relaxed ${theme.text}`}>
                              <span className={`font-bold ${theme.accentText} mr-2`}>{defIdx + 1}.</span>
                              {def}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {/* END Definitions - no content below */}
                      
                      {/* Examples */}
                      {entry.examples && entry.examples.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1 mb-2">
                            <QuoteIcon size={12} className="text-blue-400" />
                            <span className="text-[10px] font-bold text-blue-500 uppercase">Examples</span>
                          </div>
                          {entry.examples.slice(0, 2).map((ex, exIdx) => (
                            <div key={exIdx} className={`text-xs italic pl-3 border-l-2 border-blue-200 ${theme.mutedText} mb-1`}>
                              {ex}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Synonyms/Antonyms */}
                      {(entry.synonyms?.length || entry.antonyms?.length) && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4">
                          {entry.synonyms && entry.synonyms.length > 0 && (
                            <div className="flex-1">
                              <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Synonyms</div>
                              <div className="flex flex-wrap gap-1">
                                {entry.synonyms.slice(0, 4).map((syn, i) => (
                                  <span key={i} className={`text-xs px-2 py-0.5 rounded ${theme.mutedBg} ${theme.mutedText}`}>{syn}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {entry.antonyms && entry.antonyms.length > 0 && (
                            <div className="flex-1">
                              <div className="text-[10px] font-bold text-rose-500 uppercase mb-1">Antonyms</div>
                              <div className="flex flex-wrap gap-1">
                                {entry.antonyms.slice(0, 4).map((ant, i) => (
                                  <span key={i} className={`text-xs px-2 py-0.5 rounded ${theme.mutedBg} ${theme.mutedText}`}>{ant}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Entry Count - hidden for now, can enable if needed */}
                {false && processedWiktionaryData.length > 5 && (
                  <div className="text-center text-xs text-slate-400">
                    + {processedWiktionaryData.length - 5} more entries
                  </div>
                )}
              </div>
            )}
               
               {/* AI Analysis Section - After Dictionary */}
               <div className={`${theme.cardBg} rounded-3xl overflow-hidden border ${theme.border} shadow-sm`}>
                 {aiError ? (
                     <div className="p-6 space-y-4">
                         <div className="flex items-start gap-3">
                             <div className={`shrink-0 mt-1 p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30`}>
                                 <Info size={16} />
                             </div>
                             <div className="flex-1">
                                 <h4 className="text-[9px] font-black text-rose-400 uppercase tracking-[0.2em] mb-1.5">API Error</h4>
                                  <p className={`text-sm leading-relaxed font-medium ${theme.text}`}>
                                     {String(aiError)}
                                  </p>
                                 <button 
                                   onClick={() => handleAiSuggestLocal(word, sentence)}
                                   className={`mt-3 text-[10px] font-bold ${theme.mutedText} hover:text-indigo-500 uppercase tracking-widest flex items-center gap-1`}
                                 >
                                   <Sparkles size={12} /> Retry Analysis
                                 </button>
                             </div>
                         </div>
                     </div>
                 ) : isAiLoading ? (
                      <div className={`p-8 flex flex-col items-center justify-center gap-3 ${theme.mutedText}`}>
                         <Loader2 size={24} className={`animate-spin ${theme.accentText}`} />
                         <span className="text-[10px] uppercase tracking-widest">Analyzing...</span>
                     </div>
                  ) : (
                       <div className="p-6 space-y-5">
                           {/* Translation from AI */}
                           {aiSuggestion?.translation && (
                            <div className="flex items-start gap-4">
                              <div className={`shrink-0 mt-1 p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`}>
                                <Book size={16} />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1.5">AI Translation</h4>
                                <div className={`text-sm leading-relaxed font-medium ${theme.text}`}>
                                  {aiSuggestion.translation}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Root Word from AI */}
                          {aiSuggestion?.rootWord && (
                            <div className="flex items-start gap-4">
                              <div className={`shrink-0 mt-1 p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30`}>
                                <Puzzle size={16} />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] mb-1.5">Root / Etymology</h4>
                                <div className={`text-sm leading-relaxed font-medium ${theme.text}`}>
                                  {aiSuggestion.rootWord}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Explanation */}
                          {aiSuggestion?.explanation && (
                            <div className={`flex items-start gap-4 pt-5 border-t ${theme.border}`}>
                              <div className={`shrink-0 mt-1 p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30`}>
                                <BookOpen size={16} />
                              </div>
                              <div>
                                <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1.5">Explanation</h4>
                                <div className={`text-sm leading-relaxed font-medium ${theme.text}`}>
                                  {aiSuggestion.explanation}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Examples */}
                          {aiSuggestion?.examples && aiSuggestion.examples.length > 0 && (
                            <div className={`space-y-3 pt-5 border-t ${theme.border}`}>
                             <h4 className={`text-[9px] font-black ${theme.mutedText} uppercase tracking-[0.2em] flex items-center gap-2`}>
                                <Quote size={12} /> Usage Examples
                             </h4>
                            <div className="space-y-2">
                                {aiSuggestion.examples.map((ex, i) => (
                                 <div key={i} className={`p-3.5 rounded-2xl border text-xs leading-relaxed font-medium italic ${theme.mutedBg} ${theme.text}`}>
                                    {ex}
                                 </div>
                                ))}
                            </div>
                            </div>
                        )}
                        

                    </div>
                )}
            </div>
          </div>
        )}


          
        


        <div className="space-y-3">
          <label className={`text-[10px] font-black ${theme.mutedText} uppercase tracking-[0.2em]`}>Learning Level</label>
          <div className={`flex justify-between items-center p-2 rounded-2xl border gap-1 ${theme.mutedBg} ${theme.border}`}>
            {[1, 2, 3, 4, 5, 99].map(s => (
               <button
                key={s}
                type="button"
                onClick={() => {
                  const newStatus = s as TermStatus;
                  let newReps = 0;
                  if (newStatus === TermStatus.WellKnown) {
                    newReps = 4;
                  } else if (newStatus >= TermStatus.Learning1 && newStatus <= TermStatus.Learning4) {
                    newReps = newStatus - 1;
                  } else if (newStatus === TermStatus.Ignored) {
                    newReps = 0;
                  }
                  setFormData(prev => ({ ...prev, status: newStatus, reps: newReps }));
                }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all
                  ${formData.status === s 
                    ? `${theme.cardBg} ${theme.accentText} shadow-sm ring-1 ${theme.border}` 
                    : `${theme.mutedText} hover:${theme.text}`}
                `}
              >
                {s === 99 ? 'IGN' : s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={`text-[10px] font-black ${theme.mutedText} uppercase tracking-[0.2em]`}>Parent / Root Form</label>
          </div>
          <div className="relative">
            <Hash size={14} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.mutedText}`} />
            <input 
              type="text"
              placeholder="Dictionary form (e.g. bequemen)"
              value={formData.text}
              onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
              className={`w-full border rounded-2xl pl-10 pr-5 py-3.5 text-sm focus:outline-none font-bold ${theme.inputBg} ${theme.border} ${theme.text}`}
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

      <div className={`p-6 ${theme.cardBg} border-t ${theme.border} z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] space-y-3`}>
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
