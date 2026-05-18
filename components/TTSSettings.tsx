// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Volume2, CheckCircle2, AlertCircle, Loader2, Play, Square } from 'lucide-react';
import { UserSettings } from '../services/dataModels';
import { ttsService, TTSStatus } from '../services/ttsService';

interface TTSSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

const TTSSettings: React.FC<TTSSettingsProps> = ({ settings, onUpdate }) => {
  const [status, setStatus] = useState<TTSStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [installLog, setInstallLog] = useState<string>('');
  const [testPlaying, setTestPlaying] = useState(false);

  const ttsEnabled = settings.ttsEnabled ?? false;

  const getThemeClasses = () => {
    switch (settings.theme) {
      case 'dark':
        return {
          text: 'text-slate-100', border: 'border-slate-700', cardBg: 'bg-slate-800',
          mutedText: 'text-slate-400', mutedBg: 'bg-slate-800/50',
          buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
          inputBg: 'bg-slate-700 border-slate-600 text-slate-100',
          successBg: 'bg-emerald-900/40 border-emerald-700 text-emerald-300',
          errorBg: 'bg-red-900/40 border-red-700 text-red-300',
          toggleOn: 'bg-indigo-600', toggleOff: 'bg-slate-600',
        };
      case 'night':
        return {
          text: 'text-indigo-100', border: 'border-indigo-800', cardBg: 'bg-indigo-900',
          mutedText: 'text-indigo-400', mutedBg: 'bg-indigo-900/50',
          buttonPrimary: 'bg-indigo-700 text-white hover:bg-indigo-800',
          inputBg: 'bg-indigo-800 border-indigo-700 text-indigo-100',
          successBg: 'bg-emerald-900/40 border-emerald-700 text-emerald-300',
          errorBg: 'bg-red-900/40 border-red-700 text-red-300',
          toggleOn: 'bg-indigo-500', toggleOff: 'bg-indigo-700',
        };
      case 'contrast':
        return {
          text: 'text-white', border: 'border-white', cardBg: 'bg-gray-900',
          mutedText: 'text-gray-400', mutedBg: 'bg-gray-900/50',
          buttonPrimary: 'bg-white text-black hover:bg-gray-200',
          inputBg: 'bg-gray-800 border-gray-600 text-white',
          successBg: 'bg-emerald-900/40 border-emerald-500 text-emerald-300',
          errorBg: 'bg-red-900/40 border-red-500 text-red-300',
          toggleOn: 'bg-white', toggleOff: 'bg-gray-700',
        };
      case 'sepia':
        return {
          text: 'text-amber-900', border: 'border-amber-200', cardBg: 'bg-amber-100',
          mutedText: 'text-amber-700', mutedBg: 'bg-amber-100/50',
          buttonPrimary: 'bg-amber-600 text-white hover:bg-amber-700',
          inputBg: 'bg-amber-50 border-amber-300 text-amber-900',
          successBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          errorBg: 'bg-red-50 border-red-200 text-red-700',
          toggleOn: 'bg-amber-600', toggleOff: 'bg-amber-300',
        };
      case 'paper':
        return {
          text: 'text-stone-800', border: 'border-stone-200', cardBg: 'bg-stone-100',
          mutedText: 'text-stone-600', mutedBg: 'bg-stone-100/50',
          buttonPrimary: 'bg-stone-600 text-white hover:bg-stone-700',
          inputBg: 'bg-stone-50 border-stone-300 text-stone-800',
          successBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          errorBg: 'bg-red-50 border-red-200 text-red-700',
          toggleOn: 'bg-stone-600', toggleOff: 'bg-stone-300',
        };
      default:
        return {
          text: 'text-slate-900', border: 'border-slate-200', cardBg: 'bg-white',
          mutedText: 'text-slate-500', mutedBg: 'bg-slate-100/50',
          buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
          inputBg: 'bg-white border-slate-300 text-slate-800',
          successBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          errorBg: 'bg-red-50 border-red-200 text-red-700',
          toggleOn: 'bg-indigo-600', toggleOff: 'bg-slate-300',
        };
    }
  };

  const t = getThemeClasses();

  const checkServer = async () => {
    setChecking(true);
    const s = await ttsService.getStatus();
    setStatus(s);
    setChecking(false);
  };

  useEffect(() => {
    if (ttsEnabled) checkServer();
  }, [ttsEnabled]);

  const handleToggle = () => {
    const next = !ttsEnabled;
    onUpdate({ ttsEnabled: next });
    if (next) checkServer();
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setInstallLog(`Copied: ${cmd}`);
      setTimeout(() => setInstallLog(''), 2000);
    });
  };

  const handleTestVoice = async () => {
    if (!status?.ready) return;
    setTestPlaying(true);
    try {
      const res = await fetch('http://127.0.0.1:3009/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello, this is a test of the text to speech system.', voice_style: settings.ttsVoiceStyle || '' }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const buf = await res.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(buf);
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);
      src.onended = () => setTestPlaying(false);
      src.start();
    } catch {
      setTestPlaying(false);
    }
  };

  const serverReady = status?.ready === true;
  const serverLoading = status?.loading === true;

  return (
    <section className={`border rounded-3xl p-6 shadow-sm ${t.cardBg} ${t.border}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-400 to-purple-500 text-white rounded-xl shadow-sm">
            <Volume2 size={20} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${t.text}`}>Text-to-Speech</h2>
            <p className={`text-xs font-medium ${t.mutedText}`}>VoxCPM audiobook reader (requires GPU)</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${ttsEnabled ? t.toggleOn : t.toggleOff}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${ttsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {ttsEnabled && (
        <div className="space-y-4">
          {/* Server status */}
          <div className={`rounded-xl p-4 border ${
            serverReady ? t.successBg : serverLoading ? t.mutedBg + ' border ' + t.border : t.errorBg
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {checking ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : serverReady ? (
                  <CheckCircle2 size={16} />
                ) : serverLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <AlertCircle size={16} />
                )}
                <span className="text-sm font-medium">
                  {checking ? 'Checking server...' :
                   serverReady ? `Server ready — ${status?.modelName} on ${status?.device}` :
                   serverLoading ? 'Model loading...' :
                   'Server not running'}
                </span>
              </div>
              <button
                onClick={checkServer}
                disabled={checking}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${t.buttonPrimary} disabled:opacity-50`}
              >
                Refresh
              </button>
            </div>
            {status?.error && !serverReady && (
              <p className="text-xs mt-2 opacity-80">{status.error}</p>
            )}
          </div>

          {/* Not running — show setup instructions */}
          {!serverReady && !serverLoading && !checking && (
            <div className={`rounded-xl p-4 ${t.mutedBg} space-y-3`}>
              <p className={`text-sm font-medium ${t.text}`}>Setup</p>

              <div className="space-y-2">
                <p className={`text-xs ${t.mutedText}`}>
                  1. Install dependencies (torch + VoxCPM, ~5GB GPU required):
                </p>
                <div
                  onClick={() => handleCopyCommand('npm run setup:tts')}
                  className={`block text-xs px-3 py-2 rounded-lg ${t.inputBg} border font-mono cursor-pointer hover:opacity-80`}
                >
                  npm run setup:tts
                  <span className={`ml-2 text-[10px] ${t.mutedText}`}>click to copy</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className={`text-xs ${t.mutedText}`}>
                  2. Start the TTS server:
                </p>
                <div
                  onClick={() => handleCopyCommand('npm run dev:tts-api')}
                  className={`block text-xs px-3 py-2 rounded-lg ${t.inputBg} border font-mono cursor-pointer hover:opacity-80`}
                >
                  npm run dev:tts-api
                  <span className={`ml-2 text-[10px] ${t.mutedText}`}>click to copy</span>
                </div>
              </div>

              {installLog && (
                <p className={`text-xs ${t.mutedText}`}>{installLog}</p>
              )}
            </div>
          )}

          {/* Voice style setting */}
          {serverReady && (
            <div className="space-y-3">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${t.text}`}>Voice Style</label>
                <input
                  type="text"
                  value={settings.ttsVoiceStyle || ''}
                  onChange={(e) => onUpdate({ ttsVoiceStyle: e.target.value })}
                  placeholder="e.g. warm female voice, 温暖女声"
                  className={`w-full px-3 py-2 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-indigo-400 ${t.inputBg}`}
                />
                <p className={`text-xs mt-1 ${t.mutedText}`}>VoxCPM Voice Design — describe the voice style in natural language</p>
              </div>

              <button
                onClick={handleTestVoice}
                disabled={testPlaying}
                className={`px-4 py-2 text-sm rounded-xl font-semibold flex items-center gap-2 transition-all ${t.buttonPrimary} disabled:opacity-50`}
              >
                {testPlaying ? <Square size={14} /> : <Play size={14} />}
                {testPlaying ? 'Playing...' : 'Test Voice'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default TTSSettings;
