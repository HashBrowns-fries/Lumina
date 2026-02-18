// @ts-nocheck
import React, { useState } from 'react';
import { AIConfig, UserSettings } from '../services/dataModels';
import { AIProvider } from '../types';
import { Cpu, Key, Globe, Save, Sparkles, Server } from 'lucide-react';

interface AISettingsProps {
  aiConfig: AIConfig;
  onUpdate: (aiConfig: AIConfig) => void;
  settings: UserSettings;
}

const AI_PROVIDERS: { id: AIProvider; name: string; description: string; defaultModel: string }[] = [
  { id: 'gemini', name: 'Google Gemini', description: 'Google\'s Gemini API', defaultModel: 'gemini-2.0-flash-exp' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek AI models', defaultModel: 'deepseek-chat' },
  { id: 'aliyun', name: 'Alibaba Cloud', description: 'Alibaba Cloud AI services', defaultModel: 'qwen-max' },
  { id: 'ollama', name: 'Ollama', description: 'Local Ollama instance', defaultModel: 'llama3.2' },
  { id: 'qwen', name: 'Qwen', description: 'Alibaba Qwen models', defaultModel: 'qwen-max' }
];

const AISettings: React.FC<AISettingsProps> = ({ aiConfig, onUpdate, settings }) => {
  const [formData, setFormData] = useState<AIConfig>(aiConfig);
   const [isDirty, setIsDirty] = useState(false);

   // 主题颜色映射
   const getThemeClasses = () => {
     const theme = settings?.theme || 'auto';
     switch (theme) {
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

   const handleChange = (updates: Partial<AIConfig>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const handleProviderChange = (provider: AIProvider) => {
    const providerInfo = AI_PROVIDERS.find(p => p.id === provider);
    handleChange({ 
      provider, 
      model: providerInfo?.defaultModel || 'gemini-2.0-flash-exp',
      baseUrl: provider === 'ollama' ? 'http://localhost:11434/v1' : ''
    });
  };

  const handleSave = () => {
    onUpdate(formData);
    setIsDirty(false);
  };

  const handleApiKeyChange = (provider: string, value: string) => {
    const updatedKeys = { ...formData.apiKeys, [provider]: value };
    handleChange({ apiKeys: updatedKeys });
  };

  return (
    <section className={`border rounded-3xl p-6 shadow-sm ${themeClasses.cardBg} ${themeClasses.border}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <Cpu size={20} />
        </div>
        <div>
           <h2 className={`text-lg font-bold ${themeClasses.text}`}>AI Configuration</h2>
           <p className={`text-xs font-medium ${themeClasses.mutedText}`}>
             Configure AI providers for grammar analysis and translations
           </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Provider Selection */}
         <div className="space-y-3">
           <label className={`text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 ${themeClasses.mutedText}`}>
             <Sparkles size={12} /> AI Provider
           </label>
          <div className="grid grid-cols-5 gap-3">
            {AI_PROVIDERS.map(provider => (
              <button
                key={provider.id}
                onClick={() => handleProviderChange(provider.id)}
                 className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                   formData.provider === provider.id
                     ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                     : `${themeClasses.mutedBg} ${themeClasses.border} ${themeClasses.mutedText} ${themeClasses.hoverBg}`
                 }`}
              >
                <span className="text-xs font-black">{provider.name}</span>
                 <span className={`text-[10px] text-center ${themeClasses.mutedText}`}>{provider.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model and Base URL */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
           <label className={`text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 ${themeClasses.mutedText}`}>
             <Server size={12} /> Model
           </label>
             <input 
               type="text" 
               value={formData.model}
               onChange={(e) => handleChange({ model: e.target.value })}
               className={`w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all ${themeClasses.mutedBg} ${themeClasses.border} ${themeClasses.text}`}
               placeholder="e.g., gemini-2.0-flash-exp"
             />
          </div>
          <div className="space-y-2">
           <label className={`text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 ${themeClasses.mutedText}`}>
             <Globe size={12} /> Base URL
           </label>
             <input 
               type="text" 
               value={formData.baseUrl || ''}
               onChange={(e) => handleChange({ baseUrl: e.target.value })}
               className={`w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all ${themeClasses.mutedBg} ${themeClasses.border} ${themeClasses.text}`}
               placeholder="e.g., https://api.deepseek.com/v1"
             />
          </div>
        </div>

        {/* API Keys */}
        <div className="space-y-3">
           <label className={`text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 ${themeClasses.mutedText}`}>
             <Key size={12} /> API Keys
           </label>
          <div className="space-y-3">
            {AI_PROVIDERS.map(provider => (
              <div key={provider.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700 w-24">{provider.name}:</span>
                <input 
                  type="password" 
                  value={formData.apiKeys?.[provider.id] || ''}
                  onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                   className={`flex-1 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all ${themeClasses.mutedBg} ${themeClasses.border} ${themeClasses.text}`}
                  placeholder={`${provider.name} API key`}
                />
              </div>
            ))}
          </div>
           <p className={`text-xs ${themeClasses.mutedText}`}>
             API keys are stored locally and never sent to our servers.
           </p>
        </div>

        {/* Advanced Options */}
        <div className="space-y-3">
           <label className={`text-xs font-bold uppercase tracking-[0.2em] ${themeClasses.mutedText}`}>
             Advanced Options
           </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
               <label className={`text-xs font-bold ${themeClasses.mutedText}`}>Fallback Provider</label>
               <select 
                 value={formData.fallbackProvider || ''}
                 onChange={(e) => handleChange({ fallbackProvider: e.target.value as AIProvider || undefined })}
                 className={`w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all ${themeClasses.mutedBg} ${themeClasses.border} ${themeClasses.text}`}
               >
                <option value="">None</option>
                {AI_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
               <label className={`text-xs font-bold ${themeClasses.mutedText}`}>Timeout (ms)</label>
              <input 
                type="number" 
                value={formData.timeout || 30000}
                onChange={(e) => handleChange({ timeout: parseInt(e.target.value) || 30000 })}
                 className={`w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-all ${themeClasses.mutedBg} ${themeClasses.border} ${themeClasses.text}`}
                placeholder="30000"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        {isDirty && (
          <div className="pt-4 border-t border-slate-200">
             <button
               onClick={handleSave}
               className={`w-full px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${themeClasses.buttonPrimary}`}
             >
               <Save size={18} />
               Save AI Configuration
             </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default AISettings;