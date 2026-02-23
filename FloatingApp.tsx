import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2, Sparkles, BookOpen, Settings, Keyboard, Info, Save, Link2, FileText, History } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { unifiedStorage } from './services/unifiedStorage';
import { analyzeTerm } from './services/llmService';

interface Inflection {
  form: string;
  tags?: string;
  normalized_form?: string;
}

interface DictionaryEntry {
  entry_id?: string;
  text: string;
  language: string;
  translation?: string;
  root_form?: string;
  grammar?: string;
  definition?: string;
  details?: any;
  link_part?: string;
  inflections?: Inflection[];
  etymology?: string;
}

interface SearchResult {
  success: boolean;
  entries: DictionaryEntry[];
  source: string;
  query: string;
  language: string;
}

interface AIAnalysisResult {
  translation?: string;
  grammar?: {
    partOfSpeech?: string;
    case?: string;
    gender?: string;
    number?: string;
    person?: string;
    tense?: string;
  } | string | object;
  explanation?: string;
  rootWord?: string;
  examples?: string[];
  etymology?: string;
  usage?: string;
}

const FloatingApp: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<DictionaryEntry | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [language, setLanguage] = useState('de');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const unlisten = listen<string>('new-query', (event) => {
      console.log('[FloatingApp] Received query:', event.payload);
      setQuery(event.payload);
      handleSearch(event.payload);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);
    setSelectedResult(null);

    try {
      const data = await invoke<SearchResult>('search_dictionary', {
        word: searchQuery,
        language: language
      });
      
      if (data.success && data.entries && data.entries.length > 0) {
        setResults(data.entries);
        setSelectedResult(data.entries[0]);
      } else if (language === 'sa') {
        setError('Sanskrit queries require additional processing');
      } else {
        setResults([]);
        setError('No results found');
      }
    } catch (err) {
      console.error('[FloatingApp] Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      const currentIndex = results.indexOf(selectedResult!);
      if (currentIndex < results.length - 1) {
        setSelectedResult(results[currentIndex + 1]);
      }
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      const currentIndex = results.indexOf(selectedResult!);
      if (currentIndex > 0) {
        setSelectedResult(results[currentIndex - 1]);
      }
    }
  };

  const handleClose = async () => {
    try {
      await invoke('hide_floating_window');
    } catch (err) {
      console.error('[FloatingApp] Failed to hide window:', err);
    }
  };

  const handleMinimize = async () => {
    try {
      const window = getCurrentWindow();
      await window.hide();
    } catch (err) {
      console.error('[FloatingApp] Failed to minimize:', err);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    if (query) {
      handleSearch(query);
    }
  };

  const handleSaveToVocabulary = async () => {
    if (!selectedResult) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const result: any = await invoke('save_term', {
        text: selectedResult.text,
        languageId: language,
        translation: selectedResult.translation || selectedResult.definition || '',
        notes: selectedResult.root_form ? `Root: ${selectedResult.root_form}` : '',
        status: 0,
        nextReview: Date.now() + 24 * 60 * 60 * 1000,
        interval: 0,
        easeFactor: 2.5,
        reps: 0
      });
      
      const savedTerms = Array.isArray(result) ? result : [result];
      
      // Also save to IndexedDB for local access
      for (const term of savedTerms) {
        const existing = await unifiedStorage.getTermById(term.id);
        if (!existing) {
          await unifiedStorage.addTerm(term);
        }
      }
      
      setSaveMessage('Saved to vocabulary!');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      console.error('[FloatingApp] Save error:', err);
      setSaveMessage('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIAnalysis = async () => {
    if (!selectedResult) return;
    
    setIsAnalyzing(true);
    setAiError(null);
    setAiAnalysis(null);
    
    try {
      const settings = await unifiedStorage.getSettings();
      const aiConfig = settings?.aiConfig || {
        provider: 'gemini',
        model: 'gemini-3-pro-preview',
        baseUrl: '',
        apiKeys: {}
      };
      
      const languageNames: Record<string, string> = {
        'de': 'German',
        'en': 'English',
        'fr': 'French',
        'es': 'Spanish',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'sa': 'Sanskrit',
        'la': 'Latin',
        'ar': 'Arabic',
        'nl': 'Dutch',
        'pl': 'Polish',
        'sv': 'Swedish',
        'da': 'Danish',
        'fi': 'Finnish',
        'no': 'Norwegian',
        'tr': 'Turkish',
        'el': 'Greek',
        'he': 'Hebrew',
        'hi': 'Hindi',
        'th': 'Thai',
        'vi': 'Vietnamese'
      };
      
      const result = await analyzeTerm(
        selectedResult.text,
        '',
        languageNames[language] || 'English',
        aiConfig
      );
      
      setAiAnalysis(result);
    } catch (err) {
      console.error('[FloatingApp] AI analysis error:', err);
      setAiError(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col floating-window overflow-hidden">
      {/* Header - draggable */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 drag-region"
        style={{ borderRadius: '20px 20px 0 0' }}
      >
        <div className="flex items-center gap-2 no-drag">
          <BookOpen className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-sm">Lumina Quick</span>
        </div>
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title="Info"
          >
            <Info className="w-4 h-4 text-white/80" />
          </button>
          <button
            onClick={handleMinimize}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title="Minimize"
          >
            <Keyboard className="w-4 h-4 text-white/80" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-red-500 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2 mb-2">
            <Keyboard className="w-3 h-3" />
            <span className="font-medium">快捷键</span>
          </div>
          <div className="space-y-1 ml-5">
            <div><kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Ctrl+Shift+L</kbd> 唤起悬浮窗</div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Enter</kbd> 搜索</div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Esc</kbd> 关闭</div>
            <div><kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">↑↓</kbd> 选择结果</div>
          </div>
          <div className="flex items-center gap-2 mt-3 mb-2">
            <span className="font-medium">语言选择</span>
          </div>
          <div className="flex flex-wrap gap-1 ml-5">
            {['de', 'en', 'fr', 'es', 'sa', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'la', 'ar'].map(lang => (
              <button
                key={lang}
                onClick={() => handleLanguageChange(lang)}
                className={`px-2 py-1 rounded text-xs ${
                  language === lang 
                    ? 'bg-indigo-500 text-white' 
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search (${language.toUpperCase()})...`}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-hidden flex">
        {/* Results list */}
        <div className="w-1/3 border-r border-slate-200 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500 text-sm">
              {error}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              {query ? 'No results' : 'Enter a word to search'}
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedResult(result)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${
                    selectedResult === result ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
                  }`}
                >
                  <div className="font-medium text-sm text-slate-800 truncate">
                    {result.text}
                  </div>
                  {result.root_form && (
                    <div className="text-xs text-slate-500 truncate">
                      {result.root_form}
                    </div>
                  )}
                  {result.translation && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {result.translation}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result detail */}
        <div className="w-2/3 overflow-y-auto p-4">
          {selectedResult ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 serif-text">
                  {selectedResult.text}
                </h2>
                {selectedResult.root_form && (
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    <History className="w-3 h-3" />
                    Root: {selectedResult.root_form}
                  </p>
                )}
                {selectedResult.grammar && (
                  <span className="inline-block mt-2 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg">
                    {selectedResult.grammar}
                  </span>
                )}
              </div>

              {selectedResult.link_part && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Link Part
                  </h3>
                  <p className="text-sm text-amber-800 font-medium">
                    {selectedResult.link_part}
                  </p>
                </div>
              )}

              {selectedResult.etymology && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <History className="w-3 h-3" />
                    Etymology
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedResult.etymology}
                  </p>
                </div>
              )}

              {selectedResult.inflections && selectedResult.inflections.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Inflections
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedResult.inflections.map((inf, idx) => (
                      <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                        {inf.form}
                        {inf.tags && <span className="ml-1 text-slate-400">({inf.tags})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedResult.translation && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Translation
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedResult.translation}
                  </p>
                </div>
              )}

              {selectedResult.definition && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Definition
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {selectedResult.definition}
                  </p>
                </div>
              )}

              {selectedResult.details && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Details
                  </h3>
                  {Object.entries(selectedResult.details).map(([key, value]) => (
                    <div key={key}>
                      <h4 className="text-xs font-medium text-slate-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      <p className="text-sm text-slate-700 mt-1">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Analysis Section */}
              {aiAnalysis && (
                <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg space-y-3">
                  <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Analysis
                  </h3>
                  
                  {aiAnalysis.translation && (
                    <div>
                      <h4 className="text-xs font-medium text-indigo-700">Translation</h4>
                      <p className="text-sm text-slate-700">{aiAnalysis.translation}</p>
                    </div>
                  )}
                  
                  {(aiAnalysis.grammar && typeof aiAnalysis.grammar === 'object') && (
                    <div>
                      <h4 className="text-xs font-medium text-indigo-700">Grammar</h4>
                      <p className="text-sm text-slate-700">{JSON.stringify(aiAnalysis.grammar)}</p>
                    </div>
                  )}
                  
                  {aiAnalysis.etymology && (
                    <div>
                      <h4 className="text-xs font-medium text-indigo-700">Etymology</h4>
                      <p className="text-sm text-slate-700">{aiAnalysis.etymology}</p>
                    </div>
                  )}
                  
                  {aiAnalysis.examples && aiAnalysis.examples.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-indigo-700">Examples</h4>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {aiAnalysis.examples.map((ex, idx) => (
                          <li key={idx} className="ml-2">• {ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {aiAnalysis.explanation && (
                    <div>
                      <h4 className="text-xs font-medium text-indigo-700">Explanation</h4>
                      <p className="text-sm text-slate-700">{aiAnalysis.explanation}</p>
                    </div>
                  )}
                  
                  {aiAnalysis.usage && (
                    <div>
                      <h4 className="text-xs font-medium text-indigo-700">Usage</h4>
                      <p className="text-sm text-slate-700">{aiAnalysis.usage}</p>
                    </div>
                  )}
                </div>
              )}

              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{aiError}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  AI Analysis
                </button>
                <button
                  onClick={handleSaveToVocabulary}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </button>
              </div>
              
              {saveMessage && (
                <p className="text-center text-sm text-emerald-600 font-medium">{saveMessage}</p>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Select a result to view details
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
        <span>{results.length} results</span>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Ctrl+Shift+L</kbd>
          <span>Toggle</span>
        </div>
      </div>
    </div>
  );
};

export default FloatingApp;
