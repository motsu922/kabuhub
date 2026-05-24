import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { StockCard } from '../../src/components/watchlist/StockCard';
import { useWatchlist } from '../../src/hooks/useWatchlist';
import { useArticles } from '../../src/hooks/useArticles';
import { Stock, Notification, WatchlistItem } from '../../src/types';
import { computeScore, SIGNAL_POINTS, TechnicalScore } from '../../src/services/technicalAnalysis';

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

    // 続落日数
    const declineDays = (s.dailyCloses && s.dailyCloses.length >= 3)
      ? consecutiveDeclineDays(s.dailyCloses)
      : 0;

    let type: Notification['type'] | null = null;
    let message = '';

    if (pct >= 5) {
      // 急騰: +5%以上
      type = 'surge';
      if (cfg && !cfg.surge) type = null;
      else message = `急騰 (${pctStr})`;
    } else if (pct <= -5) {
      // 急落: -5%以下
      type = 'plunge';
      if (cfg && !cfg.plunge) type = null;
      else message = `急落 (${pctStr})`;
    } else if (declineDays >= 3 && pct > -3) {
      // 押し目候補: 3日以上続落 かつ 本日の下落が軽微（急落ではない）
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
  const { articles } = useArticles();

  const unreadNotifications = generateNotifications(stocks, items);
  const alertStocks = stocks.filter((s) => s.status !== 'normal');

  // テクニカルスコア: シグナルあり・中立以外の銘柄のみ、スコア絶対値の大きい順
  const techScores: Array<{ stock: Stock; result: TechnicalScore }> = stocks
    .filter((s) => s.technicalSignals && s.technicalSignals.length > 0)
    .map((s) => ({ stock: s, result: computeScore(s.technicalSignals!) }))
    .filter(({ result }) => result.signals.length > 0 && result.verdict !== '中立')
    .sort((a, b) => Math.abs(b.result.score) - Math.abs(a.result.score));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>KabuHub</Text>
            <Text style={styles.subtitle}>
              {isLoading
                ? '更新中...'
                : lastUpdatedAt
                  ? `最終更新 ${lastUpdatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`
                  : '投資情報ハブ'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <TouchableOpacity onPress={refresh} style={styles.refreshButton}>
                <Text style={styles.refreshIcon}>↻</Text>
              </TouchableOpacity>
            )}
            <View style={styles.dot}>
              <Text style={styles.dotText}>{unreadNotifications.length}</Text>
            </View>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            本アプリは投資判断の参考情報を整理するためのツールです。売買推奨ではありません。
          </Text>
        </View>

        {/* Notifications — 状況ごとにグループ化 */}
        {unreadNotifications.length > 0 && (
          <Section title="今日の注目" count={unreadNotifications.length}>
            {groupNotifications(unreadNotifications, stocks).map((g) => (
              <SituationCard
                key={g.type}
                group={g}
                onPressStock={(code) => router.push(`/stock/${code}`)}
              />
            ))}
          </Section>
        )}

        {/* Technical Scores */}
        <Section title="テクニカルスコア" count={techScores.length || undefined} onMore={() => router.push('/backtest')} moreLabel="バックテスト">
          {techScores.length > 0 ? (
            techScores.map(({ stock, result }) => (
              <TechnicalScoreCard
                key={stock.id}
                stock={stock}
                result={result}
                onPress={() => router.push(`/stock/${stock.code}`)}
              />
            ))
          ) : (
            <View style={styles.techEmpty}>
              <Text style={styles.techEmptyText}>
                {isLoading ? '分析中...' : 'シグナルなし（ウォッチリストにデータが溜まると表示されます）'}
              </Text>
            </View>
          )}
        </Section>

        {/* Alert Stocks */}
        {alertStocks.length > 0 && (
          <Section title="状態変化の銘柄">
            {alertStocks.map((s) => (
              <StockCard
                key={s.id}
                stock={s}
                intention={getItem(s.code)?.intention ?? 'neutral'}
                onPress={() => router.push(`/stock/${s.code}`)}
              />
            ))}
          </Section>
        )}

        {/* Recent Articles */}
        {articles.length > 0 && (
          <Section title="最近保存した記事" onMore={() => router.push('/(tabs)/articles')}>
            {articles.slice(0, 2).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.articleCard}
                onPress={() => router.push('/(tabs)/articles')}
              >
                <Text style={styles.articleTitle} numberOfLines={2}>{a.title}</Text>
                {a.summary && (
                  <Text style={styles.articleSummary} numberOfLines={2}>{a.summary}</Text>
                )}
                {a.relatedThemes && a.relatedThemes.length > 0 && (
                  <View style={styles.themes}>
                    {a.relatedThemes.map((t) => (
                      <Text key={t} style={styles.theme}>#{t}</Text>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {/* Watchlist Preview */}
        {stocks.length > 0 ? (
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
            <Text style={styles.emptyTitle}>銘柄をウォッチリストに追加しよう</Text>
            <Text style={styles.emptyText}>
              気になる銘柄を登録すると、ここに表示されます
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/watchlist')}
            >
              <Text style={styles.emptyButtonText}>ウォッチリストを開く</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 状況グループ ───────────────────────────────────────────────────────────────

const SITUATION_CONFIG: Record<
  Notification['type'],
  { label: string; color: string; icon: string; hint: string }
> = {
  surge:        { label: '急騰',       color: Colors.positive,    icon: '🚀', hint: '前日比 +5%以上' },
  plunge:       { label: '急落',       color: Colors.negative,    icon: '📉', hint: '前日比 -5%以下' },
  highApproach: { label: '大幅上昇',   color: Colors.statusWatch, icon: '🔔', hint: '前日比 +3〜+5%' },
  lowApproach:  { label: '大幅下落',   color: Colors.statusAlert, icon: '⚠️', hint: '前日比 -3〜-5%' },
  dip:          { label: '押し目候補', color: Colors.statusWatch, icon: '👀', hint: '2日以上続落・下落幅が限定的' },
  volume:       { label: '出来高急増', color: Colors.statusAlert, icon: '📊', hint: '平均の2倍以上の出来高' },
  themeChange:  { label: 'テーマ変化', color: Colors.primary,     icon: '🔄', hint: '関連テーマに変化あり' },
};

const SITUATION_ORDER: Notification['type'][] = [
  'surge', 'plunge', 'highApproach', 'lowApproach', 'dip', 'volume', 'themeChange',
];

interface SituationGroup {
  type: Notification['type'];
  notifications: Notification[];
}

function groupNotifications(notifications: Notification[], stocks: Stock[]): SituationGroup[] {
  const map = new Map<Notification['type'], Notification[]>();
  for (const n of notifications) {
    if (!map.has(n.type)) map.set(n.type, []);
    map.get(n.type)!.push(n);
  }
  return SITUATION_ORDER
    .filter((t) => map.has(t))
    .map((t) => ({ type: t, notifications: map.get(t)! }));
}

function SituationCard({
  group,
  onPressStock,
}: {
  group: SituationGroup;
  onPressStock: (code: string) => void;
}) {
  const cfg = SITUATION_CONFIG[group.type];
  return (
    <View style={[situationStyles.card, { borderLeftColor: cfg.color }]}>
      <View style={situationStyles.header}>
        <Text style={situationStyles.icon}>{cfg.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[situationStyles.label, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={situationStyles.hint}>{cfg.hint}</Text>
        </View>
        <View style={[situationStyles.badge, { backgroundColor: cfg.color + '25' }]}>
          <Text style={[situationStyles.badgeText, { color: cfg.color }]}>
            {group.notifications.length}銘柄
          </Text>
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
          <Text style={[
            situationStyles.change,
            { color: group.type === 'plunge' || group.type === 'lowApproach' ? Colors.negative : cfg.color },
          ]}>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: { fontSize: 16, marginTop: 2 },
  label: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 22,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  stockName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  change: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});

// ─── テクニカルスコアカード ──────────────────────────────────────────────────────

const SIGNAL_LABEL: Record<string, string> = {
  inverseHS:     '逆三尊',
  goldenCross:   'ゴールデンクロス',
  doubleBottom:  'W底',
  rsiRecovery:   'RSI底打ち',
  rsiOversold:   'RSI売られすぎ',
  headShoulders: '三尊（天井）',
  deadCross:     'デッドクロス',
  doubleTop:     'M天井',
  rsiOverbought: 'RSI買われすぎ',
};

function TechnicalScoreCard({
  stock,
  result,
  onPress,
}: {
  stock: Stock;
  result: TechnicalScore;
  onPress: () => void;
}) {
  const { score, verdict, verdictColor, signals } = result;
  const scoreStr = score > 0 ? `+${score}pt` : `${score}pt`;
  const MAX_PT = 10;
  const barWidth = Math.min(Math.abs(score) / MAX_PT, 1);
  const isBullish = score > 0;

  return (
    <TouchableOpacity style={techStyles.card} onPress={onPress} activeOpacity={0.75}>
      {/* ヘッダー */}
      <View style={techStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={techStyles.stockName} numberOfLines={1}>{stock.name}</Text>
          <Text style={techStyles.stockCode}>{stock.code}</Text>
        </View>
        <View style={[techStyles.verdictBadge, { backgroundColor: verdictColor + '22', borderColor: verdictColor + '60' }]}>
          <Text style={[techStyles.verdictText, { color: verdictColor }]}>{verdict}</Text>
          <Text style={[techStyles.scoreText, { color: verdictColor }]}>{scoreStr}</Text>
        </View>
      </View>

      {/* スコアバー */}
      <View style={techStyles.barTrack}>
        <View style={techStyles.barCenter} />
        <View style={[
          techStyles.barFill,
          {
            width: `${barWidth * 50}%`,
            backgroundColor: verdictColor,
            alignSelf: isBullish ? 'flex-end' : 'flex-start',
            marginLeft: isBullish ? '50%' : undefined,
            marginRight: isBullish ? undefined : '50%',
          } as any,
        ]} />
      </View>

      {/* シグナル一覧 */}
      <View style={techStyles.signals}>
        {signals.map((sig) => {
          const pt = SIGNAL_POINTS[sig.type];
          const ptStr = pt > 0 ? `+${pt}` : `${pt}`;
          const ptColor = pt > 0 ? Colors.positive : Colors.negative;
          return (
            <View key={sig.type} style={techStyles.signalRow}>
              <Text style={techStyles.signalLabel}>{SIGNAL_LABEL[sig.type] ?? sig.label}</Text>
              <Text style={[techStyles.signalPt, { color: ptColor }]}>{ptStr}pt</Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

const techStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stockName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  stockCode: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  verdictText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  scoreText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  barTrack: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  barCenter: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Colors.separator,
  },
  barFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  signals: {
    gap: 4,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: Spacing.sm,
  },
  signalLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  signalPt: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});

// ────────────────────────────────────────────────────────────────────────────────

function Section({
  title, count, children, onMore, moreLabel = 'すべて見る',
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  onMore?: () => void;
  moreLabel?: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {count !== undefined && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          )}
        </View>
        {onMore && (
          <TouchableOpacity onPress={onMore}>
            <Text style={styles.moreText}>{moreLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  greeting: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  refreshButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: '700',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#000',
  },
  disclaimer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.textTertiary,
  },
  disclaimerText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#000',
  },
  moreText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  articleCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  articleTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  articleSummary: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  themes: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  theme: { fontSize: FontSize.xs, color: Colors.primary },
  empty: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  techEmpty: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  techEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  emptyButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#000',
  },
});
