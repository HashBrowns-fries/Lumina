import React, { useState, useEffect, useMemo } from 'react';
import { GazeData } from '../services/eyeTrackingService';

interface ReadingHeatmapProps {
  gazeData: GazeData | null;
  isEnabled: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  totalPages: number;
  currentPage: number;
  theme?: 'light' | 'dark' | 'sepia' | 'night' | 'contrast' | 'paper' | 'auto';
}

interface PageStats {
  pageIndex: number;
  fixationCount: number;
  totalTime: number;
  lastVisitTime: number;
}

const ReadingHeatmap: React.FC<ReadingHeatmapProps> = ({
  gazeData,
  isEnabled,
  containerRef,
  totalPages,
  currentPage,
  theme = 'light'
}) => {
  const [pageStats, setPageStats] = useState<PageStats[]>([]);
  const [hoveredPage, setHoveredPage] = useState<number | null>(null);

  useEffect(() => {
    if (!isEnabled || !gazeData?.valid) return;

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const isInReadingArea = 
      gazeData.x >= containerRect.left &&
      gazeData.x <= containerRect.right &&
      gazeData.y >= containerRect.top &&
      gazeData.y <= containerRect.bottom;

    if (isInReadingArea) {
      setPageStats(prev => {
        const newStats = [...prev];
        const pageIndex = currentPage;
        
        if (!newStats[pageIndex]) {
          newStats[pageIndex] = {
            pageIndex,
            fixationCount: 0,
            totalTime: 0,
            lastVisitTime: Date.now()
          };
        }

        if (gazeData.fixation) {
          newStats[pageIndex].fixationCount++;
        }
        newStats[pageIndex].totalTime += 100;
        newStats[pageIndex].lastVisitTime = Date.now();

        return newStats;
      });
    }
  }, [gazeData, isEnabled, currentPage, containerRef]);

  const maxFixation = useMemo(() => {
    return Math.max(...pageStats.map(s => s.fixationCount), 1);
  }, [pageStats]);

  const getHeatmapColor = (fixationCount: number): string => {
    const intensity = fixationCount / maxFixation;
    
    if (theme === 'dark' || theme === 'night') {
      if (intensity < 0.25) return 'bg-indigo-900/30';
      if (intensity < 0.5) return 'bg-indigo-700/50';
      if (intensity < 0.75) return 'bg-indigo-500/70';
      return 'bg-indigo-400/90';
    }
    
    if (intensity < 0.25) return 'bg-amber-100';
    if (intensity < 0.5) return 'bg-amber-200';
    if (intensity < 0.75) return 'bg-amber-300';
    return 'bg-amber-500';
  };

  const getTextColor = (fixationCount: number): string => {
    const intensity = fixationCount / maxFixation;
    if (intensity < 0.5) return 'text-slate-600';
    return 'text-slate-800';
  };

  if (!isEnabled || totalPages <= 1) return null;

  const getThemeClasses = () => {
    switch (theme) {
      case 'dark': return 'bg-slate-800 border-slate-700 text-slate-200';
      case 'night': return 'bg-indigo-900 border-indigo-800 text-indigo-200';
      case 'sepia': return 'bg-amber-100 border-amber-200 text-amber-900';
      case 'contrast': return 'bg-black border-white text-white';
      case 'paper': return 'bg-stone-100 border-stone-200 text-stone-800';
      default: return 'bg-white border-slate-200 text-slate-700';
    }
  };

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 p-3 rounded-xl border shadow-lg ${getThemeClasses()}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
          阅读热力图
        </span>
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => {
          const stats = pageStats[i];
          const fixationCount = stats?.fixationCount || 0;
          const isActive = i === currentPage;
          
          return (
            <div
              key={i}
              className={`
                flex flex-col items-center justify-center
                w-8 h-8 rounded text-xs font-medium
                cursor-pointer transition-all duration-200
                ${getHeatmapColor(fixationCount)}
                ${getTextColor(fixationCount)}
                ${isActive ? 'ring-2 ring-indigo-500 scale-110' : 'hover:scale-105'}
              `}
              onMouseEnter={() => setHoveredPage(i)}
              onMouseLeave={() => setHoveredPage(null)}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
      
      {hoveredPage !== null && pageStats[hoveredPage] && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
          <div>页 {hoveredPage + 1}</div>
          <div className="opacity-70">
            注视: {pageStats[hoveredPage].fixationCount} | 
            时间: {Math.round(pageStats[hoveredPage].totalTime / 1000)}s
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingHeatmap;
