
// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, Link as LinkIcon, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Text, Term, TermStatus, Language, AIConfig, GeminiSuggestion, UserSettings } from '../types';
import TermSidebar from './TermSidebar';
import { getLargeTextContent } from '../services/fileStorage';
import { analyzeTerm } from '../services/llmService';
import { getDocument, getDocumentChapters, loadChapter, getReadingProgress, saveReadingProgress } from '../services/documentStorage';
import { StoredChapter } from '../services/storageService';

interface SelectionState {
  indices: number[];
  sentence: string;
}

interface ReaderProps {
  text: Text;
  terms: Record<string, Term>;
  onUpdateTerm: (term: Term, linkedChild?: Term) => void;
  onDeleteTerm: (key: string) => void;
  language: Language;
  aiConfig: AIConfig;
  settings: UserSettings;
  onClose: () => void;
}

const Reader: React.FC<ReaderProps> = ({ text, terms, onUpdateTerm, onDeleteTerm, language, aiConfig, settings, onClose }) => {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [fullContent, setFullContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [aiSuggestion, setAiSuggestion] = useState<GeminiSuggestion | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // 新存储系统相关状态
  const [chapters, setChapters] = useState<StoredChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [currentChapterContent, setCurrentChapterContent] = useState<string>('');
  const [isUsingNewStorage, setIsUsingNewStorage] = useState<boolean>(false);
  // 分页状态
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  // 段落结构
  const [paragraphs, setParagraphs] = useState<string[][]>([]);
  const [allWords, setAllWords] = useState<string[]>([]);
  // 布局调整
  const [mainContentWidth, setMainContentWidth] = useState<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
  const isResizingRef = useRef<boolean>(false);
  const WORDS_PER_PAGE = 1000; // 每页1000词
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      
      // 首先尝试从新存储系统加载
      try {
        // 检查文档是否存在于新系统中
        const doc = await getDocument(text.id);
        if (doc) {
          console.debug('[Reader] Document found in new storage system:', doc.title);
          
          // 加载章节列表
          const docChapters = await getDocumentChapters(text.id);
          console.debug(`[Reader] Loaded ${docChapters.length} chapters`);
          setChapters(docChapters);
          setIsUsingNewStorage(true);
          
          // 加载阅读进度
          const progress = await getReadingProgress(text.id);
          if (progress) {
            console.debug('[Reader] Found reading progress:', progress);
            setCurrentChapterIndex(progress.chapterIndex);
            // 稍后恢复滚动位置
          } else {
            setCurrentChapterIndex(0);
          }
          
          // 加载当前章节内容
          if (docChapters.length > 0) {
            const targetChapterIndex = progress ? progress.chapterIndex : 0;
            const chapter = docChapters[targetChapterIndex];
            if (chapter) {
              setCurrentChapterContent(chapter.content);
              setFullContent(chapter.content); // 用于向后兼容的令牌系统
            } else {
              // 回退到旧系统
              await loadFromLegacySystem();
            }
          } else {
            // 没有章节，回退到旧系统
            await loadFromLegacySystem();
          }
        } else {
          // 文档不存在于新系统中，使用旧系统
          await loadFromLegacySystem();
        }
      } catch (error) {
        console.error('[Reader] Error loading from new storage system:', error);
        // 出错时回退到旧系统
        await loadFromLegacySystem();
      } finally {
        setIsLoading(false);
      }
    };
    
    const loadFromLegacySystem = async () => {
      console.debug('[Reader] Falling back to legacy storage system');
      const content = await getLargeTextContent(text.id);
      setFullContent(content || '');
      setIsUsingNewStorage(false);
    };
    
    load();
  }, [text.id]);

  // 旧系统滚动位置恢复
  useEffect(() => {
    if (!isLoading && !isUsingNewStorage && scrollRef.current && text.progress > 0) {
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = text.progress * (scrollRef.current.scrollHeight - scrollRef.current.clientHeight);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, text.id, isUsingNewStorage]);

  // 新系统初始进度恢复
  useEffect(() => {
    if (!isLoading && isUsingNewStorage && scrollRef.current && chapters.length > 0) {
      const restoreProgress = async () => {
        try {
          const progress = await getReadingProgress(text.id);
          if (progress && progress.chapterIndex === currentChapterIndex) {
            try {
              const position = JSON.parse(progress.position);
              if (position.scrollTop && scrollRef.current) {
                setTimeout(() => {
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = position.scrollTop;
                  }
                }, 100);
              }
            } catch (e) {
              console.debug('[Reader] Could not parse saved position:', e);
            }
          }
        } catch (error) {
          console.debug('[Reader] Error loading progress for restoration:', error);
        }
      };
      
      restoreProgress();
    }
  }, [isLoading, isUsingNewStorage, chapters, text.id, currentChapterIndex]);

  // 从HTML中提取纯文本
  /**
   * 将HTML内容解析为段落数组，保留原始结构
   */
  const parseHtmlToParagraphs = useCallback((html: string): { paragraphs: string[][]; flatWords: string[] } => {
    if (!html) {
      return { paragraphs: [], flatWords: [] };
    }
    
    // 检查是否是HTML（包含标签）
    if (!html.includes('<')) {
      // 如果是纯文本，按换行分割段落
      const paragraphs = html.split(/\n+/).map(para => 
        para.trim().split(/\s+/).filter(word => word.length > 0)
      ).filter(para => para.length > 0);
      
      const flatWords = paragraphs.flat();
      return { paragraphs, flatWords };
    }
    
    try {
      // 创建临时元素
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // 移除不需要的脚本、样式等
      const scripts = tempDiv.querySelectorAll('script, style, noscript, .pg-boilerplate, .pgheader');
      scripts.forEach(script => script.remove());
      
      const paragraphs: string[][] = [];
      
      // 使用 TreeWalker 遍历文本节点，识别段落边界
      const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            // 跳过脚本、样式等元素
            if (node.nodeType === Node.ELEMENT_NODE) {
              const elem = node as Element;
              if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(elem.tagName)) {
                return NodeFilter.FILTER_REJECT;
              }
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        } as any
      );
      
      let currentParagraph: string[] = [];
      let node: Node | null;
      
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const tagName = element.tagName.toLowerCase();
          
          // 检查是否是段落边界元素
          const isParagraphBoundary = [
            'p', 'div', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'li', 'blockquote', 'pre', 'table', 'tr'
          ].includes(tagName);
          
          // 如果是块级元素且当前段落有内容，结束当前段落
          if (isParagraphBoundary && currentParagraph.length > 0) {
            paragraphs.push([...currentParagraph]);
            currentParagraph = [];
          }
          
          // 对于br元素，立即结束当前段落
          if (tagName === 'br' && currentParagraph.length > 0) {
            paragraphs.push([...currentParagraph]);
            currentParagraph = [];
          }
          
          // 继续遍历子节点
          continue;
        }
        
        // 文本节点
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (text.trim()) {
            // 分割文本为单词，处理单词连接问题
            // 先将标点符号与单词分离
            const words = text
              .replace(/([a-z])([A-Z])/g, '$1 $2')  // 修复单词连接
              .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // 修复大写单词连接
              // 将标点符号与单词分离（保留标点作为独立token）
              .replace(/([a-zA-ZÀ-ÿ\u4e00-\u9fa5]+)([,.!?;:"'«»¿¡()[\]{}])/g, '$1 $2')
              .replace(/([,.!?;:"'«»¿¡()[\]{}])([a-zA-ZÀ-ÿ\u4e00-\u9fa5]+)/g, '$1 $2')
              .split(/\s+/)
              .filter(word => word.length > 0);
            
            currentParagraph.push(...words);
          }
        }
      }
      
      // 添加最后一个段落（如果有）
      if (currentParagraph.length > 0) {
        paragraphs.push([...currentParagraph]);
      }
      
      // 过滤空段落
      const filteredParagraphs = paragraphs.filter(para => para.length > 0);
      const flatWords = filteredParagraphs.flat();
      
      console.debug('[Reader] Parsed HTML to paragraphs:', {
        paragraphCount: filteredParagraphs.length,
        totalWords: flatWords.length,
        sampleParagraphs: filteredParagraphs.slice(0, 3).map(p => p.slice(0, 5).join(' ') + '...')
      });
      
      return { paragraphs: filteredParagraphs, flatWords };
      
    } catch (error) {
      console.warn('[Reader] Failed to parse HTML to paragraphs:', error);
      // 回退：简单提取文本
      const plainText = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const paragraphs = plainText
        .split(/\n+/)
        .map(para => para.trim().split(/\s+/).filter(word => word.length > 0))
        .filter(para => para.length > 0);
      
      const flatWords = paragraphs.flat();
      return { paragraphs, flatWords };
    }
  }, []);



  // 计算页面：将词分组成页面
  const pages = useMemo(() => {
    if (!allWords.length) return [];
    
    const pageCount = Math.ceil(allWords.length / WORDS_PER_PAGE);
    const pageArray: string[][] = [];
    
    for (let i = 0; i < pageCount; i++) {
      const start = i * WORDS_PER_PAGE;
      const end = Math.min(start + WORDS_PER_PAGE, allWords.length);
      pageArray.push(allWords.slice(start, end));
    }
    
    console.debug('[Reader] Pages generated:', { 
      pageCount,
      totalWords: allWords.length,
      wordsPerPage: WORDS_PER_PAGE
    });
    
    return pageArray;
  }, [allWords]);

  // 当前页面的词
  const currentPageWords = useMemo(() => {
    if (!pages.length || currentPageIndex >= pages.length) return [];
    return pages[currentPageIndex];
  }, [pages, currentPageIndex]);

  // 当章节或内容改变时解析段落并重置页面索引
  useEffect(() => {
    if (fullContent) {
      const { paragraphs: parsedParagraphs, flatWords } = parseHtmlToParagraphs(fullContent);
      setParagraphs(parsedParagraphs);
      setAllWords(flatWords);
      console.debug('[Reader] Parsed content:', {
        paragraphCount: parsedParagraphs.length,
        wordCount: flatWords.length,
        sample: parsedParagraphs.slice(0, 2).map(p => p.slice(0, 3).join(' ') + '...')
      });
    } else {
      setParagraphs([]);
      setAllWords([]);
    }
    
    setCurrentPageIndex(0);
    setIsLoadingMore(false);
    isScrollingRef.current = false;
  }, [currentChapterIndex, fullContent, parseHtmlToParagraphs]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // 保存阅读进度（节流）- 仅适用于新存储系统
    if (isUsingNewStorage && scrollHeight > clientHeight) {
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
      }
      saveProgressTimeoutRef.current = setTimeout(() => {
        const progress = scrollTop / (scrollHeight - clientHeight);
        saveReadingProgress(text.id, currentChapterIndex, JSON.stringify({ scrollTop, progress }));
        saveProgressTimeoutRef.current = null;
      }, 1000); // 1秒延迟
    }
    
    // 分页检测：当滚动到接近底部时显示翻页提示
    // （不自动翻页，用户必须手动点击按钮）
    if (isScrollingRef.current || isLoadingMore || !pages.length) return;
    
    const scrollBottom = scrollTop + clientHeight;
    const distanceFromBottom = scrollHeight - scrollBottom;
    const showPromptThreshold = 100; // 距离底部100px时显示提示
    
    // 检查是否有更多页面
    const hasMorePages = currentPageIndex < pages.length - 1;
    
    // 我们可以在这里添加一个浮动按钮提示，但暂时不自动翻页
    // 如果需要，可以在此处触发显示"下一页"按钮
  };

  const handleChapterChange = async (newIndex: number) => {
    if (newIndex === currentChapterIndex) return;
    
    setIsLoading(true);
    try {
      // 保存当前章节的进度
      if (scrollRef.current && isUsingNewStorage) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        if (scrollHeight > clientHeight) {
          const progress = scrollTop / (scrollHeight - clientHeight);
          await saveReadingProgress(text.id, currentChapterIndex, JSON.stringify({ scrollTop, progress }));
        }
      }
      
      // 加载新章节
      const chapter = chapters[newIndex];
      if (chapter) {
        setCurrentChapterIndex(newIndex);
        setCurrentChapterContent(chapter.content);
        setFullContent(chapter.content);
        
        // 重置滚动位置到顶部
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
        
        // 加载新章节的保存进度
        const progress = await getReadingProgress(text.id);
        if (progress && progress.chapterIndex === newIndex) {
          // 恢复保存的滚动位置
          try {
            const position = JSON.parse(progress.position);
            if (position.scrollTop && scrollRef.current) {
              setTimeout(() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = position.scrollTop;
                }
              }, 100);
            }
          } catch (e) {
            console.debug('[Reader] Could not parse saved position:', e);
          }
        }
      }
    } catch (error) {
      console.error('[Reader] Error changing chapter:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const findSentence = (wordIndex: number) => {
    // 由于我们只有词数组，没有标点，我们返回包含该词的一个句子段
    // 简化实现：返回周围的一些词
    const start = Math.max(0, wordIndex - 10);
    const end = Math.min(allWords.length - 1, wordIndex + 10);
    return allWords.slice(start, end + 1).join(' ').trim() + '...';
  };

  const handleWordClick = (wordIndex: number) => {
    if (isLinkingMode && selection) {
      // Add to existing selection if not already present
      if (!selection.indices.includes(wordIndex)) {
        setSelection({
          ...selection,
          indices: [...selection.indices, wordIndex].sort((a, b) => a - b)
        });
      }
      // 保持 linking 模式，让用户可以继续选择更多词
    } else {
      // Reset AI state when selecting a new word
      console.debug('[Reader] handleWordClick: Resetting AI state for new word selection');
      setAiSuggestion(null);
      setAiError(null);
      setIsAiLoading(false);
      
      // Clean up any pending requests
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      setSelection({
        indices: [wordIndex],
        sentence: findSentence(wordIndex)
      });
      setIsLinkingMode(false);
    }
  };

  const getTermStyles = (token: string, idx: number) => {
    const tokenLower = token.toLowerCase();
    // Find term by languageId and text match
    const termKey = Object.keys(terms).find(key => {
      const term = terms[key];
      return term && term.languageId === language.id && term.text.toLowerCase() === tokenLower;
    });
    const term = termKey ? terms[termKey] : null;
    const isSelected = selection?.indices.includes(idx);
    
    let baseStyles = "cursor-pointer transition-all duration-200 px-0.5 rounded-md mx-[1px] ";
    
    if (isSelected) {
      baseStyles += "ring-2 ring-indigo-500 ring-offset-2 z-10 bg-indigo-100/50 scale-105 shadow-sm ";
    }

    if (!term) return baseStyles + "hover:bg-indigo-50 text-slate-800";
    
    // Resolve status from Parent if available (Parent status takes precedence)
    let status = term.status;
    if (term.parentId && terms[term.parentId]) {
        status = terms[term.parentId].status;
    }
    
    switch (status) {
      case TermStatus.Learning1: return baseStyles + "bg-rose-100 text-rose-900 border-b-2 border-rose-300";
      case TermStatus.Learning2: return baseStyles + "bg-orange-100 text-orange-900 border-b-2 border-orange-300";
      case TermStatus.Learning3: return baseStyles + "bg-amber-100 text-amber-900 border-b-2 border-amber-300";
      case TermStatus.Learning4: return baseStyles + "bg-lime-100 text-lime-900 border-b-2 border-lime-300";
      case TermStatus.WellKnown: return baseStyles + "text-slate-900 font-medium hover:bg-slate-100";
      case TermStatus.Ignored: return baseStyles + "text-slate-300 line-through opacity-60";
      default: return baseStyles + "hover:bg-indigo-50";
    }
  };

  const isWord = (token: string) => /\p{L}+/u.test(token);

  const selectedText = useMemo(() => {
    if (!selection) return "";
    const text = selection.indices.map(i => allWords[i]).join(" ");
    // 过滤掉标点符号，只保留字母和数字
    return text.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
  }, [selection, allWords]);

  const handleAiSuggest = useCallback(async (targetWord: string, targetSentence: string) => {
    console.debug('[Reader] handleAiSuggest called:', {
      targetWord,
      targetSentenceLength: targetSentence.length,
      language: language?.name,
      provider: aiConfig?.provider || 'unknown'
    });
    
    if (!language || !language.name) {
      console.error('[Reader] Language not configured:', language);
      setAiError('Language not configured');
      return;
    }
    
    // Clean up previous request if any
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Set timeout to abort request after 30 seconds
    timeoutRef.current = setTimeout(() => {
      console.debug('[Reader] Request timeout reached, aborting');
      abortController.abort(new DOMException('Request timeout', 'TimeoutError'));
    }, 30000);
    
    setIsAiLoading(true);
    setAiError(null);
    
    try {
      console.debug('[Reader] Calling analyzeTerm...');
      if (!aiConfig) {
        console.error('[Reader] aiConfig is not defined');
        setAiError('AI configuration not available');
        return;
      }
      const suggestion = await analyzeTerm(targetWord, targetSentence, language.name, aiConfig, { signal: abortController.signal });
      console.debug('[Reader] analyzeTerm completed, suggestion:', {
        hasTranslation: !!suggestion.translation,
        hasGrammar: !!suggestion.grammar,
        hasRootWord: !!suggestion.rootWord,
        examplesCount: suggestion.examples?.length || 0
      });
      
      setAiSuggestion(suggestion);
    } catch (error) {
      if (error instanceof DOMException) {
        console.debug('[Reader] Request aborted:', error.name, error.message);
        if (error.name === 'TimeoutError') {
          setAiError('Request timeout. Please check your connection and try again.');
        }
      } else {
        console.error("[Reader] AI Suggestion Error:", error);
        let errorMessage = 'Failed to analyze term';
        if (error instanceof Error) {
          errorMessage = error.message;
          
          if (errorMessage.includes('API key') || errorMessage.includes('key is required')) {
            errorMessage = 'AI API key not configured. Please go to Settings > AI Configuration and add your API key.';
          } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
          } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            errorMessage = 'AI service not found. Please check your API key and settings.';
          } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            errorMessage = 'Invalid API key. Please check your AI configuration in Settings.';
          } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          }
        } else if (typeof error === 'object' && error !== null) {
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
          } else if ('error' in error && typeof error.error === 'string') {
            errorMessage = error.error;
          } else {
            errorMessage = JSON.stringify(error);
          }
        } else {
          errorMessage = String(error);
        }
        setAiError(errorMessage);
      }
    } finally {
      // Clean up timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setIsAiLoading(false);
      
      // Clear abort controller if this request completed
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [language, aiConfig]);

  // 键盘导航支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在输入框等元素中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1);
            // 滚动到顶部
            if (scrollRef.current) {
              scrollRef.current.scrollTop = 0;
            }
          } else if (currentChapterIndex > 0) {
            // 如果已经是第一页，跳转到上一章的最后一页
            handleChapterChange(currentChapterIndex - 1);
          }
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          if (currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(currentPageIndex + 1);
            // 滚动到顶部
            if (scrollRef.current) {
              scrollRef.current.scrollTop = 0;
            }
          } else if (currentChapterIndex < chapters.length - 1) {
            // 如果已经是最后一页，跳转到下一章的第一页
            handleChapterChange(currentChapterIndex + 1);
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (currentChapterIndex > 0) {
            handleChapterChange(currentChapterIndex - 1);
          }
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (currentChapterIndex < chapters.length - 1) {
            handleChapterChange(currentChapterIndex + 1);
          }
          break;
          
        case 'Home':
          e.preventDefault();
          setCurrentPageIndex(0);
          if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
          }
          break;
          
        case 'End':
          e.preventDefault();
          setCurrentPageIndex(pages.length - 1);
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPageIndex, pages.length, currentChapterIndex, chapters.length, handleChapterChange]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      console.debug('[Reader] Component unmounting, aborting pending requests');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
        saveProgressTimeoutRef.current = null;
      }
    };
  }, []);

  // Reset AI state when selection changes
  useEffect(() => {
    if (selection) {
      setAiSuggestion(null);
      setAiError(null);
      setIsAiLoading(false);
    }
  }, [selection]);

  // 侧边栏拖拽调整宽度处理函数 - 同时调整阅读器和侧边栏宽度
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    
    const startX = e.clientX;
    const defaultSidebarWidth = 400;
    const defaultMainWidth = typeof window !== 'undefined' ? window.innerWidth - defaultSidebarWidth : 800;
    const startMainWidth = mainContentWidth !== null ? mainContentWidth : defaultMainWidth;
    const startSidebarWidth = sidebarWidth !== null ? sidebarWidth : defaultSidebarWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      
      // 计算鼠标移动距离
      const deltaX = e.clientX - startX;
      
      // 根据移动方向调整宽度：向右移动减少侧边栏宽度，增加阅读器宽度
      let newMainWidth = startMainWidth + deltaX;
      let newSidebarWidth = startSidebarWidth - deltaX;
      
      // 约束最小宽度：阅读器最小600px，侧边栏最小250px
      const minMainWidth = 600;
      const minSidebarWidth = 250;
      const maxTotalWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
      
      // 确保两个区域都不小于最小宽度
      if (newMainWidth < minMainWidth) {
        newMainWidth = minMainWidth;
        newSidebarWidth = maxTotalWidth - minMainWidth;
      } else if (newSidebarWidth < minSidebarWidth) {
        newSidebarWidth = minSidebarWidth;
        newMainWidth = maxTotalWidth - minSidebarWidth;
      }
      
      // 确保总宽度不超过最大宽度
      const totalWidth = newMainWidth + newSidebarWidth;
      if (totalWidth > maxTotalWidth) {
        const scale = maxTotalWidth / totalWidth;
        newMainWidth = Math.floor(newMainWidth * scale);
        newSidebarWidth = Math.floor(newSidebarWidth * scale);
      }
      
      setMainContentWidth(newMainWidth);
      setSidebarWidth(newSidebarWidth);
    };
    
    const stopResizing = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [mainContentWidth, sidebarWidth]);

  // 清理拖拽事件监听器
  useEffect(() => {
    return () => {
      if (isResizingRef.current) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Processing Manuscript...</p>
        </div>
      </div>
    );
  }

  const defaultSidebarWidth = 400;
  const defaultMainWidth = typeof window !== 'undefined' ? window.innerWidth - defaultSidebarWidth : 800;
  const contentWidth = mainContentWidth !== null ? mainContentWidth : defaultMainWidth;
  const sidebarContentWidth = sidebarWidth !== null ? sidebarWidth : defaultSidebarWidth;

  return (
     <div className={`flex-1 flex h-full overflow-hidden ${
       settings.theme === 'dark' ? 'bg-slate-900' :
       settings.theme === 'night' ? 'bg-indigo-950' :
       settings.theme === 'contrast' ? 'bg-black' :
       settings.theme === 'sepia' ? 'bg-amber-50' :
       settings.theme === 'paper' ? 'bg-stone-50' :
       'bg-white'
     }`}>
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto p-8 md:p-12 lg:p-20 relative scroll-smooth"
        style={{ width: `${contentWidth}px` }}
      >
        <div className="max-w-3xl mx-auto">
            <header className={`mb-12 border-b pb-8 ${
              settings.theme === 'dark' ? 'border-slate-700' :
              settings.theme === 'night' ? 'border-indigo-800' :
              settings.theme === 'contrast' ? 'border-white' :
              settings.theme === 'sepia' ? 'border-amber-200' :
              settings.theme === 'paper' ? 'border-stone-200' :
              'border-slate-100'
            }`}>
              <h1 className={`text-4xl font-black serif-text tracking-tight leading-tight ${
                settings.theme === 'dark' ? 'text-slate-100' :
                settings.theme === 'night' ? 'text-indigo-100' :
                settings.theme === 'contrast' ? 'text-white' :
                settings.theme === 'sepia' ? 'text-amber-900' :
                settings.theme === 'paper' ? 'text-stone-800' :
                'text-slate-900'
              }`}>{text.title}</h1>
             
             {/* 章节导航 */}
             {isUsingNewStorage && chapters.length > 1 && (
               <div className="mt-6 flex items-center gap-3 flex-wrap">
                 <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                   <BookOpen size={16} />
                   <span>Chapters:</span>
                 </div>
                 <div className="flex items-center gap-1 flex-wrap">
                   <button
                     onClick={() => handleChapterChange(currentChapterIndex - 1)}
                     disabled={currentChapterIndex === 0}
                     className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100"
                   >
                     <ChevronLeft size={18} />
                   </button>
                   
                      <select
                        value={currentChapterIndex}
                        onChange={(e) => handleChapterChange(Number(e.target.value))}
                        className={`border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 min-w-[200px] ${
                          settings.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' :
                          settings.theme === 'night' ? 'bg-indigo-900 border-indigo-800 text-indigo-100' :
                          settings.theme === 'contrast' ? 'bg-black border-white text-white' :
                          settings.theme === 'sepia' ? 'bg-amber-100 border-amber-200 text-amber-900' :
                          settings.theme === 'paper' ? 'bg-stone-100 border-stone-200 text-stone-800' :
                          'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                     {chapters.map((chapter, idx) => (
                       <option key={chapter.id} value={idx}>
                         {chapter.title || `Chapter ${idx + 1}`}
                       </option>
                     ))}
                   </select>
                   
                   <button
                     onClick={() => handleChapterChange(currentChapterIndex + 1)}
                     disabled={currentChapterIndex >= chapters.length - 1}
                     className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-slate-100"
                   >
                     <ChevronRight size={18} />
                   </button>
                   
                   <span className="text-slate-400 text-sm font-medium ml-2">
                     {currentChapterIndex + 1} / {chapters.length}
                   </span>
                 </div>
               </div>
             )}
             
             <div className="flex items-center gap-3 mt-5">
               <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{language.name}</span>
               <span className="text-slate-300">/</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Page {currentPageIndex + 1}/{pages.length} • {allWords.length} words
                  </span>
               <span className="text-slate-300">/</span>
               <span className="text-indigo-500 text-[10px] font-bold uppercase tracking-widest">
                 {isUsingNewStorage 
                   ? `Chapter ${currentChapterIndex + 1}/${chapters.length}` 
                   : `${Math.round((text.progress || 0) * 100)}% progress`}
               </span>
             </div>
           </header>

              <div 
                className="selection:bg-indigo-100 selection:text-indigo-900 space-y-6"
                style={{
                  fontSize: `${settings.fontSize}px`,
                  lineHeight: settings.lineHeight,
                  fontFamily: settings.fontFamily === 'system-ui' ? 'inherit' : settings.fontFamily,
                  fontWeight: settings.fontWeight,
                  color: settings.theme === 'dark' ? '#f1f5f9' :
                         settings.theme === 'night' ? '#e0e7ff' :
                         settings.theme === 'contrast' ? '#ffffff' :
                         settings.theme === 'sepia' ? '#78350f' :
                         settings.theme === 'paper' ? '#292524' :
                         '#1e293b' // light, auto, default
                }}
              >
               {/* 按段落渲染内容 */}
               {(() => {
                 // 计算当前页面的全局词索引范围
                 const pageStartIndex = currentPageIndex * WORDS_PER_PAGE;
                 const pageEndIndex = Math.min(pageStartIndex + WORDS_PER_PAGE, allWords.length);
                 
                 // 累积词索引计数器
                 let wordAccumulator = 0;
                 // 收集属于当前页面的段落
                 const visibleParagraphs: { words: string[]; startIndex: number }[] = [];
                 
                 for (const paragraph of paragraphs) {
                   const paragraphStart = wordAccumulator;
                   const paragraphEnd = wordAccumulator + paragraph.length;
                   
                   // 检查段落是否与当前页面有交集
                   if (paragraphEnd > pageStartIndex && paragraphStart < pageEndIndex) {
                     // 计算交集部分
                     const overlapStart = Math.max(0, pageStartIndex - paragraphStart);
                     const overlapEnd = Math.min(paragraph.length, pageEndIndex - paragraphStart);
                     const visibleWords = paragraph.slice(overlapStart, overlapEnd);
                     const startIndex = paragraphStart + overlapStart;
                     
                     if (visibleWords.length > 0) {
                       visibleParagraphs.push({
                         words: visibleWords,
                         startIndex
                       });
                     }
                   }
                   
                   wordAccumulator += paragraph.length;
                 }
                 
                 return visibleParagraphs.map((para, paraIdx) => (
                   <p key={paraIdx} className="mb-6 last:mb-0">
                     {para.words.map((word, wordIdx) => {
                       const globalWordIndex = para.startIndex + wordIdx;
                       const wordDetected = isWord(word);
                       if (!wordDetected) return <span key={wordIdx} className="text-slate-300 whitespace-pre-wrap">{word}</span>;
                       return (
                         <span 
                           key={wordIdx}
                           onClick={() => handleWordClick(globalWordIndex)}
                           className={getTermStyles(word, globalWordIndex)}
                         >
                           {word}{' '}
                         </span>
                       );
                     })}
                   </p>
                 ));
               })()}
               
               {/* 分页导航 */}
              {pages.length > 1 && (
                <div className="mt-12 mb-8 text-center">
                  <div className="inline-flex flex-col items-center gap-4">
                    <div className="flex items-center gap-3">
                       <button
                         onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                         disabled={currentPageIndex === 0}
                         className={`px-5 py-2.5 font-medium rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-2 ${
                           settings.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700' :
                           settings.theme === 'night' ? 'bg-indigo-900 hover:bg-indigo-800 text-indigo-100 border border-indigo-800' :
                           settings.theme === 'contrast' ? 'bg-black hover:bg-gray-900 text-white border border-white' :
                           settings.theme === 'sepia' ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200' :
                           settings.theme === 'paper' ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200' :
                           'bg-slate-100 hover:bg-slate-200 text-slate-700'
                         }`}
                       >
                        <ChevronLeft size={16} />
                        Previous Page
                      </button>
                      
                       <div className={`border rounded-xl px-5 py-2.5 ${
                         settings.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' :
                         settings.theme === 'night' ? 'bg-indigo-900 border-indigo-800 text-indigo-100' :
                         settings.theme === 'contrast' ? 'bg-black border-white text-white' :
                         settings.theme === 'sepia' ? 'bg-amber-100 border-amber-200 text-amber-900' :
                         settings.theme === 'paper' ? 'bg-stone-100 border-stone-200 text-stone-800' :
                         'bg-white border-slate-200 text-slate-700'
                       }`}>
                        <span className="text-sm font-bold text-slate-700">
                          Page {currentPageIndex + 1} of {pages.length}
                        </span>
                        <span className="text-xs text-slate-400 ml-3">
                          ({currentPageWords.length} words)
                        </span>
                      </div>
                      
                       <button
                         onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                         disabled={currentPageIndex >= pages.length - 1}
                         className={`px-5 py-2.5 font-medium rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-2 ${
                           settings.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700' :
                           settings.theme === 'night' ? 'bg-indigo-900 hover:bg-indigo-800 text-indigo-100 border border-indigo-800' :
                           settings.theme === 'contrast' ? 'bg-black hover:bg-gray-900 text-white border border-white' :
                           settings.theme === 'sepia' ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200' :
                           settings.theme === 'paper' ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200' :
                           'bg-slate-100 hover:bg-slate-200 text-slate-700'
                         }`}
                       >
                        Next Page
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    
                     <div className="text-xs text-slate-500">
                       Total: {allWords.length} words • {pages.length} pages • {WORDS_PER_PAGE} words per page
                     </div>
                    
                    {/* 快速跳转 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Go to page:</span>
                       <select
                         value={currentPageIndex}
                         onChange={(e) => setCurrentPageIndex(Number(e.target.value))}
                         className={`border rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-indigo-500 ${
                           settings.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' :
                           settings.theme === 'night' ? 'bg-indigo-900 border-indigo-800 text-indigo-100' :
                           settings.theme === 'contrast' ? 'bg-black border-white text-white' :
                           settings.theme === 'sepia' ? 'bg-amber-100 border-amber-200 text-amber-900' :
                           settings.theme === 'paper' ? 'bg-stone-100 border-stone-200 text-stone-800' :
                           'bg-slate-50 border-slate-200 text-slate-700'
                         }`}
                       >
                        {pages.map((_, idx) => (
                          <option key={idx} value={idx}>
                            Page {idx + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
           <div className="h-48" />
        </div>
       </div>

        {/* 拖拽调整宽度句柄 */}
        <div 
          className="w-2 cursor-ew-resize hover:bg-indigo-200/50 active:bg-indigo-300/70 transition-colors z-20"
          onMouseDown={startResizing}
        />

        {/* 浮动翻页控件 */}
        <div className={`fixed bottom-8 z-30 flex items-center gap-3 backdrop-blur-sm border rounded-2xl px-4 py-3 shadow-xl ${
          settings.theme === 'dark' ? 'bg-slate-800/90 border-slate-700 shadow-slate-900' :
          settings.theme === 'night' ? 'bg-indigo-900/90 border-indigo-800 shadow-indigo-950' :
          settings.theme === 'contrast' ? 'bg-black/90 border-white shadow-white/20' :
          settings.theme === 'sepia' ? 'bg-amber-100/90 border-amber-200 shadow-amber-200' :
          settings.theme === 'paper' ? 'bg-stone-100/90 border-stone-200 shadow-stone-200' :
          'bg-white/90 border-slate-200 shadow-slate-200'
        }`}
             style={{ right: `calc(${sidebarContentWidth}px + 2rem)` }}>
          <button
            onClick={() => {
              if (currentPageIndex > 0) {
                setCurrentPageIndex(currentPageIndex - 1);
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
              }
            }}
            disabled={currentPageIndex === 0}
            className={`p-2.5 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              settings.theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-100' :
              settings.theme === 'night' ? 'bg-indigo-800 hover:bg-indigo-700 text-indigo-100' :
              settings.theme === 'contrast' ? 'bg-gray-900 hover:bg-gray-800 text-white' :
              settings.theme === 'sepia' ? 'bg-amber-200 hover:bg-amber-300 text-amber-900' :
              settings.theme === 'paper' ? 'bg-stone-200 hover:bg-stone-300 text-stone-800' :
              'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Previous page (←)"
          >
           <ChevronLeft size={20} />
         </button>
         
         <div className="px-4 py-1.5">
           <span className="text-sm font-bold text-slate-700">
             {currentPageIndex + 1} / {pages.length}
           </span>
           <span className="text-xs text-slate-400 ml-2">
             Page
           </span>
         </div>
         
          <button
            onClick={() => {
              if (currentPageIndex < pages.length - 1) {
                setCurrentPageIndex(currentPageIndex + 1);
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
              }
            }}
            disabled={currentPageIndex >= pages.length - 1}
            className={`p-2.5 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              settings.theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600 text-slate-100' :
              settings.theme === 'night' ? 'bg-indigo-800 hover:bg-indigo-700 text-indigo-100' :
              settings.theme === 'contrast' ? 'bg-gray-900 hover:bg-gray-800 text-white' :
              settings.theme === 'sepia' ? 'bg-amber-200 hover:bg-amber-300 text-amber-900' :
              settings.theme === 'paper' ? 'bg-stone-200 hover:bg-stone-300 text-stone-800' :
              'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Next page (→)"
          >
           <ChevronRight size={20} />
         </button>
         
         {/* 章节导航 */}
         {isUsingNewStorage && chapters.length > 1 && (
           <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200">
             <button
               onClick={() => handleChapterChange(currentChapterIndex - 1)}
               disabled={currentChapterIndex === 0}
               className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
               title="Previous chapter (↑)"
             >
               <ChevronLeft size={16} />
             </button>
             <span className="text-xs text-slate-500 font-medium">
               Ch. {currentChapterIndex + 1}
             </span>
             <button
               onClick={() => handleChapterChange(currentChapterIndex + 1)}
               disabled={currentChapterIndex >= chapters.length - 1}
               className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
               title="Next chapter (↓)"
             >
               <ChevronRight size={16} />
             </button>
           </div>
         )}
       </div>

         <aside className={`border-l flex flex-col shrink-0 z-20 shadow-2xl ${
           settings.theme === 'dark' ? 'border-slate-700 bg-slate-800 shadow-slate-900' :
           settings.theme === 'night' ? 'border-indigo-800 bg-indigo-900 shadow-indigo-950' :
           settings.theme === 'contrast' ? 'border-white bg-black shadow-white/20' :
           settings.theme === 'sepia' ? 'border-amber-200 bg-amber-100 shadow-amber-200' :
           settings.theme === 'paper' ? 'border-stone-200 bg-stone-100 shadow-stone-200' :
           'border-slate-200 bg-slate-50 shadow-slate-200'
         }`}
               style={{ width: `${sidebarContentWidth}px` }}>
          {selection ? (
             <TermSidebar 
               word={selectedText}
               sentence={selection.sentence}
               language={language}
               existingTerm={Object.values(terms).find(t => t.languageId === language.id && t.text.toLowerCase() === selectedText.toLowerCase()) || undefined}
               onSave={onUpdateTerm}
               onDeleteTerm={onDeleteTerm}
               allTerms={terms}
               onClose={() => { setSelection(null); setIsLinkingMode(false); }}
              aiConfig={aiConfig}
              isLinkingMode={isLinkingMode}
              onToggleLinkMode={() => setIsLinkingMode(!isLinkingMode)}
              aiSuggestion={aiSuggestion}
              isAiLoading={isAiLoading}
              aiError={aiError}
              onAiSuggest={handleAiSuggest}
              settings={settings}
            />
         ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-24 h-24 bg-white border border-slate-200 rounded-[32px] flex items-center justify-center mb-8 shadow-sm">
              <Search size={40} strokeWidth={1.5} className="text-slate-200" />
            </div>
            <h4 className="text-slate-900 font-black text-lg mb-3 tracking-tight">Select Text</h4>
            <p className="text-slate-500 text-sm leading-relaxed max-w-[260px] font-medium">
              Click a word to analyze its meaning. Use <strong>Fragment Pairing</strong> for separable German verbs or multi-word idioms.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};

export default Reader;
