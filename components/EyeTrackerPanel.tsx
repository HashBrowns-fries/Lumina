import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeOff, Crosshair, Video } from 'lucide-react';
import { webgazerService, WebGazerGazeData, WebGazerStatus } from '../services/webgazerService';
import CalibrationModal from './CalibrationModal';

interface EyeTrackerPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  theme?: 'light' | 'dark' | 'sepia' | 'night' | 'contrast' | 'paper' | 'auto';
  onGazeUpdate?: (gazeData: WebGazerGazeData) => void;
  onTrackingStarted?: () => void;
  onTrackingStopped?: () => void;
}

const EyeTrackerPanel: React.FC<EyeTrackerPanelProps> = ({ 
  isExpanded, 
  onToggle, 
  theme = 'light',
  onGazeUpdate,
  onTrackingStarted,
  onTrackingStopped
}) => {
  const [webgazerStatus, setWebgazerStatus] = useState<WebGazerStatus>({
    running: false,
    calibrated: false,
    cameraAvailable: false
  });
  const [showCameraPreview, setShowCameraPreview] = useState(true);
  const [showPredictionPointers, setShowPredictionPointers] = useState(true);
  const [gazeData, setGazeData] = useState<WebGazerGazeData | null>(null);
  const [show9PointCalibration, setShow9PointCalibration] = useState(false);
  const gazeDataRef = useRef<WebGazerGazeData | null>(null);

  useEffect(() => {
    if (gazeData) {
      gazeDataRef.current = gazeData;
    }
  }, [gazeData]);

  const getCurrentGaze = useCallback(() => {
    const data = gazeDataRef.current;
    if (data && data.valid) {
      return { x: data.x, y: data.y, valid: data.valid };
    }
    return null;
  }, []);

  useEffect(() => {
    setShowCameraPreview(webgazerService.getShowCameraPreview());
  }, []);

  const handleToggleCameraPreview = (show: boolean) => {
    setShowCameraPreview(show);
    webgazerService.setShowCameraPreview(show);
  };

  const handleTogglePredictionPointers = (show: boolean) => {
    setShowPredictionPointers(show);
    webgazerService.setShowPredictionPointers(show);
  };

  useEffect(() => {
    const unsubscribeStatus = webgazerService.subscribeToStatus((s) => {
      setWebgazerStatus(s);
    });
    
    const unsubscribeGaze = webgazerService.subscribe((data) => {
      setGazeData(data);
      onGazeUpdate?.(data);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeGaze();
    };
  }, [onGazeUpdate]);

  const getThemeClasses = () => {
    switch (theme) {
      case 'dark': return 'bg-slate-800 text-slate-100 border-slate-700';
      case 'night': return 'bg-indigo-900 text-indigo-100 border-indigo-800';
      case 'sepia': return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'contrast': return 'bg-black text-white border-white';
      case 'paper': return 'bg-stone-100 text-stone-800 border-stone-200';
      default: return 'bg-white text-slate-800 border-slate-200';
    }
  };

  return (
    <>
      {/* Toggle Button - Fixed on left edge */}
      <button
        onClick={onToggle}
        className={`fixed left-4 z-50 p-3 rounded-xl shadow-lg transition-all duration-300 bottom-4 ${
          theme === 'dark' ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' :
          theme === 'night' ? 'bg-indigo-800 text-indigo-100 hover:bg-indigo-700' :
          theme === 'sepia' ? 'bg-amber-200 text-amber-900 hover:bg-amber-300' :
          theme === 'contrast' ? 'bg-gray-800 text-white hover:bg-gray-700' :
          theme === 'paper' ? 'bg-stone-200 text-stone-800 hover:bg-stone-300' :
          'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
        style={{ bottom: '24px' }}
        title={isExpanded ? '隐藏眼动追踪' : '显示眼动追踪'}
      >
        {webgazerStatus.running && webgazerStatus.calibrated ? <Video size={20} /> : <Eye size={20} />}
      </button>

      {/* Panel - Floating at bottom left */}
      <div 
        className={`fixed left-4 bottom-20 w-72 z-40 transform transition-all duration-300 ${
          isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        } ${getThemeClasses()} rounded-xl shadow-2xl border`}
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >
        <div className="p-3 h-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <Eye size={16} />
              WebGazer 眼动追踪
            </h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                webgazerStatus.calibrated 
                  ? 'bg-green-100 text-green-700' 
                  : webgazerStatus.running 
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-slate-100 text-slate-500'
              }`}>
                {webgazerStatus.calibrated ? '已校准' : webgazerStatus.running ? '待校准' : '未启动'}
              </span>
              <button 
                onClick={onToggle}
                className="p-1 hover:bg-slate-200 rounded"
                title="收起面板"
              >
                <EyeOff size={14} />
              </button>
            </div>
          </div>

          {/* WebGazer Toggle */}
          <div className="space-y-3 mb-4">
            <button
              onClick={async () => {
                if (webgazerStatus.running) {
                  await webgazerService.stop();
                  onTrackingStopped?.();
                } else {
                  await webgazerService.start();
                  onTrackingStarted?.();
                }
              }}
              className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
                webgazerStatus.running 
                  ? 'bg-red-100 hover:bg-red-200 text-red-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <Video size={16} />
              {webgazerStatus.running ? '停止追踪' : '启动 WebGazer'}
            </button>
          </div>

          {/* Camera Preview Toggle */}
          <div className="mb-4 p-2 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-70">摄像头预览</span>
              <button
                onClick={() => handleToggleCameraPreview(!showCameraPreview)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  showCameraPreview ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showCameraPreview ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="opacity-70">预测红点</span>
              <button
                onClick={() => handleTogglePredictionPointers(!showPredictionPointers)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  showPredictionPointers ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showPredictionPointers ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 9-Point Calibration */}
          {webgazerStatus.running && (
            <>
              <div className="border-t border-current opacity-20 my-3" />
              <div className="space-y-2">
                <button
                  onClick={() => setShow9PointCalibration(true)}
                  className="w-full py-2 px-3 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg flex items-center justify-center gap-2"
                >
                  <Crosshair size={14} />
                  九点校准
                </button>
              </div>
            </>
          )}

          {/* Gaze Position Debug */}
          {webgazerStatus.running && gazeData?.valid && (
            <>
              <div className="border-t border-current opacity-20 my-2" />
              <div className="text-xs opacity-50">
                <div>Gaze: ({gazeData.x.toFixed(0)}, {gazeData.y.toFixed(0)})</div>
              </div>
            </>
          )}

          {/* Instructions */}
          {!webgazerStatus.running && (
            <>
              <div className="border-t border-current opacity-20 my-3" />
              <div className="text-xs opacity-60 space-y-1">
                <p className="font-medium">使用方法：</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>点击启动 WebGazer</li>
                  <li>允许摄像头权限</li>
                  <li>完成校准后使用</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>

      <CalibrationModal
        isOpen={show9PointCalibration}
        onClose={() => setShow9PointCalibration(false)}
        onComplete={(points, screenWidth, screenHeight) => {
          console.log('Calibration complete:', points, screenWidth, screenHeight);
        }}
        getCurrentGaze={getCurrentGaze}
      />
    </>
  );
};

export default EyeTrackerPanel;
