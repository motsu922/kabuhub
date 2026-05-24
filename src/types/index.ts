export type StockStatus = 'normal' | 'watch' | 'alert' | 'surge';

export interface OHLCBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalSignal {
  type: string;
  label: string;
  description: string;
  bullish: boolean;
}

export interface Stock {
  id: string;
  code: string;
  name: string;
  market: 'JP' | 'US';
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  status: StockStatus;
  updatedAt: Date;
  priceHistory: number[]; // for mini chart
  dailyCloses?: number[]; // for consecutive decline detection
  themes?: string[];
  memo?: string;
  technicalSignals?: TechnicalSignal[];
}

export interface Article {
  id: string;
  url: string;
  title: string;
  summary?: string;
  relatedStocks?: string[]; // stock codes
  relatedThemes?: string[];
  savedAt: Date;
  isProcessed: boolean;
}

export type WatchStyle = 'buy' | 'sell';
export type UserIntention = 'buy' | 'sell' | 'neutral';

export interface WatchlistItem {
  stockCode: string;
  addedAt: Date;
  memo?: string;
  intention?: UserIntention;
  watchStyle?: WatchStyle;
  alertSettings?: AlertSettings;
}

export interface AlertSettings {
  dip: boolean;
  surge: boolean;
  plunge: boolean;
  volume: boolean;
  highApproach: boolean;
  lowApproach: boolean;
  themeChange: boolean;
  consecutiveDecline: boolean; // 続落
}

export type SecuritiesApp =
  | 'sbi'
  | 'rakuten'
  | 'ispeed'
  | 'moomoo'
  | 'matsui'
  | 'monex';

export interface UserSettings {
  securitiesApp: SecuritiesApp | null;
  notificationsEnabled: boolean;
}

export interface StockCandidate {
  name: string;
  code: string;
  context: string;      // テキスト中での言及内容
  price?: number;
  changePercent?: number;
  source: 'ai' | 'regex'; // 抽出方法
}

export interface Notification {
  id: string;
  stockCode: string;
  stockName: string;
  type: 'dip' | 'surge' | 'plunge' | 'volume' | 'highApproach' | 'lowApproach' | 'themeChange';
  message: string;
  createdAt: Date;
  isRead: boolean;
}
