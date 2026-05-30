import { OHLCBar } from '../types';

export interface TechnicalSignal {
  id: string;
  label: string;
  type?: 'bullish' | 'bearish' | 'neutral' | string;
  description?: string;
}

export interface TechnicalScore {
  total: number;
  score?: number;
  verdict?: string;
  verdictColor?: string;
  signals?: TechnicalSignal[];
}

export const SIGNAL_POINTS: Record<string, number> = {};

export function detectSignals(_bars: OHLCBar[] = []): TechnicalSignal[] {
  return [];
}

export function computeScore(signals: TechnicalSignal[] = []): TechnicalScore {
  const score = signals.length;
  return {
    total: score,
    score,
    verdict: score > 0 ? 'watch' : 'neutral',
    verdictColor: score > 0 ? '#60A5FA' : '#9CA3AF',
    signals,
  };
}
