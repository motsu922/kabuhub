import * as Notifications from 'expo-notifications';
import { Stock, WatchlistItem } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

// キー: "${code}_${type}_${YYYY-MM-DD}" — 1日1回まで
const sentToday = new Set<string>();
let lastResetDate = new Date().toDateString();

function todayKey(code: string, type: string): string {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    sentToday.clear();
    lastResetDate = today;
  }
  return `${code}_${type}_${today}`;
}

function consecutiveDeclineDays(closes: number[]): number {
  let days = 0;
  for (let i = closes.length - 1; i > 0; i--) {
    if (closes[i] < closes[i - 1]) days++;
    else break;
  }
  return days;
}

async function send(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  async checkAndNotify(stocks: Stock[], items: WatchlistItem[]) {
    for (const s of stocks) {
      const cfg = items.find((i) => i.stockCode === s.code)?.alertSettings;
      const pct = s.changePercent ?? 0;
      const abs = Math.abs(pct);
      const sign = pct >= 0 ? '+' : '';
      const priceStr = `${s.price.toLocaleString('ja-JP')}円 (${sign}${pct.toFixed(2)}%)`;

      // 急騰 (≥5%)
      if (abs >= 5 && pct > 0 && cfg?.surge !== false) {
        const key = todayKey(s.code, 'surge');
        if (!sentToday.has(key)) {
          sentToday.add(key);
          await send(`📈 ${s.name} 急騰`, priceStr);
        }
      }

      // 急落 (≤-5%)
      if (abs >= 5 && pct < 0 && cfg?.plunge !== false) {
        const key = todayKey(s.code, 'plunge');
        if (!sentToday.has(key)) {
          sentToday.add(key);
          await send(`📉 ${s.name} 急落`, priceStr);
        }
      }

      // 押し目候補 (-3%〜-5%)
      if (abs >= 3 && abs < 5 && pct < 0 && cfg?.dip !== false) {
        const key = todayKey(s.code, 'dip');
        if (!sentToday.has(key)) {
          sentToday.add(key);
          await send(`🔍 ${s.name} 押し目候補`, priceStr);
        }
      }

      // 続落アラート
      if (cfg?.consecutiveDecline !== false && s.dailyCloses && s.dailyCloses.length >= 3) {
        const days = consecutiveDeclineDays(s.dailyCloses);
        if (days >= 2) {
          const key = todayKey(s.code, `decline${days}`);
          if (!sentToday.has(key)) {
            sentToday.add(key);
            await send(`⚠️ ${s.name} ${days}日続落`, priceStr);
          }
        }
      }
    }
  },
};
