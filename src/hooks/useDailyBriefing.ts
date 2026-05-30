import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stock, WatchlistItem, UserIntention } from '../types';
import { AISummaryService } from '../services/aiSummary';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const INTENTION_PRIORITY: Record<UserIntention, number> = { hold: 0, buy: 1, sell: 1, neutral: 99 };

function cacheKey(): string {
  const d = new Date();
  return `@kabuhub_briefing_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CacheEntry {
  lines: string[];
  generatedAt: number;
}

export function useDailyBriefing(stocks: Stock[], items: WatchlistItem[]) {
  const [lines, setLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const hasAttempted = useRef(false);

  const generate = useCallback(async (force: boolean) => {
    if (!stocks.length) return;

    if (!force) {
      try {
        const raw = await AsyncStorage.getItem(cacheKey());
        if (raw) {
          const entry: CacheEntry = JSON.parse(raw);
          if (Date.now() - entry.generatedAt < CACHE_TTL_MS) {
            setLines(entry.lines);
            setGeneratedAt(new Date(entry.generatedAt));
            return;
          }
        }
      } catch {}
    }

    const inputs = stocks
      .map((s) => {
        const item = items.find((i) => i.stockCode === s.code);
        return { ...s, intention: (item?.intention ?? 'neutral') as UserIntention };
      })
      .filter((s) => s.intention !== 'neutral' || Math.abs(s.changePercent) >= 2)
      .sort((a, b) => {
        const pa = INTENTION_PRIORITY[a.intention];
        const pb = INTENTION_PRIORITY[b.intention];
        if (pa !== pb) return pa - pb;
        return Math.abs(b.changePercent) - Math.abs(a.changePercent);
      })
      .slice(0, 8)
      .map((s) => ({
        name: s.name,
        code: s.code,
        intention: s.intention,
        changePercent: s.changePercent,
        price: s.price,
      }));

    if (!inputs.length) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await AISummaryService.generateDailyBriefing(inputs);
      const now = Date.now();
      setLines(result.lines);
      setGeneratedAt(new Date(now));
      const entry: CacheEntry = { lines: result.lines, generatedAt: now };
      await AsyncStorage.setItem(cacheKey(), JSON.stringify(entry));
    } catch (e: any) {
      setError(e.message ?? 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [stocks, items]);

  const hasStocks = stocks.length > 0;
  useEffect(() => {
    if (hasStocks && !hasAttempted.current) {
      hasAttempted.current = true;
      generate(false);
    }
  }, [hasStocks]); // eslint-disable-line react-hooks/exhaustive-deps

  return { lines, isLoading, error, generatedAt, refresh: () => generate(true) };
}
