import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stock, WatchlistItem, AlertSettings, UserIntention } from '../types';
import { StorageService } from '../services/storage';
import { StockDataService } from '../services/stockData';

export function useWatchlist() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const w = await StorageService.getWatchlist();
    const normalized = w.map((i) => ({ ...i, intention: i.intention ?? 'neutral' as UserIntention }));
    setItems(normalized);

    const details = await Promise.all(
      normalized.map(async (i) => {
        const d = await StockDataService.getStockDetail(i.stockCode);
        if (d) return d;
        return { id: i.stockCode, code: i.stockCode, name: i.stockCode } as Stock;
      })
    );
    setStocks(details);
    setLastUpdatedAt(new Date());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const getItem = useCallback((code: string) => items.find((i) => i.stockCode === code), [items]);
  const isInWatchlist = useCallback((code: string) => items.some((i) => i.stockCode === code), [items]);

  const addStock = useCallback(async (input: Stock | string) => {
    const code = typeof input === 'string' ? input : input.code;
    if (!code || isInWatchlist(code)) return;
    await StorageService.addToWatchlist(code);
    await load();
  }, [isInWatchlist, load]);

  const removeStock = useCallback(async (code: string) => {
    await StorageService.removeFromWatchlist(code);
    await load();
  }, [load]);

  const updateAlertSettings = useCallback(async (stockCode: string, settings: AlertSettings) => {
    await StorageService.updateAlertSettings(stockCode, settings);
    await load();
  }, [load]);

  const updateIntention = useCallback(async (stockCode: string, intention: UserIntention) => {
    const exists = items.some((i) => i.stockCode === stockCode);
    if (!exists) {
      await StorageService.addToWatchlist(stockCode);
    }
    await StorageService.updateIntention(stockCode, intention);
    await load();
  }, [items, load]);

  const updateGroup = useCallback(async (stockCode: string, group: string | null) => {
    await StorageService.updateGroup(stockCode, group);
    await load();
  }, [load]);

  const value = useMemo(() => ({
    stocks,
    items,
    isLoading,
    lastUpdatedAt,
    getItem,
    refresh,
    isInWatchlist,
    addStock,
    removeStock,
    updateAlertSettings,
    updateIntention,
    updateGroup,
  }), [stocks, items, isLoading, lastUpdatedAt, getItem, refresh, isInWatchlist, addStock, removeStock, updateAlertSettings, updateIntention, updateGroup]);

  return value;
}
