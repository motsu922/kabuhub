import { OHLCBar } from '../types';

export interface TechnicalSignal {
  type: string;
  label: string;
  description: string;
  bullish: boolean;
}

// ── ポイント定義 ──────────────────────────────────────────────────────────────

export const SIGNAL_POINTS: Record<string, number> = {
  inverseHS:     +4,
  goldenCross:   +3,
  doubleBottom:  +3,
  rsiRecovery:   +2,
  rsiOversold:   +2,
  headShoulders: -4,
  deadCross:     -3,
  doubleTop:     -3,
  rsiOverbought: -2,
};

export type TechnicalVerdict = '強い買い' | '買い' | '中立' | '売り' | '強い売り';

export interface TechnicalScore {
  score: number;
  verdict: TechnicalVerdict;
  verdictColor: string;
  signals: TechnicalSignal[];
}

const POSITIVE = '#00C853';
const NEGATIVE = '#FF3B30';
const NEUTRAL  = '#8E8E93';

export function computeScore(signals: TechnicalSignal[]): TechnicalScore {
  const scored = signals.filter((s) => s.type in SIGNAL_POINTS);
  const score  = scored.reduce((sum, s) => sum + SIGNAL_POINTS[s.type], 0);

  let verdict: TechnicalVerdict;
  let verdictColor: string;
  if (score >= 5)      { verdict = '強い買い'; verdictColor = POSITIVE; }
  else if (score >= 2) { verdict = '買い';     verdictColor = POSITIVE; }
  else if (score <= -5){ verdict = '強い売り'; verdictColor = NEGATIVE; }
  else if (score <= -2){ verdict = '売り';     verdictColor = NEGATIVE; }
  else                 { verdict = '中立';     verdictColor = NEUTRAL;  }

  return { score, verdict, verdictColor, signals: scored };
}

// ── 基本指標 ─────────────────────────────────────────────────────────────────

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result.push(sum / period);
  }
  return result;
}

function rsi(closes: number[], period = 14): number[] {
  if (closes.length <= period) return [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  const result: number[] = [al === 0 ? 100 : 100 - 100 / (1 + ag / al)];
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(0, d)) / period;
    al = (al * (period - 1) + Math.max(0, -d)) / period;
    result.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return result;
}

// ── 極値検出 ─────────────────────────────────────────────────────────────────

function localMinIdx(values: number[], window = 3): number[] {
  const idx: number[] = [];
  for (let i = window; i < values.length - window; i++) {
    let ok = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && values[j] <= values[i]) { ok = false; break; }
    }
    if (ok) idx.push(i);
  }
  return idx;
}

function localMaxIdx(values: number[], window = 3): number[] {
  const idx: number[] = [];
  for (let i = window; i < values.length - window; i++) {
    let ok = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && values[j] >= values[i]) { ok = false; break; }
    }
    if (ok) idx.push(i);
  }
  return idx;
}

// ── パターン検出メイン ────────────────────────────────────────────────────────

export function detectSignals(bars: OHLCBar[]): TechnicalSignal[] {
  if (bars.length < 30) return [];

  const closes  = bars.map((b) => b.close);
  const highs   = bars.map((b) => b.high);
  const lows    = bars.map((b) => b.low);
  const current = closes[closes.length - 1];
  const signals: TechnicalSignal[] = [];

  // ── 1. ゴールデンクロス / デッドクロス ──────────────────────────────────────
  const ma5  = sma(closes, 5);
  const ma25 = sma(closes, 25);
  if (ma5.length >= 2 && ma25.length >= 2) {
    const n    = Math.min(ma5.length, ma25.length);
    const prev = ma5[n - 2] - ma25[n - 2];
    const curr = ma5[n - 1] - ma25[n - 1];
    if (prev <= 0 && curr > 0) {
      signals.push({ type: 'goldenCross', label: 'ゴールデンクロス', description: '5日MA が 25日MA を上抜け', bullish: true });
    } else if (prev >= 0 && curr < 0) {
      signals.push({ type: 'deadCross', label: 'デッドクロス', description: '5日MA が 25日MA を下抜け', bullish: false });
    }
  }

  // ── 2. RSI ──────────────────────────────────────────────────────────────────
  const rsiVals = rsi(closes, 14);
  if (rsiVals.length >= 2) {
    const cur = rsiVals[rsiVals.length - 1];
    const prv = rsiVals[rsiVals.length - 2];
    if (cur < 30) {
      signals.push({ type: 'rsiOversold', label: 'RSI売られすぎ', description: `RSI ${cur.toFixed(0)} — 売られすぎ水準 (< 30)`, bullish: true });
    } else if (cur > 70) {
      signals.push({ type: 'rsiOverbought', label: 'RSI買われすぎ', description: `RSI ${cur.toFixed(0)} — 買われすぎ水準 (> 70)`, bullish: false });
    }
    if (prv < 30 && cur >= 30) {
      signals.push({ type: 'rsiRecovery', label: 'RSI底打ち', description: `RSI が売られすぎ圏を脱出 → ${cur.toFixed(0)}`, bullish: true });
    }
  }

  // ── 3. W底 (Double Bottom) ───────────────────────────────────────────────
  const minIdx = localMinIdx(lows, 3);
  outer3: for (let i = minIdx.length - 2; i >= Math.max(0, minIdx.length - 5); i--) {
    const a = minIdx[i], b = minIdx[i + 1];
    if (b - a < 5) continue;
    if (Math.abs(lows[a] - lows[b]) / lows[a] > 0.03) continue;
    // 2つの底の間の高値をネックラインとする
    const neck = Math.max(...closes.slice(a, b + 1));
    if (current >= neck * 0.98) {
      signals.push({ type: 'doubleBottom', label: 'W底', description: '2つの安値が同水準でネックライン付近', bullish: true });
      break outer3;
    }
  }

  // ── 4. M天井 (Double Top) ───────────────────────────────────────────────
  const maxIdx = localMaxIdx(highs, 3);
  outer4: for (let i = maxIdx.length - 2; i >= Math.max(0, maxIdx.length - 5); i--) {
    const a = maxIdx[i], b = maxIdx[i + 1];
    if (b - a < 5) continue;
    if (Math.abs(highs[a] - highs[b]) / highs[a] > 0.03) continue;
    const neck = Math.min(...lows.slice(a, b + 1));
    if (current <= neck * 1.02) {
      signals.push({ type: 'doubleTop', label: 'M天井', description: '2つの高値が同水準でネックライン付近', bullish: false });
      break outer4;
    }
  }

  // ── 5. 逆三尊 (Inverse Head & Shoulders) ────────────────────────────────
  const ihs = localMinIdx(lows, 4);
  outer5: for (let i = ihs.length - 3; i >= 0; i--) {
    const [ls, hd, rs] = [ihs[i], ihs[i + 1], ihs[i + 2]];
    if (hd - ls < 5 || rs - hd < 5) continue;
    if (lows[hd] >= lows[ls] || lows[hd] >= lows[rs]) continue;        // 頭が最安値
    if (Math.abs(lows[ls] - lows[rs]) / lows[ls] > 0.04) continue;     // 両肩が近い
    const neckline = (Math.max(...highs.slice(ls, hd + 1)) + Math.max(...highs.slice(hd, rs + 1))) / 2;
    if (current >= neckline * 0.98) {
      signals.push({ type: 'inverseHS', label: '逆三尊', description: 'ネックライン突破 — 強い底打ちシグナル', bullish: true });
      break outer5;
    }
  }

  // ── 6. 三尊 (Head & Shoulders Top) ──────────────────────────────────────
  const hs = localMaxIdx(highs, 4);
  outer6: for (let i = hs.length - 3; i >= 0; i--) {
    const [ls, hd, rs] = [hs[i], hs[i + 1], hs[i + 2]];
    if (hd - ls < 5 || rs - hd < 5) continue;
    if (highs[hd] <= highs[ls] || highs[hd] <= highs[rs]) continue;    // 頭が最高値
    if (Math.abs(highs[ls] - highs[rs]) / highs[ls] > 0.04) continue;  // 両肩が近い
    const neckline = (Math.min(...lows.slice(ls, hd + 1)) + Math.min(...lows.slice(hd, rs + 1))) / 2;
    if (current <= neckline * 1.02) {
      signals.push({ type: 'headShoulders', label: '三尊（天井）', description: 'ネックライン割込み — 天井からの下落シグナル', bullish: false });
      break outer6;
    }
  }

  return signals;
}

// ── バックテスト ──────────────────────────────────────────────────────────────

export interface BacktestEntry {
  signalType: string;
  bullish: boolean;
  ret5d:  number;   // 5営業日後の騰落率 (%)
  ret10d: number;   // 10営業日後の騰落率 (%)
}

export interface BacktestResult {
  signalType: string;
  label:      string;
  bullish:    boolean;
  count:      number;
  winRate5d:  number;   // 0-1
  avgRet5d:   number;   // %
  winRate10d: number;
  avgRet10d:  number;
}

export function backtestSignals(bars: OHLCBar[]): BacktestEntry[] {
  if (bars.length < 50) return [];
  const closes = bars.map((b) => b.close);
  const highs  = bars.map((b) => b.high);
  const lows   = bars.map((b) => b.low);
  const entries: BacktestEntry[] = [];

  function pushEntry(type: string, bullish: boolean, atIdx: number) {
    if (atIdx + 10 >= closes.length) return;
    const base  = closes[atIdx];
    const sign  = bullish ? 1 : -1;
    entries.push({
      signalType: type,
      bullish,
      ret5d:  sign * (closes[atIdx + 5]  - base) / base * 100,
      ret10d: sign * (closes[atIdx + 10] - base) / base * 100,
    });
  }

  // ── 1. ゴールデンクロス / デッドクロス（単一パス）─────────────────────────
  const ma5a  = new Array<number | null>(closes.length).fill(null);
  const ma25a = new Array<number | null>(closes.length).fill(null);
  sma(closes, 5).forEach((v, i)  => { ma5a[i + 4]   = v; });
  sma(closes, 25).forEach((v, i) => { ma25a[i + 24]  = v; });

  for (let i = 25; i < closes.length; i++) {
    if (ma5a[i] == null || ma25a[i] == null || ma5a[i - 1] == null || ma25a[i - 1] == null) continue;
    const prev = ma5a[i - 1]! - ma25a[i - 1]!;
    const curr = ma5a[i]!     - ma25a[i]!;
    if (prev <= 0 && curr > 0) pushEntry('goldenCross', true,  i);
    if (prev >= 0 && curr < 0) pushEntry('deadCross',   false, i);
  }

  // ── 2. RSI シグナル（単一パス）──────────────────────────────────────────────
  const rsiVals = rsi(closes, 14);
  const rsiA    = new Array<number | null>(closes.length).fill(null);
  rsiVals.forEach((v, i) => { rsiA[i + 14] = v; });

  for (let i = 15; i < closes.length; i++) {
    const cur = rsiA[i], prv = rsiA[i - 1];
    if (cur == null || prv == null) continue;
    if (prv >= 30 && cur < 30) pushEntry('rsiOversold',  true,  i);
    if (prv < 30  && cur >= 30) pushEntry('rsiRecovery', true,  i);
    if (prv <= 70 && cur > 70)  pushEntry('rsiOverbought', false, i);
  }

  // ── 3. パターンシグナル（スライディングウィンドウ step=5）──────────────────
  const PATTERN_STEP = 5;
  const seen = new Map<string, number>(); // type → last recorded bar

  for (let i = 40; i < bars.length - 10; i += PATTERN_STEP) {
    const window = bars.slice(0, i + 1);
    const signals = detectSignals(window);
    for (const sig of signals) {
      if (!['doubleBottom', 'doubleTop', 'inverseHS', 'headShoulders'].includes(sig.type)) continue;
      const last = seen.get(sig.type) ?? -99;
      if (i - last < 20) continue; // 同一シグナルを20本以内で二重カウントしない
      seen.set(sig.type, i);
      pushEntry(sig.type, sig.bullish, i);
    }
  }

  return entries;
}

export function aggregateBacktest(entries: BacktestEntry[]): BacktestResult[] {
  const byType = new Map<string, BacktestEntry[]>();
  for (const e of entries) {
    if (!byType.has(e.signalType)) byType.set(e.signalType, []);
    byType.get(e.signalType)!.push(e);
  }

  const LABEL: Record<string, string> = {
    inverseHS:     '逆三尊',
    goldenCross:   'ゴールデンクロス',
    doubleBottom:  'W底',
    rsiRecovery:   'RSI底打ち',
    rsiOversold:   'RSI売られすぎ',
    headShoulders: '三尊（天井）',
    deadCross:     'デッドクロス',
    doubleTop:     'M天井',
    rsiOverbought: 'RSI買われすぎ',
  };

  const results: BacktestResult[] = [];
  for (const [type, list] of byType) {
    if (!list.length) continue;
    const wr5  = list.filter((e) => e.ret5d  > 0).length / list.length;
    const wr10 = list.filter((e) => e.ret10d > 0).length / list.length;
    const avg  = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    results.push({
      signalType: type,
      label:      LABEL[type] ?? type,
      bullish:    list[0].bullish,
      count:      list.length,
      winRate5d:  wr5,
      avgRet5d:   avg(list.map((e) => e.ret5d)),
      winRate10d: wr10,
      avgRet10d:  avg(list.map((e) => e.ret10d)),
    });
  }

  // 買いシグナル → 勝率5d降順、売りシグナル → 同様
  const bullish = results.filter((r) => r.bullish).sort((a, b) => b.winRate5d - a.winRate5d);
  const bearish = results.filter((r) => !r.bullish).sort((a, b) => b.winRate5d - a.winRate5d);
  return [...bullish, ...bearish];
}
