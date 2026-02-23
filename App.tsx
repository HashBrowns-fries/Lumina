// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { 
  BookOpen, 
  Library, 
  Settings, 
  Plus, 
  ChevronLeft,
  X,
  Search,
  Wand2,
  Trash2,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  GraduationCap,
  Download,
  Database,
  Cpu,
  Key,
  Globe,
  Save,
  FileJson,
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { TermStatus } from './types';
import { unifiedDb, unifiedStorage } from './services/unifiedStorage';
import { migrateToV3, needsMigration, checkDatabaseStatus } from './services/migrationService';
import { 
  Language, 
  Text, 
  Term, 
  UserSettings,
  AIConfig,
  AppState as NewAppState 
} from './services/dataModels';
import { DEFAULT_LANGUAGES, fixLanguageIds } from './src/constants/languages';
import { deleteDocument } from './services/documentStorage';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Lazy load large components
const Reader = lazy(() => import('./components/Reader'));
const LibraryView = lazy(() => import('./components/LibraryView'));
const VocabularyView = lazy(() => import('./components/VocabularyView'));
const LanguageSettings = lazy(() => import('./components/LanguageSettings'));
const AISettings = lazy(() => import('./components/AISettings'));
const DictionarySettings = lazy(() => import('./components/DictionarySettings'));
const AppearanceSettings = lazy(() => import('./components/AppearanceSettings'));
const UpdateSettings = lazy(() => import('./components/UpdateSettings'));

// Get default values from environment variables
const DEFAULT_AI_PROVIDER = (process.env.DEFAULT_AI_PROVIDER as any) || 'gemini';
const DEFAULT_AI_MODEL = process.env.DEFAULT_AI_MODEL || 'gemini-2.0-flash';

const DEFAULT_AI_CONFIG = {
  provider: DEFAULT_AI_PROVIDER,
  model: DEFAULT_AI_MODEL,
  baseUrl: undefined,
  apiKeys: {
    gemini: process.env.GEMINI_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    aliyun: process.env.ALIYUN_API_KEY || '',
    qwen: process.env.QWEN_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    ollama: process.env.OLLAMA_API_KEY || ''
  }
};

const App = () => {
   const [view, setView] = React.useState<'library' | 'reader' | 'settings' | 'vocabulary'>('library');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 100, phase: '' });
  
  // Track last read document for continue reading
  const [lastReadTextId, setLastReadTextId] = useState<string | null>(null);
  
  // 使用新的统一状态
  const [languages, setLanguages] = useState<Language[]>(() => 
    DEFAULT_LANGUAGES.map(lang => ({
      ...lang,
      kaikkiDownloaded: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))
  );
  const [texts, setTexts] = useState<Text[]>([]);
  const [terms, setTerms] = useState<Record<string, Term>>({});
  const [currentTextId, setCurrentTextId] = useState<string | undefined>(undefined);
  const [settings, setSettings] = useState<UserSettings>({
    id: 'default',
    autoSaveOnClick: false,
    showRootFormsOnly: false,
    theme: 'auto',
    fontSize: 16,
    lineHeight: 1.6,
    wordsPerPage: 1000,
    fontFamily: 'system-ui',
    fontWeight: 400,
    aiConfig: DEFAULT_AI_CONFIG,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  // File System Sync State
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const syncTimeoutRef = useRef<number | null>(null);

  // 1. Initialization: Load from Unified IndexedDB
  useEffect(() => {
    console.debug('[App] Initializing app with unified storage');
    
    const init = async () => {
      try {
        // 检查是否需要迁移
        const needsMigrate = await needsMigration();
        const status = await checkDatabaseStatus();
        
        console.debug('[App] Database status:', status);
        
        if (needsMigrate && status.oldDbExists) {
          console.log('[App] Migration required, starting...');
          setIsMigrating(true);
          
          const result = await migrateToV3((progress) => {
            setMigrationProgress(progress);
          });
          
          console.log('[App] Migration result:', result);
          setIsMigrating(false);
        }
        
        // 打开统一数据库
        if (!unifiedDb.isOpen()) {
          await unifiedDb.open();
        }
        
        // 加载数据
        const loadedLanguages = await unifiedStorage.getAllLanguages();
        const loadedTexts = await unifiedStorage.getAllTexts();
        const loadedTerms = await unifiedStorage.getAllTerms();
        const loadedSettings = await unifiedStorage.getSettings();
        
        console.debug('[App] Loaded data:', {
          languages: loadedLanguages.length,
          texts: loadedTexts.length,
          terms: loadedTerms.length,
          hasSettings: !!loadedSettings
        });
        
        // 修复语言ID
        if (loadedLanguages.length > 0) {
          // 确保所有语言都有必需的字段
          const fixedLanguages = loadedLanguages.map(lang => ({
            ...lang,
            dictionaryUrl: lang.dictionaryUrl || `https://${lang.id}.wiktionary.org/wiki/###`,
            kaikkiDownloaded: lang.kaikkiDownloaded ?? false,
            createdAt: lang.createdAt ?? Date.now(),
            updatedAt: lang.updatedAt ?? Date.now()
          }));
          setLanguages(fixedLanguages);
        } else {
          // 使用默认语言
          const defaultLangs: Language[] = DEFAULT_LANGUAGES.map(l => ({
            id: l.id,
            name: l.name,
            dictionaryUrl: l.dictionaryUrl,
            kaikkiDownloaded: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));
          setLanguages(defaultLangs);
          // 保存默认语言
          for (const lang of defaultLangs) {
            await unifiedStorage.addLanguage(lang).catch(() => {});
          }
        }
        
        setTexts(loadedTexts);
        
        // 转换 terms 数组为记录
        const termsRecord: Record<string, Term> = {};
        for (const term of loadedTerms) {
          termsRecord[term.id] = term;
        }
        setTerms(termsRecord);
        
        if (loadedSettings) {
          setSettings(loadedSettings);
        } else {
          // 保存默认设置
          await unifiedStorage.saveSettings(settings);
        }
        
      } catch (error) {
        console.error('[App] Initialization failed:', error);
      }
      
      // 从 Rust 后端加载词汇
      try {
        console.debug('[App] Loading terms from Rust backend...');
        const terms = await invoke('get_all_terms');
        
        if (terms && terms.length > 0) {
          console.debug('[App] Syncing terms from Rust backend...');
          
          for (const term of terms) {
            // 检查是否已存在
            const existing = await unifiedStorage.getTermById(term.id);
            if (!existing) {
              // 添加到 IndexedDB
              await unifiedStorage.addTerm({
                ...term,
                status: term.status || 0,
                nextReview: term.nextReview || 0,
                lastReview: term.lastReview || 0,
                interval: term.interval || 0,
                easeFactor: term.easeFactor || 2.5,
                reps: term.reps || 0
              });
              console.debug('[App] Synced term:', term.text);
            }
          }
          
          // 重新加载词汇
          const syncedTerms = await unifiedStorage.getAllTerms();
          const termsRecord: Record<string, Term> = {};
          for (const term of syncedTerms) {
            termsRecord[term.id] = term;
          }
          setTerms(termsRecord);
          console.debug('[App] Terms sync complete, total:', syncedTerms.length);
        }
      } catch (syncError) {
        console.debug('[App] No terms to sync or sync failed:', syncError);
      }
      
      // Listen to Tauri events for real-time term updates
      try {
        console.debug('[App] Setting up term update listener...');
        const unlisten = await listen('term-update', async (event) => {
          try {
            const { action, term } = event.payload;
            console.debug('[App] Term update event:', action, term);
            
            if (action === 'add') {
              const termsToAdd = Array.isArray(term) ? term : [term];
              for (const t of termsToAdd) {
                const existing = await unifiedStorage.getTermById(t.id);
                if (!existing) {
                  const termData = {
                    ...t,
                    status: t.status === 'new' ? 0 : (typeof t.status === 'number' ? t.status : 0),
                    nextReview: t.nextReview || 0,
                    lastReview: t.lastReview || 0,
                    interval: t.interval || 0,
                    easeFactor: t.easeFactor || 2.5,
                    reps: t.reps || 0,
                    parentId: t.parentId || undefined,
                    updatedAt: t.updatedAt || Date.now(),
                    createdAt: t.createdAt || Date.now()
                  };
                  await unifiedStorage.addTerm(termData);
                }
              }
            } else if (action === 'update') {
              const t = term;
              const termData = {
                ...t,
                status: t.status === 'new' ? 0 : (typeof t.status === 'number' ? t.status : 0),
                parentId: t.parentId || undefined
              };
              await unifiedStorage.updateTerm(t.id, termData);
            } else if (action === 'delete') {
              await unifiedStorage.deleteTerm(term.id);
            }
            
            // Refresh terms from IndexedDB
            const updatedTerms = await unifiedStorage.getAllTerms();
            const termsRecord: Record<string, Term> = {};
            for (const termItem of updatedTerms) {
              termsRecord[termItem.id] = termItem;
            }
            setTerms(termsRecord);
            console.debug('[App] Terms sync complete');
          } catch (err) {
            console.error('[App] Term update processing error:', err);
          }
        });
        
        console.debug('[App] Term update listener setup complete');
      } catch (listenerError) {
        console.debug('[App] Term update listener setup failed:', listenerError);
      }
      
      setIsInitialized(true);
      console.debug('[App] Initialization complete');
    };
    
    init();
  }, []);

  // 2. Auto-save to IndexedDB
  useEffect(() => {
    if (!isInitialized || isMigrating) return;

    const autoSave = async () => {
      try {
        console.debug('[App] Auto-saving...');
        
        // 保存语言
        const existingLangs = await unifiedStorage.getAllLanguages();
        for (const lang of languages) {
          const exists = existingLangs.find(l => l.id === lang.id);
          if (exists) {
            await unifiedStorage.updateLanguage(lang.id, lang);
          } else {
            await unifiedStorage.addLanguage(lang).catch(() => {});
          }
        }
        
        // 保存设置
        await unifiedStorage.saveSettings(settings);
        
        console.debug('[App] Auto-save complete');
      } catch (error) {
        console.error('[App] Auto-save failed:', error);
      }
    };

    const timeoutId = window.setTimeout(autoSave, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [languages, settings, isInitialized, isMigrating]);

  // 3. File System Sync
  useEffect(() => {
    if (!isInitialized || !fileHandle) return;

    const syncToFile = async () => {
      setSyncStatus('syncing');
      
      try {
        const exportData = await unifiedStorage.exportAllData();
        const dataStr = JSON.stringify(exportData, null, 2);
        
        const options = { mode: 'readwrite' as any };
        if ((await (fileHandle as any).queryPermission(options)) !== 'granted') {
          if ((await (fileHandle as any).requestPermission(options)) !== 'granted') {
            throw new Error('Permission denied');
          }
        }

        const writable = await fileHandle.createWritable();
        await writable.write(dataStr);
        await writable.close();
        
        setSyncStatus('synced');
      } catch (err) {
        console.error('[App] File sync error:', err);
        setSyncStatus('error');
      }
    };

    const timeoutId = window.setTimeout(syncToFile, 2000);
    return () => window.clearTimeout(timeoutId);
  }, [texts, terms, languages, settings, fileHandle, isInitialized]);

  // Handlers
  const handleAddText = async (text: Text) => {
    await unifiedStorage.addText(text);
    setTexts(prev => [...prev, text]);
  };

  const handleDeleteText = async (id: string) => {
    await unifiedStorage.deleteText(id);
    await deleteDocument(id);
    setTexts(prev => prev.filter(t => t.id !== id));
    
    if (currentTextId === id) {
      setCurrentTextId(undefined);
      setView('library');
    }
  };

  const handleUpdateTerm = async (term: Term, linkedChild?: Term) => {
    console.debug('[App] handleUpdateTerm called:', { 
      term, 
      linkedChild,
      termKey: `${term.languageId}:${term.text.toLowerCase()}` 
    });
    
    // 确保术语有ID
    const termKey = `${term.languageId}:${term.text.toLowerCase()}`;
    const termWithId = { ...term, id: term.id || termKey };
    
    // 更新主术语
    setTerms(prev => ({
      ...prev,
      [termKey]: termWithId
    }));
    
    // 保存主术语到存储
    try {
      const existingTerm = terms[termKey];
      if (existingTerm) {
        // 更新现有术语
        await unifiedStorage.updateTerm(termKey, termWithId);
      } else {
        // 添加新术语
        await unifiedStorage.addTerm(termWithId);
      }
    } catch (error) {
      console.error('Failed to save term to storage:', error);
    }
    
    // 如果有关联子术语，也更新它
    if (linkedChild) {
      const childKey = `${linkedChild.languageId}:${linkedChild.text.toLowerCase()}`;
      const childWithId = { ...linkedChild, id: linkedChild.id || childKey };
      
      setTerms(prev => ({
        ...prev,
        [childKey]: childWithId
      }));
      
      // 保存子术语到存储
      try {
        const existingChild = terms[childKey];
        if (existingChild) {
          await unifiedStorage.updateTerm(childKey, childWithId);
        } else {
          await unifiedStorage.addTerm(childWithId);
        }
      } catch (error) {
        console.error('Failed to save linked child term to storage:', error);
      }
    }
  };

  const handleDeleteTerm = async (key: string) => {
    // 从状态中删除
    setTerms(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    
    // 从存储中删除
    try {
      await unifiedStorage.deleteTerm(key);
    } catch (error) {
      console.error('Failed to delete term from storage:', error);
    }
  };

  const handleSelectText = (id: string) => {
    setCurrentTextId(id);
    setLastReadTextId(id);
    setView('reader');
  };
  
  const handleContinueReading = () => {
    if (lastReadTextId && texts.find(t => t.id === lastReadTextId)) {
      setCurrentTextId(lastReadTextId);
      setView('reader');
    } else if (texts.length > 0) {
      // If no last read or it was deleted, go to most recent
      const sortedTexts = [...texts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCurrentTextId(sortedTexts[0].id);
      setLastReadTextId(sortedTexts[0].id);
      setView('reader');
    }
  };

  const handleUpdateLanguages = async (newLanguages: Language[]) => {
    setLanguages(newLanguages);
  };

  const handleUpdateAIConfig = async (aiConfig: AIConfig) => {
    setSettings(prev => ({
      ...prev,
      aiConfig,
      updatedAt: Date.now()
    }));
  };

  const handleUpdateSettings = (updates: Partial<UserSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...updates,
      updatedAt: Date.now()
    }));
  };

  // 主题颜色映射
  const getThemeClasses = () => {
    switch (settings.theme) {
      case 'dark':
        return {
          bg: 'bg-slate-900',
          text: 'text-slate-100',
          border: 'border-slate-700',
          cardBg: 'bg-slate-800',
          hoverBg: 'hover:bg-slate-700',
          mutedText: 'text-slate-400',
          mutedBg: 'bg-slate-800/50',
          navBg: 'bg-slate-800/80',
          inputBg: 'bg-slate-700',
          buttonPrimary: 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600 shadow-md hover:shadow-lg',
          buttonSecondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600 border border-slate-600'
        };
      case 'night':
        return {
          bg: 'bg-indigo-950',
          text: 'text-indigo-100',
          border: 'border-indigo-800',
          cardBg: 'bg-indigo-900',
          hoverBg: 'hover:bg-indigo-800',
          mutedText: 'text-indigo-400',
          mutedBg: 'bg-indigo-900/50',
          navBg: 'bg-indigo-900/80',
          inputBg: 'bg-indigo-900',
          buttonPrimary: 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-md hover:shadow-lg',
          buttonSecondary: 'bg-indigo-800 text-indigo-100 hover:bg-indigo-700 border border-indigo-700'
        };
      case 'contrast':
        return {
          bg: 'bg-black',
          text: 'text-white',
          border: 'border-white',
          cardBg: 'bg-gray-900',
          hoverBg: 'hover:bg-gray-800',
          mutedText: 'text-gray-400',
          mutedBg: 'bg-gray-900/50',
          navBg: 'bg-black/80',
          inputBg: 'bg-gray-900',
          buttonPrimary: 'bg-white text-black hover:bg-gray-200 shadow-lg',
          buttonSecondary: 'bg-gray-900 text-white hover:bg-gray-800 border border-white'
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-900',
          border: 'border-amber-200',
          cardBg: 'bg-amber-100',
          hoverBg: 'hover:bg-amber-200',
          mutedText: 'text-amber-700',
          mutedBg: 'bg-amber-100/50',
          navBg: 'bg-amber-100/80',
          inputBg: 'bg-amber-50',
          buttonPrimary: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-md hover:shadow-lg',
          buttonSecondary: 'bg-amber-200 text-amber-900 hover:bg-amber-300 border border-amber-300'
        };
      case 'paper':
        return {
          bg: 'bg-stone-50',
          text: 'text-stone-800',
          border: 'border-stone-200',
          cardBg: 'bg-stone-100',
          hoverBg: 'hover:bg-stone-200',
          mutedText: 'text-stone-600',
          mutedBg: 'bg-stone-100/50',
          navBg: 'bg-stone-100/80',
          inputBg: 'bg-stone-50',
          buttonPrimary: 'bg-gradient-to-r from-stone-500 to-zinc-500 text-white hover:from-stone-600 hover:to-zinc-600 shadow-md hover:shadow-lg',
          buttonSecondary: 'bg-stone-200 text-stone-800 hover:bg-stone-300 border border-stone-300'
        };
      default: // light, auto
        return {
          bg: 'bg-slate-50',
          text: 'text-slate-900',
          border: 'border-slate-200',
          cardBg: 'bg-white',
          hoverBg: 'hover:bg-slate-100',
          mutedText: 'text-slate-500',
          mutedBg: 'bg-slate-100/50',
          navBg: 'bg-white/80',
          inputBg: 'bg-slate-50',
          buttonPrimary: 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600 shadow-md hover:shadow-lg',
          buttonSecondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
        };
    }
  };

  const themeClasses = getThemeClasses();

  const currentText = useMemo(() => 
    texts.find(t => t.id === currentTextId), 
    [texts, currentTextId]
  );

  const currentLanguage = useMemo(() => 
    languages.find(l => l.id === currentText?.languageId) || languages[0] || DEFAULT_LANGUAGES[0],
    [languages, currentText]
  );

  // 迁移 UI
  if (isMigrating) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <RefreshCw size={24} className="animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Migrating Data</h2>
              <p className="text-sm text-slate-500">Please wait while we upgrade your storage</p>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-700">
                {migrationProgress.phase}
              </span>
              <span className="text-sm text-slate-500">
                {Math.round(migrationProgress.progress)}%
              </span>
            </div>
            
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${migrationProgress.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading UI
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 size={24} className="animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

   return (
    <div className={`min-h-screen font-sans selection:bg-indigo-100 ${themeClasses.bg} ${themeClasses.text}`}>
      {/* Navigation */}
       <nav className={`fixed top-0 left-0 right-0 h-16 backdrop-blur-md border-b z-50 px-6 flex items-center justify-between ${themeClasses.navBg} ${themeClasses.border}`}>
        <div className="flex items-center gap-4">
           <button 
            onClick={() => setView('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              view === 'library' ? 'bg-indigo-100 text-indigo-700' : `${themeClasses.text} ${themeClasses.hoverBg}`
            }`}
          >
            <Library size={20} />
            Library
          </button>
          {texts.length > 0 && (
            <button 
              onClick={handleContinueReading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                view === 'reader' ? 'bg-indigo-100 text-indigo-700' : `${themeClasses.text} ${themeClasses.hoverBg}`
              }`}
            >
              <BookOpen size={20} />
              Reader
              {lastReadTextId && (
                <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">
                  Continue
                </span>
              )}
            </button>
          )}
           <button 
            onClick={() => setView('vocabulary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              view === 'vocabulary' ? 'bg-indigo-100 text-indigo-700' : `${themeClasses.text} ${themeClasses.hoverBg}`
            }`}
          >
            <GraduationCap size={20} />
            Vocabulary
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          {syncStatus !== 'idle' && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
              syncStatus === 'syncing' ? 'text-amber-600 bg-amber-50' :
              syncStatus === 'synced' ? 'text-emerald-600 bg-emerald-50' :
              'text-rose-600 bg-rose-50'
            }`}>
              {syncStatus === 'syncing' && <RefreshCw size={12} className="animate-spin" />}
              {syncStatus === 'syncing' ? 'Syncing...' :
               syncStatus === 'synced' ? 'Synced' : 'Sync Error'}
            </div>
          )}
          
           <button 
            onClick={() => setView('settings')}
            className={`p-2 rounded-xl transition-all ${
              view === 'settings' ? 'bg-indigo-100 text-indigo-700' : `${themeClasses.text} ${themeClasses.hoverBg}`
            }`}
          >
            <Settings size={20} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-16 h-screen">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">Loading...</p>
            </div>
          </div>
        }>
          {view === 'library' && (
            <LibraryView 
              texts={texts}
              languages={languages}
              onSelect={handleSelectText}
              onAdd={handleAddText}
              onDelete={handleDeleteText}
              settings={settings}
            />
          )}
          
          {view === 'reader' && currentText && (
            <Reader 
              text={currentText}
              language={currentLanguage}
              terms={terms}
              onUpdateTerm={handleUpdateTerm}
              onDeleteTerm={handleDeleteTerm}
              onSave={(term) => {
                // Add term to state
                setTerms(prev => ({ ...prev, [term.id]: term }));
                // Save to storage
                unifiedStorage.addTerm(term).catch(err => {
                  console.error('Failed to save term to storage:', err);
                });
              }}
              aiConfig={settings.aiConfig || DEFAULT_AI_CONFIG}
              settings={settings}
              onClose={() => setView('library')}
            />
          )}
          
          {view === 'vocabulary' && (
            <VocabularyView 
              terms={terms}
              languages={languages}
              onUpdateTerm={handleUpdateTerm}
              onDeleteTerm={handleDeleteTerm}
              settings={settings}
            />
          )}
          
          {view === 'settings' && (
            <div className={`flex-1 overflow-y-auto p-8 ${themeClasses.bg}`}>
              <div className="max-w-3xl mx-auto space-y-6">
                <LanguageSettings 
                  languages={languages}
                  onUpdate={handleUpdateLanguages}
                  settings={settings}
                  onSettingsUpdate={(updates) => {
                    setSettings(prev => ({ ...prev, ...updates, updatedAt: Date.now() }));
                  }}
                />
               
                <DictionarySettings settings={settings} />
               
               <AppearanceSettings
                 settings={settings}
                 onUpdate={handleUpdateSettings}
               />
               
                <AISettings 
                  aiConfig={settings.aiConfig || DEFAULT_AI_CONFIG}
                  onUpdate={handleUpdateAIConfig}
                  settings={settings}
                />
              
                {/* Sync Settings */}
                <section className={`border-0 rounded-2xl p-6 shadow-lg ${themeClasses.cardBg}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-xl shadow-sm">
                      <Save size={20} />
                    </div>
                    <div>
                      <h2 className={`text-lg font-bold ${themeClasses.text}`}>Data Sync</h2>
                      <p className={`text-xs font-medium ${themeClasses.mutedText}`}>Export and backup your data</p>
                    </div>
                 </div>
                 
                 <div className="flex gap-3">
                   <button 
                     onClick={async () => {
                       const data = await unifiedStorage.exportAllData();
                       const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                       const url = URL.createObjectURL(blob);
                       const a = document.createElement('a');
                       a.href = url;
                       a.download = `lumina-backup-${new Date().toISOString().split('T')[0]}.json`;
                       a.click();
                     }}
                      className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 transform hover:scale-[1.02] ${themeClasses.buttonPrimary}`}
                   >
                     <Download size={18} />
                     Export Data
                   </button>
                  </div>
                </section>
                
                <UpdateSettings settings={settings} />
              </div>
            </div>
          )}
        </Suspense>
      </main>
    </div>
  );
};

export default App;
