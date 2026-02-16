// @ts-nocheck
import React, { useState } from 'react';
import { Language } from '../services/dataModels';
import { STANDARD_LANGUAGES } from '../src/constants/languages';
import { Plus, Globe, Trash2, ExternalLink, Type, ChevronDown } from 'lucide-react';

interface LanguageSettingsProps {
  languages: Language[];
  onUpdate: (languages: Language[]) => void;
}

interface StandardLanguage {
  id: string;
  name: string;
  dictionaryUrl: string;
}

const LanguageSettings: React.FC<LanguageSettingsProps> = ({ languages, onUpdate }) => {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

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

  const handleRemove = (id: string) => {
    onUpdate(languages.filter(l => l.id !== id));
  };

  const handleChange = (id: string, updates: Partial<Language>) => {
    onUpdate(languages.map(l => l.id === id ? { ...l, ...updates, updatedAt: Date.now() } : l));
  };

  return (
    <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Globe size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Languages & Dictionaries</h2>
            <p className="text-xs text-slate-400 font-medium">
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
          
          {showLanguageDropdown && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
              <div className="p-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">Add Language</h3>
                <p className="text-xs text-slate-500 mt-1">Select a standard language</p>
              </div>
              
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
  );
};

export default LanguageSettings;
