// @ts-nocheck
import React, { useState } from 'react';
import { Language, UserSettings } from '../services/dataModels';
import { STANDARD_LANGUAGES } from '../src/constants/languages';
import { Plus, Globe, Trash2, ExternalLink, Type, ChevronDown, X, Check } from 'lucide-react';

interface LanguageSettingsProps {
  languages: Language[];
  onUpdate: (languages: Language[]) => void;
  settings?: UserSettings;
  onSettingsUpdate?: (updates: Partial<UserSettings>) => void;
}

interface StandardLanguage {
  id: string;
  name: string;
  dictionaryUrl: string;
}

const LanguageSettings: React.FC<LanguageSettingsProps> = ({ languages, onUpdate, settings, onSettingsUpdate }) => {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLanguage, setCustomLanguage] = useState({
    id: '',
    name: '',
    dictionaryUrl: 'https://example.wiktionary.org/wiki/###'
  });

  // 默认设置
  const defaultSettings: UserSettings = {
    id: 'default',
    autoSaveOnClick: false,
    showRootFormsOnly: false,
    theme: 'light',
    fontSize: 16,
    lineHeight: 1.6,
    wordsPerPage: 1000,
    fontFamily: 'system-ui',
    fontWeight: 400,
    aiConfig: {
      provider: 'gemini' as const,
      model: 'gemini-3-pro-preview',
      baseUrl: '',
      apiKeys: {}
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const currentSettings = settings || defaultSettings;

  // 主题颜色映射
  const getThemeClasses = () => {
    switch (currentSettings.theme) {
      case 'dark':
        return {
          bg: 'bg-slate-900',
          text: 'text-slate-100',
          border: 'border-slate-700',
          cardBg: 'bg-slate-800',
          hoverBg: 'hover:bg-slate-700',
          mutedText: 'text-slate-400',
          mutedBg: 'bg-slate-800/50',
          buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
          buttonSecondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600'
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
          buttonPrimary: 'bg-indigo-700 text-white hover:bg-indigo-800',
          buttonSecondary: 'bg-indigo-800 text-indigo-100 hover:bg-indigo-700'
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
          buttonPrimary: 'bg-white text-black hover:bg-gray-200',
          buttonSecondary: 'bg-gray-900 text-white hover:bg-gray-800'
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
          buttonPrimary: 'bg-amber-600 text-white hover:bg-amber-700',
          buttonSecondary: 'bg-amber-200 text-amber-900 hover:bg-amber-300'
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
          buttonPrimary: 'bg-stone-600 text-white hover:bg-stone-700',
          buttonSecondary: 'bg-stone-200 text-stone-800 hover:bg-stone-300'
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
          buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
          buttonSecondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        };
    }
  };

  const themeClasses = getThemeClasses();

  const handleAddStandardLanguage = (stdLang: StandardLanguage) => {
    // 检查是否已存在
    if (languages.some(l => l.id === stdLang.id)) {
      alert(`Language "${stdLang.name}" is already added.`);
      return;
    }
    
    // 转换为完整 Language 对象
    const newLang: Language = {
      id: stdLang.id,
      name: stdLang.name,
      dictionaryUrl: stdLang.dictionaryUrl,
      kaikkiDownloaded: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    onUpdate([...languages, newLang]);
    setShowLanguageDropdown(false);
  };

  const handleAddCustomLanguage = () => {
    // 验证输入
    if (!customLanguage.id.trim()) {
      alert('Language ID is required');
      return;
    }
    
    if (!customLanguage.name.trim()) {
      alert('Language name is required');
      return;
    }
    
    if (!customLanguage.dictionaryUrl.trim()) {
      alert('Dictionary URL template is required');
      return;
    }
    
    // 检查ID是否已存在
    if (languages.some(l => l.id === customLanguage.id)) {
      alert(`Language with ID "${customLanguage.id}" already exists.`);
      return;
    }
    
    // 创建自定义语言对象
    const newLang: Language = {
      id: customLanguage.id,
      name: customLanguage.name,
      dictionaryUrl: customLanguage.dictionaryUrl,
      kaikkiDownloaded: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    onUpdate([...languages, newLang]);
    
    // 重置表单
    setCustomLanguage({
      id: '',
      name: '',
      dictionaryUrl: 'https://example.wiktionary.org/wiki/###'
    });
    setShowCustomForm(false);
    setShowLanguageDropdown(false);
  };

  const handleCancelCustomLanguage = () => {
    setShowCustomForm(false);
    setCustomLanguage({
      id: '',
      name: '',
      dictionaryUrl: 'https://example.wiktionary.org/wiki/###'
    });
    setShowLanguageDropdown(false);
  };

  const handleRemove = (id: string) => {
    onUpdate(languages.filter(l => l.id !== id));
  };

  const handleChange = (id: string, updates: Partial<Language>) => {
    onUpdate(languages.map(l => l.id === id ? { ...l, ...updates, updatedAt: Date.now() } : l));
  };

  return (
    <>
      {/* Double-Click Save Setting */}
      <section className={`border rounded-3xl p-6 shadow-sm ${themeClasses.cardBg} ${themeClasses.border} mb-6`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <Check size={20} />
            </div>
            <div className="flex-1">
              <h2 className={`text-base font-bold ${themeClasses.text}`}>Double-Click to Save</h2>
              <p className={`text-xs ${themeClasses.mutedText} mt-1`}>
                Enable double-click on a word to automatically save it to vocabulary
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const newValue = !currentSettings.autoSaveOnClick;
              // Call parent handler if provided
              if (onSettingsUpdate) {
                onSettingsUpdate({ autoSaveOnClick: newValue });
              }
            }}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
              currentSettings.autoSaveOnClick ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                currentSettings.autoSaveOnClick ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Languages Section */}
      <section className={`border rounded-3xl p-6 shadow-sm ${themeClasses.cardBg} ${themeClasses.border}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Globe size={20} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${themeClasses.text}`}>Languages & Dictionaries</h2>
            <p className={`text-xs font-medium ${themeClasses.mutedText}`}>
              Manage your target languages and dictionary URLs
            </p>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95 flex items-center gap-1"
            title="Add Language"
          >
            <Plus size={20} strokeWidth={3} />
            <ChevronDown size={16} />
          </button>
          
          {showLanguageDropdown && !showCustomForm && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
              <div className="p-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Add Language</h3>
                <p className="text-xs text-slate-500 mt-1">Select a standard language or add custom</p>
              </div>
              
              {/* 自定义语言按钮 */}
              <button
                onClick={() => setShowCustomForm(true)}
                className="w-full text-left px-3 py-3 border-b border-slate-100 hover:bg-slate-50 text-sm flex items-center justify-between text-indigo-600"
              >
                <span className="font-medium">Add Custom Language</span>
                <Plus size={16} />
              </button>
              
              <div className="max-h-64 overflow-y-auto">
                {(STANDARD_LANGUAGES as StandardLanguage[]).map(lang => (
                  <button
                    key={lang.id}
                    onClick={() => handleAddStandardLanguage(lang)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex items-center justify-between"
                  >
                    <span>{lang.name}</span>
                    <span className="text-xs text-slate-500">{lang.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {showLanguageDropdown && showCustomForm && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Add Custom Language</h3>
                  <p className="text-xs text-slate-500 mt-1">Enter custom language details</p>
                </div>
                <button
                  onClick={handleCancelCustomLanguage}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Language ID
                  </label>
                  <input
                    type="text"
                    value={customLanguage.id}
                    onChange={(e) => setCustomLanguage(prev => ({ ...prev, id: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                    placeholder="e.g., sw, la, el"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Short code (2-3 letters), must be unique
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Language Name
                  </label>
                  <input
                    type="text"
                    value={customLanguage.name}
                    onChange={(e) => setCustomLanguage(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                    placeholder="e.g., Swahili, Latin, Ancient Greek"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dictionary URL Template
                  </label>
                  <input
                    type="text"
                    value={customLanguage.dictionaryUrl}
                    onChange={(e) => setCustomLanguage(prev => ({ ...prev, dictionaryUrl: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all font-mono"
                    placeholder="https://example.wiktionary.org/wiki/###"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Use ### as placeholder for the word
                  </p>
                </div>
                
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={handleCancelCustomLanguage}
                    className="flex-1 py-2 text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomLanguage}
                    className="flex-1 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Check size={16} />
                    Add Language
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {languages.map((lang) => (
          <div 
            key={lang.id} 
            className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-slate-200 transition-all group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={lang.name}
                  onChange={(e) => handleChange(lang.id, { name: e.target.value })}
                  className="text-sm font-bold text-slate-900 bg-transparent border-none focus:ring-0 p-0 w-32 shrink-0 hover:bg-slate-100/50 rounded px-1 -ml-1 transition-colors"
                  placeholder="Language name"
                />
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <Type size={12} className="text-slate-300" />
                <input 
                  type="text" 
                  value={lang.dictionaryUrl}
                  onChange={(e) => handleChange(lang.id, { dictionaryUrl: e.target.value })}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="URL template with ###"
                />
                <a 
                  href={lang.dictionaryUrl?.replace('###', 'hello') || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-indigo-500 transition-colors"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <button 
              onClick={() => handleRemove(lang.id)}
              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {languages.length === 0 && (
          <div className="text-center py-4 text-slate-400 text-xs italic">
            No languages added. Click the plus button to start.
          </div>
        )}
      </div>
      </section>
    </>
  );
};

export default LanguageSettings;
