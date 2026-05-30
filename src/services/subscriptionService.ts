import AsyncStorage from '@react-native-async-storage/async-storage';

export const FREE_WATCHLIST_LIMIT = 10;
export const FREE_AI_WEEKLY_LIMIT = 1;

const DEV_BYPASS = true; // テスト用：本番前に false に戻すこと

const PREMIUM_KEY  = '@kabuhub_premium';
const AI_USAGE_KEY = '@kabuhub_ai_usage';

interface AIUsage {
  weekStart: string; // YYYY-MM-DD (月曜日)
  count: number;
}

function getWeekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export const SubscriptionService = {
  async isPremium(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(PREMIUM_KEY)) === 'true';
    } catch {
      return false;
    }
  },

  async setPremium(flag: boolean): Promise<void> {
    await AsyncStorage.setItem(PREMIUM_KEY, flag ? 'true' : 'false');
  },

  async getAIUsageThisWeek(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(AI_USAGE_KEY);
      if (!raw) return 0;
      const usage: AIUsage = JSON.parse(raw);
      return usage.weekStart === getWeekStartISO() ? usage.count : 0;
    } catch {
      return 0;
    }
  },

  async incrementAIUsage(): Promise<void> {
    try {
      const thisWeek = getWeekStartISO();
      const raw = await AsyncStorage.getItem(AI_USAGE_KEY);
      let usage: AIUsage = { weekStart: thisWeek, count: 0 };
      if (raw) {
        const parsed: AIUsage = JSON.parse(raw);
        if (parsed.weekStart === thisWeek) usage = parsed;
      }
      await AsyncStorage.setItem(AI_USAGE_KEY, JSON.stringify({ weekStart: thisWeek, count: usage.count + 1 }));
    } catch {}
  },

  async canAddToWatchlist(currentCount: number): Promise<boolean> {
    if (DEV_BYPASS) return true;
    if (currentCount < FREE_WATCHLIST_LIMIT) return true;
    return SubscriptionService.isPremium();
  },

  async canUseAI(): Promise<boolean> {
    if (DEV_BYPASS) return true;
    if (await SubscriptionService.isPremium()) return true;
    return (await SubscriptionService.getAIUsageThisWeek()) < FREE_AI_WEEKLY_LIMIT;
  },
};
