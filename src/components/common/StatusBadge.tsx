import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StockStatus } from '../../types';
import { Colors, FontSize, BorderRadius, Spacing } from '../../constants/theme';

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; dot: string | null }> = {
  normal:  { label: '平常',   color: Colors.statusNormal, dot: null },
  watch:   { label: '注目',   color: Colors.statusWatch,  dot: null },
  alert:   { label: '要確認', color: Colors.negative,     dot: '●' },
  surge:   { label: '急騰',   color: Colors.statusSurge,  dot: '🚀' },
};

interface Props {
  status: StockStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact }: Props) {
  const config = STATUS_CONFIG[status];
  if (compact) {
    if (!config.dot) return null;
    return <Text style={[styles.dot, { color: config.color }]}>{config.dot}</Text>;
  }
  return (
    <View style={[styles.badge, { borderColor: config.color + '60' }]}>
      {config.dot && <Text style={[styles.dot, { color: config.color }]}>{config.dot}</Text>}
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    fontSize: FontSize.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
