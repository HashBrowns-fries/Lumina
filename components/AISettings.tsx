// @ts-nocheck
import React, { useState } from 'react';
import { AIConfig } from '../services/dataModels';
import { AIProvider } from '../types';
import { Cpu, Key, Globe, Save, Sparkles, Server } from 'lucide-react';

interface AISettingsProps {
  aiConfig: AIConfig;
  onUpdate: (aiConfig: AIConfig) => void;
}

const AI_PROVIDERS: { id: AIProvider; name: string; description: string; defaultModel: string }[] = [
  { id: 'gemini', name: 'Google Gemini', description: 'Google\'s Gemini API', defaultModel: 'gemini-2.0-flash-exp' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek AI models', defaultModel: 'deepseek-chat' },
  { id: 'aliyun', name: 'Alibaba Cloud', description: 'Alibaba Cloud AI services', defaultModel: 'qwen-max' },
  { id: 'ollama', name: 'Ollama', description: 'Local Ollama instance', defaultModel: 'llama3.2' },
  { id: 'qwen', name: 'Qwen', description: 'Alibaba Qwen models', defaultModel: 'qwen-max' }
];

const AISettings: React.FC<AISettingsProps> = ({ aiConfig, onUpdate }) => {
  const [formData, setFormData] = useState<AIConfig>(aiConfig);
  const [isDirty, setIsDirty] = useState(false);

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
    <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <Cpu size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">AI Configuration</h2>
          <p className="text-xs text-slate-400 font-medium">
            Configure AI providers for grammar analysis and translations
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
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
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-black">{provider.name}</span>
                <span className="text-[10px] text-slate-500 text-center">{provider.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model and Base URL */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Server size={12} /> Model
            </label>
            <input 
              type="text" 
              value={formData.model}
              onChange={(e) => handleChange({ model: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
              placeholder="e.g., gemini-2.0-flash-exp"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Globe size={12} /> Base URL
            </label>
            <input 
              type="text" 
              value={formData.baseUrl || ''}
              onChange={(e) => handleChange({ baseUrl: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
              placeholder="e.g., https://api.deepseek.com/v1"
            />
          </div>
        </div>

        {/* API Keys */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
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
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder={`${provider.name} API key`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            API keys are stored locally and never sent to our servers.
          </p>
        </div>

        {/* Advanced Options */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
            Advanced Options
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">Fallback Provider</label>
              <select 
                value={formData.fallbackProvider || ''}
                onChange={(e) => handleChange({ fallbackProvider: e.target.value as AIProvider || undefined })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
              >
                <option value="">None</option>
                {AI_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">Timeout (ms)</label>
              <input 
                type="number" 
                value={formData.timeout || 30000}
                onChange={(e) => handleChange({ timeout: parseInt(e.target.value) || 30000 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
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
              className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
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