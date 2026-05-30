export type UserIntention = 'buy' | 'sell' | 'neutral';
export type StockStatus = 'normal' | 'hot' | 'watch' | 'surge' | 'alert';
export type SecuritiesApp = 'sbi' | 'rakuten' | 'none';

export interface AlertSettings {
  surge?: boolean;
  dip?: boolean;
  volume?: boolean;
  highApproach?: boolean;
  themeChange?: boolean;
  consecutiveDecline?: boolean;
}

export interface Stock {
  id: string;
  code: string;
  name: string;
  market?: 'JP' | 'US' | string;
  price?: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  status?: StockStatus;
  updatedAt?: Date | string;
  priceHistory?: number[];
  dailyCloses?: number[];
  themes?: string[];
  [key: string]: any;
}

export interface OHLCBar {
  time?: string;
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface NewsItem {
  id?: string;
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: string | Date;
}

export interface Article {
  id: string;
  title: string;
  content?: string;
  url?: string;
  summary?: string;
  relatedStocks?: string[];
  relatedThemes?: string[];
  savedAt?: Date | string;
  isProcessed?: boolean;
}

export interface StockCandidate {
  code: string;
  name: string;
  reason?: string;
  context?: string;
  price?: number;
  changePercent?: number;
  source?: 'ai' | 'regex' | string;
}

export interface Notification {
  id: string;
  stockCode: string;
  stockName: string;
  type: 'surge' | 'highApproach' | 'dip' | 'volume' | 'themeChange';
  message: string;
  createdAt: Date;
  isRead: boolean;
}

export interface WatchlistItem {
  stockCode: string;
  intention?: UserIntention;
  group?: string;
  memo?: string;
  addedAt?: Date | string;
  alertSettings?: AlertSettings;
}

export interface UserSettings {
  securitiesApp?: SecuritiesApp | null;
  notificationsEnabled?: boolean;
}
