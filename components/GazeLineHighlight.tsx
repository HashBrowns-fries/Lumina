import React, { useMemo } from 'react';
import { GazeData } from '../services/eyeTrackingService';

interface GazeLineHighlightProps {
  gazeData: GazeData | null;
  isEnabled: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}

interface ParagraphElement {
  type: 'p';
  key: string;
  top: number;
  height: number;
  element: HTMLParagraphElement;
}

const GazeLineHighlight: React.FC<GazeLineHighlightProps> = ({
  gazeData,
  isEnabled,
  containerRef,
  children
}) => {
  const paragraphs = useMemo<ParagraphElement[]>(() => {
    if (!containerRef.current) return [];
    
    const container = containerRef.current;
    const paras = Array.from(container.querySelectorAll('p'));
    
    return paras.map((p, idx) => {
      const rect = p.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      return {
        type: 'p' as const,
        key: p.key || `p-${idx}`,
        top: rect.top - containerRect.top + container.scrollTop,
        height: rect.height,
        element: p
      };
    });
  }, [containerRef, children]);

  const highlightedLine = useMemo(() => {
    if (!gazeData?.valid || !isEnabled || paragraphs.length === 0) {
      return null;
    }

    const { y } = gazeData;
    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const relativeY = y - containerRect.top + container.scrollTop;

    let currentLineTop = 0;
    for (const para of paragraphs) {
      const paraBottom = para.top + para.height;
      
      if (relativeY >= para.top && relativeY < paraBottom) {
        const lineHeight = 28;
        const relativeLine = Math.floor((relativeY - para.top) / lineHeight);
        const lineTop = para.top + relativeLine * lineHeight;
        
        return {
          top: lineTop,
          height: Math.min(lineHeight, paraBottom - lineTop)
        };
      }
      
      currentLineTop = paraBottom;
    }

    return null;
  }, [gazeData, isEnabled, paragraphs, containerRef]);

  return (
    <div className="relative">
      {children}
      
      {isEnabled && highlightedLine && (
        <>
          {/* Highlight overlay */}
          <div
            className="absolute left-0 right-0 pointer-events-none transition-all duration-150"
            style={{
              top: `${highlightedLine.top}px`,
              height: `${highlightedLine.height}px`,
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              borderLeft: '3px solid rgba(99, 102, 241, 0.8)',
            }}
          />
          
          {/* Gaze position indicator */}
          {gazeData?.valid && (
            <div
              className="fixed pointer-events-none transition-all duration-100 z-50"
              style={{
                left: gazeData.x,
                top: gazeData.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="w-3 h-3 rounded-full bg-indigo-500 opacity-70 animate-pulse" />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GazeLineHighlight;
