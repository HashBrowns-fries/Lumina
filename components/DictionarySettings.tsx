// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Info } from 'lucide-react';
import { UserSettings } from '../services/dataModels';

interface Dictionary {
  code: string;
  name: string;
  hasLocal: boolean;
  wordCount: number;
  senseCount: number;
  formCount: number;
}

interface DictionarySettingsProps {
  settings: UserSettings;
}

const DictionarySettings: React.FC<DictionarySettingsProps> = ({ settings }) => {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const theme = settings?.theme || 'auto';
  const isDark = theme === 'dark' || theme === 'night';

  useEffect(() => {
    loadDictionaries();
  }, []);

  const loadDictionaries = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('http://localhost:3011/api/dictionary/installed');
      if (res.ok) {
        const installed = await res.json();
        setDictionaries(installed.map((d: any) => ({
          code: d.code,
          name: d.name,
          hasLocal: true,
          wordCount: d.word_count || 0,
          senseCount: d.sense_count || 0,
          formCount: d.form_count || 0,
        })));
      } else {
        setDictionaries([]);
      }
    } catch {
      setError('Dictionary API unavailable. Ensure the service is running on port 3011.');
      setDictionaries([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        Loading dictionaries...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 rounded-lg ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
          Local Dictionaries
        </h3>
        <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Offline dictionaries for fast word lookup. Dictionaries are stored in the <code className="px-1 py-0.5 rounded bg-opacity-20 bg-slate-500">dict/</code> directory.
        </p>

        {dictionaries.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No dictionaries found</p>
            <p className="text-sm mt-1">Add dictionary files to the dict/ directory</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dictionaries.map((dict: Dictionary) => (
              <div
                key={dict.code}
                className={`p-3 rounded-lg flex items-center justify-between ${
                  isDark ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-white hover:bg-slate-50'
                } border ${isDark ? 'border-slate-600' : 'border-slate-200'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${dict.hasLocal ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'}`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                      {dict.name || dict.code}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {dict.code.toUpperCase()} • {dict.wordCount?.toLocaleString() || 0} words
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <HardDrive className="w-3 h-3" />
                    Local
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`p-4 rounded-lg ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border`}>
        <div className="flex items-start gap-3">
          <Info className={`w-5 h-5 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <div className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
            <p className="font-semibold mb-1">Dictionary Files</p>
            <p>Dictionaries are loaded from the dict/[language]/[code]_dict.db directory structure.</p>
            <p className="mt-2">Example: dict/German/de_dict.db</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DictionarySettings;
