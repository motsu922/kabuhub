import { useState } from 'react';
import { Stock, WatchlistItem } from '../types';

export function useWatchlist() {
  const [stocks] = useState<Stock[]>([]);
  const [items] = useState<WatchlistItem[]>([]);
  return {
    stocks,
    items,
    isLoading: false,
    lastUpdatedAt: new Date(),
    getItem: (code: string) => items.find(i => i.stockCode === code),
    refresh: () => {},
    isInWatchlist: (_code: string) => false,
    addStock: async (_s: Stock) => {},
    removeStock: async (_code: string) => {},
    updateAlertSettings: async () => {},
    updateIntention: async () => {},
    updateGroup: async () => {},
  };
}
