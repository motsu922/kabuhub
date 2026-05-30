export const ExternalLinks = {
  yahooFinance: (code: string) => `https://finance.yahoo.co.jp/quote/${code}.T`,
  kabutan: (code: string) => `https://kabutan.jp/stock/?code=${code}`,
  minkabv: (code: string) => `https://minkabu.jp/stock/${code}`,
};

type SecuritiesAppLink = {
  name: string;
  url: string;
  appStoreUrl: string;
};

export const SecuritiesAppLinks: Record<string, SecuritiesAppLink> = {
  sbi: {
    name: 'SBI証券',
    url: 'sbiapp://',
    appStoreUrl: 'https://apps.apple.com/jp/app/sbi証券-株-投信/id466367206',
  },
  rakuten: {
    name: 'iSPEED',
    url: 'ispeed://',
    appStoreUrl: 'https://apps.apple.com/jp/app/ispeed-株取引-株価/id398694603',
  },
};
