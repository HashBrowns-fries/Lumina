// @ts-nocheck
import React from 'react';
import { Palette, Type, Maximize2, Sun, Moon, Eye, Contrast, Book, Zap } from 'lucide-react';
import { UserSettings } from '../services/dataModels';

interface AppearanceSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({ settings, onUpdate }) => {
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
  
  // 主题定义
  const themes = [
    { id: 'light' as const, name: 'Light', icon: Sun, bgColor: 'bg-slate-100', previewBg: 'bg-white', previewText: 'text-slate-800' },
    { id: 'dark' as const, name: 'Dark', icon: Moon, bgColor: 'bg-slate-900', previewBg: 'bg-slate-900', previewText: 'text-slate-100' },
    { id: 'sepia' as const, name: 'Sepia', icon: Book, bgColor: 'bg-amber-100', previewBg: 'bg-amber-50', previewText: 'text-amber-900' },
    { id: 'night' as const, name: 'Night', icon: Moon, bgColor: 'bg-indigo-950', previewBg: 'bg-indigo-950', previewText: 'text-indigo-100' },
    { id: 'contrast' as const, name: 'High Contrast', icon: Contrast, bgColor: 'bg-black', previewBg: 'bg-black', previewText: 'text-white' },
    { id: 'paper' as const, name: 'Paper', icon: Book, bgColor: 'bg-stone-50', previewBg: 'bg-stone-50', previewText: 'text-stone-800' },
    { id: 'auto' as const, name: 'Auto', icon: Zap, bgColor: 'bg-gradient-to-r from-slate-100 to-slate-300', previewBg: 'bg-gradient-to-r from-slate-100 to-slate-300', previewText: 'text-slate-800' },
  ];

  // 字体族定义
  const fontFamilies = [
    { id: 'system-ui', name: 'System UI' },
    { id: 'serif', name: 'Serif' },
    { id: 'sans-serif', name: 'Sans Serif' },
    { id: 'monospace', name: 'Monospace' },
    { id: 'georgia', name: 'Georgia' },
    { id: 'times-new-roman', name: 'Times New Roman' },
  ];

  // 字重定义
  const fontWeights = [
    { value: 300, label: 'Light' },
    { value: 400, label: 'Regular' },
    { value: 500, label: 'Medium' },
    { value: 600, label: 'Semibold' },
    { value: 700, label: 'Bold' },
    { value: 800, label: 'Heavy' },
  ];

  const handleThemeChange = (themeId: UserSettings['theme']) => {
    onUpdate({ theme: themeId });
  };

  const handleFontFamilyChange = (fontFamily: UserSettings['fontFamily']) => {
    onUpdate({ fontFamily });
  };

  const handleFontWeightChange = (fontWeight: number) => {
    onUpdate({ fontWeight });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ fontSize: parseInt(e.target.value) });
  };

  const handleLineHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ lineHeight: parseFloat(e.target.value) });
  };

  return (
     <section className={`border rounded-3xl p-6 shadow-sm ${themeClasses.cardBg} ${themeClasses.border}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <Palette size={20} />
        </div>
        <div>
           <h2 className={`text-lg font-bold ${themeClasses.text}`}>Appearance</h2>
           <p className={`text-xs font-medium ${themeClasses.mutedText}`}>
             Customize reading experience like Apple Books
           </p>
        </div>
      </div>

      {/* 主题选择 */}
      <div className="mb-8">
         <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${themeClasses.text}`}>
          <Sun size={14} />
          Theme
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {themes.map((theme) => {
            const Icon = theme.icon;
            return (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                 className={`p-3 rounded-xl border transition-all ${settings.theme === theme.id ? 'border-indigo-500 ring-2 ring-indigo-100' : `${themeClasses.border} ${themeClasses.hoverBg}`}`}
               >
                 <div className="flex flex-col items-center gap-2">
                   <div className={`w-10 h-10 rounded-full ${theme.bgColor} flex items-center justify-center`}>
                     <Icon size={18} className={theme.previewText} />
                   </div>
                   <span className={`text-xs font-medium ${themeClasses.text}`}>{theme.name}</span>
                 </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 字体设置 */}
      <div className="space-y-6">
        <div>
          <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${themeClasses.text}`}>
            <Type size={14} />
            Typography
          </h3>
          
          {/* 字体大小 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <Type size={16} className={themeClasses.mutedText} />
               <span className={`font-medium ${themeClasses.text}`}>Font Size</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="12"
                max="32"
                step="1"
                value={settings.fontSize}
                onChange={handleFontSizeChange}
                className="w-48 accent-indigo-600"
              />
               <span className={`w-12 text-center text-sm font-bold ${themeClasses.text}`}>
                 {settings.fontSize}px
               </span>
            </div>
          </div>

          {/* 行高 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <Maximize2 size={16} className={themeClasses.mutedText} />
               <span className={`font-medium ${themeClasses.text}`}>Line Height</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1.2"
                max="3.0"
                step="0.1"
                value={settings.lineHeight}
                onChange={handleLineHeightChange}
                className="w-48 accent-indigo-600"
              />
               <span className={`w-12 text-center text-sm font-bold ${themeClasses.text}`}>
                 {settings.lineHeight.toFixed(1)}
               </span>
            </div>
          </div>

          {/* 字体族 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
               <span className={`font-medium ${themeClasses.text}`}>Font Family</span>
               <span className={`text-xs ${themeClasses.mutedText}`}>{settings.fontFamily}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {fontFamilies.map((font) => (
                <button
                  key={font.id}
                  onClick={() => handleFontFamilyChange(font.id)}
                   className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${settings.fontFamily === font.id ? 'bg-indigo-600 text-white' : `${themeClasses.buttonSecondary}`}`}
                  style={{ fontFamily: font.id === 'system-ui' ? 'inherit' : font.id }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>

          {/* 字重 */}
          <div>
            <div className="flex items-center justify-between mb-2">
               <span className={`font-medium ${themeClasses.text}`}>Font Weight</span>
               <span className={`text-xs ${themeClasses.mutedText}`}>
                 {fontWeights.find(fw => fw.value === settings.fontWeight)?.label || 'Regular'}
               </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {fontWeights.map((fw) => (
                <button
                  key={fw.value}
                  onClick={() => handleFontWeightChange(fw.value)}
                   className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${settings.fontWeight === fw.value ? 'bg-indigo-600 text-white' : `${themeClasses.buttonSecondary}`}`}
                  style={{ fontWeight: fw.value }}
                >
                  {fw.label}
                </button>
              ))}
            </div>
          </div>
        </div>

         {/* 预览区域 */}
         <div className={`mt-8 pt-6 border-t ${themeClasses.border}`}>
           <h3 className={`text-sm font-bold mb-3 ${themeClasses.text}`}>Preview</h3>
           <div 
             className={`p-4 rounded-xl border ${themeClasses.mutedBg} ${themeClasses.border}`}
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              fontFamily: settings.fontFamily === 'system-ui' ? 'inherit' : settings.fontFamily,
              fontWeight: settings.fontWeight,
            }}
          >
            <p className="mb-3">
              The quick brown fox jumps over the lazy dog. This sentence contains all letters of the alphabet.
            </p>
            <p className="text-slate-600">
              This is how your text will appear with the current settings. Adjust the sliders to find your perfect reading experience.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppearanceSettings;