import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StockCandidate } from '../../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

interface Props {
  candidate: StockCandidate;
  isAdded: boolean;
  onAdd: () => void;
}

export function StockCandidateCard({ candidate, isAdded, onAdd }: Props) {
  const pct = candidate.changePercent;
  const isUp = (pct ?? 0) >= 0;
  const sign = isUp ? '+' : '';

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{candidate.name}</Text>
          <Text style={styles.code}>{candidate.code}</Text>
        </View>
        <Text style={styles.context} numberOfLines={1}>{candidate.context}</Text>
        {candidate.price != null && (
          <Text style={styles.price}>
            {candidate.price.toLocaleString('ja-JP')}円
            {pct != null && (
              <Text style={[styles.pct, { color: isUp ? Colors.positive : Colors.negative }]}>
                {'  '}{sign}{pct.toFixed(2)}%
              </Text>
            )}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.button, isAdded && styles.buttonAdded]}
        onPress={onAdd}
        disabled={isAdded}
        activeOpacity={0.7}
      >
        <Text style={[styles.buttonText, isAdded && styles.buttonTextAdded]}>
          {isAdded ? '✓ 登録済' : '+ 追加'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  left: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  code: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  context: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  price: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pct: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minWidth: 72,
    alignItems: 'center',
  },
  buttonAdded: {
    backgroundColor: Colors.surface,
  },
  buttonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#000',
  },
  buttonTextAdded: {
    color: Colors.textSecondary,
  },
});
