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
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { SwipeableStockCard } from '../../src/components/watchlist/SwipeableStockCard';
import { SkeletonCard } from '../../src/components/common/SkeletonCard';
import { BubbleChart } from '../../src/components/home/BubbleChart';
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
  const { colors, theme } = useTheme();
  const { stocks, items, isLoading, lastUpdatedAt, getItem, updateIntention, refresh } = useWatchlist();

  const notifications = generateNotifications(stocks, items);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.stickyHeader, { opacity: scrollY.interpolate({ inputRange: [0, 48], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
        <BlurView intensity={60} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
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
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.iconButton}>
              <Text style={styles.settingsIcon}>⚙</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={refresh} style={styles.iconButton} disabled={isLoading}>
              <Animated.Text style={[styles.refreshIcon, isLoading && { opacity: 0.3 }]}>↻</Animated.Text>
            </TouchableOpacity>
          </View>
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
        {/* インラインヘッダー（常に表示、スクロールで隠れる） */}
        <View style={styles.inlineHeader}>
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
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.iconButton}>
              <Text style={styles.settingsIcon}>⚙</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={refresh} style={styles.iconButton} disabled={isLoading}>
              <Animated.Text style={[styles.refreshIcon, isLoading && { opacity: 0.3 }]}>↻</Animated.Text>
            </TouchableOpacity>
          </View>
        </View>

        {stocks.length > 0 && (
          <BubbleChart
            stocks={stocks}
            items={items}
            colors={colors}
            onPressStock={(code) => router.push(`/stock/${code}`)}
          />
        )}

        {notifications.length > 0 && (
          <Section title="今日の注目" count={notifications.length} colors={colors}>
            {groupNotifications(notifications).map((g) => (
              <SituationCard
                key={g.type}
                group={g}
                colors={colors}
                onPressStock={(code) => router.push(`/stock/${code}`)}
              />
            ))}
          </Section>
        )}

        {isLoading ? (
          <Section title="ウォッチリスト" colors={colors}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </Section>
        ) : stocks.length > 0 ? (
          <Section title="ウォッチリスト" onMore={() => router.push('/(tabs)/watchlist')} colors={colors}>
            {stocks.slice(0, 3).map((s) => (
              <SwipeableStockCard
                key={s.id}
                stock={s}
                intention={getItem(s.code)?.intention ?? 'neutral'}
                onPress={() => router.push(`/stock/${s.code}`)}
                onIntentionChange={updateIntention}
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
  { label: string; colorKey: keyof ColorPalette; icon: string }
> = {
  surge:        { label: '急騰',       colorKey: 'signalSurge',  icon: '▲' },
  highApproach: { label: '大幅上昇',   colorKey: 'primary',      icon: '◈' },
  dip:          { label: '押し目候補', colorKey: 'signalDip',    icon: '◎' },
  volume:       { label: '出来高急増', colorKey: 'statusAlert',  icon: '◇' },
};

const SITUATION_ORDER: Notification['type'][] = [
  'surge', 'highApproach', 'dip', 'volume',
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

function SituationCard({ group, colors, onPressStock }: {
  group: SituationGroup;
  colors: ColorPalette;
  onPressStock: (code: string) => void;
}) {
  const cfg = SITUATION_CONFIG[group.type];
  const accent = colors[cfg.colorKey] as string;
  const sStyles = React.useMemo(() => createSituationStyles(colors), [colors]);

  return (
    <View style={[sStyles.card, { borderLeftColor: accent }]}>
      {/* カードヘッダー */}
      <View style={sStyles.header}>
        <View style={[sStyles.iconWrap, { backgroundColor: accent + '22' }]}>
          <Text style={[sStyles.icon, { color: accent }]}>{cfg.icon}</Text>
        </View>
        <Text style={[sStyles.label, { color: accent }]}>{cfg.label}</Text>
        <View style={[sStyles.badge, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
          <Text style={[sStyles.badgeText, { color: accent }]}>{group.notifications.length}銘柄</Text>
        </View>
      </View>

      {/* 銘柄行 */}
      {group.notifications.map((n) => {
        const pctMatch = n.message.match(/[+-][\d.]+%/)?.[0] ?? '';
        const detail = n.message.replace(/\(.*\)/, '').trim();
        return (
          <TouchableOpacity
            key={n.stockCode}
            style={sStyles.row}
            onPress={() => onPressStock(n.stockCode)}
            activeOpacity={0.7}
          >
            <View style={sStyles.rowLeft}>
              <Text style={sStyles.stockName} numberOfLines={1}>{n.stockName}</Text>
              <Text style={sStyles.stockSub}>{n.stockCode}  {detail}</Text>
            </View>
            <View style={[sStyles.pctChip, { backgroundColor: accent + '18' }]}>
              <Text style={[sStyles.pctText, { color: accent }]}>{pctMatch}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createSituationStyles(c: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderLeftWidth: 3,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.md,
      paddingTop: 10,
      paddingBottom: 8,
    },
    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: 7,
      justifyContent: 'center',
      alignItems: 'center',
    },
    icon: { fontSize: 12, fontWeight: '700' },
    label: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: -0.2, flex: 1 },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
      gap: Spacing.sm,
    },
    rowLeft: { flex: 1, gap: 2 },
    stockName: { fontSize: FontSize.sm, fontWeight: '700', color: c.text },
    stockSub: { fontSize: FontSize.xs, color: c.textTertiary },
    pctChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BorderRadius.sm,
      minWidth: 58,
      alignItems: 'center',
    },
    pctText: { fontSize: FontSize.xs, fontWeight: '800', fontVariant: ['tabular-nums'] },
  });
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, count, children, onMore, colors }: {
  title: string;
  count?: number;
  children: React.ReactNode;
  onMore?: () => void;
  colors: ColorPalette;
}) {
  const styles = React.useMemo(() => createStyles(colors), [colors]);
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

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
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
    inlineHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: Spacing.md,
    },
    appName: {
      fontSize: FontSize.xxl,
      fontWeight: '800',
      color: c.primary,
      letterSpacing: -0.5,
    },
    subtitle: { fontSize: FontSize.sm, color: c.textSecondary, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    iconButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    settingsIcon: { fontSize: 20, color: c.textSecondary },
    refreshIcon: { fontSize: 22, color: c.primary, fontWeight: '700' },
    scroll: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 100 },
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
      backgroundColor: c.primary,
    },
    sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: c.text },
    countBadge: {
      backgroundColor: c.primaryMuted,
      borderRadius: BorderRadius.full,
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderWidth: 1,
      borderColor: c.primaryDim,
    },
    countText: { fontSize: FontSize.xs, fontWeight: '700', color: c.primary },
    moreText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '500' },
    empty: {
      backgroundColor: c.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.cardBorder,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    emptyIconSymbol: { fontSize: 24, color: c.primary, lineHeight: 30 },
    emptyTitle: {
      fontSize: FontSize.lg,
      fontWeight: '700',
      color: c.text,
      letterSpacing: -0.3,
    },
    emptyText: {
      fontSize: FontSize.sm,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyButton: {
      marginTop: Spacing.sm,
      backgroundColor: c.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
    },
    emptyButtonText: { fontSize: FontSize.sm, fontWeight: '700', color: '#06090F' },
  });
}
