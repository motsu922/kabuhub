import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { StockCard } from '../../src/components/watchlist/StockCard';
import { SkeletonCard } from '../../src/components/common/SkeletonCard';
import { PaywallModal, PaywallReason } from '../../src/components/common/PaywallModal';
import { useWatchlist } from '../../src/hooks/useWatchlist';
import { StockDataService } from '../../src/services/stockData';
import { SubscriptionService, FREE_WATCHLIST_LIMIT } from '../../src/services/subscriptionService';
import { Stock, UserIntention } from '../../src/types';

type FilterTab = 'all' | 'buy' | 'sell';
type ViewMode = 'intention' | 'group';

const INTENTION_ORDER: Record<UserIntention, number> = { buy: 0, neutral: 1, sell: 2 };

const INTENTION_SECTION_CONFIG: Record<UserIntention, { label: string; color: string }> = {
  buy:     { label: '買いたい',      color: Colors.primary },
  sell:    { label: '売りたい',      color: Colors.negative },
  neutral: { label: 'ニュートラル', color: Colors.textSecondary },
};

type ListItem =
  | { type: 'header'; intention: UserIntention; count: number }
  | { type: 'group-header'; label: string; count: number }
  | { type: 'stock'; stock: Stock };

export default function WatchlistScreen() {
  const router = useRouter();
  const { stocks, items, isLoading, addStock, removeStock, isInWatchlist, getItem, refresh } = useWatchlist();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('intention');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null);

  const counts = useMemo(() => {
    const buy  = stocks.filter((s) => getItem(s.code)?.intention === 'buy').length;
    const sell = stocks.filter((s) => getItem(s.code)?.intention === 'sell').length;
    return { buy, sell };
  }, [stocks, items]);

  // 現在の意思フィルタ範囲内のテーマ一覧
  const allThemes = useMemo(() => {
    let base = stocks;
    if (filter === 'buy')  base = stocks.filter((s) => getItem(s.code)?.intention === 'buy');
    if (filter === 'sell') base = stocks.filter((s) => getItem(s.code)?.intention === 'sell');
    const set = new Set<string>();
    base.forEach((s) => s.themes?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [stocks, items, filter]);

  const filteredStocks = useMemo(() => {
    let list = stocks;
    if (filter === 'buy')  list = stocks.filter((s) => getItem(s.code)?.intention === 'buy');
    if (filter === 'sell') list = stocks.filter((s) => getItem(s.code)?.intention === 'sell');
    if (selectedTheme)     list = list.filter((s) => s.themes?.includes(selectedTheme));
    return [...list].sort((a, b) => {
      const ia = INTENTION_ORDER[getItem(a.code)?.intention ?? 'neutral'];
      const ib = INTENTION_ORDER[getItem(b.code)?.intention ?? 'neutral'];
      return ia - ib;
    });
  }, [stocks, items, filter, selectedTheme]);

  const listData = useMemo<ListItem[]>(() => {
    if (viewMode === 'group') {
      const grouped = new Map<string, Stock[]>();
      filteredStocks.forEach((s) => {
        const g = getItem(s.code)?.group ?? '未分類';
        if (!grouped.has(g)) grouped.set(g, []);
        grouped.get(g)!.push(s);
      });
      // 未分類を末尾に
      const sorted = [...grouped.entries()].sort(([a], [b]) =>
        a === '未分類' ? 1 : b === '未分類' ? -1 : a.localeCompare(b)
      );
      const result: ListItem[] = [];
      sorted.forEach(([label, group]) => {
        result.push({ type: 'group-header', label, count: group.length });
        group.forEach((stock) => result.push({ type: 'stock', stock }));
      });
      return result;
    }
    if (filter !== 'all' || filteredStocks.length === 0) {
      return filteredStocks.map((stock) => ({ type: 'stock', stock }));
    }
    const groups: Record<UserIntention, Stock[]> = { buy: [], neutral: [], sell: [] };
    filteredStocks.forEach((s) => {
      const intention = getItem(s.code)?.intention ?? 'neutral';
      groups[intention].push(s);
    });
    const result: ListItem[] = [];
    (['buy', 'neutral', 'sell'] as UserIntention[]).forEach((intention) => {
      if (groups[intention].length > 0) {
        result.push({ type: 'header', intention, count: groups[intention].length });
        groups[intention].forEach((stock) => result.push({ type: 'stock', stock }));
      }
    });
    return result;
  }, [filteredStocks, filter, viewMode, items]);

  const handleSetFilter = (f: FilterTab) => {
    setFilter(f);
    setSelectedTheme(null);
    setThemeOpen(false);
  };

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.length < 1) { setSearchResults([]); return; }
    const local = StockDataService.searchStockLocal(text);
    setSearchResults(local);
    setIsSearching(true);
    const remote = await StockDataService.searchStockRemote(text);
    setSearchResults((prev) => {
      const prevCodes = new Set(prev.map((s) => s.code));
      return [...prev, ...remote.filter((r) => !prevCodes.has(r.code))];
    });
    setIsSearching(false);
  }, []);

  const handleAdd = async (code: string) => {
    const canAdd = await SubscriptionService.canAddToWatchlist(stocks.length);
    if (!canAdd) {
      setPaywallReason('watchlist');
      return;
    }
    await addStock(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setQuery('');
    setSearchResults([]);
  };

  const handleRemove = (code: string, name: string) => {
    Alert.alert(
      `${name}を削除`,
      'ウォッチリストから削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            removeStock(code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <PaywallModal
        visible={paywallReason !== null}
        reason={paywallReason ?? 'watchlist'}
        onClose={() => setPaywallReason(null)}
      />
      <View style={styles.header}>
        <Text style={styles.title}>ウォッチリスト</Text>
        {stocks.length > 0 && (
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>{stocks.length} / {FREE_WATCHLIST_LIMIT}</Text>
          </View>
        )}
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'intention' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('intention')}
          >
            <Text style={[styles.viewModeBtnText, viewMode === 'intention' && styles.viewModeBtnTextActive]}>スタンス</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'group' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('group')}
          >
            <Text style={[styles.viewModeBtnText, viewMode === 'group' && styles.viewModeBtnTextActive]}>グループ</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 検索 */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⊙</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="銘柄コード・名前で検索"
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {isSearching && <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />}
        {query.length > 0 && !isSearching && (
          <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 検索結果 */}
      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.slice(0, 8).map((stock) => (
            <TouchableOpacity
              key={stock.id}
              style={styles.searchItem}
              onPress={() => handleAdd(stock.code)}
            >
              <View style={styles.searchItemLeft}>
                <Text style={styles.searchCode}>{stock.code}</Text>
                <Text style={styles.searchName} numberOfLines={1}>{stock.name}</Text>
              </View>
              {isInWatchlist(stock.code) ? (
                <Text style={styles.addedText}>追加済み ✓</Text>
              ) : (
                <View style={styles.addButton}>
                  <Text style={styles.addButtonText}>+ 追加</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 意思フィルタ */}
      {stocks.length > 0 && (
        <View style={styles.filterRow}>
          <FilterChip label="全て"    count={stocks.length} active={filter === 'all'}  onPress={() => handleSetFilter('all')}  color={Colors.textSecondary} />
          <FilterChip label="買いたい" count={counts.buy}    active={filter === 'buy'}  onPress={() => handleSetFilter('buy')}  color={Colors.primary} />
          <FilterChip label="売りたい" count={counts.sell}   active={filter === 'sell'} onPress={() => handleSetFilter('sell')} color={Colors.negative} />
        </View>
      )}

      {/* テーマフィルタ（折り畳み式） */}
      {allThemes.length > 0 && (
        <View>
          <TouchableOpacity
            style={styles.themeToggle}
            onPress={() => setThemeOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.themeToggleText}>
              テーマ{selectedTheme ? `：#${selectedTheme}` : ''}
            </Text>
            <Text style={styles.themeToggleArrow}>{themeOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {themeOpen && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.themeRow}
            >
              {allThemes.map((theme) => {
                const active = selectedTheme === theme;
                return (
                  <TouchableOpacity
                    key={theme}
                    style={[styles.themeChip, active && styles.themeChipActive]}
                    onPress={() => {
                      setSelectedTheme(active ? null : theme);
                      setThemeOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                      #{theme}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* リスト */}
      {isLoading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : stocks.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIconText}>◎</Text>
          </View>
          <Text style={styles.emptyTitle}>ウォッチリストが空です</Text>
          <Text style={styles.emptyText}>上の検索欄から銘柄を追加すると{'\n'}ここに表示されます</Text>
        </View>
      ) : filteredStocks.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIconText}>◎</Text>
          </View>
          <Text style={styles.emptyTitle}>
            {selectedTheme ? `#${selectedTheme} の銘柄なし` : '該当銘柄なし'}
          </Text>
          <Text style={styles.emptyText}>
            {selectedTheme ? 'このテーマが付いた銘柄はありません' : '銘柄詳細で意思を設定してください'}
          </Text>
          {selectedTheme && (
            <TouchableOpacity style={styles.clearThemeBtn} onPress={() => setSelectedTheme(null)}>
              <Text style={styles.clearThemeBtnText}>フィルタを解除</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => {
            if (item.type === 'header') return `hdr-${item.intention}`;
            if (item.type === 'group-header') return `grp-${item.label}`;
            return item.stock.id;
          }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <IntentionSectionHeader intention={item.intention} count={item.count} />;
            }
            if (item.type === 'group-header') {
              return <GroupSectionHeader label={item.label} count={item.count} />;
            }
            return (
              <StockCard
                stock={item.stock}
                intention={getItem(item.stock.code)?.intention ?? 'neutral'}
                onPress={() => router.push(`/stock/${item.stock.code}`)}
              />
            );
          }}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function GroupSectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.groupIcon}>📁</Text>
      <Text style={[sectionStyles.label, { color: Colors.textSecondary }]}>{label}</Text>
      <View style={sectionStyles.line} />
      <Text style={sectionStyles.count}>{count}銘柄</Text>
    </View>
  );
}

function IntentionSectionHeader({ intention, count }: { intention: UserIntention; count: number }) {
  const cfg = INTENTION_SECTION_CONFIG[intention];
  return (
    <View style={sectionStyles.row}>
      <View style={[sectionStyles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[sectionStyles.label, { color: cfg.color }]}>{cfg.label}</Text>
      <View style={sectionStyles.line} />
      <Text style={sectionStyles.count}>{count}銘柄</Text>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  groupIcon: { fontSize: 13 },
  label: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5 },
  line: { flex: 1, height: 1, backgroundColor: Colors.separator },
  count: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '500' },
});

function FilterChip({ label, count, active, onPress, color }: {
  label: string; count: number; active: boolean; onPress: () => void; color: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && { borderColor: color, backgroundColor: color + '18' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipLabel, active && { color }]}>{label}</Text>
      {count > 0 && (
        <View style={[styles.filterChipBadge, active && { backgroundColor: color }]}>
          <Text style={[styles.filterChipBadgeText, active && { color: Colors.background }]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  viewModeToggle: {
    marginLeft: 'auto' as any,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  viewModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewModeBtnActive: { backgroundColor: Colors.primary },
  viewModeBtnText: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary },
  viewModeBtnTextActive: { color: '#06090F' },
  countChip: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
  },
  countChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: 46,
  },
  searchIcon: { fontSize: 16, color: Colors.textTertiary, marginRight: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
  clearBtn: { width: 36, height: 46, justifyContent: 'center', alignItems: 'center' },
  clearBtnText: { fontSize: 18, color: Colors.textTertiary },
  searchResults: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  searchItemLeft: { flex: 1, gap: 2, marginRight: Spacing.sm },
  searchCode: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.5 },
  searchName: { fontSize: FontSize.md, color: Colors.text, fontWeight: '500' },
  addedText: { fontSize: FontSize.sm, color: Colors.textTertiary },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  addButtonText: { fontSize: FontSize.sm, fontWeight: '700', color: '#06090F' },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  filterChipLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textTertiary },
  filterChipBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterChipBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },

  // テーマフィルタ
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  themeToggleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  themeToggleArrow: {
    fontSize: 9,
    color: Colors.textTertiary,
  },
  themeRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  themeChip: {
    width: 88,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surface,
  },
  themeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  themeChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  themeChipTextActive: {
    color: Colors.primary,
  },

  list: { padding: Spacing.md, paddingTop: Spacing.xs },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyIconText: { fontSize: 28, color: Colors.textTertiary, lineHeight: 34 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  clearThemeBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  clearThemeBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
});
