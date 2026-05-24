import { AlertSettings, WatchStyle } from '../types';

export const WATCH_PRESETS: Record<WatchStyle, {
  label: string;
  emoji: string;
  description: string;
  alerts: string[];
  settings: AlertSettings;
}> = {
  buy: {
    label:       '買いたい',
    emoji:       '📈',
    description: '押し目・急落で通知。エントリー機会を逃さない',
    alerts:      ['押し目候補', '続落アラート', '急落アラート', '安値接近', '出来高急増'],
    settings: {
      dip:               true,
      consecutiveDecline:true,
      plunge:            true,
      lowApproach:       true,
      volume:            true,
      surge:             false,
      highApproach:      false,
      themeChange:       true,
    },
  },
  sell: {
    label:       '売りたい',
    emoji:       '📉',
    description: '急騰・高値接近で通知。利確・損切りのタイミングを把握',
    alerts:      ['急騰アラート', '高値接近', '急落アラート', '出来高急増'],
    settings: {
      surge:             true,
      highApproach:      true,
      plunge:            true,
      volume:            true,
      dip:               false,
      consecutiveDecline:false,
      lowApproach:       false,
      themeChange:       true,
    },
  },
};
