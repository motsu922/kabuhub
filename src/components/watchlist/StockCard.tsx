import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Stock, StockStatus, UserIntention } from '../../types';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MiniChart } from '../common/MiniChart';
import { StockDataService } from '../../services/stockData';

const STATUS_LABEL: Record<StockStatus, string> = {
  normal: '',
  watch:  '注目',
  alert:  '大幅安',
  surge:  '急騰',
};

function changeOpacityHex(pct: number): string {
  if (pct > 5)  return '44';
  if (pct > 3)  return '32';
  if (pct > 1)  return '22';
  return '14';
}

interface Props {
  stock: Stock;
  onPress: () => void;
  intention?: UserIntention;
}

export function StockCard({ stock, onPress, intention = 'neutral' }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const STATUS_ACCENT: Record<StockStatus, string> = {
    normal: colors.positive,
    watch:  colors.statusWatch,
    alert:  colors.statusAlert,
    surge:  colors.statusSurge,
  };

  const INTENTION_CONFIG: Record<UserIntention, { accent: string; label: string; show: boolean }> = {
    buy:     { accent: colors.primary,  label: '買いたい', show: true },
    hold:    { accent: colors.positive, label: '持ってる', show: true },
    sell:    { accent: colors.negative, label: '売りたい', show: true },
    neutral: { accent: '',              label: '',         show: false },
  };

  const isUp = stock.change >= 0;
  const chartData = stock.previousClose > 0
    ? [stock.previousClose, ...stock.priceHistory]
    : stock.priceHistory;

  const intentionCfg = INTENTION_CONFIG[intention];
  const accentColor = intentionCfg.show ? intentionCfg.accent : STATUS_ACCENT[stock.status];
  const statusLabel = !intentionCfg.show ? STATUS_LABEL[stock.status] : '';

  const pct = Math.abs(stock.changePercent ?? 0);
  const changeColor = isUp ? colors.positive : colors.negative;
  const changeBg = changeColor + changeOpacityHex(pct);

  const scale = React.useRef(new Animated.Value(1)).current;
  const onPressIn  = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 5 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
        <View style={styles.content}>
          <View style={styles.left}>
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>{stock.name}</Text>
              {intentionCfg.show && (
                <View style={[styles.intentionChip, { backgroundColor: intentionCfg.accent + '22', borderColor: intentionCfg.accent + '55' }]}>
                  <Text style={[styles.intentionChipText, { color: intentionCfg.accent }]}>
                    {intentionCfg.label}
                  </Text>
                </View>
              )}
              {!intentionCfg.show && statusLabel !== '' && (
                <View style={[styles.statusChip, { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}>
                  <Text style={[styles.statusChipText, { color: accentColor }]}>{statusLabel}</Text>
                </View>
              )}
            </View>
            <View style={styles.codeRow}>
              <Text style={styles.code}>{stock.code}</Text>
              {stock.market === 'US' && (
                <View style={styles.marketBadge}>
                  <Text style={styles.marketBadgeText}>US</Text>
                </View>
              )}
            </View>
            <View style={styles.priceRow}>
              {stock.market === 'US' ? (
                <Text style={styles.price}>${stock.price.toFixed(2)}</Text>
              ) : (
                <Text style={styles.price}>
                  {stock.price.toLocaleString('ja-JP')}<Text style={styles.priceUnit}> 円</Text>
                </Text>
              )}
              <View style={[styles.changeChip, { backgroundColor: changeBg }]}>
                <Text style={[styles.changeText, { color: changeColor }]}>
                  {StockDataService.formatChange(stock.change, stock.changePercent, stock.market)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.right}>
            <MiniChart data={chartData} width={60} height={30} showArea positive={isUp} />
            <Text style={styles.time}>
              {stock.updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: c.cardBorder,
      overflow: 'hidden',
    },
    accentBar: { width: 3, alignSelf: 'stretch' },
    content: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      paddingLeft: 8,
    },
    left: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: {
      fontSize: FontSize.md,
      fontWeight: '700',
      color: c.text,
      letterSpacing: -0.3,
      flex: 1,
    },
    intentionChip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    intentionChipText: { fontSize: 10, fontWeight: '700' },
    statusChip: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    statusChipText: { fontSize: 10, fontWeight: '700' },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    code: {
      fontSize: FontSize.xs,
      fontWeight: '600',
      color: c.textTertiary,
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.5,
    },
    marketBadge: {
      backgroundColor: '#1A73E822',
      borderRadius: 3,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    marketBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#1A73E8',
      letterSpacing: 0.5,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    price: {
      fontSize: FontSize.lg,
      fontWeight: '800',
      color: c.text,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
    },
    priceUnit: {
      fontSize: FontSize.xs,
      fontWeight: '400',
      color: c.textSecondary,
    },
    changeChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    changeText: {
      fontSize: FontSize.xs,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    right: { alignItems: 'flex-end', gap: 4, marginLeft: 10 },
    time: { fontSize: 9, color: c.textTertiary, fontVariant: ['tabular-nums'] },
  });
}
