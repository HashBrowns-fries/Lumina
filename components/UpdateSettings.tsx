// @ts-nocheck
import React, { useState } from 'react';
import { RefreshCw, Download, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { UserSettings } from '../services/dataModels';

const CURRENT_VERSION = '1.3.1';
const REPO_OWNER = 'HashBrowns-fries';
const REPO_NAME = 'Lumina';

interface UpdateSettingsProps {
  settings: UserSettings;
}

interface UpdateInfo {
  available: boolean;
  version?: string;
  body?: string;
  date?: string;
}

const UpdateSettings: React.FC<UpdateSettingsProps> = ({ settings }) => {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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
      default:
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

  const checkForUpdates = async () => {
    setChecking(true);
    setError(null);
    setUpdateInfo(null);

    try {
      const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const data = await response.json();
      const latestVersion = data.tag_name?.replace('v', '') || data.name;
      
      if (latestVersion !== CURRENT_VERSION) {
        setUpdateInfo({
          available: true,
          version: latestVersion,
          body: data.body || '',
          date: data.published_at
        });
      } else {
        setUpdateInfo({
          available: false
        });
      }
    } catch (err) {
      console.error('Update check failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    if (!updateInfo?.available) return;

    setDownloading(true);
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
      const data = await response.json();
      
      const windowsAsset = data.assets?.find((a: any) => a.name?.endsWith('.exe') || a.name?.endsWith('.msi'));
      
      if (windowsAsset?.browser_download_url) {
        window.open(windowsAsset.browser_download_url, '_blank');
      } else {
        window.open(data.html_url, '_blank');
      }
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to download update');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={`border rounded-3xl p-6 shadow-sm ${themeClasses.cardBg} ${themeClasses.border}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
          <RefreshCw size={20} />
        </div>
        <div>
          <h2 className={`text-lg font-bold ${themeClasses.text}`}>Updates</h2>
          <p className={`text-xs font-medium ${themeClasses.mutedText}`}>Check for new versions</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className={`rounded-xl p-4 ${themeClasses.mutedBg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info size={16} className={themeClasses.mutedText} />
              <span className={`text-sm ${themeClasses.text}`}>
                Current version: <span className="font-mono font-bold">{CURRENT_VERSION}</span>
              </span>
            </div>
            <button
              onClick={checkForUpdates}
              disabled={checking}
              className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                checking 
                  ? 'opacity-50 cursor-not-allowed' 
                  : themeClasses.buttonPrimary
              }`}
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl p-4 bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {updateInfo && (
          <div className={`rounded-xl p-4 border ${
            updateInfo.available 
              ? 'bg-emerald-50 border-emerald-200' 
              : 'bg-emerald-50 border-emerald-200'
          }`}>
            {updateInfo.available ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Download size={16} />
                  <span className="font-bold">Update Available!</span>
                </div>
                <div className={`text-sm ${themeClasses.text}`}>
                  <p>Version: <span className="font-mono font-bold">{updateInfo.version}</span></p>
                  {updateInfo.date && <p>Release date: {updateInfo.date}</p>}
                  {updateInfo.body && (
                    <div className={`mt-2 p-3 rounded-lg ${themeClasses.mutedBg}`}>
                      <p className="whitespace-pre-wrap text-xs">{updateInfo.body}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={downloadAndInstall}
                  disabled={downloading}
                  className={`w-full px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    downloading
                      ? 'opacity-50 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <Download size={14} />
                  {downloading ? 'Downloading...' : 'Download & Install'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={16} />
                <span className="text-sm font-medium">You're running the latest version!</span>
              </div>
            )}
          </div>
        )}

        <div className={`text-xs ${themeClasses.mutedText} p-3 rounded-lg ${themeClasses.mutedBg}`}>
          <p>To configure automatic updates, you need to set up an update server and add your public key to tauri.conf.json.</p>
          <p className="mt-1">See the Tauri updater documentation for more information.</p>
        </div>
      </div>
    </section>
  );
};

export default UpdateSettings;
