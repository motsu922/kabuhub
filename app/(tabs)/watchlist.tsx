import React, { useState, useRef, useCallback } from 'react';
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
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { StockCard } from '../../src/components/watchlist/StockCard';
import { useWatchlist } from '../../src/hooks/useWatchlist';
import { StockDataService } from '../../src/services/stockData';
import { Stock } from '../../src/types';

export default function WatchlistScreen() {
  const router = useRouter();
  const { stocks, items, isLoading, addStock, removeStock, isInWatchlist, getItem, refresh } = useWatchlist();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0); // レースコンディション防止

  const handleSearch = useCallback((text: string) => {
    setQuery(text);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // ① ローカル結果を即時表示
    const local = StockDataService.searchStockLocal(text);
    setSearchResults(local);
    setIsSearching(true);

    // ② 300ms 後にリモート検索
    const seq = ++searchSeq.current;
    debounceTimer.current = setTimeout(async () => {
      try {
        const remote = await StockDataService.searchStockRemote(text);
        if (seq !== searchSeq.current) return; // 古いリクエストは捨てる
        const localCodes = new Set(StockDataService.searchStockLocal(text).map((s) => s.code));
        const merged = [
          ...StockDataService.searchStockLocal(text),
          ...remote.filter((s) => !localCodes.has(s.code)),
        ];
        setSearchResults(merged);
      } finally {
        if (seq === searchSeq.current) setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleAdd = async (code: string) => {
    await addStock(code);
    setQuery('');
    setSearchResults([]);
  };

  const handleRemove = (code: string, name: string) => {
    Alert.alert(
      `${name}を削除`,
      'ウォッチリストから削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => removeStock(code) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ウォッチリスト</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="銘柄コードまたは名前で検索"
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={handleSearch}
          keyboardType="default"
          returnKeyType="search"
        />
        {isSearching && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.map((stock) => (
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
                <Text style={styles.addedText}>追加済み</Text>
              ) : (
                <View style={styles.addButton}>
                  <Text style={styles.addButtonText}>＋ 追加</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Watchlist */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : stocks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>ウォッチリストが空です</Text>
          <Text style={styles.emptyText}>上の検索欄から銘柄を追加してください</Text>
        </View>
      ) : (
        <FlatList
          data={stocks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View>
              <StockCard
                stock={item}
                intention={getItem(item.code)?.intention ?? 'neutral'}
                onPress={() => router.push(`/stock/${item.code}`)}
              />
            </View>
          )}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={isLoading}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: Colors.text,
    fontSize: FontSize.md,
  },
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
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  searchItemLeft: { flex: 1, gap: 2, marginRight: Spacing.sm },
  searchCode: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  searchName: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
  },
  addedText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#000',
  },
  list: { padding: Spacing.md },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyIcon: { fontSize: 48 },
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
});
