import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stock, OHLCBar, WatchlistItem, AlertSettings, UserIntention, RefreshInterval, UserSettings } from '../types';
import { StorageService } from '../services/storage';
import { StockDataService } from '../services/stockData';
import { NotificationService } from '../services/notificationService';
import { detectSignals } from '../services/technicalAnalysis';
import { MOCK_STOCKS } from '../constants/mockData';
import { isUSCode } from '../services/stockData';

const REFRESH_INTERVAL_MS: Record<RefreshInterval, number | null> = {
  manual: null,
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
};

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
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const itemsRef = useRef<WatchlistItem[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const watchlistItems = await StorageService.getWatchlist();
      const appSettings = await StorageService.getSettings();
      setSettings(appSettings);
      setItems(watchlistItems);
      itemsRef.current = watchlistItems;
      const codes = watchlistItems.map((i) => i.stockCode);
      if (!codes.length) { setStocks([]); return; }

      // ベース情報（名前）。非モック銘柄は社名を API で解決
      const baseStocks = await Promise.all(codes.map(async (code) => {
        const base = buildBaseStock(code);
        const needsName = base.name === base.code;
        const resolved = needsName
          ? await StockDataService.resolveNameByCode(code).catch(() => null)
          : null;
        return { ...base, ...(resolved ? { name: resolved } : {}) };
      }));

      // Yahoo Finance 一括取得（1リクエストで全銘柄）
      const quoteMap = await StockDataService.fetchQuotes(codes);

      // ミニチャート用履歴 + テクニカル分析用OHLC(日足/週足)を並列取得
      const [historyArr, ohlcArr, ohlcWeeklyArr] = await Promise.all([
        Promise.all(codes.map((c) => StockDataService.fetchPriceHistory(c))),
        Promise.all(codes.map((c) => StockDataService.fetchOHLC(c, '1d'))),
        Promise.all(codes.map((c) => StockDataService.fetchOHLC(c, '1wk').catch(() => [] as OHLCBar[]))),
      ]);

      const calcPct = (bars: OHLCBar[], n: number) => {
        if (bars.length <= n) return undefined;
        const last = bars[bars.length - 1].close;
        const prev = bars[bars.length - 1 - n].close;
        return prev !== 0 ? ((last - prev) / prev) * 100 : undefined;
      };

      const enriched = baseStocks.map((s, i) => {
        const quote      = quoteMap.get(s.code);
        const history    = historyArr[i];
        const ohlc       = ohlcArr[i];
        const ohlcWeekly = ohlcWeeklyArr[i];
        const technicalSignals = ohlc.length >= 30 ? detectSignals(ohlc) : [];
        const avgVolume20d = ohlc.length >= 5
          ? ohlc.slice(-Math.min(ohlc.length, 20)).reduce((sum, b) => sum + b.volume, 0) / Math.min(ohlc.length, 20)
          : undefined;
        return {
          ...s,
          ...(quote ?? {}),
          priceHistory: history.length ? history : s.priceHistory,
          technicalSignals,
          avgVolume20d,
          change7d:   calcPct(ohlc, 7),
          change30d:  calcPct(ohlc, 30),
          change365d: calcPct(ohlcWeekly, 52),
        };
      });

      setStocks(enriched);
      setLastUpdatedAt(new Date());

      // アラート判定 → ローカル通知
      NotificationService.checkAndNotify(enriched, itemsRef.current, appSettings).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初回ロード
  useEffect(() => { load(); }, [load]);

  // 60秒ごとにフォアグラウンドで自動更新
  useEffect(() => {
    const interval = settings ? REFRESH_INTERVAL_MS[settings.refreshInterval] : REFRESH_INTERVAL_MS['1m'];
    const timer = interval
      ? setInterval(() => {
          if (AppState.currentState === 'active') load();
        }, interval)
      : null;

    // バックグラウンドから復帰したとき即時更新
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && settings?.refreshOnAppActive !== false) load();
    });

    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [load, settings?.refreshInterval, settings?.refreshOnAppActive]);

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
    // items だけ即時更新 — 株価データの再取得は不要
    setItems(prev => prev.map(item =>
      item.stockCode === code ? { ...item, intention } : item
    ));
    itemsRef.current = itemsRef.current.map(item =>
      item.stockCode === code ? { ...item, intention } : item
    );
  }, []);

  const updateGroup = useCallback(async (code: string, group: string | null) => {
    await StorageService.updateGroup(code, group);
    await load();
  }, [load]);

  return { stocks, items, isLoading, lastUpdatedAt, addStock, removeStock, isInWatchlist, getItem, updateAlertSettings, updateIntention, updateGroup, refresh: load };
}
