import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stock, Article, UserSettings, WatchlistItem } from '../types';

const KEYS = {
  watchlist: 'watchlist',
  articles: 'articles',
  settings: 'settings',
  stocks: 'stocks_cache',
} as const;

export const StorageService = {
  async getWatchlist(): Promise<WatchlistItem[]> {
    const raw = await AsyncStorage.getItem(KEYS.watchlist);
    return raw ? JSON.parse(raw) : [];
  },

  async saveWatchlist(items: WatchlistItem[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.watchlist, JSON.stringify(items));
  },

  async addToWatchlist(stockCode: string, memo?: string): Promise<void> {
    const items = await StorageService.getWatchlist();
    const exists = items.find((i) => i.stockCode === stockCode);
    if (exists) return;
    items.push({
      stockCode,
      addedAt: new Date(),
      memo,
      alertSettings: {
        dip: true,
        surge: true,
        plunge: true,
        volume: true,
        highApproach: false,
        lowApproach: false,
        themeChange: true,
        consecutiveDecline: true,
      },
    });
    await StorageService.saveWatchlist(items);
  },

  async removeFromWatchlist(stockCode: string): Promise<void> {
    const items = await StorageService.getWatchlist();
    await StorageService.saveWatchlist(items.filter((i) => i.stockCode !== stockCode));
  },

  async updateAlertSettings(stockCode: string, settings: import('../types').AlertSettings): Promise<void> {
    const items = await StorageService.getWatchlist();
    const idx = items.findIndex((i) => i.stockCode === stockCode);
    if (idx >= 0) {
      items[idx].alertSettings = settings;
      await StorageService.saveWatchlist(items);
    }
  },

  async updateIntention(stockCode: string, intention: import('../types').UserIntention): Promise<void> {
    const items = await StorageService.getWatchlist();
    const idx = items.findIndex((i) => i.stockCode === stockCode);
    if (idx >= 0) {
      items[idx].intention = intention;
      await StorageService.saveWatchlist(items);
    }
  },

  async updateWatchStyle(stockCode: string, style: import('../types').WatchStyle): Promise<void> {
    const { WATCH_PRESETS } = await import('../constants/watchPresets');
    const items = await StorageService.getWatchlist();
    const idx = items.findIndex((i) => i.stockCode === stockCode);
    if (idx >= 0) {
      items[idx].watchStyle    = style;
      items[idx].alertSettings = WATCH_PRESETS[style].settings;
      await StorageService.saveWatchlist(items);
    }
  },

  async getArticles(): Promise<Article[]> {
    const raw = await AsyncStorage.getItem(KEYS.articles);
    if (!raw) return [];
    const articles: Article[] = JSON.parse(raw);
    return articles.map((a) => ({ ...a, savedAt: new Date(a.savedAt) }));
  },

  async saveArticle(article: Article): Promise<void> {
    const articles = await StorageService.getArticles();
    const idx = articles.findIndex((a) => a.id === article.id);
    if (idx >= 0) {
      articles[idx] = article;
    } else {
      articles.unshift(article);
    }
    await AsyncStorage.setItem(KEYS.articles, JSON.stringify(articles));
  },

  async deleteArticle(id: string): Promise<void> {
    const articles = await StorageService.getArticles();
    await AsyncStorage.setItem(
      KEYS.articles,
      JSON.stringify(articles.filter((a) => a.id !== id))
    );
  },

  async getSettings(): Promise<UserSettings> {
    const raw = await AsyncStorage.getItem(KEYS.settings);
    return raw ? JSON.parse(raw) : { securitiesApp: null, notificationsEnabled: true };
  },

  async saveSettings(settings: UserSettings): Promise<void> {
    await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
  },

  async getCachedStocks(): Promise<Stock[]> {
    const raw = await AsyncStorage.getItem(KEYS.stocks);
    if (!raw) return [];
    const stocks: Stock[] = JSON.parse(raw);
    return stocks.map((s) => ({ ...s, updatedAt: new Date(s.updatedAt) }));
  },

  async cacheStocks(stocks: Stock[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.stocks, JSON.stringify(stocks));
  },
};
