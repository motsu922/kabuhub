import { Stock, StockStatus, OHLCBar, NewsItem } from '../types';
import { MOCK_STOCKS } from '../constants/mockData';
import { JP_STOCK_INDEX } from '../constants/japaneseStockIndex';

function computeStatus(changePercent: number): StockStatus {
  if (changePercent >= 5) return 'surge';
  if (changePercent <= -3) return 'alert';
  if (Math.abs(changePercent) >= 1.5) return 'watch';
  return 'normal';
}

export type ChartInterval = '5m' | '5d' | '1mo' | '1d' | '1wk' | '3y';

const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

export function isUSCode(code: string): boolean {
  return /^[A-Z]{1,5}$/.test(code);
}

function toTicker(code: string) {
  return isUSCode(code) ? code : `${code}.T`;
}

const INTERVAL_MAP: Record<ChartInterval, { interval: string; range: string }> = {
  '5m':  { interval: '5m',  range: '1d'  },
  '5d':  { interval: '60m', range: '5d'  },
  '1mo': { interval: '1d',  range: '1mo' },
  '1d':  { interval: '1d',  range: '3mo' },
  '1wk': { interval: '1wk', range: '1y'  },
  '3y':  { interval: '1wk', range: '3y'  },
};

const DATE_FMT: Record<ChartInterval, Intl.DateTimeFormatOptions> = {
  '5m':  { hour: '2-digit', minute: '2-digit' },
  '5d':  { month: 'numeric', day: 'numeric', hour: '2-digit' },
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
// テーマキャッシュ（コード → string[]）
const themesCache = new Map<string, string[]>();

// Yahoo Finance industry → 日本語テーマタグ
const INDUSTRY_THEMES: Record<string, string[]> = {
  'Semiconductor Equipment & Materials': ['半導体製造装置', '半導体'],
  'Semiconductors':                       ['半導体'],
  'Electronic Components':               ['電子部品'],
  'Electronics & Computer Distribution': ['電子部品', 'IT'],
  'Software—Application':                ['ソフトウェア', 'IT'],
  'Software—Infrastructure':             ['ソフトウェア', 'IT'],
  'Information Technology Services':     ['IT', 'DX'],
  'Internet Content & Information':      ['インターネット', 'IT'],
  'Computer Hardware':                   ['ハードウェア', 'IT'],
  'Consumer Electronics':                ['家電', '電子機器'],
  'Scientific & Technical Instruments':  ['精密機器'],
  'Auto Manufacturers':                  ['自動車'],
  'Auto Parts':                          ['自動車部品', '自動車'],
  'Auto & Truck Dealerships':            ['自動車'],
  'Banks—Regional':                      ['地銀', '銀行'],
  'Banks—Diversified':                   ['銀行', 'メガバンク'],
  'Insurance—Life':                      ['保険', '金融'],
  'Insurance—Diversified':               ['保険', '金融'],
  'Insurance—Property & Casualty':       ['保険', '金融'],
  'Capital Markets':                     ['証券', '金融'],
  'Asset Management':                    ['資産運用', '金融'],
  'Credit Services':                     ['金融', 'フィンテック'],
  'Drug Manufacturers—General':          ['医薬品'],
  'Drug Manufacturers—Specialty & Generic': ['医薬品', 'ジェネリック'],
  'Biotechnology':                       ['バイオ', '医薬品'],
  'Medical Instruments & Supplies':      ['医療機器'],
  'Medical Devices':                     ['医療機器', 'ヘルスケア'],
  'Healthcare Plans':                    ['医療', 'ヘルスケア'],
  'Aerospace & Defense':                 ['防衛', '航空宇宙'],
  'Industrial Machinery':                ['産業機械'],
  'Specialty Industrial Machinery':      ['産業機械', '製造'],
  'Farm & Heavy Construction Machinery': ['建設機械'],
  'Tools & Accessories':                 ['工具・機器'],
  'Electrical Equipment & Parts':        ['電気機器'],
  'Conglomerates':                       ['総合電機', '多角経営'],
  'Railroads':                           ['鉄道', 'インフラ'],
  'Airlines':                            ['航空', '旅行'],
  'Trucking':                            ['物流', '輸送'],
  'Shipping & Ports':                    ['海運', '物流'],
  'Integrated Freight & Logistics':      ['物流'],
  'Steel':                               ['鉄鋼', '素材'],
  'Aluminum':                            ['非鉄金属', '素材'],
  'Copper':                              ['非鉄金属', '素材'],
  'Other Industrial Metals & Mining':    ['素材', '資源'],
  'Chemicals':                           ['化学'],
  'Specialty Chemicals':                 ['特殊化学', '化学'],
  'Agricultural Inputs':                 ['農業', '化学'],
  'Oil & Gas E&P':                       ['石油・ガス', 'エネルギー'],
  'Oil & Gas Integrated':                ['石油・ガス', 'エネルギー'],
  'Oil & Gas Refining & Marketing':      ['石油・ガス', 'エネルギー'],
  'Utilities—Regulated Electric':        ['電力', '公益事業'],
  'Utilities—Regulated Gas':             ['ガス', '公益事業'],
  'Utilities—Renewable':                 ['再生可能エネルギー', '脱炭素'],
  'Telecom Services':                    ['通信'],
  'Wireless Telecom Services':           ['通信', '5G'],
  'Electronic Gaming & Multimedia':      ['ゲーム', 'エンタメ'],
  'Entertainment':                       ['エンタメ', 'コンテンツ'],
  'Publishing':                          ['出版', 'メディア'],
  'Broadcasting':                        ['放送', 'メディア'],
  'Advertising Agencies':                ['広告', 'メディア'],
  'Lodging':                             ['ホテル', '旅行'],
  'Resorts & Casinos':                   ['レジャー', '旅行'],
  'Restaurants':                         ['外食', '飲食'],
  'Retail—Cyclical':                     ['小売'],
  'Retail—Defensive':                    ['小売', '生活必需品'],
  'Department Stores':                   ['百貨店', '小売'],
  'Grocery Stores':                      ['食品スーパー', '小売'],
  'Food Distribution':                   ['食品', '物流'],
  'Packaged Foods':                      ['食品', '加工食品'],
  'Beverages—Non-Alcoholic':             ['飲料', '食品'],
  'Beverages—Alcoholic':                 ['飲料', 'アルコール'],
  'Real Estate—Development':             ['不動産', '住宅'],
  'Real Estate—Diversified':             ['不動産'],
  'Real Estate Services':                ['不動産'],
  'Staffing & Employment Services':      ['人材', 'HR'],
  'Consulting Services':                 ['コンサルティング', 'DX'],
  'Waste Management':                    ['環境', '廃棄物処理'],
  'Paper & Paper Products':              ['紙・パルプ', '素材'],
  'Lumber & Wood Production':            ['木材', '素材'],
  'Building Materials':                  ['建材', '住宅'],
  'Engineering & Construction':          ['建設', 'インフラ'],
};

const SECTOR_THEMES: Record<string, string> = {
  'Technology':             'テクノロジー',
  'Financial Services':     '金融',
  'Healthcare':             'ヘルスケア',
  'Consumer Cyclical':      '消費財',
  'Industrials':            '産業',
  'Basic Materials':        '素材',
  'Communication Services': '通信',
  'Energy':                 'エネルギー',
  'Real Estate':            '不動産',
  'Consumer Defensive':     '生活必需品',
  'Utilities':              '公益事業',
};

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

  // ② リモート検索（非同期）: Yahoo Finance search（JP・US両対応）
  async searchStockRemote(query: string): Promise<Stock[]> {
    const q = query.trim();
    if (!q) return [];
    if (searchCache.has(q)) return searchCache.get(q)!;

    const isUS = isUSCode(q.toUpperCase());

    try {
      type YFQuote = { symbol: string; shortname?: string; longname?: string; quoteType?: string };
      let remote: Stock[];

      if (isUS) {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q.toUpperCase())}&lang=en&region=US&quotesCount=20&newsCount=0`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return [];
        const json = await res.json();
        const quotes: YFQuote[] = json?.quotes ?? [];
        remote = quotes
          .filter((r) => r.quoteType === 'EQUITY' && /^[A-Z]{1,5}$/.test(r.symbol))
          .map((r) => {
            const code = r.symbol;
            const name = r.longname ?? r.shortname ?? code;
            nameCache.set(code, name);
            const stock: Stock = {
              id: code, code, name, market: 'US',
              price: 0, previousClose: 0, change: 0, changePercent: 0,
              volume: 0, status: 'normal', updatedAt: new Date(), priceHistory: [],
            };
            stockPool.set(code, stock);
            return stock;
          });
      } else {
        // lang=ja&region=JP で日本語社名を優先取得
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=ja&region=JP&quotesCount=20&newsCount=0&enableFuzzyQuery=true`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return [];
        const json = await res.json();
        const quotes: YFQuote[] = json?.quotes ?? [];

        const localCodes = new Set([
          ...MOCK_STOCKS.map((s) => s.code),
          ...JP_STOCK_INDEX.map((s) => s.code),
        ]);

        remote = quotes
          .filter((r) => r.quoteType === 'EQUITY' && /^[A-Z0-9]{4}\.T$/.test(r.symbol))
          .map((r) => {
            const code = r.symbol.replace('.T', '');
            const jpEntry = JP_STOCK_INDEX.find((s) => s.code === code);
            const name = jpEntry?.name ?? r.longname ?? r.shortname ?? code;
            if (!jpEntry && name !== code) nameCache.set(code, name);
            const stock: Stock = {
              id: code, code, name, market: 'JP',
              price: 0, previousClose: 0, change: 0, changePercent: 0,
              volume: 0, status: 'normal', updatedAt: new Date(), priceHistory: [],
            };
            if (!jpEntry) stockPool.set(code, stock);
            return { stock, inLocalIndex: localCodes.has(code) };
          })
          .filter(({ inLocalIndex }) => !inLocalIndex)
          .map(({ stock }) => stock);
      }

      searchCache.set(q, remote);
      return remote;
    } catch {
      return [];
    }
  },

  // 銘柄名/コードで検索して最初の日本株コードを返す（AI抽出用）
  // 優先順位: JP_STOCK_INDEX ローカル検索 → Yahoo Finance 検索（lang=ja）
  async searchByName(name: string): Promise<{ code: string; fullName: string } | null> {
    // ローカルインデックス部分一致
    const local = StockDataService.searchStockLocal(name);
    if (local.length > 0) return { code: local[0].code, fullName: local[0].name };
    // Yahoo Finance 検索（lang=ja で日本語名）
    const remote = await StockDataService.searchStockRemote(name).catch(() => []);
    if (remote.length > 0) return { code: remote[0].code, fullName: remote[0].name };
    return null;
  },

  // コードで完全一致する銘柄名を取得（キャッシュ付き）
  async resolveNameByCode(code: string): Promise<string | null> {
    if (isUSCode(code)) {
      if (nameCache.has(code)) return nameCache.get(code)!;
      try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(code)}&lang=en&region=US&quotesCount=5&newsCount=0`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return null;
        const json = await res.json();
        type YFQ = { symbol: string; longname?: string; shortname?: string };
        const quotes: YFQ[] = json?.quotes ?? [];
        const match = quotes.find((r) => r.symbol === code);
        const name = match?.longname ?? match?.shortname ?? null;
        if (name) nameCache.set(code, name);
        return name;
      } catch {
        return null;
      }
    }

    // JP: 優先順位: JP_STOCK_INDEX > nameCache > Yahoo Finance Search（lang=ja）
    const local = JP_STOCK_INDEX.find((s) => s.code === code);
    if (local) {
      nameCache.set(code, local.name);
      return local.name;
    }
    if (nameCache.has(code)) return nameCache.get(code)!;
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(code)}&lang=ja&region=JP&quotesCount=5&newsCount=0`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return null;
      const json = await res.json();
      type YFQ = { symbol: string; longname?: string; shortname?: string };
      const quotes: YFQ[] = json?.quotes ?? [];
      const match = quotes.find((r) => r.symbol === toTicker(code));
      const name = match?.longname ?? match?.shortname ?? null;
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
    const [name, quote] = await Promise.all([
      StockDataService.resolveNameByCode(code).catch(() => null),
      StockDataService.fetchQuote(code).catch(() => null),
    ]);
    if (!quote) return null;
    return {
      id: code, code,
      name: name ?? code,
      market: isUSCode(code) ? 'US' : 'JP',
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

      const refDate = getSessionRefDate();

      const timestamps: number[] = result.timestamp ?? [];
      const closes: number[] = timestamps
        .map((ts: number, i: number) => {
          const barDate = new Date(ts * 1000); barDate.setHours(0, 0, 0, 0);
          return barDate < refDate ? (q.close?.[i] as number) : null;
        })
        .filter((c): c is number => c != null && !isNaN(c));

      const allCloses: number[] = timestamps
        .map((_: number, i: number) => q.close?.[i] as number)
        .filter((c: number) => c != null && !isNaN(c));

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
    for (const host of ['query1', 'query2']) {
      try {
        const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false&_=${Date.now()}`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) continue;
        const json   = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) continue;
        const meta  = result.meta;
        const price = meta.regularMarketPrice as number;
        const prev  = meta.regularMarketPreviousClose as number;
        if (!price || !prev) continue;
        const change = price - prev;
        return { price, change, changePercent: (change / prev) * 100 };
      } catch {
        continue;
      }
    }
    return null;
  },

  // 主要指数を一括取得（Yahoo Finance chart API）
  async fetchMarketIndices(
    symbols: string[]
  ): Promise<Record<string, { price: number; change: number; changePercent: number }>> {
    const results = await Promise.all(
      symbols.map(async (sym) => {
        const q = await StockDataService.fetchIndexQuote(sym).catch(() => null);
        return [sym, q] as const;
      })
    );
    const map: Record<string, { price: number; change: number; changePercent: number }> = {};
    for (const [sym, val] of results) {
      if (val) map[sym] = val;
    }
    return map;
  },

  // 銘柄コードからテーマタグを自動取得（Yahoo Finance assetProfile）
  async fetchThemes(code: string): Promise<string[]> {
    if (themesCache.has(code)) return themesCache.get(code)!;
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${toTicker(code)}?modules=assetProfile`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return [];
      const json = await res.json();
      const profile = json?.quoteSummary?.result?.[0]?.assetProfile;
      if (!profile) return [];

      const industry: string = profile.industry ?? '';
      const sector:   string = profile.sector   ?? '';
      const themes: string[] = [];

      const industryThemes = INDUSTRY_THEMES[industry];
      if (industryThemes) themes.push(...industryThemes);

      const sectorTheme = SECTOR_THEMES[sector];
      if (sectorTheme && !themes.includes(sectorTheme)) themes.push(sectorTheme);

      themesCache.set(code, themes);
      return themes;
    } catch {
      return [];
    }
  },

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

  async fetchPriceHistory(code: string): Promise<number[]> {
    const bars = await StockDataService.fetchOHLC(code, '5m');
    return bars.map((b) => b.close);
  },

  async fetchValuation(code: string): Promise<{ per?: number; pbr?: number; week52High?: number; week52Low?: number } | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${toTicker(code)}?modules=summaryDetail,defaultKeyStatistics`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) return null;
      const json = await res.json();
      const result = json?.quoteSummary?.result?.[0];
      if (!result) return null;
      const sd = result.summaryDetail ?? {};
      const ks = result.defaultKeyStatistics ?? {};
      const rawPE  = sd.trailingPE?.raw ?? sd.forwardPE?.raw;
      const rawPBR = ks.priceToBook?.raw;
      return {
        per:       rawPE  != null ? Math.round(rawPE  * 10)  / 10  : undefined,
        pbr:       rawPBR != null ? Math.round(rawPBR * 100) / 100 : undefined,
        week52High: sd.fiftyTwoWeekHigh?.raw ?? undefined,
        week52Low:  sd.fiftyTwoWeekLow?.raw  ?? undefined,
      };
    } catch {
      return null;
    }
  },

  async fetchNews(code: string): Promise<NewsItem[]> {
    try {
      if (isUSCode(code)) {
        // 米国株: Yahoo Finance（英語）
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(code)}&newsCount=6&quotesCount=0`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return [];
        const json = await res.json();
        type YFNews = { uuid: string; title: string; link: string; publisher: string; providerPublishTime: number };
        const news: YFNews[] = json?.news ?? [];
        return news.map((n) => ({
          id: n.uuid, title: n.title, url: n.link,
          publisher: n.publisher,
          publishedAt: new Date(n.providerPublishTime * 1000),
        }));
      } else {
        // 日本株: Google News RSS（日本語）
        const name = nameCache.get(code)
          ?? await StockDataService.resolveNameByCode(code)
          ?? code;
        const q = encodeURIComponent(`${name} 株`);
        const url = `https://news.google.com/rss/search?q=${q}&hl=ja&gl=JP&ceid=JP:ja`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRSS(xml).slice(0, 6);
      }
    } catch {
      return [];
    }
  },

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

  formatChange(change: number, changePercent: number, market: 'JP' | 'US' = 'JP'): string {
    const sign = change >= 0 ? '+' : '';
    const changeStr = market === 'US'
      ? `${change >= 0 ? '+' : '-'}$${Math.abs(change).toFixed(2)}`
      : `${sign}${change.toLocaleString('ja-JP')}`;
    return `${changeStr} (${sign}${changePercent.toFixed(2)}%)`;
  },

  formatVolume(volume: number): string {
    if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M株`;
    if (volume >= 1_000)     return `${(volume / 1_000).toFixed(0)}K株`;
    return `${volume}株`;
  },
};

function round(n: number)  { return Math.round(n * 10)   / 10; }
function round2(n: number) { return Math.round(n * 100)  / 100; }

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = (
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ??
      block.match(/<title>([\s\S]*?)<\/title>/)
    )?.[1] ?? '';
    const link =
      block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ??
      block.match(/href="(https?[^"]+)"/)?.[1] ?? '';
    const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '';
    const src = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? 'Google News';
    if (!title || !link) continue;
    items.push({
      id: link,
      title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(),
      url: link,
      publisher: src.trim(),
      publishedAt: pub ? new Date(pub) : new Date(),
    });
  }
  return items;
}

function getSessionRefDate(): Date {
  const d = new Date();
  if (d.getHours() < 9) d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
