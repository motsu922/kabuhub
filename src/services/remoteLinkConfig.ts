import AsyncStorage from '@react-native-async-storage/async-storage';

// GitHub Gist の raw URL をここに設定する
// Gist の内容は下記 DEFAULT_TEMPLATES と同じ JSON 形式
export const REMOTE_CONFIG_URL =
  'https://gist.githubusercontent.com/motsu922/kabuhub-links/raw/links.json';

const STORAGE_KEY = '@kabuhub_link_config';

const DEFAULT_TEMPLATES: Record<string, string> = {
  yahooFinance:   'https://finance.yahoo.co.jp/quote/{code}.T',
  kabutan:        'https://kabutan.jp/stock/?code={code}',
  minkabv:        'https://minkabu.jp/stock/{code}',
  yahooFinanceUS: 'https://finance.yahoo.com/quote/{code}',
  tradingViewUS:  'https://www.tradingview.com/symbols/{code}/',
  stockTwits:     'https://stocktwits.com/symbol/{code}',
  seekingAlpha:   'https://seekingalpha.com/symbol/{code}',
};

let cache: Record<string, string> = { ...DEFAULT_TEMPLATES };

export const RemoteLinkConfig = {
  // アプリ起動時に1回呼ぶ。AsyncStorage → remote の順で読み込む
  async init(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) cache = { ...DEFAULT_TEMPLATES, ...JSON.parse(stored) };
    } catch {}

    try {
      const res = await fetch(REMOTE_CONFIG_URL, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const links: Record<string, string> = json.links ?? json;
        cache = { ...DEFAULT_TEMPLATES, ...links };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(links));
      }
    } catch {}
  },

  getLink(key: string, code: string): string {
    const template = cache[key] ?? DEFAULT_TEMPLATES[key] ?? '';
    return template.replace(/{code}/g, code);
  },
};
