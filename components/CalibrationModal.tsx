import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, RefreshCw, Target } from 'lucide-react';
import { CalibrationPoint } from '../services/eyeTrackingService';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (points: CalibrationPoint[], screenWidth: number, screenHeight: number) => void;
  getCurrentGaze: () => { x: number; y: number; valid: boolean } | null;
}

interface CalibrationState {
  currentIndex: number;
  points: { x: number; y: number }[];
  completedPoints: CalibrationPoint[];
  isCalibrating: boolean;
  screenWidth: number;
  screenHeight: number;
}

const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  getCurrentGaze
}) => {
  const [state, setState] = useState<CalibrationState>({
    currentIndex: 0,
    points: [],
    completedPoints: [],
    isCalibrating: false,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight
  });

  const [showGazePreview, setShowGazePreview] = useState(true);
  const [gazePosition, setGazePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      const paddingX = screenWidth * 0.1;
      const paddingY = screenHeight * 0.1;
      
      const cols = 3;
      const rows = 3;
      const xStep = (screenWidth - 2 * paddingX) / (cols - 1);
      const yStep = (screenHeight - 2 * paddingY) / (rows - 1);
      
      const points: { x: number; y: number }[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          points.push({
            x: paddingX + col * xStep,
            y: paddingY + row * yStep
          });
        }
      }

      setState({
        currentIndex: 0,
        points,
        completedPoints: [],
        isCalibrating: true,
        screenWidth,
        screenHeight
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !state.isCalibrating) return;

    const interval = setInterval(() => {
      const gaze = getCurrentGaze();
      if (gaze && gaze.valid) {
        setGazePosition({ x: gaze.x, y: gaze.y });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, state.isCalibrating, getCurrentGaze]);

  const handlePointClick = useCallback(() => {
    if (!state.isCalibrating || state.currentIndex >= state.points.length) return;

    const gaze = getCurrentGaze();
    const currentPoint = state.points[state.currentIndex];
    
    const calibrationPoint: CalibrationPoint = {
      targetX: currentPoint.x,
      targetY: currentPoint.y,
      gazeX: gaze?.valid ? gaze.x : currentPoint.x,
      gazeY: gaze?.valid ? gaze.y : currentPoint.y
    };

    const newCompletedPoints = [...state.completedPoints, calibrationPoint];
    const nextIndex = state.currentIndex + 1;

    if (nextIndex >= state.points.length) {
      setState(prev => ({
        ...prev,
        completedPoints: newCompletedPoints,
        currentIndex: nextIndex,
        isCalibrating: false
      }));
      
      onComplete(newCompletedPoints, state.screenWidth, state.screenHeight);
    } else {
      setState(prev => ({
        ...prev,
        completedPoints: newCompletedPoints,
        currentIndex: nextIndex
      }));
    }
  }, [state, getCurrentGaze, onComplete]);

  const handleReset = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentIndex: 0,
      completedPoints: [],
      isCalibrating: true
    }));
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      handlePointClick();
    }
  }, [handlePointClick]);

  useEffect(() => {
    if (state.isCalibrating) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [state.isCalibrating, handleKeyDown]);

  if (!isOpen) return null;

  const currentPoint = state.points[state.currentIndex];
  const progress = state.completedPoints.length;
  const total = state.points.length;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={handlePointClick}
    >
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-center z-10">
        <h2 className="text-2xl font-bold mb-2">九点校准</h2>
        <p className="text-lg opacity-80">
          {state.isCalibrating 
            ? `点击第 ${state.currentIndex + 1} / ${total} 个点 (按空格键)` 
            : '校准完成！'}
        </p>
        <div className="mt-2 w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${(progress / total) * 100}%` }}
          />
        </div>
      </div>

      {state.isCalibrating && currentPoint && (
        <>
          <div
            className="absolute transition-all duration-200"
            style={{
              left: currentPoint.x,
              top: currentPoint.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="relative flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-indigo-500 animate-pulse" />
              <div className="absolute w-8 h-8 bg-indigo-500 rounded-full" />
            </div>
          </div>

          {showGazePreview && (
            <div
              className="absolute transition-all duration-75"
              style={{
                left: gazePosition.x,
                top: gazePosition.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-red-500 opacity-70" />
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-red-400 text-xs whitespace-nowrap">
                  视线位置
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {state.completedPoints.map((point, index) => (
        <div
          key={index}
          className="absolute"
          style={{
            left: point.targetX,
            top: point.targetY,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <Check size={14} className="text-white" />
          </div>
        </div>
      ))}

      <div className="absolute bottom-8 flex gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowGazePreview(!showGazePreview);
          }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
        >
          <Target size={18} />
          {showGazePreview ? '隐藏视线' : '显示视线'}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleReset();
          }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
        >
          <RefreshCw size={18} />
          重新校准
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2"
        >
          <X size={18} />
          关闭
        </button>
      </div>

      {!state.isCalibrating && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={40} className="text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">校准完成！</h3>
          <p className="text-gray-600 mb-6">
            已收集 {state.completedPoints.length} 个校准点
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg flex items-center gap-2"
            >
              <RefreshCw size={18} />
              重新校准
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalibrationModal;
