// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, HardDrive, Info, FileText, Database, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { UserSettings } from '../services/dataModels';

const DICT_API = 'http://localhost:3011';

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

interface DownloadProgress {
  stage: string;
  progress: number;
  message: string;
  language_code: string;
}

const DICTIONARY_FILES: DictionaryFile[] = [
  { lang: 'Chinese', name: 'Chinese', code: 'zh', size: '~600MB', compressedSize: '143MB', downloadUrl: 'https://kaikki.org/dictionary/Chinese/kaikki.org-dictionary-Chinese.jsonl.gz' },
  { lang: 'Czech', name: 'Czech', code: 'cs', size: '~80MB', compressedSize: '12MB', downloadUrl: 'https://kaikki.org/dictionary/Czech/kaikki.org-dictionary-Czech.jsonl.gz' },
  { lang: 'Dutch', name: 'Dutch', code: 'nl', size: '~120MB', compressedSize: '18MB', downloadUrl: 'https://kaikki.org/dictionary/Dutch/kaikki.org-dictionary-Dutch.jsonl.gz' },
  { lang: 'French', name: 'French', code: 'fr', size: '~200MB', compressedSize: '48MB', downloadUrl: 'https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl.gz' },
  { lang: 'German', name: 'German', code: 'de', size: '~350MB', compressedSize: '85MB', downloadUrl: 'https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl.gz' },
  { lang: 'Greek', name: 'Greek', code: 'el', size: '~60MB', compressedSize: '10MB', downloadUrl: 'https://kaikki.org/dictionary/Greek/kaikki.org-dictionary-Greek.jsonl.gz' },
  { lang: 'Indonesian', name: 'Indonesian', code: 'id', size: '~30MB', compressedSize: '5MB', downloadUrl: 'https://kaikki.org/dictionary/Indonesian/kaikki.org-dictionary-Indonesian.jsonl.gz' },
  { lang: 'Italian', name: 'Italian', code: 'it', size: '~150MB', compressedSize: '25MB', downloadUrl: 'https://kaikki.org/dictionary/Italian/kaikki.org-dictionary-Italian.jsonl.gz' },
  { lang: 'Japanese', name: 'Japanese', code: 'ja', size: '~180MB', compressedSize: '43MB', downloadUrl: 'https://kaikki.org/dictionary/Japanese/kaikki.org-dictionary-Japanese.jsonl.gz' },
  { lang: 'Korean', name: 'Korean', code: 'ko', size: '~80MB', compressedSize: '14MB', downloadUrl: 'https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl.gz' },
  { lang: 'Kurdish', name: 'Kurdish', code: 'ku', size: '~40MB', compressedSize: '7MB', downloadUrl: 'https://kaikki.org/dictionary/Kurdish/kaikki.org-dictionary-Kurdish.jsonl.gz' },
  { lang: 'Malay', name: 'Malay', code: 'ms', size: '~20MB', compressedSize: '3MB', downloadUrl: 'https://kaikki.org/dictionary/Malay/kaikki.org-dictionary-Malay.jsonl.gz' },
  { lang: 'Polish', name: 'Polish', code: 'pl', size: '~100MB', compressedSize: '17MB', downloadUrl: 'https://kaikki.org/dictionary/Polish/kaikki.org-dictionary-Polish.jsonl.gz' },
  { lang: 'Portuguese', name: 'Portuguese', code: 'pt', size: '~120MB', compressedSize: '20MB', downloadUrl: 'https://kaikki.org/dictionary/Portuguese/kaikki.org-dictionary-Portuguese.jsonl.gz' },
  { lang: 'Russian', name: 'Russian', code: 'ru', size: '~200MB', compressedSize: '40MB', downloadUrl: 'https://kaikki.org/dictionary/Russian/kaikki.org-dictionary-Russian.jsonl.gz' },
  { lang: 'Spanish', name: 'Spanish', code: 'es', size: '~200MB', compressedSize: '35MB', downloadUrl: 'https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl.gz' },
  { lang: 'Thai', name: 'Thai', code: 'th', size: '~40MB', compressedSize: '7MB', downloadUrl: 'https://kaikki.org/dictionary/Thai/kaikki.org-dictionary-Thai.jsonl.gz' },
  { lang: 'Turkish', name: 'Turkish', code: 'tr', size: '~80MB', compressedSize: '14MB', downloadUrl: 'https://kaikki.org/dictionary/Turkish/kaikki.org-dictionary-Turkish.jsonl.gz' },
  { lang: 'Vietnamese', name: 'Vietnamese', code: 'vi', size: '~60MB', compressedSize: '10MB', downloadUrl: 'https://kaikki.org/dictionary/Vietnamese/kaikki.org-dictionary-Vietnamese.jsonl.gz' },
];

const DictionaryDownloadSettings: React.FC<DictionaryDownloadSettingsProps> = ({ settings }) => {
  const theme = settings?.theme || 'auto';
  const isDark = theme === 'dark' || theme === 'night';

  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [completedCodes, setCompletedCodes] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${DICT_API}/api/dictionary/installed`)
      .then(r => r.json())
      .then((installed: any[]) => {
        setCompletedCodes(new Set(installed.map(d => d.code)));
      }).catch(() => {});
  }, []);

  const pollStatus = (code: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${DICT_API}/api/dictionary/status/${code}`);
        const data = await res.json();
        if (data.stage === 'idle' || !data.stage) return;
        setProgress(data);
        if (data.stage === 'done') {
          setCompletedCodes(prev => new Set([...prev, code]));
          setDownloadingCode(null);
          setProgress(null);
          clearInterval(interval);
        } else if (data.stage === 'error') {
          setErrorMessage(data.message);
          setDownloadingCode(null);
          setProgress(null);
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
        setErrorMessage('Lost connection to dictionary API');
        setDownloadingCode(null);
        setProgress(null);
      }
    }, 1000);
  };

  const handleDownload = async (dict: DictionaryFile) => {
    setDownloadingCode(dict.code);
    setErrorMessage(null);
    setProgress({ stage: 'downloading', progress: 0, message: 'Starting...', language_code: dict.code });

    try {
      const res = await fetch(`${DICT_API}/api/dictionary/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: dict.downloadUrl, languageCode: dict.code, languageName: dict.lang }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      pollStatus(dict.code);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to start download. Is the dictionary API running?');
      setDownloadingCode(null);
      setProgress(null);
    }
  };

  const getButtonContent = (dict: DictionaryFile) => {
    if (completedCodes.has(dict.code)) {
      return (
        <span className="flex items-center gap-1.5 text-green-500">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Installed
        </span>
      );
    }
    if (downloadingCode === dict.code && progress) {
      return (
        <span className="flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {progress.stage === 'downloading' ? `${(progress.progress * 100).toFixed(0)}%` :
           progress.stage === 'decompressing' ? 'Unzipping...' :
           progress.stage === 'converting' ? 'Converting...' : 'Working...'}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5" />
        Install
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <h3 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
          <Download className="w-5 h-5 text-indigo-500" />
          Download Dictionaries
        </h3>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Click "Install" to download, decompress, and install dictionaries automatically.
        </p>
      </div>

      {errorMessage && (
        <div className={`p-3 rounded-lg flex items-start gap-2 ${isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} border`}>
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-medium">Error: </span>{errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-2 underline text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {downloadingCode && progress && (
        <div className={`p-3 rounded-lg ${isDark ? 'bg-indigo-900/20 border-indigo-800' : 'bg-indigo-50 border-indigo-200'} border`}>
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
              {progress.message}
            </span>
          </div>
          {progress.stage === 'downloading' && (
            <div className={`w-full h-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${Math.max(2, progress.progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className={`rounded-lg border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <h4 className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Available Dictionaries ({DICTIONARY_FILES.length})
          </h4>
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
                    {dict.compressedSize} compressed
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDownload(dict)}
                disabled={downloadingCode !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  completedCodes.has(dict.code)
                    ? isDark ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700'
                    : isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {getButtonContent(dict)}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Source: Kaikki.org (Wiktionary Data Mining)
            </span>
          </div>
          <button
            onClick={() => window.open('https://kaikki.org/dictionary/rawdata.html', '_blank')}
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
