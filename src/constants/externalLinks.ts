export const ExternalLinks = {
  yahooFinance: (code: string) =>
    `https://finance.yahoo.co.jp/quote/${code}.T`,
  yahooBBS: (code: string) =>
    `https://finance.yahoo.co.jp/quote/${code}.T/forum`,
  kabutan: (code: string) =>
    `https://kabutan.jp/stock/?code=${code}`,
  tradingView: (code: string) =>
    `https://www.tradingview.com/chart/?symbol=TSE:${code}`,
  minkabv: (code: string) =>
    `https://minkabu.jp/stock/${code}`,
} as const;

export const SecuritiesAppLinks = {
  sbi: {
    name: 'SBI証券',
    url: 'sbisec://',
    appStoreUrl: 'https://apps.apple.com/jp/app/id587625995',
  },
  rakuten: {
    name: '楽天証券',
    url: 'rakutensec://',
    appStoreUrl: 'https://apps.apple.com/jp/app/id1078816802',
  },
  ispeed: {
    name: 'iSPEED',
    url: 'ispeed://',
    appStoreUrl: 'https://apps.apple.com/jp/app/id510070315',
  },
  moomoo: {
    name: 'moomoo',
    url: 'moomoo://',
    appStoreUrl: 'https://apps.apple.com/jp/app/id1282870843',
  },
  matsui: {
    name: '松井証券',
    url: 'matsui-sec://',
    appStoreUrl: 'https://apps.apple.com/jp/app/id454998542',
  },
  monex: {
    name: 'マネックス証券',
    url: 'monex://',
    appStoreUrl: 'https://apps.apple.com/jp/app/id490295583',
  },
} as const;

export const NotificationMessages = {
  dip: (name: string) => `${name}が押し目候補圏に近づいています`,
  surge: (name: string) => `${name}が急騰しています`,
  plunge: (name: string) => `${name}が急落しています`,
  volume: (name: string) => `${name}の出来高が急増しています`,
  highApproach: (name: string) => `${name}が高値に接近しています`,
  lowApproach: (name: string) => `${name}が安値に接近しています`,
  themeChange: (name: string) => `${name}の関連テーマに変化があります`,
} as const;
