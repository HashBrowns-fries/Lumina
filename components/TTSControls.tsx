// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Volume2, Loader2, Settings, X } from 'lucide-react';
import { ttsService, TTSState, TTSPlaybackState } from '../services/ttsService';

interface TTSControlsProps {
  paragraphs: string[][];
  theme: string;
  onParagraphChange?: (paragraphIndex: number | null) => void;
}

const TTSControls: React.FC<TTSControlsProps> = ({ paragraphs, theme, onParagraphChange }) => {
  const [ttsState, setTtsState] = useState<TTSState>({
    playbackState: 'idle',
    currentParagraphIndex: null,
    totalParagraphs: 0,
    available: false,
  });
  const [available, setAvailable] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const [showVoicePopover, setShowVoicePopover] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState(() =>
    localStorage.getItem('lumina_tts_voice_style') || ''
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  // Check TTS server on mount — only poll while server responds
  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let failCount = 0;
    const check = async () => {
      const status = await ttsService.getStatus();
      if (!mounted) return;
      setAvailable(status.ready);
      setServerLoading(status.loading);
      if (status.ready || status.loading) {
        failCount = 0;
      } else {
        failCount++;
        if (failCount >= 2 && interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    };
    check();
    interval = setInterval(check, 15000);
    return () => { mounted = false; if (interval) clearInterval(interval); };
  }, []);

  // Subscribe to TTS state changes
  useEffect(() => {
    return ttsService.subscribe((state) => {
      setTtsState(state);
      onParagraphChange?.(state.currentParagraphIndex);
    });
  }, [onParagraphChange]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowVoicePopover(false);
      }
    };
    if (showVoicePopover) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVoicePopover]);

  const handlePlay = () => {
    if (ttsState.playbackState === 'paused') {
      ttsService.resume();
    } else {
      ttsService.setParagraphs(paragraphs, voiceStyle);
      ttsService.play();
    }
  };

  const handlePause = () => ttsService.pause();
  const handleStop = () => ttsService.stop();
  const handleNext = () => ttsService.next();
  const handlePrev = () => ttsService.prev();

  const handleVoiceStyleSave = (style: string) => {
    setVoiceStyle(style);
    localStorage.setItem('lumina_tts_voice_style', style);
    ttsService.setVoiceStyle(style);
    setShowVoicePopover(false);
  };

  const isPlaying = ttsState.playbackState === 'playing';
  const isPaused = ttsState.playbackState === 'paused';
  const isLoading = ttsState.playbackState === 'loading';
  const isActive = isPlaying || isPaused || isLoading;

  const btnBase = `p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed`;
  const btnTheme =
    theme === 'dark' ? 'hover:bg-slate-600 text-slate-200' :
    theme === 'night' ? 'hover:bg-indigo-700 text-indigo-200' :
    theme === 'contrast' ? 'hover:bg-gray-800 text-white' :
    theme === 'sepia' ? 'hover:bg-amber-200 text-amber-800' :
    theme === 'paper' ? 'hover:bg-stone-200 text-stone-700' :
    'hover:bg-slate-100 text-slate-600';

  const textColor =
    theme === 'dark' ? 'text-slate-400' :
    theme === 'night' ? 'text-indigo-400' :
    theme === 'contrast' ? 'text-gray-400' :
    theme === 'sepia' ? 'text-amber-600' :
    theme === 'paper' ? 'text-stone-500' :
    'text-slate-400';

  const borderColor =
    theme === 'dark' ? 'border-slate-600' :
    theme === 'night' ? 'border-indigo-700' :
    theme === 'contrast' ? 'border-gray-700' :
    theme === 'sepia' ? 'border-amber-300' :
    theme === 'paper' ? 'border-stone-300' :
    'border-slate-200';

  if (!available && !serverLoading) return null;

  return (
    <div className={`flex items-center gap-1 pr-3 mr-3 border-r ${borderColor}`}>
      {serverLoading ? (
        <div className={`flex items-center gap-2 px-2 ${textColor}`}>
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">TTS loading...</span>
        </div>
      ) : (
        <>
          <button
            onClick={handlePrev}
            disabled={!isActive || ttsState.currentParagraphIndex === 0}
            className={`${btnBase} ${btnTheme}`}
            title="Previous paragraph"
          >
            <SkipBack size={14} />
          </button>

          {isLoading ? (
            <div className={`${btnBase} ${btnTheme}`}>
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : isPlaying ? (
            <button onClick={handlePause} className={`${btnBase} ${btnTheme}`} title="Pause">
              <Pause size={16} />
            </button>
          ) : (
            <button onClick={handlePlay} className={`${btnBase} ${btnTheme}`} title={isPaused ? 'Resume' : 'Play'}>
              <Play size={16} />
            </button>
          )}

          {isActive && (
            <button onClick={handleStop} className={`${btnBase} ${btnTheme}`} title="Stop">
              <Square size={14} />
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={!isActive || ttsState.currentParagraphIndex === paragraphs.length - 1}
            className={`${btnBase} ${btnTheme}`}
            title="Next paragraph"
          >
            <SkipForward size={14} />
          </button>

          {/* Voice style settings */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowVoicePopover(!showVoicePopover)}
              className={`${btnBase} ${btnTheme} ${voiceStyle ? 'opacity-100' : 'opacity-60'}`}
              title="Voice settings"
            >
              <Volume2 size={14} />
            </button>

            {showVoicePopover && (
              <VoicePopover
                theme={theme}
                voiceStyle={voiceStyle}
                onSave={handleVoiceStyleSave}
                onClose={() => setShowVoicePopover(false)}
              />
            )}
          </div>

          {isActive && ttsState.currentParagraphIndex !== null && (
            <span className={`text-xs ml-1 ${textColor}`}>
              {ttsState.currentParagraphIndex + 1}/{paragraphs.length}
            </span>
          )}
        </>
      )}
    </div>
  );
};

interface VoicePopoverProps {
  theme: string;
  voiceStyle: string;
  onSave: (style: string) => void;
  onClose: () => void;
}

const VoicePopover: React.FC<VoicePopoverProps> = ({ theme, voiceStyle, onSave, onClose }) => {
  const [value, setValue] = useState(voiceStyle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const bgColor =
    theme === 'dark' ? 'bg-slate-800 border-slate-600' :
    theme === 'night' ? 'bg-indigo-900 border-indigo-700' :
    theme === 'contrast' ? 'bg-black border-gray-600' :
    theme === 'sepia' ? 'bg-amber-50 border-amber-200' :
    theme === 'paper' ? 'bg-stone-50 border-stone-200' :
    'bg-white border-slate-200';

  const inputBg =
    theme === 'dark' ? 'bg-slate-700 text-slate-100 border-slate-600 placeholder-slate-500' :
    theme === 'night' ? 'bg-indigo-800 text-indigo-100 border-indigo-600 placeholder-indigo-500' :
    theme === 'contrast' ? 'bg-gray-900 text-white border-gray-600 placeholder-gray-500' :
    theme === 'sepia' ? 'bg-amber-100 text-amber-900 border-amber-300 placeholder-amber-500' :
    theme === 'paper' ? 'bg-stone-100 text-stone-800 border-stone-300 placeholder-stone-500' :
    'bg-white text-slate-800 border-slate-300 placeholder-slate-400';

  const labelColor =
    theme === 'dark' ? 'text-slate-300' :
    theme === 'night' ? 'text-indigo-300' :
    theme === 'contrast' ? 'text-gray-300' :
    theme === 'sepia' ? 'text-amber-700' :
    theme === 'paper' ? 'text-stone-600' :
    'text-slate-600';

  const presets = [
    'warm female voice',
    'deep male narrator',
    '温暖女声',
    '沉稳男声',
  ];

  return (
    <div className={`absolute bottom-full mb-2 right-0 w-64 rounded-xl shadow-xl border p-3 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${labelColor}`}>Voice Style</span>
        <button onClick={onClose} className={`p-1 rounded hover:opacity-70 ${labelColor}`}>
          <X size={12} />
        </button>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(value); }}
        placeholder="e.g. warm female voice"
        className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-indigo-400 ${inputBg}`}
      />
      <div className="flex flex-wrap gap-1 mt-2">
        {presets.map(p => (
          <button
            key={p}
            onClick={() => { setValue(p); onSave(p); }}
            className={`text-xs px-2 py-0.5 rounded-full border ${labelColor} hover:opacity-80 ${
              theme === 'dark' ? 'border-slate-600' :
              theme === 'night' ? 'border-indigo-700' :
              'border-slate-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSave(value)}
        className="w-full mt-2 py-1 text-xs font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
      >
        Apply
      </button>
    </div>
  );
};

export default TTSControls;
