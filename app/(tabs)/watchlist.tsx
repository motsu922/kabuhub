import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
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

type ListItem =
  | { type: 'header'; intention: UserIntention; count: number }
  | { type: 'group-header'; label: string; count: number }
  | { type: 'stock'; stock: Stock };

export default function WatchlistScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { stocks, items, isLoading, addStock, removeStock, isInWatchlist, getItem, refresh } = useWatchlist();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('intention');
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null);

  const INTENTION_SECTION_CONFIG: Record<UserIntention, { label: string; color: string }> = {
    buy:     { label: '買いたい',      color: colors.primary },
    sell:    { label: '売りたい',      color: colors.negative },
    neutral: { label: 'ニュートラル', color: colors.textSecondary },
  };

  const counts = useMemo(() => {
    const buy  = stocks.filter((s) => getItem(s.code)?.intention === 'buy').length;
    const sell = stocks.filter((s) => getItem(s.code)?.intention === 'sell').length;
    return { buy, sell };
  }, [stocks, items]);

  const filteredStocks = useMemo(() => {
    let list = stocks;
    if (filter === 'buy')  list = stocks.filter((s) => getItem(s.code)?.intention === 'buy');
    if (filter === 'sell') list = stocks.filter((s) => getItem(s.code)?.intention === 'sell');
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
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {isSearching && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
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
          <FilterChip label="全て"    count={stocks.length} active={filter === 'all'}  onPress={() => handleSetFilter('all')}  color={colors.textSecondary} styles={styles} />
          <FilterChip label="買いたい" count={counts.buy}    active={filter === 'buy'}  onPress={() => handleSetFilter('buy')}  color={colors.primary}       styles={styles} />
          <FilterChip label="売りたい" count={counts.sell}   active={filter === 'sell'} onPress={() => handleSetFilter('sell')} color={colors.negative}      styles={styles} />
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
          <Text style={styles.emptyTitle}>該当銘柄なし</Text>
          <Text style={styles.emptyText}>銘柄詳細で意思を設定してください</Text>
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
              const cfg = INTENTION_SECTION_CONFIG[item.intention];
              return (
                <View style={sectionRow}>
                  <View style={[sectionDot, { backgroundColor: cfg.color }]} />
                  <Text style={[sectionLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <View style={[sectionLine, { backgroundColor: colors.separator }]} />
                  <Text style={[sectionCount, { color: colors.textTertiary }]}>{item.count}銘柄</Text>
                </View>
              );
            }
            if (item.type === 'group-header') {
              return (
                <View style={sectionRow}>
                  <Text style={groupIcon}>📁</Text>
                  <Text style={[sectionLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                  <View style={[sectionLine, { backgroundColor: colors.separator }]} />
                  <Text style={[sectionCount, { color: colors.textTertiary }]}>{item.count}銘柄</Text>
                </View>
              );
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

// inline section header styles (avoid StyleSheet per-render since they don't use colors)
const sectionRow: any = {
  flexDirection: 'row', alignItems: 'center', gap: 6,
  paddingVertical: 8, paddingHorizontal: 2, marginBottom: 2,
};
const sectionDot: any = { width: 6, height: 6, borderRadius: 3 };
const groupIcon: any = { fontSize: 13 };
const sectionLabel: any = { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5 };
const sectionLine: any = { flex: 1, height: 1 };
const sectionCount: any = { fontSize: FontSize.xs, fontWeight: '500' };

function FilterChip({ label, count, active, onPress, color, styles }: {
  label: string; count: number; active: boolean; onPress: () => void; color: string;
  styles: ReturnType<typeof createStyles>;
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
          <Text style={[styles.filterChipBadgeText, active && { color: '#fff' }]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
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
      color: c.text,
      letterSpacing: -0.5,
    },
    viewModeToggle: {
      marginLeft: 'auto' as any,
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
      overflow: 'hidden',
    },
    viewModeBtn: { paddingHorizontal: 10, paddingVertical: 4 },
    viewModeBtnActive: { backgroundColor: c.primary },
    viewModeBtnText: { fontSize: 11, fontWeight: '700', color: c.textTertiary },
    viewModeBtnTextActive: { color: '#06090F' },
    countChip: {
      backgroundColor: c.primaryMuted,
      borderRadius: BorderRadius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: c.primaryDim,
    },
    countChipText: { fontSize: FontSize.xs, fontWeight: '700', color: c.primary },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: Spacing.md,
      marginTop: Spacing.sm,
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      paddingLeft: Spacing.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
      height: 46,
    },
    searchIcon: { fontSize: 16, color: c.textTertiary, marginRight: Spacing.sm },
    searchInput: { flex: 1, color: c.text, fontSize: FontSize.md },
    clearBtn: { width: 36, height: 46, justifyContent: 'center', alignItems: 'center' },
    clearBtnText: { fontSize: 18, color: c.textTertiary },
    searchResults: {
      marginHorizontal: Spacing.md,
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
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
      borderBottomColor: c.separator,
    },
    searchItemLeft: { flex: 1, gap: 2, marginRight: Spacing.sm },
    searchCode: { fontSize: 11, fontWeight: '700', color: c.primary, letterSpacing: 0.5 },
    searchName: { fontSize: FontSize.md, color: c.text, fontWeight: '500' },
    addedText: { fontSize: FontSize.sm, color: c.textTertiary },
    addButton: {
      backgroundColor: c.primary,
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
      borderColor: c.cardBorder,
      backgroundColor: c.card,
    },
    filterChipLabel: { fontSize: FontSize.sm, fontWeight: '600', color: c.textTertiary },
    filterChipBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    filterChipBadgeText: { fontSize: 10, fontWeight: '700', color: c.textSecondary },
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
      borderColor: c.cardBorder,
      backgroundColor: c.card,
    },
    themeToggleText: { fontSize: FontSize.sm, fontWeight: '600', color: c.textSecondary },
    themeToggleArrow: { fontSize: 9, color: c.textTertiary },
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
      borderColor: c.cardBorder,
      backgroundColor: c.surface,
    },
    themeChipActive: { borderColor: c.primary, backgroundColor: c.primaryMuted },
    themeChipText: { fontSize: FontSize.xs, fontWeight: '600', color: c.textTertiary },
    themeChipTextActive: { color: c.primary },
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
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.cardBorder,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    emptyIconText: { fontSize: 28, color: c.textTertiary, lineHeight: 34 },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
    emptyText: { fontSize: FontSize.sm, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
    clearThemeBtn: {
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.primary,
    },
    clearThemeBtnText: { fontSize: FontSize.sm, color: c.primary, fontWeight: '600' },
  });
}
