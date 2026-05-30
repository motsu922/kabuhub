import React, { useRef, useCallback } from 'react';
import { Animated, View, Text, TouchableOpacity, PanResponder, StyleSheet } from 'react-native';
import { Stock, UserIntention } from '../../types';
import { BorderRadius } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { StockCard } from './StockCard';

const BTN_W     = 56;
const ACTIONS_W = BTN_W * 4; // 224px
const THRESHOLD = 56;         // px to trigger open

interface Props {
  stock: Stock;
  intention: UserIntention;
  onPress: () => void;
  onIntentionChange: (code: string, intention: UserIntention) => void;
}

export function SwipeableStockCard({ stock, intention, onPress, onIntentionChange }: Props) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen     = useRef(false);
  const startX     = useRef(0);

  const ACTIONS: { intention: UserIntention; label: string; color: string }[] = [
    { intention: 'buy',     label: '買いたい', color: colors.primary  },
    { intention: 'hold',    label: '持ってる', color: colors.positive },
    { intention: 'sell',    label: '売りたい', color: colors.negative },
    { intention: 'neutral', label: '中立',     color: colors.textSecondary },
  ];

  const snapTo = useCallback((toValue: number, open: boolean) => {
    isOpen.current = open;
    Animated.spring(translateX, {
      toValue, useNativeDriver: true, bounciness: 0, speed: 30,
    }).start();
  }, [translateX]);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8,
    onPanResponderGrant: () => {
      startX.current = isOpen.current ? -ACTIONS_W : 0;
      translateX.stopAnimation();
    },
    onPanResponderMove: (_, { dx }) => {
      translateX.setValue(Math.max(-ACTIONS_W, Math.min(0, startX.current + dx)));
    },
    onPanResponderRelease: (_, { dx }) => {
      const net = startX.current + dx;
      if (isOpen.current) {
        net > -ACTIONS_W / 2 ? snapTo(0, false) : snapTo(-ACTIONS_W, true);
      } else {
        net < -THRESHOLD ? snapTo(-ACTIONS_W, true) : snapTo(0, false);
      }
    },
  })).current;

  const handleSet = (newIntention: UserIntention) => {
    snapTo(0, false);
    onIntentionChange(stock.code, newIntention);
  };

  return (
    <View style={styles.container}>
      {/* Action buttons revealed by swipe */}
      <View style={styles.actions}>
        {ACTIONS.map(a => (
          <TouchableOpacity
            key={a.intention}
            style={[styles.btn, { backgroundColor: a.color + (intention === a.intention ? 'FF' : 'CC') }]}
            onPress={() => handleSet(a.intention)}
            activeOpacity={0.85}
          >
            {intention === a.intention && <Text style={styles.check}>✓</Text>}
            <Text style={styles.btnLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sliding card */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <StockCard
          stock={stock}
          intention={intention}
          onPress={() => {
            if (isOpen.current) snapTo(0, false);
            else onPress();
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: BorderRadius.sm,
    marginBottom: 5,
  },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTIONS_W,
    flexDirection: 'row',
  },
  btn: {
    width: BTN_W,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  check: { fontSize: 12, color: '#fff', fontWeight: '800' },
  btnLabel: { fontSize: 10, color: '#fff', fontWeight: '700', textAlign: 'center', lineHeight: 13 },
});
