const GAZE_API_BASE = 'http://127.0.0.1:8765';

export interface GazeData {
  x: number;
  y: number;
  fixation: boolean;
  timestamp: number;
  valid: boolean;
  reading_speed: number;
  avg_dwell_time: number;
  regression_rate: number;
  total_time: number;
  fixation_count: number;
  saccade_count: number;
  regression_count: number;
  progression_count: number;
}

export interface GazeStatus {
  running: boolean;
  calibrated: boolean;
  calibration_file_exists: boolean;
}

export interface CalibrationPoint {
  targetX: number;
  targetY: number;
  gazeX: number;
  gazeY: number;
}

export interface CalibrationData {
  points: CalibrationPoint[];
  screenWidth: number;
  screenHeight: number;
  timestamp: number;
}

class EyeTrackingService {
  private pollInterval: number | null = null;
  private listeners: Set<(data: GazeData) => void> = new Set();
  private statusListeners: Set<(status: GazeStatus) => void> = new Set();
  private lastGazeData: GazeData | null = null;
  private lastStatus: GazeStatus | null = null;
  
  private offsetX: number = 0;
  private offsetY: number = 0;

  private emaX: number = 0;
  private emaY: number = 0;
  private readonly EMA_ALPHA = 0.3;
  private readonly INVALID_EMA_ALPHA = 0.8;

  private correctionMatrix: { scaleX: number; scaleY: number; offsetX: number; offsetY: number } | null = null;

  constructor() {
    this.loadOffset();
    this.loadCalibration();
  }

  saveCalibrationData(points: CalibrationPoint[], screenWidth: number, screenHeight: number): void {
    const calibrationData: CalibrationData = {
      points,
      screenWidth,
      screenHeight,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem('gazeCalibrationData', JSON.stringify(calibrationData));
      this.calculateCorrectionMatrix(points);
      console.log('[EyeTrackingService] 校准数据已保存');
    } catch (e) {
      console.warn('[EyeTrackingService] 保存校准数据失败:', e);
    }
  }

  private loadCalibration(): void {
    try {
      const saved = localStorage.getItem('gazeCalibrationData');
      if (saved) {
        const data: CalibrationData = JSON.parse(saved);
        this.calculateCorrectionMatrix(data.points);
        console.log('[EyeTrackingService] 加载校准数据');
      }
    } catch (e) {
      console.warn('[EyeTrackingService] 加载校准数据失败:', e);
    }
  }

  private calculateCorrectionMatrix(points: CalibrationPoint[]): void {
    if (points.length < 2) {
      this.correctionMatrix = null;
      return;
    }

    let sumErrorX = 0;
    let sumErrorY = 0;
    let avgErrorX = 0;
    let avgErrorY = 0;

    for (const point of points) {
      sumErrorX += point.targetX - point.gazeX;
      sumErrorY += point.targetY - point.gazeY;
    }

    avgErrorX = sumErrorX / points.length;
    avgErrorY = sumErrorY / points.length;

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

    this.offsetX = avgErrorX;
    this.offsetY = avgErrorY;
    
    console.log('[EyeTrackingService] 校正矩阵计算完成:', this.correctionMatrix);
  }

  getCorrectionMatrix(): { scaleX: number; scaleY: number; offsetX: number; offsetY: number } | null {
    return this.correctionMatrix;
  }

  hasCalibrationData(): boolean {
    return this.correctionMatrix !== null;
  }

  clearCalibrationData(): void {
    this.correctionMatrix = null;
    localStorage.removeItem('gazeCalibrationData');
    console.log('[EyeTrackingService] 校准数据已清除');
  }

  getCalibrationPoints(): CalibrationPoint[] {
    try {
      const saved = localStorage.getItem('gazeCalibrationData');
      if (saved) {
        const data: CalibrationData = JSON.parse(saved);
        return data.points;
      }
    } catch (e) {
      console.warn('[EyeTrackingService] 获取校准点失败:', e);
    }
    return [];
  }

  private loadOffset() {
    try {
      const saved = localStorage.getItem('gazeOffset');
      if (saved) {
        const { x, y } = JSON.parse(saved);
        this.offsetX = x || 0;
        this.offsetY = y || 0;
        console.log('[EyeTrackingService] 加载偏移量:', this.offsetX, this.offsetY);
      }
    } catch (e) {
      console.warn('[EyeTrackingService] 加载偏移量失败:', e);
    }
  }

  saveOffset(x: number, y: number) {
    this.offsetX = x;
    this.offsetY = y;
    this.emaX = 0;
    this.emaY = 0;
    try {
      localStorage.setItem('gazeOffset', JSON.stringify({ x, y }));
      console.log('[EyeTrackingService] 保存偏移量:', x, y);
    } catch (e) {
      console.warn('[EyeTrackingService] 保存偏移量失败:', e);
    }
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  resetOffset() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.emaX = 0;
    this.emaY = 0;
    localStorage.removeItem('gazeOffset');
    console.log('[EyeTrackingService] 重置偏移量');
  }

  getAutoStart(): boolean {
    try {
      const saved = localStorage.getItem('gazeAutoStart');
      return saved === 'true';
    } catch {
      return false;
    }
  }

  setAutoStart(enabled: boolean) {
    try {
      localStorage.setItem('gazeAutoStart', String(enabled));
      console.log('[EyeTrackingService] 自动启动:', enabled);
    } catch (e) {
      console.warn('[EyeTrackingService] 保存自动启动设置失败:', e);
    }
  }

  private applyCorrection(data: GazeData): { x: number; y: number } {
    let rawX = data.x;
    let rawY = data.y;

    if (this.correctionMatrix) {
      rawX = data.x * this.correctionMatrix.scaleX + this.correctionMatrix.offsetX;
      rawY = data.y * this.correctionMatrix.scaleY + this.correctionMatrix.offsetY;
    } else {
      rawX = data.x + this.offsetX;
      rawY = data.y + this.offsetY;
    }

    return { x: rawX, y: rawY };
  }

  private applySmoothing(data: GazeData): GazeData {
    const corrected = this.applyCorrection(data);
    const rawX = corrected.x;
    const rawY = corrected.y;
    
    if (!this.lastGazeData || !this.lastGazeData.valid) {
      this.emaX = rawX;
      this.emaY = rawY;
      return { ...data, x: rawX, y: rawY };
    }

    const alpha = data.valid ? this.EMA_ALPHA : this.INVALID_EMA_ALPHA;
    
    if (this.lastGazeData.fixation !== data.fixation) {
      this.emaX = rawX;
      this.emaY = rawY;
    } else {
      this.emaX = alpha * rawX + (1 - alpha) * this.emaX;
      this.emaY = alpha * rawY + (1 - alpha) * this.emaY;
    }

    return { ...data, x: this.emaX, y: this.emaY };
  }

  private hasStatusChanged(newStatus: GazeStatus): boolean {
    if (!this.lastStatus) return true;
    return (
      this.lastStatus.running !== newStatus.running ||
      this.lastStatus.calibrated !== newStatus.calibrated ||
      this.lastStatus.calibration_file_exists !== newStatus.calibration_file_exists
    );
  }

  private hasGazeDataChanged(newData: GazeData): boolean {
    if (!this.lastGazeData) return true;
    const threshold = 5;
    return (
      Math.abs(newData.x - this.lastGazeData.x) > threshold ||
      Math.abs(newData.y - this.lastGazeData.y) > threshold ||
      newData.valid !== this.lastGazeData.valid ||
      newData.fixation !== this.lastGazeData.fixation
    );
  }

  async start(screenWidth: number = 1920, screenHeight: number = 1080): Promise<boolean> {
    try {
      const url = `${GAZE_API_BASE}/api/gaze/start`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenWidth, screenHeight })
      });
      
      const result = JSON.parse(await response.text());
      return result.status === 'started' || result.status === 'already_running';
    } catch (error) {
      console.error('[EyeTrackingService] 启动失败:', error);
      return false;
    }
  }

  async stop(): Promise<boolean> {
    try {
      const url = `${GAZE_API_BASE}/api/gaze/stop`;
      const response = await fetch(url, { method: 'POST' });
      const result = JSON.parse(await response.text());
      this.stopPolling();
      return result.status === 'stopped';
    } catch (error) {
      console.error('[EyeTrackingService] 停止失败:', error);
      this.stopPolling();
      return false;
    }
  }

  async calibrate(): Promise<boolean> {
    try {
      const url = `${GAZE_API_BASE}/api/gaze/calibrate`;
      const response = await fetch(url, { method: 'POST' });
      const result = JSON.parse(await response.text());
      return result.status === 'calibrated' || result.status === 'calibrating';
    } catch (error) {
      console.error('[EyeTrackingService] 校准失败:', error);
      return false;
    }
  }

  async startAndCalibrate(screenWidth: number = 1920, screenHeight: number = 1080): Promise<boolean> {
    const started = await this.start(screenWidth, screenHeight);
    if (!started) return false;

    await new Promise(resolve => setTimeout(resolve, 1000));

    const status = await this.getStatus();
    if (status.calibrated) {
      console.log('[EyeTrackingService] 已校准，直接开始');
      return true;
    }

    console.log('[EyeTrackingService] 开始自动校准...');
    const calibrated = await this.calibrate();
    if (calibrated) {
      console.log('[EyeTrackingService] 校准已启动');
    }
    return calibrated;
  }

  async getStatus(): Promise<GazeStatus> {
    try {
      const url = `${GAZE_API_BASE}/api/gaze/status`;
      const response = await fetch(url);
      
      let status;
      try {
        status = JSON.parse(await response.text());
      } catch (e) {
        return { running: false, calibrated: false, calibration_file_exists: false };
      }
      
      // 只在状态变化时输出日志
      if (this.hasStatusChanged(status)) {
        console.log('[EyeTrackingService] 状态更新:', status);
        this.lastStatus = status;
      }
      return status;
    } catch (error) {
      console.error('[EyeTrackingService] 获取状态失败:', error);
      return { running: false, calibrated: false, calibration_file_exists: false };
    }
  }

  private getDefaultGazeData(): GazeData {
    return {
      x: 0, y: 0, fixation: false, timestamp: 0, valid: false,
      reading_speed: 0, avg_dwell_time: 0, regression_rate: 0, total_time: 0,
      fixation_count: 0, saccade_count: 0, regression_count: 0, progression_count: 0
    };
  }

  async getGazeData(): Promise<GazeData> {
    try {
      const url = `${GAZE_API_BASE}/api/gaze/data`;
      const response = await fetch(url);
      const text = await response.text();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return this.lastGazeData || this.getDefaultGazeData();
      }
      
      const smoothedData = this.applySmoothing(data);
      
      if (this.hasGazeDataChanged(smoothedData)) {
        console.log('[EyeTrackingService] 视线更新:', { x: smoothedData.x?.toFixed(0), y: smoothedData.y?.toFixed(0), fixation: smoothedData.fixation });
        this.lastGazeData = smoothedData;
      }
      return smoothedData;
    } catch (error) {
      return this.lastGazeData || this.getDefaultGazeData();
    }
  }

  async reportWordsRead(count: number): Promise<void> {
    try {
      await fetch(`${GAZE_API_BASE}/api/gaze/words_read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
    } catch (error) {
      console.error('Failed to report words read:', error);
    }
  }

  async resetStats(): Promise<void> {
    try {
      await fetch(`${GAZE_API_BASE}/api/gaze/reset_stats`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to reset stats:', error);
    }
  }

  startPolling(intervalMs: number = 100): void {
    if (this.pollInterval) {
      console.log('[EyeTrackingService] 轮询已在运行');
      return;
    }
    
    console.log('[EyeTrackingService] 开始轮询，间隔:', intervalMs, 'ms');
    this.pollInterval = window.setInterval(async () => {
      const data = await this.getGazeData();
      this.listeners.forEach(listener => listener(data));
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      console.log('[EyeTrackingService] 停止轮询');
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  subscribe(listener: (data: GazeData) => void): () => void {
    console.log('[EyeTrackingService] 添加订阅者，当前订阅数:', this.listeners.size + 1);
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      console.log('[EyeTrackingService] 移除订阅者，当前订阅数:', this.listeners.size);
    };
  }

  subscribeToStatus(listener: (status: GazeStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  notifyStatusChange(status: GazeStatus): void {
    this.statusListeners.forEach(listener => listener(status));
  }
}

export const eyeTrackingService = new EyeTrackingService();
