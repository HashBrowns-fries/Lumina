export interface WebGazerGazeData {
  x: number;
  y: number;
  timestamp: number;
  valid: boolean;
}

export interface WebGazerStatus {
  running: boolean;
  calibrated: boolean;
  cameraAvailable: boolean;
}

export interface WebGazerCalibrationPoint {
  targetX: number;
  targetY: number;
  gazeX: number;
  gazeY: number;
}

export interface WebGazerCalibrationData {
  points: WebGazerCalibrationPoint[];
  screenWidth: number;
  screenHeight: number;
  timestamp: number;
}

declare global {
  interface Window {
    webgazer: any;
  }
}

class WebGazerService {
  private listeners: Set<(data: WebGazerGazeData) => void> = new Set();
  private statusListeners: Set<(status: WebGazerStatus) => void> = new Set();
  private isRunning: boolean = false;
  private isCalibrated: boolean = false;
  private showCameraPreview: boolean = true;
  private showPredictionPointers: boolean = true;
  private gazeInterval: number | null = null;
  private lastGazeData: WebGazerGazeData | null = null;
  private predictionListener: ((data: any) => void) | null = null;

  private offsetX: number = 0;
  private offsetY: number = 0;
  private emaX: number = 0;
  private emaY: number = 0;
  private readonly EMA_ALPHA = 0.3;

  private correctionMatrix: { scaleX: number; scaleY: number; offsetX: number; offsetY: number } | null = null;

  constructor() {
    this.loadCalibration();
    this.loadOffset();
  }

  async initialize(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.webgazer) {
        console.log('[WebGazerService] WebGazer already initialized');
        resolve(true);
        return;
      }

      console.log('[WebGazerService] Loading WebGazer script...');

      const script = document.createElement('script');
      script.src = '/webgazer.js';
      script.async = true;
      script.onload = () => {
        console.log('[WebGazerService] WebGazer script loaded successfully');
        try {
          this.setupWebGazer();
          resolve(true);
        } catch (error) {
          console.error('[WebGazerService] Error in setupWebGazer:', error);
          reject(error);
        }
      };
      script.onerror = (event) => {
        console.error('[WebGazerService] Failed to load WebGazer script', event);
        reject(new Error('Failed to load WebGazer script'));
      };
      document.body.appendChild(script);
    });
  }

  private setupWebGazer(): void {
    if (!window.webgazer) {
      console.error('[WebGazerService] WebGazer not found');
      return;
    }

    console.log('[WebGazerService] Setting up WebGazer...');

    try {
      window.webgazer
        .setGazeListener((data: any, timestamp: number) => {
          if (data == null) return;

          console.log('[WebGazerService] Gaze data received:', data.x, data.y);

          const gazeData: WebGazerGazeData = {
            x: data.x,
            y: data.y,
            timestamp: timestamp,
            valid: data.x !== null && data.y !== null
          };

          this.lastGazeData = this.applySmoothing(gazeData);
          this.notifyListeners(this.lastGazeData);
        })
        .saveDataAcrossSessions(true);

      window.webgazer.begin();
      console.log('[WebGazerService] webgazer.begin() called');

      setTimeout(() => {
        if (window.webgazer && window.webgazer.params) {
          window.webgazer.params.showVideoPreview = this.showCameraPreview;
          window.webgazer.params.showFaceOverlay = true;
          window.webgazer.params.showFaceFeedbackBox = true;
          window.webgazer.params.showPredictionPointers = this.showPredictionPointers;
          console.log('[WebGazerService] Parameters set - showPredictionPointers:', this.showPredictionPointers, 'showVideoPreview:', this.showCameraPreview);
        }
      }, 1000);

      console.log('[WebGazerService] WebGazer configured');
    } catch (error) {
      console.error('[WebGazerService] Error setting up WebGazer:', error);
    }
  }

  private applySmoothing(data: WebGazerGazeData): WebGazerGazeData {
    let rawX = data.x + this.offsetX;
    let rawY = data.y + this.offsetY;

    if (this.correctionMatrix) {
      rawX = data.x * this.correctionMatrix.scaleX + this.correctionMatrix.offsetX;
      rawY = data.y * this.correctionMatrix.scaleY + this.correctionMatrix.offsetY;
    }

    if (!this.lastGazeData || !this.lastGazeData.valid) {
      this.emaX = rawX;
      this.emaY = rawY;
      return { ...data, x: rawX, y: rawY };
    }

    this.emaX = this.EMA_ALPHA * rawX + (1 - this.EMA_ALPHA) * this.emaX;
    this.emaY = this.EMA_ALPHA * rawY + (1 - this.EMA_ALPHA) * this.emaY;

    return { ...data, x: this.emaX, y: this.emaY };
  }

  private notifyListeners(data: WebGazerGazeData): void {
    this.listeners.forEach(listener => listener(data));
  }

  async start(): Promise<boolean> {
    try {
      if (!window.webgazer) {
        await this.initialize();
      }

      this.isRunning = true;
      this.notifyStatusChange();
      console.log('[WebGazerService] Started');
      return true;
    } catch (error) {
      console.error('[WebGazerService] Failed to start:', error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    try {
      this.isRunning = false;
      if (this.gazeInterval) {
        clearInterval(this.gazeInterval);
        this.gazeInterval = null;
      }
      this.notifyStatusChange();
      console.log('[WebGazerService] Stopped');
      return true;
    } catch (error) {
      console.error('[WebGazerService] Failed to stop:', error);
      return false;
    }
  }

  setShowCameraPreview(show: boolean): void {
    this.showCameraPreview = show;
    if (window.webgazer) {
      window.webgazer.showPredictionPoints(show);
      window.webgazer.showVideoPreview(show);
    }
    console.log('[WebGazerService] Camera preview set to:', show);
  }

  setShowPredictionPointers(show: boolean): void {
    this.showPredictionPointers = show;
    if (window.webgazer && window.webgazer.params) {
      window.webgazer.params.showPredictionPointers = show;
    }
    console.log('[WebGazerService] Prediction pointers set to:', show);
  }

  getShowCameraPreview(): boolean {
    return this.showCameraPreview;
  }

  getShowPredictionPointers(): boolean {
    return this.showPredictionPointers;
  }

  async calibrate(): Promise<void> {
    console.log('[WebGazerService] Using WebGazer built-in calibration (click on screen points)');
    this.isCalibrated = true;
    this.notifyStatusChange();
  }

  getStatus(): WebGazerStatus {
    return {
      running: this.isRunning,
      calibrated: this.isCalibrated,
      cameraAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices
    };
  }

  getGazeData(): WebGazerGazeData | null {
    return this.lastGazeData;
  }

  subscribe(listener: (data: WebGazerGazeData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeToStatus(listener: (status: WebGazerStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.statusListeners.forEach(listener => listener(status));
  }

  saveCalibrationData(points: WebGazerCalibrationPoint[], screenWidth: number, screenHeight: number): void {
    const calibrationData: WebGazerCalibrationData = {
      points,
      screenWidth,
      screenHeight,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('webgazerCalibrationData', JSON.stringify(calibrationData));
      this.calculateCorrectionMatrix(points);
      console.log('[WebGazerService] Calibration data saved');
    } catch (e) {
      console.warn('[WebGazerService] Failed to save calibration data:', e);
    }
  }

  private loadCalibration(): void {
    try {
      const saved = localStorage.getItem('webgazerCalibrationData');
      if (saved) {
        const data: WebGazerCalibrationData = JSON.parse(saved);
        this.calculateCorrectionMatrix(data.points);
        this.isCalibrated = data.points.length >= 3;
        console.log('[WebGazerService] Loaded calibration data');
      }
    } catch (e) {
      console.warn('[WebGazerService] Failed to load calibration data:', e);
    }
  }

  private calculateCorrectionMatrix(points: WebGazerCalibrationPoint[]): void {
    if (points.length < 2) {
      this.correctionMatrix = null;
      return;
    }

    let sumErrorX = 0;
    let sumErrorY = 0;

    for (const point of points) {
      sumErrorX += point.targetX - point.gazeX;
      sumErrorY += point.targetY - point.gazeY;
    }

    const avgErrorX = sumErrorX / points.length;
    const avgErrorY = sumErrorY / points.length;

    let scaleX = 1;
    let scaleY = 1;

    const targetWidth = Math.max(...points.map(p => p.targetX)) - Math.min(...points.map(p => p.targetX));
    const gazeWidth = Math.max(...points.map(p => p.gazeX)) - Math.min(...points.map(p => p.gazeX));
    if (gazeWidth > 0) {
      scaleX = targetWidth / gazeWidth;
    }

    const targetHeight = Math.max(...points.map(p => p.targetY)) - Math.min(...points.map(p => p.targetY));
    const gazeHeight = Math.max(...points.map(p => p.gazeY)) - Math.min(...points.map(p => p.gazeY));
    if (gazeHeight > 0) {
      scaleY = targetHeight / gazeHeight;
    }

    this.correctionMatrix = {
      scaleX,
      scaleY,
      offsetX: avgErrorX,
      offsetY: avgErrorY
    };

    console.log('[WebGazerService] Correction matrix calculated:', this.correctionMatrix);
  }

  clearCalibrationData(): void {
    this.correctionMatrix = null;
    this.isCalibrated = false;
    localStorage.removeItem('webgazerCalibrationData');
    console.log('[WebGazerService] Calibration data cleared');
  }

  getCalibrationPoints(): WebGazerCalibrationPoint[] {
    try {
      const saved = localStorage.getItem('webgazerCalibrationData');
      if (saved) {
        const data: WebGazerCalibrationData = JSON.parse(saved);
        return data.points;
      }
    } catch (e) {
      console.warn('[WebGazerService] Failed to get calibration points:', e);
    }
    return [];
  }

  private loadOffset(): void {
    try {
      const saved = localStorage.getItem('webgazerOffset');
      if (saved) {
        const { x, y } = JSON.parse(saved);
        this.offsetX = x || 0;
        this.offsetY = y || 0;
        console.log('[WebGazerService] Loaded offset:', this.offsetX, this.offsetY);
      }
    } catch (e) {
      console.warn('[WebGazerService] Failed to load offset:', e);
    }
  }

  saveOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
    this.emaX = 0;
    this.emaY = 0;
    try {
      localStorage.setItem('webgazerOffset', JSON.stringify({ x, y }));
      console.log('[WebGazerService] Saved offset:', x, y);
    } catch (e) {
      console.warn('[WebGazerService] Failed to save offset:', e);
    }
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  resetOffset(): void {
    this.offsetX = 0;
    this.offsetY = 0;
    this.emaX = 0;
    this.emaY = 0;
    localStorage.removeItem('webgazerOffset');
    console.log('[WebGazerService] Reset offset');
  }

  getAutoStart(): boolean {
    try {
      return localStorage.getItem('webgazerAutoStart') === 'true';
    } catch {
      return false;
    }
  }

  setAutoStart(enabled: boolean): void {
    try {
      localStorage.setItem('webgazerAutoStart', String(enabled));
      console.log('[WebGazerService] Auto start:', enabled);
    } catch (e) {
      console.warn('[WebGazerService] Failed to save auto start setting:', e);
    }
  }
}

export const webgazerService = new WebGazerService();
