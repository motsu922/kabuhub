export interface TechnicalScore { total: number }
export interface TechnicalSignal { id: string; label: string }
export const SIGNAL_POINTS: Record<string, number> = {};
export function detectSignals() { return [] as TechnicalSignal[]; }
export function computeScore() { return { total: 0 } as TechnicalScore; }
