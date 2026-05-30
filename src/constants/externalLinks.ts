export const ExternalLinks = {
  yahooFinance: (code: string) => `https://finance.yahoo.co.jp/quote/${code}.T`,
  kabutan: (code: string) => `https://kabutan.jp/stock/?code=${code}`,
  minkabv: (code: string) => `https://minkabu.jp/stock/${code}`,
};

export const SecuritiesAppLinks: Record<string, (code: string) => string> = {
  sbi: (code) => `sbiapp://stock/${code}`,
  rakuten: (code) => `rakuten-sec://stock/${code}`,
};
