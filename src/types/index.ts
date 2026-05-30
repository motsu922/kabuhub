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
  memo?: string;
  technicalSignals?: TechnicalSignal[];
  week52High?: number;
  week52Low?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: Date;
}

export interface Article {
  id: string;
  url: string;
  title: string;
  summary?: string;
  relatedStocks?: string[]; // stock codes
  savedAt: Date;
  isProcessed: boolean;
}

export type UserIntention = 'buy' | 'sell' | 'neutral';

export interface WatchlistItem {
  stockCode: string;
  addedAt: Date;
  memo?: string;
  intention?: UserIntention;
  alertSettings?: AlertSettings;
  group?: string;
}

export interface AlertSettings {
  dip: boolean;
  surge: boolean;
  volume: boolean;
  highApproach: boolean;
  consecutiveDecline: boolean; // 続落
}

export interface MarketIndex {
  id: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export type SecuritiesApp = 'ispeed';

export interface UserSettings {
  securitiesApp: SecuritiesApp | null;
  notificationsEnabled: boolean;
}

export interface StockCandidate {
  name: string;
  code: string | null;  // コードが特定できない場合は null
  context: string;      // テキスト中での言及内容
  price?: number;
  changePercent?: number;
  source: 'ai' | 'regex'; // 抽出方法
}

export interface Notification {
  id: string;
  stockCode: string;
  stockName: string;
  type: 'dip' | 'surge' | 'volume' | 'highApproach';
  message: string;
  createdAt: Date;
  isRead: boolean;
}
