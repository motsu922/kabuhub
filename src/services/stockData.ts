import { Stock, StockStatus, OHLCBar } from '../types';
import { MOCK_STOCKS } from '../constants/mockData';
import { JP_STOCK_INDEX } from '../constants/japaneseStockIndex';

function computeStatus(changePercent: number): StockStatus {
  const abs = Math.abs(changePercent);
  if (abs >= 5) return 'surge';
  if (abs >= 3) return 'alert';
  if (abs >= 1.5) return 'watch';
  return 'normal';
}

export type ChartInterval = '5m' | '5d' | '1mo' | '1d' | '1wk' | '3y';

const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const TWELVE_KEY = process.env.EXPO_PUBLIC_TWELVE_DATA_API_KEY ?? '';

function toTicker(code: string) {
  return `${code}.T`;
}

const INTERVAL_MAP: Record<ChartInterval, { interval: string; range: string }> = {
  '5m':  { interval: '5m',  range: '1d'  },
  '5d':  { interval: '1d',  range: '5d'  },
  '1mo': { interval: '1d',  range: '1mo' },
  '1d':  { interval: '1d',  range: '3mo' },
  '1wk': { interval: '1wk', range: '1y'  },
  '3y':  { interval: '1wk', range: '3y'  },
};

const DATE_FMT: Record<ChartInterval, Intl.DateTimeFormatOptions> = {
  '5m':  { hour: '2-digit', minute: '2-digit' },
  '5d':  { month: 'numeric', day: 'numeric' },
  '1mo': { month: 'numeric', day: 'numeric' },
  '1d':  { month: 'numeric', day: 'numeric' },
  '1wk': { year: '2-digit', month: 'numeric' },
  '3y':  { year: '2-digit', month: 'numeric' },
};

// ─────────────────────────────────────────────────────────────────────────────

// 検索結果キャッシュ（クエリ → Stock[]）
const searchCache = new Map<string, Stock[]>();
// 社名解決キャッシュ（コード → 社名）
const nameCache = new Map<string, string>();
// リモートで発見済みの銘柄プール（コード → Stock）: ローカル部分一致に使い回す
const stockPool = new Map<string, Stock>();

function addToPool(stock: Stock) {
  nameCache.set(stock.code, stock.name);
  stockPool.set(stock.code, stock);
}

export const StockDataService = {

  // ① 即時ローカル検索（同期）: MOCK_STOCKS + ローカルインデックス + stockPool を部分一致
  searchStockLocal(query: string): Stock[] {
    const q = query.trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    const results: Stock[] = [];
    const seen = new Set<string>();

    type Entry = { code: string; name: string; en?: string };
    const allEntries: Entry[] = [
      ...MOCK_STOCKS.map((s) => ({ code: s.code, name: s.name })),
      ...JP_STOCK_INDEX,
      ...[...stockPool.values()].map((s) => ({ code: s.code, name: s.name })),
    ];

    for (const entry of allEntries) {
      if (seen.has(entry.code)) continue;
      const matches =
        entry.code.toLowerCase().includes(ql) ||
        entry.name.toLowerCase().includes(ql) ||
        (entry.en != null && entry.en.toLowerCase().includes(ql));
      if (!matches) continue;
      seen.add(entry.code);
      const mock = MOCK_STOCKS.find((s) => s.code === entry.code);
      if (mock) { results.push(mock); continue; }
      const pooled = stockPool.get(entry.code);
      results.push(pooled ?? {
        id: entry.code, code: entry.code, name: entry.name, market: 'JP',
        price: 0, previousClose: 0, change: 0, changePercent: 0,
        volume: 0, status: 'normal', updatedAt: new Date(), priceHistory: [],
      });
    }

    return results;
  },

  // ② リモート検索（非同期）: Yahoo Finance search（日本語クエリ対応・全上場銘柄）
  async searchStockRemote(query: string): Promise<Stock[]> {
    const q = query.trim();
    if (!q) return [];
    if (searchCache.has(q)) return searchCache.get(q)!;

    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&region=JP&lang=ja`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return [];
      const json = await res.json();
      type YFQuote = { symbol: string; shortname?: string; longname?: string; quoteType?: string; exchange?: string };
      const quotes: YFQuote[] = json?.quotes ?? [];

      const localCodes = new Set([
        ...MOCK_STOCKS.map((s) => s.code),
        ...JP_STOCK_INDEX.map((s) => s.code),
      ]);

      const remote = quotes
        .filter((r) => r.quoteType === 'EQUITY' && /^\d{4}\.T$/.test(r.symbol))
        .map((r) => {
          const code = r.symbol.replace('.T', '');
          // ローカルインデックスに日本語名があれば優先使用
          const jpEntry = JP_STOCK_INDEX.find((s) => s.code === code);
          const name = jpEntry?.name ?? nameCache.get(code) ?? r.longname ?? r.shortname ?? code;
          const stock: Stock = {
            id: code, code, name, market: 'JP',
            price: 0, previousClose: 0, change: 0, changePercent: 0,
            volume: 0, status: 'normal' as const, updatedAt: new Date(), priceHistory: [],
          };
          addToPool(stock);
          return { stock, inLocalIndex: localCodes.has(code) };
        })
        // ローカルインデックス既存銘柄はローカル結果と重複するので除外
        .filter(({ inLocalIndex }) => !inLocalIndex)
        .map(({ stock }) => stock);

      searchCache.set(q, remote);
      return remote;
    } catch {
      return [];
    }
  },
  // 銘柄名/コードで検索して最初の日本株コードを返す（AI抽出用）
  async searchByName(name: string): Promise<{ code: string; fullName: string } | null> {
    try {
      const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(name)}&outputsize=5&apikey=${TWELVE_KEY}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const items: Array<{ symbol: string; instrument_name: string; country: string; instrument_type: string }> =
        json?.data ?? [];
      const match = items.find(
        (r) => r.country === 'Japan' && r.instrument_type === 'Common Stock' && /^\d{4}$/.test(r.symbol)
      );
      if (!match) return null;
      return { code: match.symbol, fullName: match.instrument_name };
    } catch {
      return null;
    }
  },

  // コードで完全一致する銘柄名を取得（キャッシュ付き）
  // 優先順位: JP_STOCK_INDEX（日本語）> nameCache > Twelve Data API（英語）
  async resolveNameByCode(code: string): Promise<string | null> {
    const local = JP_STOCK_INDEX.find((s) => s.code === code);
    if (local) {
      nameCache.set(code, local.name);
      return local.name;
    }
    if (nameCache.has(code)) return nameCache.get(code)!;
    try {
      const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(code)}&outputsize=10&apikey=${TWELVE_KEY}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const items: Array<{ symbol: string; instrument_name: string; country: string; instrument_type: string }> =
        json?.data ?? [];
      const match = items.find((r) => r.symbol === code && r.country === 'Japan');
      const name = match?.instrument_name ?? null;
      if (name) {
        nameCache.set(code, name);
        if (!stockPool.has(code)) {
          addToPool({
            id: code, code, name, market: 'JP',
            price: 0, previousClose: 0, change: 0, changePercent: 0,
            volume: 0, status: 'normal', updatedAt: new Date(), priceHistory: [],
          });
        }
      }
      return name;
    } catch {
      return null;
    }
  },

  async getStockDetail(code: string): Promise<Stock | null> {
    const mock = MOCK_STOCKS.find((s) => s.code === code);
    if (mock) return mock;
    // モックにない銘柄: コード完全一致で社名取得 + 株価取得
    const [name, quote] = await Promise.all([
      StockDataService.resolveNameByCode(code).catch(() => null),
      StockDataService.fetchQuote(code).catch(() => null),
    ]);
    if (!quote) return null;
    return {
      id: code, code,
      name: name ?? code,
      market: 'JP',
      price: quote.price ?? 0,
      previousClose: quote.previousClose ?? 0,
      change: quote.change ?? 0,
      changePercent: quote.changePercent ?? 0,
      volume: quote.volume ?? 0,
      status: quote.status ?? 'normal',
      updatedAt: quote.updatedAt ?? new Date(),
      priceHistory: [],
    };
  },

  // v8/chart で現在値 + 日足バーから前日終値を正確に算出
  async fetchQuote(code: string): Promise<Partial<Stock> | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${toTicker(code)}?interval=1d&range=5d&includePrePost=false&_=${Date.now()}`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`${res.status}`);
      const json   = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('no result');

      const meta   = result.meta;
      const q      = result.indicators?.quote?.[0] ?? {};
      const price  = meta.regularMarketPrice as number;

      // 直近取引日を基準にする（土日・祝前9時は金曜/前営業日まで戻す）
      const refDate = getSessionRefDate();

      const timestamps: number[] = result.timestamp ?? [];
      const closes: number[] = timestamps
        .map((ts: number, i: number) => {
          const barDate = new Date(ts * 1000); barDate.setHours(0, 0, 0, 0);
          return barDate < refDate ? (q.close?.[i] as number) : null;
        })
        .filter((c): c is number => c != null && !isNaN(c));

      // 全バー終値（続落検知用）
      const allCloses: number[] = timestamps
        .map((_: number, i: number) => q.close?.[i] as number)
        .filter((c: number) => c != null && !isNaN(c));

      // 前日終値: meta優先 → 今日より前の最新バー終値
      const previousClose: number =
        (meta.regularMarketPreviousClose != null && meta.regularMarketPreviousClose > 0)
          ? meta.regularMarketPreviousClose
          : (closes.length >= 1 ? closes[closes.length - 1] : price);

      const change        = price - previousClose;
      const changePercent = (change / previousClose) * 100;

      return {
        price:         round(price),
        previousClose: round(previousClose),
        change:        round(change),
        changePercent: round2(changePercent),
        volume:        meta.regularMarketVolume ?? 0,
        status:        computeStatus(changePercent),
        updatedAt:     new Date(),
        dailyCloses:   allCloses,
      };
    } catch {
      return null;
    }
  },

  // 複数銘柄を並列取得（ウォッチリスト用）
  async fetchQuotes(codes: string[]): Promise<Map<string, Partial<Stock>>> {
    const result = new Map<string, Partial<Stock>>();
    if (!codes.length) return result;
    const entries = await Promise.all(
      codes.map(async (code) => {
        const q = await StockDataService.fetchQuote(code);
        return { code, q };
      })
    );
    for (const { code, q } of entries) {
      if (q) result.set(code, q);
    }
    return result;
  },

  // OHLCチャートデータ（v8 chart API）
  async fetchOHLC(code: string, interval: ChartInterval = '1d'): Promise<OHLCBar[]> {
    try {
      const { interval: iv, range } = INTERVAL_MAP[interval];
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${toTicker(code)}?interval=${iv}&range=${range}&includePrePost=false&_=${Date.now()}`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`${res.status}`);
      const json   = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('no result');

      const timestamps: number[]  = result.timestamp ?? [];
      const q                     = result.indicators?.quote?.[0] ?? {};
      const fmt                   = DATE_FMT[interval];

      return timestamps
        .map((ts, i) => ({
          date:   new Date(ts * 1000).toLocaleString('ja-JP', fmt),
          open:   q.open?.[i]   as number,
          high:   q.high?.[i]   as number,
          low:    q.low?.[i]    as number,
          close:  q.close?.[i]  as number,
          volume: q.volume?.[i] as number ?? 0,
        }))
        .filter((b) => b.open != null && b.close != null && !isNaN(b.open));
    } catch {
      return [];
    }
  },

  // 市場指数取得（^N225 など .T を付けないシンボル用）
  async fetchIndexQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false&_=${Date.now()}`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return null;
      const json   = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) return null;
      const meta = result.meta;
      const price = meta.regularMarketPrice as number;
      const prev  = meta.regularMarketPreviousClose as number;
      if (!price || !prev) return null;
      const change = price - prev;
      return { price, change, changePercent: (change / prev) * 100 };
    } catch {
      return null;
    }
  },

  // バックテスト用 2年分日足データ
  async fetchOHLCLong(code: string): Promise<OHLCBar[]> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${toTicker(code)}?interval=1d&range=2y&includePrePost=false&_=${Date.now()}`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`${res.status}`);
      const json   = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('no result');
      const timestamps: number[] = result.timestamp ?? [];
      const q = result.indicators?.quote?.[0] ?? {};
      const fmt: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric' };
      return timestamps
        .map((ts, i) => ({
          date:   new Date(ts * 1000).toLocaleString('ja-JP', fmt),
          open:   q.open?.[i]   as number,
          high:   q.high?.[i]   as number,
          low:    q.low?.[i]    as number,
          close:  q.close?.[i]  as number,
          volume: q.volume?.[i] as number ?? 0,
        }))
        .filter((b) => b.open != null && b.close != null && !isNaN(b.open));
    } catch {
      return [];
    }
  },

  // ミニチャート用の終値履歴（当日5分足）
  async fetchPriceHistory(code: string): Promise<number[]> {
    const bars = await StockDataService.fetchOHLC(code, '5m');
    return bars.map((b) => b.close);
  },

  // 共通テーマでスコアリングして関連銘柄を返す（自分自身を除く、上位 limit 件）
  getRelatedByTheme(code: string, themes: string[], limit = 3): Stock[] {
    if (!themes.length) return [];
    return MOCK_STOCKS
      .filter((s) => s.code !== code && s.themes?.length)
      .map((s) => ({
        stock: s,
        score: (s.themes ?? []).filter((t) => themes.includes(t)).length,
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ stock }) => stock);
  },

  formatPrice(price: number): string {
    return price.toLocaleString('ja-JP') + '円';
  },

  formatChange(change: number, changePercent: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toLocaleString('ja-JP')} (${sign}${changePercent.toFixed(2)}%)`;
  },

  formatVolume(volume: number): string {
    if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M株`;
    if (volume >= 1_000)     return `${(volume / 1_000).toFixed(0)}K株`;
    return `${volume}株`;
  },
};

function round(n: number)  { return Math.round(n * 10)   / 10; }
function round2(n: number) { return Math.round(n * 100)  / 100; }

// 直近の取引日（平日）を返す。
// 9時前 → 1日戻す、土日 → 金曜まで戻す（月曜9時前は金曜になる）
function getSessionRefDate(): Date {
  const d = new Date();
  if (d.getHours() < 9) d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
