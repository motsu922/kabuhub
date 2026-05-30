import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StockCandidate } from '../../types';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  candidate: StockCandidate;
  isAdded: boolean;
  onAdd: () => void;
}

export function StockCandidateCard({ candidate, isAdded, onAdd }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const pct = candidate.changePercent;
  const isUp = (pct ?? 0) >= 0;
  const sign = isUp ? '+' : '';

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{candidate.name}</Text>
          <Text style={[styles.code, !candidate.code && styles.codeUnknown]}>
            {candidate.code ?? 'コード不明'}
          </Text>
        </View>
        <Text style={styles.context} numberOfLines={1}>{candidate.context}</Text>
        {candidate.price != null && (
          <Text style={styles.price}>
            {candidate.price.toLocaleString('ja-JP')}円
            {pct != null && (
              <Text style={[styles.pct, { color: isUp ? colors.positive : colors.negative }]}>
                {'  '}{sign}{pct.toFixed(2)}%
              </Text>
            )}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.button, (isAdded || !candidate.code) && styles.buttonAdded]}
        onPress={onAdd}
        disabled={isAdded || !candidate.code}
        activeOpacity={0.7}
      >
        <Text style={[styles.buttonText, (isAdded || !candidate.code) && styles.buttonTextAdded]}>
          {isAdded ? '✓ 登録済' : !candidate.code ? '追加不可' : '+ 追加'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
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
      color: c.text,
      flex: 1,
    },
    code: {
      fontSize: FontSize.xs,
      fontWeight: '700',
      color: c.textSecondary,
      backgroundColor: c.surface,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    codeUnknown: {
      color: c.textTertiary,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    context: { fontSize: FontSize.xs, color: c.textTertiary },
    price: {
      fontSize: FontSize.sm,
      color: c.text,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    pct: { fontSize: FontSize.xs, fontWeight: '500' },
    button: {
      backgroundColor: c.primary,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      minWidth: 72,
      alignItems: 'center',
    },
    buttonAdded: { backgroundColor: c.surface },
    buttonText: { fontSize: FontSize.sm, fontWeight: '700', color: '#000' },
    buttonTextAdded: { color: c.textSecondary },
  });
}
