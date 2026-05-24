import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stock, UserIntention } from '../../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const INTENTION_CONFIG: Record<UserIntention, { label: string; color: string; bg: string }> = {
  buy:     { label: '買いたい', color: Colors.positive,      bg: Colors.positive + '20' },
  sell:    { label: '売りたい', color: Colors.negative,      bg: Colors.negative + '20' },
  neutral: { label: '中立',     color: Colors.textTertiary,  bg: Colors.surface },
};
import { StatusBadge } from '../common/StatusBadge';
import { MiniChart } from '../common/MiniChart';
import { StockDataService } from '../../services/stockData';

interface Props {
  stock: Stock;
  intention?: UserIntention;
  onPress: () => void;
}

export function StockCard({ stock, intention = 'neutral', onPress }: Props) {
  const isUp = stock.change >= 0;
  const intentionCfg = INTENTION_CONFIG[intention];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <View style={styles.header}>
          <Text style={styles.code}>{stock.code}</Text>
          <StatusBadge status={stock.status} compact />
          <View style={[styles.intentionBadge, { backgroundColor: intentionCfg.bg }]}>
            <Text style={[styles.intentionText, { color: intentionCfg.color }]}>
              {intentionCfg.label}
            </Text>
          </View>
        </View>
        <Text style={styles.name} numberOfLines={1}>{stock.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {stock.price.toLocaleString('ja-JP')}円
          </Text>
          <Text style={[styles.change, { color: isUp ? Colors.positive : Colors.negative }]}>
            {StockDataService.formatChange(stock.change, stock.changePercent)}
          </Text>
        </View>
        {stock.themes && (
          <View style={styles.themes}>
            {stock.themes.slice(0, 2).map((t) => (
              <View key={t} style={styles.theme}>
                <Text style={styles.themeText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.right}>
        <MiniChart data={stock.priceHistory} width={64} height={32} />
        <Text style={styles.time}>
          {stock.updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  left: {
    flex: 1,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  code: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  price: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  change: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  intentionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: 'auto',
  },
  intentionText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  themes: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  theme: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  themeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: Spacing.md,
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
});
