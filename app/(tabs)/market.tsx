import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { StockDataService } from '../../src/services/stockData';
import { useWatchlist } from '../../src/hooks/useWatchlist';

// ── 表示する主要指数 ──────────────────────────────────────────────────────────

const INDICES = [
  { symbol: '^N225',   label: '日経平均',  flag: '🇯🇵' },
  { symbol: '^TPX',    label: 'TOPIX',    flag: '🇯🇵' },
  { symbol: 'USDJPY=X',label: 'ドル/円',  flag: '💱' },
  { symbol: '^DJI',    label: 'NYダウ',   flag: '🇺🇸' },
  { symbol: '^IXIC',   label: 'NASDAQ',   flag: '🇺🇸' },
  { symbol: '^VIX',    label: 'VIX',      flag: '😨' },
];

interface IndexData {
  price: number;
  change: number;
  changePercent: number;
}

// ── コンポーネント ────────────────────────────────────────────────────────────

export default function MarketScreen() {
  const router  = useRouter();
  const { stocks, isLoading: watchlistLoading, refresh: refreshWatchlist } = useWatchlist();

  const [indices, setIndices]     = useState<Record<string, IndexData | null>>({});
  const [indicesLoading, setIndicesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadIndices = useCallback(async () => {
    setIndicesLoading(true);
    const results = await Promise.all(
      INDICES.map(async ({ symbol }) => ({
        symbol,
        data: await StockDataService.fetchIndexQuote(symbol).catch(() => null),
      }))
    );
    const map: Record<string, IndexData | null> = {};
    for (const { symbol, data } of results) map[symbol] = data;
    setIndices(map);
    setIndicesLoading(false);
  }, []);

  useEffect(() => { loadIndices(); }, [loadIndices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadIndices(), refreshWatchlist()]);
    setRefreshing(false);
  }, [loadIndices, refreshWatchlist]);

  // ウォッチリストの騰落ランキング
  const ranked = [...stocks]
    .filter((s) => s.price > 0)
    .sort((a, b) => b.changePercent - a.changePercent);
  const gainers = ranked.slice(0, 5);
  const losers  = [...ranked].reverse().slice(0, 5);

  // 市場センチメント（ウォッチリスト内の上昇比率）
  const total   = stocks.filter((s) => s.price > 0).length;
  const upCount = stocks.filter((s) => s.changePercent > 0).length;
  const sentiment = total > 0 ? upCount / total : null;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ヘッダー */}
        <View style={s.header}>
          <Text style={s.title}>マーケット概況</Text>
          {indicesLoading && <ActivityIndicator size="small" color={Colors.primary} />}
        </View>

        {/* 主要指数 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>主要指数</Text>
          <View style={s.indexGrid}>
            {INDICES.map(({ symbol, label, flag }) => {
              const d = indices[symbol];
              return (
                <IndexCard
                  key={symbol}
                  flag={flag}
                  label={label}
                  data={d}
                  loading={indicesLoading}
                />
              );
            })}
          </View>
        </View>

        {/* ウォッチリスト センチメント */}
        {total > 0 && sentiment !== null && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>ウォッチリスト センチメント</Text>
            <SentimentBar upCount={upCount} total={total} sentiment={sentiment} />
          </View>
        )}

        {/* 騰落ランキング */}
        {stocks.length > 0 && (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>📈 本日の上昇銘柄</Text>
              {watchlistLoading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : gainers.filter((s) => s.changePercent > 0).length === 0 ? (
                <Text style={s.emptyText}>上昇銘柄なし</Text>
              ) : (
                gainers
                  .filter((st) => st.changePercent > 0)
                  .map((st) => (
                    <RankRow
                      key={st.code}
                      stock={st}
                      onPress={() => router.push(`/stock/${st.code}`)}
                    />
                  ))
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>📉 本日の下落銘柄</Text>
              {watchlistLoading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : losers.filter((st) => st.changePercent < 0).length === 0 ? (
                <Text style={s.emptyText}>下落銘柄なし</Text>
              ) : (
                losers
                  .filter((st) => st.changePercent < 0)
                  .map((st) => (
                    <RankRow
                      key={st.code}
                      stock={st}
                      onPress={() => router.push(`/stock/${st.code}`)}
                    />
                  ))
              )}
            </View>
          </>
        )}

        {stocks.length === 0 && !watchlistLoading && (
          <View style={s.emptyWatchlist}>
            <Text style={s.emptyWatchlistText}>
              ウォッチリストに銘柄を追加すると{'\n'}騰落ランキングが表示されます
            </Text>
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => router.push('/(tabs)/watchlist')}
            >
              <Text style={s.addBtnText}>ウォッチリストを開く</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── IndexCard ────────────────────────────────────────────────────────────────

function IndexCard({
  flag, label, data, loading,
}: {
  flag: string;
  label: string;
  data: IndexData | null | undefined;
  loading: boolean;
}) {
  const isUp = (data?.changePercent ?? 0) >= 0;
  const color = data
    ? (isUp ? Colors.positive : Colors.negative)
    : Colors.textTertiary;

  const formatPrice = (v: number) => {
    if (v >= 1000) return v.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
    if (v >= 100)  return v.toFixed(2);
    return v.toFixed(3);
  };

  return (
    <View style={s.indexCard}>
      <View style={s.indexTop}>
        <Text style={s.indexFlag}>{flag}</Text>
        <Text style={s.indexLabel} numberOfLines={1}>{label}</Text>
      </View>
      {loading || data === undefined ? (
        <ActivityIndicator size="small" color={Colors.textTertiary} style={{ marginTop: 6 }} />
      ) : data === null ? (
        <Text style={s.indexError}>取得失敗</Text>
      ) : (
        <>
          <Text style={[s.indexPrice, { color }]}>{formatPrice(data.price)}</Text>
          <Text style={[s.indexChange, { color }]}>
            {isUp ? '▲' : '▼'} {Math.abs(data.changePercent).toFixed(2)}%
          </Text>
        </>
      )}
    </View>
  );
}

// ── SentimentBar ─────────────────────────────────────────────────────────────

function SentimentBar({ upCount, total, sentiment }: { upCount: number; total: number; sentiment: number }) {
  const downCount = total - upCount;
  const label = sentiment >= 0.7 ? '強気' : sentiment >= 0.5 ? 'やや強気' : sentiment >= 0.3 ? 'やや弱気' : '弱気';
  const labelColor = sentiment >= 0.5 ? Colors.positive : Colors.negative;
  return (
    <View style={s.sentimentCard}>
      <View style={s.sentimentRow}>
        <Text style={[s.sentimentLabel, { color: Colors.positive }]}>上昇 {upCount}</Text>
        <View style={[s.sentimentBadge, { backgroundColor: labelColor + '22', borderColor: labelColor + '60' }]}>
          <Text style={[s.sentimentBadgeText, { color: labelColor }]}>{label}</Text>
        </View>
        <Text style={[s.sentimentLabel, { color: Colors.negative }]}>下落 {downCount}</Text>
      </View>
      <View style={s.sentimentBar}>
        <View style={[s.sentimentUp,   { flex: upCount }]} />
        <View style={[s.sentimentDown, { flex: Math.max(downCount, 0) }]} />
      </View>
      <Text style={s.sentimentTotal}>{total}銘柄中</Text>
    </View>
  );
}

// ── RankRow ──────────────────────────────────────────────────────────────────

function RankRow({ stock, onPress }: { stock: any; onPress: () => void }) {
  const isUp = stock.changePercent >= 0;
  const color = isUp ? Colors.positive : Colors.negative;
  return (
    <TouchableOpacity style={s.rankRow} onPress={onPress} activeOpacity={0.75}>
      <View style={{ flex: 1 }}>
        <Text style={s.rankName} numberOfLines={1}>{stock.name}</Text>
        <Text style={s.rankCode}>{stock.code}</Text>
      </View>
      <View style={s.rankRight}>
        <Text style={[s.rankPct, { color }]}>
          {isUp ? '+' : ''}{stock.changePercent.toFixed(2)}%
        </Text>
        <Text style={s.rankPrice}>{stock.price.toLocaleString('ja-JP')}円</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── スタイル ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },

  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },

  // 指数グリッド
  indexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  indexCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: 2,
  },
  indexTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  indexFlag: { fontSize: 16 },
  indexLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600', flex: 1 },
  indexPrice: { fontSize: FontSize.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  indexChange: { fontSize: FontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  indexError: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 6 },

  // センチメント
  sentimentCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sentimentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sentimentLabel: { fontSize: FontSize.sm, fontWeight: '700' },
  sentimentBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  sentimentBadgeText: { fontSize: FontSize.sm, fontWeight: '700' },
  sentimentBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  sentimentUp:   { backgroundColor: Colors.positive },
  sentimentDown: { backgroundColor: Colors.negative },
  sentimentTotal: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'right' },

  // ランキング行
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  rankName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  rankCode: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  rankRight: { alignItems: 'flex-end', gap: 2 },
  rankPct:   { fontSize: FontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankPrice: { fontSize: FontSize.xs, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },

  emptyText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.sm },
  emptyWatchlist: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
  },
  emptyWatchlistText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  addBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  addBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#000' },
});
