// @ts-nocheck
import React from 'react';
import { Download, ExternalLink, HardDrive, Info, FileText, Database } from 'lucide-react';
import { UserSettings } from '../services/dataModels';

interface DictionaryDownloadSettingsProps {
  settings: UserSettings;
}

interface DictionaryFile {
  lang: string;
  name: string;
  code: string;
  size: string;
  compressedSize: string;
  downloadUrl: string;
}

const DICTIONARY_FILES: DictionaryFile[] = [
  // English Edition
  { lang: 'English', name: 'English', code: 'en', size: '21.4GB', compressedSize: '2.5GB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/en/raw-wiktextract-data.jsonl.gz' },
  // Other Languages
  { lang: 'Chinese', name: '中文', code: 'zh', size: '1.8GB', compressedSize: '211.3MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/zh/zh-extract.jsonl.gz' },
  { lang: 'Czech', name: 'Čeština', code: 'cs', size: '262.7MB', compressedSize: '36.3MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/cs/cs-extract.jsonl.gz' },
  { lang: 'Dutch', name: 'Nederlands', code: 'nl', size: '1.1GB', compressedSize: '119.6MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/nl/nl-extract.jsonl.gz' },
  { lang: 'French', name: 'Français', code: 'fr', size: '6.2GB', compressedSize: '668.7MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/fr/fr-extract.jsonl.gz' },
  { lang: 'German', name: 'Deutsch', code: 'de', size: '2.8GB', compressedSize: '282.2MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/de/de-extract.jsonl.gz' },
  { lang: 'Greek', name: 'Ελληνικά', code: 'el', size: '1.4GB', compressedSize: '99.4MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/el/el-extract.jsonl.gz' },
  { lang: 'Indonesian', name: 'Bahasa Indonesia', code: 'id', size: '28.5MB', compressedSize: '2.7MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/id/id-extract.jsonl.gz' },
  { lang: 'Italian', name: 'Italiano', code: 'it', size: '406.5MB', compressedSize: '35.1MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/it/it-extract.jsonl.gz' },
  { lang: 'Japanese', name: '日本語', code: 'ja', size: '385.0MB', compressedSize: '56.5MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/ja/ja-extract.jsonl.gz' },
  { lang: 'Korean', name: '한국어', code: 'ko', size: '182.8MB', compressedSize: '24.6MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/ko/ko-extract.jsonl.gz' },
  { lang: 'Kurdish', name: 'Kurdî', code: 'ku', size: '721.5MB', compressedSize: '60.7MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/ku/ku-extract.jsonl.gz' },
  { lang: 'Malay', name: 'Bahasa Melayu', code: 'ms', size: '41.4MB', compressedSize: '5.6MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/ms/ms-extract.jsonl.gz' },
  { lang: 'Polish', name: 'Polski', code: 'pl', size: '968.1MB', compressedSize: '123.0MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/pl/pl-extract.jsonl.gz' },
  { lang: 'Portuguese', name: 'Português', code: 'pt', size: '327.9MB', compressedSize: '33.3MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/pt/pt-extract.jsonl.gz' },
  { lang: 'Russian', name: 'Русский', code: 'ru', size: '2.3GB', compressedSize: '271.9MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/ru/ru-extract.jsonl.gz' },
  { lang: 'Simple English', name: 'Simple English', code: 'simple', size: '35.2MB', compressedSize: '4.3MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/simple/simple-extract.jsonl.gz' },
  { lang: 'Spanish', name: 'Español', code: 'es', size: '1.1GB', compressedSize: '95.3MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/es/es-extract.jsonl.gz' },
  { lang: 'Thai', name: 'ไทย', code: 'th', size: '1.5GB', compressedSize: '66.3MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/th/th-extract.jsonl.gz' },
  { lang: 'Turkish', name: 'Türkçe', code: 'tr', size: '641.9MB', compressedSize: '39.2MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/tr/tr-extract.jsonl.gz' },
  { lang: 'Vietnamese', name: 'Tiếng Việt', code: 'vi', size: '251.2MB', compressedSize: '29.9MB', downloadUrl: 'https://kaikki.org/dictionary/raw/downloads/vi/vi-extract.jsonl.gz' },
];

const DictionaryDownloadSettings: React.FC<DictionaryDownloadSettingsProps> = ({ settings }) => {
  const theme = settings?.theme || 'auto';
  const isDark = theme === 'dark' || theme === 'night';

  const openExternal = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <h3 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
          <Download className="w-5 h-5 text-indigo-500" />
          Download Dictionaries
        </h3>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Download machine-readable dictionary data from Kaikki.org (Wiktionary extracts).
          After downloading, place files in the <code className="px-1 py-0.5 rounded bg-opacity-20 bg-slate-500">dict/</code> directory.
        </p>
      </div>

      {/* Download Instructions */}
      <div className={`p-4 rounded-lg ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border`}>
        <div className="flex items-start gap-3">
          <Info className={`w-5 h-5 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          <div className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
            <p className="font-semibold mb-1">How to use downloaded dictionaries</p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>Click the download link for your desired language</li>
              <li>Save the .gz file to your Lumina's <code className="px-1 py-0.5 rounded bg-opacity-20 bg-slate-500">dict/</code> directory</li>
              <li>Decompress the file (use 7-Zip or similar)</li>
              <li>Rename to <code className="px-1 py-0.5 rounded bg-opacity-20 bg-slate-500">[code]_dict.db</code> (e.g., <code className="px-1 py-0.5 rounded bg-opacity-20 bg-slate-500">de_dict.db</code>)</li>
              <li>Restart Lumina to load the dictionary</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Dictionary File List */}
      <div className={`rounded-lg border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h4 className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Available Dictionaries ({DICTIONARY_FILES.length})
          </h4>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Data extracted from Wiktionary, updated 2026-05-01
          </p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-96 overflow-y-auto">
          {DICTIONARY_FILES.map((dict) => (
            <div
              key={dict.code}
              className={`px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {dict.name}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {dict.code.toUpperCase()}
                    </span>
                  </div>
                  <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {dict.compressedSize} compressed • {dict.size} original
                  </div>
                </div>
              </div>
              <button
                onClick={() => openExternal(dict.downloadUrl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  isDark
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Source Link */}
      <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Source: Kaikki.org (Wiktionary Data Mining)
            </span>
          </div>
          <button
            onClick={() => openExternal('https://kaikki.org/dictionary/rawdata.html')}
            className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
          >
            Visit Kaikki.org
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DictionaryDownloadSettings;