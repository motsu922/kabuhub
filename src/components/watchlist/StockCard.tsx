import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Stock, StockStatus, UserIntention } from '../../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { MiniChart } from '../common/MiniChart';
import { StockDataService } from '../../services/stockData';

const STATUS_ACCENT: Record<StockStatus, string> = {
  normal: Colors.positive,
  watch:  Colors.statusWatch,
  alert:  Colors.statusAlert,
  surge:  Colors.statusSurge,
};

const STATUS_LABEL: Record<StockStatus, string> = {
  normal: '',
  watch:  '注目',
  alert:  '大幅安',
  surge:  '急騰',
};

const INTENTION_CONFIG: Record<UserIntention, { accent: string; label: string; show: boolean }> = {
  buy:     { accent: Colors.primary,  label: '買いたい', show: true },
  sell:    { accent: Colors.negative, label: '売りたい', show: true },
  neutral: { accent: '',              label: '',         show: false },
};

// 変動率の絶対値に応じてチップの不透明度を上げる
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
  const isUp = stock.change >= 0;
  const chartData = stock.previousClose > 0
    ? [stock.previousClose, ...stock.priceHistory]
    : stock.priceHistory;

  const intentionCfg = INTENTION_CONFIG[intention];
  const accentColor = intentionCfg.show ? intentionCfg.accent : STATUS_ACCENT[stock.status];
  const statusLabel = !intentionCfg.show ? STATUS_LABEL[stock.status] : '';

  const pct = Math.abs(stock.changePercent ?? 0);
  const changeColor = isUp ? Colors.positive : Colors.negative;
  const changeBg = changeColor + changeOpacityHex(pct);

  // プレスアニメーション
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
            {stock.themes && stock.themes.length > 0 && (
              <View style={styles.themes}>
                {stock.themes.slice(0, 2).map((t) => (
                  <Text key={t} style={styles.theme}>#{t}</Text>
                ))}
              </View>
            )}
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

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.sm,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingLeft: 8,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
    flex: 1,
  },
  intentionChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  intentionChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  code: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  marketBadge: {
    backgroundColor: '#1A73E8' + '22',
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
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  priceUnit: {
    fontSize: FontSize.xs,
    fontWeight: '400',
    color: Colors.textSecondary,
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
  themes: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 1,
  },
  theme: {
    fontSize: 10,
    color: Colors.primary,
    opacity: 0.8,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 10,
  },
  time: {
    fontSize: 9,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
});
