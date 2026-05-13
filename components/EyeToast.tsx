import React, { useState, useEffect, useCallback } from 'react';
import { Eye, X } from 'lucide-react';
import { GazeData } from '../services/eyeTrackingService';

interface EyeToastProps {
  gazeData: GazeData | null;
  isEnabled: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  theme?: 'light' | 'dark' | 'sepia' | 'night' | 'contrast' | 'paper' | 'auto';
}

const AWAY_THRESHOLD_MS = 3000;
const STILL_THRESHOLD_MS = 10000;

const EyeToast: React.FC<EyeToastProps> = ({
  gazeData,
  isEnabled,
  containerRef,
  theme = 'light'
}) => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [awayStartTime, setAwayStartTime] = useState<number | null>(null);
  const [stillStartTime, setStillStartTime] = useState<number | null>(null);

  const getThemeClasses = () => {
    switch (theme) {
      case 'dark': return 'bg-slate-800 text-slate-100 border-slate-700';
      case 'night': return 'bg-indigo-900 text-indigo-100 border-indigo-800';
      case 'sepia': return 'bg-amber-200 text-amber-900 border-amber-300';
      case 'contrast': return 'bg-black text-white border-white';
      case 'paper': return 'bg-stone-200 text-stone-800 border-stone-300';
      default: return 'bg-white text-slate-800 border-slate-200';
    }
  };

  const dismissToast = useCallback(() => {
    setShowToast(false);
    setAwayStartTime(null);
    setStillStartTime(null);
  }, []);

  useEffect(() => {
    if (!isEnabled || !gazeData) {
      setShowToast(false);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const isInReadingArea = 
      gazeData.x >= containerRect.left &&
      gazeData.x <= containerRect.right &&
      gazeData.y >= containerRect.top &&
      gazeData.y <= containerRect.bottom;

    const now = Date.now();

    if (!isInReadingArea) {
      if (awayStartTime === null) {
        setAwayStartTime(now);
      } else if (now - awayStartTime > AWAY_THRESHOLD_MS && !showToast) {
        setToastMessage('回来~ 你的目光游离了');
        setShowToast(true);
        setStillStartTime(null);
      }
    } else {
      if (showToast) {
        dismissToast();
      }
      
      if (gazeData.fixation && gazeData.valid) {
        if (stillStartTime === null) {
          setStillStartTime(now);
        } else if (now - stillStartTime > STILL_THRESHOLD_MS && !showToast) {
          setToastMessage('休息一下？ 你已经注视很久了');
          setShowToast(true);
        }
      } else {
        setStillStartTime(null);
      }
    }
  }, [gazeData, isEnabled, containerRef, awayStartTime, showToast, dismissToast, stillStartTime]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        dismissToast();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast, dismissToast]);

  if (!isEnabled) return null;

  return (
    <>
      {showToast && (
        <div 
          className={`fixed bottom-8 right-8 z-50 max-w-sm animate-slide-up ${getThemeClasses()} border-2 rounded-2xl shadow-2xl`}
        >
          <div className="p-4 flex items-start gap-3">
            <div className="p-2 bg-indigo-100 rounded-full shrink-0">
              <Eye size={20} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{toastMessage}</p>
              <p className="text-xs opacity-60 mt-1">
                点击任意处关闭
              </p>
            </div>
            <button 
              onClick={dismissToast}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default EyeToast;
