// @ts-nocheck
const TTS_API_BASE = 'http://127.0.0.1:3009';

export interface TTSStatus {
  ready: boolean;
  loading: boolean;
  modelName: string;
  sampleRate: number;
  device: string;
  error?: string;
}

export type TTSPlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

export interface TTSState {
  playbackState: TTSPlaybackState;
  currentParagraphIndex: number | null;
  totalParagraphs: number;
  available: boolean;
}

type TTSListener = (state: TTSState) => void;

class TTSService {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private paragraphs: string[] = [];
  private currentIndex: number = 0;
  private audioCache: Map<number, AudioBuffer> = new Map();
  private playbackState: TTSPlaybackState = 'idle';
  private voiceStyle: string = '';
  private listeners: Set<TTSListener> = new Set();
  private abortController: AbortController | null = null;
  private pausedAt: number = 0;
  private startedAt: number = 0;
  private currentBuffer: AudioBuffer | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private notify() {
    const state: TTSState = {
      playbackState: this.playbackState,
      currentParagraphIndex: this.playbackState === 'idle' ? null : this.currentIndex,
      totalParagraphs: this.paragraphs.length,
      available: true,
    };
    this.listeners.forEach(fn => fn(state));
  }

  subscribe(listener: TTSListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async getStatus(): Promise<TTSStatus> {
    try {
      const res = await fetch(`${TTS_API_BASE}/tts/status`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      return {
        ready: data.ready,
        loading: data.loading,
        modelName: data.model_name,
        sampleRate: data.sample_rate,
        device: data.device,
        error: data.error,
      };
    } catch {
      return { ready: false, loading: false, modelName: '', sampleRate: 0, device: '', error: 'Server unavailable' };
    }
  }

  setParagraphs(paragraphs: string[][], voiceStyle: string) {
    this.stop();
    this.paragraphs = paragraphs.map(words => words.join(' '));
    this.voiceStyle = voiceStyle;
    this.audioCache.clear();
    this.currentIndex = 0;
  }

  setVoiceStyle(style: string) {
    this.voiceStyle = style;
    this.audioCache.clear();
  }

  async play(startIndex?: number) {
    if (this.paragraphs.length === 0) return;

    if (startIndex !== undefined) {
      this.currentIndex = Math.max(0, Math.min(startIndex, this.paragraphs.length - 1));
    }

    this.pausedAt = 0;
    await this.playCurrentParagraph();
  }

  async resume() {
    if (this.playbackState !== 'paused' || !this.currentBuffer) return;
    await this.playBuffer(this.currentBuffer, this.pausedAt);
  }

  pause() {
    if (this.playbackState !== 'playing' || !this.sourceNode) return;

    const ctx = this.getAudioContext();
    this.pausedAt = ctx.currentTime - this.startedAt;
    this.sourceNode.onended = null;
    this.sourceNode.stop();
    this.sourceNode = null;
    this.playbackState = 'paused';
    this.notify();
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
      this.sourceNode = null;
    }
    this.playbackState = 'idle';
    this.pausedAt = 0;
    this.currentBuffer = null;
    this.notify();
    // Signal server to stop generation
    fetch(`${TTS_API_BASE}/tts/stop`, { method: 'POST' }).catch(() => {});
  }

  async next() {
    if (this.currentIndex < this.paragraphs.length - 1) {
      this.stopCurrentPlayback();
      this.currentIndex++;
      this.pausedAt = 0;
      await this.playCurrentParagraph();
    }
  }

  async prev() {
    if (this.currentIndex > 0) {
      this.stopCurrentPlayback();
      this.currentIndex--;
      this.pausedAt = 0;
      await this.playCurrentParagraph();
    }
  }

  private stopCurrentPlayback() {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
      this.sourceNode = null;
    }
  }

  private async playCurrentParagraph() {
    const index = this.currentIndex;
    const text = this.paragraphs[index];
    if (!text || !text.trim()) {
      this.advanceToNext();
      return;
    }

    this.playbackState = 'loading';
    this.notify();

    let buffer = this.audioCache.get(index);
    if (!buffer) {
      buffer = await this.fetchAudio(text);
      if (!buffer) {
        this.playbackState = 'idle';
        this.notify();
        return;
      }
      this.audioCache.set(index, buffer);
    }

    this.currentBuffer = buffer;
    await this.playBuffer(buffer, this.pausedAt);

    // Prefetch next paragraph
    this.prefetch(index + 1);
  }

  private async playBuffer(buffer: AudioBuffer, offset: number = 0) {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    source.onended = () => {
      if (this.playbackState === 'playing') {
        this.advanceToNext();
      }
    };

    this.sourceNode = source;
    this.startedAt = ctx.currentTime - offset;
    source.start(0, offset);
    this.playbackState = 'playing';
    this.notify();
  }

  private advanceToNext() {
    if (this.currentIndex < this.paragraphs.length - 1) {
      this.currentIndex++;
      this.pausedAt = 0;
      this.playCurrentParagraph();
    } else {
      this.playbackState = 'idle';
      this.currentBuffer = null;
      this.notify();
    }
  }

  private async fetchAudio(text: string): Promise<AudioBuffer | null> {
    this.abortController = new AbortController();
    try {
      const res = await fetch(`${TTS_API_BASE}/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice_style: this.voiceStyle,
        }),
        signal: this.abortController.signal,
      });

      if (!res.ok) return null;

      const arrayBuffer = await res.arrayBuffer();
      const ctx = this.getAudioContext();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch {
      return null;
    } finally {
      this.abortController = null;
    }
  }

  private async prefetch(index: number) {
    if (index >= this.paragraphs.length || this.audioCache.has(index)) return;
    const text = this.paragraphs[index];
    if (!text || !text.trim()) return;

    try {
      const res = await fetch(`${TTS_API_BASE}/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_style: this.voiceStyle }),
      });
      if (!res.ok) return;
      const arrayBuffer = await res.arrayBuffer();
      const ctx = this.getAudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.audioCache.set(index, buffer);
    } catch {
      // Prefetch failure is non-critical
    }
  }
}

export const ttsService = new TTSService();
