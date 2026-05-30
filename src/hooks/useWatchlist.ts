import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stock, WatchlistItem, AlertSettings, UserIntention } from '../types';
import { StorageService } from '../services/storage';
import { StockDataService } from '../services/stockData';
import { NotificationService } from '../services/notificationService';
import { detectSignals } from '../services/technicalAnalysis';
import { MOCK_STOCKS } from '../constants/mockData';
import { isUSCode } from '../services/stockData';

const REFRESH_INTERVAL_MS = 60_000;

function buildBaseStock(code: string): Stock {
  const mock = MOCK_STOCKS.find((s) => s.code === code);
  if (mock) return mock;
  // モックにない銘柄のデフォルト値
  return {
    id: code, code, name: code, market: isUSCode(code) ? 'US' : 'JP',
    price: 0, previousClose: 0, change: 0, changePercent: 0,
    volume: 0, status: 'normal', updatedAt: new Date(),
    priceHistory: [],
  };
}

export function useWatchlist() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [items,  setItems]  = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const itemsRef = useRef<WatchlistItem[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const watchlistItems = await StorageService.getWatchlist();
      setItems(watchlistItems);
      itemsRef.current = watchlistItems;
      const codes = watchlistItems.map((i) => i.stockCode);
      if (!codes.length) { setStocks([]); return; }

      // ベース情報（名前・テーマ等）。非モック銘柄は社名・テーマを API で解決
      const baseStocks = await Promise.all(codes.map(async (code) => {
        const base = buildBaseStock(code);
        const needsName   = base.name === base.code;
        const needsThemes = !base.themes || base.themes.length === 0;
        const [resolved, themes] = await Promise.all([
          needsName   ? StockDataService.resolveNameByCode(code).catch(() => null) : Promise.resolve(null),
          needsThemes ? StockDataService.fetchThemes(code).catch(() => [])         : Promise.resolve(base.themes ?? []),
        ]);
        return {
          ...base,
          ...(resolved ? { name: resolved } : {}),
          themes: themes.length > 0 ? themes : (base.themes ?? []),
        };
      }));

      // Yahoo Finance 一括取得（1リクエストで全銘柄）
      const quoteMap = await StockDataService.fetchQuotes(codes);

      // ミニチャート用履歴 + テクニカル分析用OHLCを並列取得
      const [historyArr, ohlcArr] = await Promise.all([
        Promise.all(codes.map((c) => StockDataService.fetchPriceHistory(c))),
        Promise.all(codes.map((c) => StockDataService.fetchOHLC(c, '1d'))),
      ]);

      const enriched = baseStocks.map((s, i) => {
        const quote   = quoteMap.get(s.code);
        const history = historyArr[i];
        const ohlc    = ohlcArr[i];
        const technicalSignals = ohlc.length >= 30 ? detectSignals(ohlc) : [];
        return {
          ...s,
          ...(quote ?? {}),
          priceHistory: history.length ? history : s.priceHistory,
          technicalSignals,
        };
      });

      setStocks(enriched);
      setLastUpdatedAt(new Date());

      // アラート判定 → ローカル通知
      NotificationService.checkAndNotify(enriched, itemsRef.current).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初回ロード
  useEffect(() => { load(); }, [load]);

  // 60秒ごとにフォアグラウンドで自動更新
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') load();
    }, REFRESH_INTERVAL_MS);

    // バックグラウンドから復帰したとき即時更新
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') load();
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [load]);

  const addStock = useCallback(async (code: string) => {
    await StorageService.addToWatchlist(code);
    await load();
  }, [load]);

  const removeStock = useCallback(async (code: string) => {
    await StorageService.removeFromWatchlist(code);
    await load();
  }, [load]);

  const isInWatchlist = useCallback(
    (code: string) => items.some((i) => i.stockCode === code),
    [items]
  );

  const getItem = useCallback(
    (code: string) => items.find((i) => i.stockCode === code),
    [items]
  );

  const updateAlertSettings = useCallback(async (code: string, settings: AlertSettings) => {
    await StorageService.updateAlertSettings(code, settings);
    await load();
  }, [load]);

  const updateIntention = useCallback(async (code: string, intention: UserIntention) => {
    await StorageService.updateIntention(code, intention);
    await load();
  }, [load]);

  const updateGroup = useCallback(async (code: string, group: string | null) => {
    await StorageService.updateGroup(code, group);
    await load();
  }, [load]);

  return { stocks, items, isLoading, lastUpdatedAt, addStock, removeStock, isInWatchlist, getItem, updateAlertSettings, updateIntention, updateGroup, refresh: load };
}
