export type UserIntention = 'buy' | 'sell' | 'neutral';
export type StockStatus = 'normal' | 'hot' | 'watch';
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
  price?: number;
  changePercent?: number;
  dailyCloses?: number[];
  [key: string]: any;
}
export interface OHLCBar { time: string; open: number; high: number; low: number; close: number; volume?: number }
export interface NewsItem { title: string; url: string; publishedAt?: string }
export interface Article { id: string; title: string; content?: string; url?: string }
export interface StockCandidate { code: string; name: string; reason?: string }
export interface Notification { id: string; stockCode: string; stockName: string; type: 'surge'|'highApproach'|'dip'|'volume'|'themeChange'; message: string; createdAt: Date; isRead: boolean }
export interface WatchlistItem {
  stockCode: string;
  intention: UserIntention;
  group?: string;
  memo?: string;
  addedAt?: Date | string;
  alertSettings?: AlertSettings;
}
export interface UserSettings { securitiesApp?: SecuritiesApp }
