import { RemoteLinkConfig } from '../services/remoteLinkConfig';

export const ExternalLinks = {
  // JP
  yahooFinance: (code: string) => RemoteLinkConfig.getLink('yahooFinance', code),
  kabutan:      (code: string) => RemoteLinkConfig.getLink('kabutan', code),
  minkabv:      (code: string) => RemoteLinkConfig.getLink('minkabv', code),
  tradingView:  (code: string) => RemoteLinkConfig.getLink('tradingView', code),
  // US
  yahooFinanceUS: (code: string) => RemoteLinkConfig.getLink('yahooFinanceUS', code),
  tradingViewUS:  (code: string) => RemoteLinkConfig.getLink('tradingViewUS', code),
  stockTwits:     (code: string) => RemoteLinkConfig.getLink('stockTwits', code),
  seekingAlpha:   (code: string) => RemoteLinkConfig.getLink('seekingAlpha', code),
};

export const SecuritiesAppLinks = {
  ispeed: {
    name: 'iSPEED',
    url: 'ispeed://',
    appStoreUrl: 'https://apps.apple.com/jp/app/id510070315',
  },
} as const;

export const NotificationMessages = {
  dip: (name: string) => `${name}が押し目候補圏に近づいています`,
  surge: (name: string) => `${name}が急騰しています`,
  volume: (name: string) => `${name}の出来高が急増しています`,
  highApproach: (name: string) => `${name}が高値に接近しています`,
  themeChange: (name: string) => `${name}の関連テーマに変化があります`,
} as const;
