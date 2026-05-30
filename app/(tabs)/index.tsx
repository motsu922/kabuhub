import React from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { StockCard } from '../../src/components/watchlist/StockCard';
import { SkeletonCard } from '../../src/components/common/SkeletonCard';
import { useWatchlist } from '../../src/hooks/useWatchlist';
import { Stock, Notification, WatchlistItem } from '../../src/types';

function consecutiveDeclineDays(closes: number[]): number {
  if (closes.length < 2) return 0;
  let days = 0;
  for (let i = closes.length - 1; i > 0; i--) {
    if (closes[i] < closes[i - 1]) days++;
    else break;
  }
  return days;
}

function generateNotifications(stocks: Stock[], items: WatchlistItem[]): Notification[] {
  const now = new Date();
  const byStock = new Map<string, Notification>();

  for (const s of stocks) {
    const cfg = items.find((i) => i.stockCode === s.code)?.alertSettings;
    const pct    = s.changePercent ?? 0;
    const sign   = pct >= 0 ? '+' : '';
    const pctStr = `${sign}${pct.toFixed(2)}%`;

    const declineDays = (s.dailyCloses && s.dailyCloses.length >= 3)
      ? consecutiveDeclineDays(s.dailyCloses)
      : 0;

    let type: Notification['type'] | null = null;
    let message = '';

    if (pct >= 5) {
      type = 'surge';
      if (cfg && !cfg.surge) type = null;
      else message = `急騰 (${pctStr})`;
    } else if (declineDays >= 3 && pct > -3) {
      type = 'dip';
      message = `${declineDays}日続落・押し目圏 (${pctStr})`;
    }

    if (!type) continue;

    byStock.set(s.code, {
      id: s.code,
      stockCode: s.code,
      stockName: s.name,
      type,
      message,
      createdAt: now,
      isRead: false,
    });
  }

  return [...byStock.values()];
}

export default function HomeScreen() {
  const router = useRouter();
  const { stocks, items, isLoading, lastUpdatedAt, getItem, refresh } = useWatchlist();

  const notifications = generateNotifications(stocks, items);

  const scrollY = React.useRef(new Animated.Value(0)).current;

  return (
    <SafeAreaView style={styles.container}>
      {/* スクロール追従ヘッダー（ブラー） */}
      <Animated.View style={[styles.stickyHeader, { opacity: scrollY.interpolate({ inputRange: [0, 48], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.appName}>KabuHub</Text>
            <Text style={styles.subtitle}>
              {isLoading
                ? '更新中...'
                : lastUpdatedAt
                  ? `更新 ${lastUpdatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
                  : '投資情報ハブ'}
            </Text>
          </View>
          <TouchableOpacity onPress={refresh} style={styles.refreshButton} disabled={isLoading}>
            <Animated.Text style={[styles.refreshIcon, isLoading && { opacity: 0.3 }]}>↻</Animated.Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* ヘッダー分のスペース */}
        <View style={{ height: 60 }} />

        {/* 今日の注目 */}
        {notifications.length > 0 && (
          <Section title="今日の注目" count={notifications.length}>
            {groupNotifications(notifications).map((g) => (
              <SituationCard
                key={g.type}
                group={g}
                onPressStock={(code) => router.push(`/stock/${code}`)}
              />
            ))}
          </Section>
        )}

        {/* Watchlist */}
        {isLoading ? (
          <Section title="ウォッチリスト">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </Section>
        ) : stocks.length > 0 ? (
          <Section title="ウォッチリスト" onMore={() => router.push('/(tabs)/watchlist')}>
            {stocks.slice(0, 3).map((s) => (
              <StockCard
                key={s.id}
                stock={s}
                intention={getItem(s.code)?.intention ?? 'neutral'}
                onPress={() => router.push(`/stock/${s.code}`)}
              />
            ))}
          </Section>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Text style={styles.emptyIconSymbol}>⬡</Text>
            </View>
            <Text style={styles.emptyTitle}>銘柄をウォッチしよう</Text>
            <Text style={styles.emptyText}>気になる銘柄を登録すると{'\n'}ここに表示されます</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/watchlist')}
            >
              <Text style={styles.emptyButtonText}>ウォッチリストを開く</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ─── 状況グループ ─────────────────────────────────────────────────────────────

const SITUATION_CONFIG: Record<
  Notification['type'],
  { label: string; color: string; icon: string }
> = {
  surge:        { label: '急騰',       color: Colors.signalSurge,  icon: '▲' },
  highApproach: { label: '大幅上昇',   color: Colors.primary,      icon: '◈' },
  dip:          { label: '押し目候補', color: Colors.signalDip,    icon: '◎' },
  volume:       { label: '出来高急増', color: Colors.statusAlert,  icon: '◇' },
  themeChange:  { label: 'テーマ変化', color: Colors.signalTheme,  icon: '✦' },
};

const SITUATION_ORDER: Notification['type'][] = [
  'surge', 'highApproach', 'dip', 'volume', 'themeChange',
];

interface SituationGroup { type: Notification['type']; notifications: Notification[]; }

function groupNotifications(notifications: Notification[]): SituationGroup[] {
  const map = new Map<Notification['type'], Notification[]>();
  for (const n of notifications) {
    if (!map.has(n.type)) map.set(n.type, []);
    map.get(n.type)!.push(n);
  }
  return SITUATION_ORDER
    .filter((t) => map.has(t))
    .map((t) => ({ type: t, notifications: map.get(t)! }));
}

function SituationCard({ group, onPressStock }: { group: SituationGroup; onPressStock: (code: string) => void }) {
  const cfg = SITUATION_CONFIG[group.type];
  return (
    <View style={[situationStyles.card, { borderLeftColor: cfg.color }]}>
      <View style={situationStyles.header}>
        <View style={[situationStyles.iconWrap, { backgroundColor: cfg.color + '20' }]}>
          <Text style={[situationStyles.icon, { color: cfg.color }]}>{cfg.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[situationStyles.label, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <View style={[situationStyles.badge, { backgroundColor: cfg.color + '20', borderColor: cfg.color + '40' }]}>
          <Text style={[situationStyles.badgeText, { color: cfg.color }]}>{group.notifications.length}銘柄</Text>
        </View>
      </View>
      {group.notifications.map((n) => (
        <TouchableOpacity
          key={n.stockCode}
          style={situationStyles.row}
          onPress={() => onPressStock(n.stockCode)}
          activeOpacity={0.7}
        >
          <Text style={situationStyles.stockName} numberOfLines={1}>{n.stockName}</Text>
          <Text style={[situationStyles.change, { color: cfg.color }]}>
            {n.message.match(/[+-][\d.]+%/)?.[0] ?? ''}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const situationStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    gap: 8,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: FontSize.md, fontWeight: '700', letterSpacing: -0.2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingLeft: 40,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  stockName: { fontSize: FontSize.sm, color: Colors.text, flex: 1, marginRight: Spacing.sm },
  change: { fontSize: FontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, count, children, onMore }: {
  title: string;
  count?: number;
  children: React.ReactNode;
  onMore?: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>{title}</Text>
          {count !== undefined && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          )}
        </View>
        {onMore && (
          <TouchableOpacity onPress={onMore}>
            <Text style={styles.moreText}>すべて見る →</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  refreshButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  refreshIcon: { fontSize: 22, color: Colors.primary, fontWeight: '700' },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  countBadge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
  },
  countText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  moreText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },
  empty: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  emptyIconSymbol: { fontSize: 24, color: Colors.primary, lineHeight: 30 },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  emptyButtonText: { fontSize: FontSize.sm, fontWeight: '700', color: '#06090F' },
});
