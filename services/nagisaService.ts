// @ts-nocheck
const NAGISA_API_BASE = 'http://127.0.0.1:3010';

export interface NagisaToken {
  surface: string;
  pos: string;
}

class NagisaService {
  async getPos(word: string): Promise<string | null> {
    const tokens = await this.tokenize(word);
    if (tokens.length === 0) return null;
    if (tokens.length === 1) return tokens[0].pos;
    return tokens.map(t => `${t.surface}(${t.pos})`).join(' + ');
  }

  async tokenize(text: string): Promise<NagisaToken[]> {
    try {
      const res = await fetch(`${NAGISA_API_BASE}/api/tokenize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.success ? data.tokens : [];
    } catch {
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${NAGISA_API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const nagisaService = new NagisaService();
