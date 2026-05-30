import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stock, UserIntention } from '../../types';
import { BorderRadius, ColorPalette } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { StockCard } from './StockCard';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface Props {
  stock: Stock;
  intention: UserIntention;
  onPress: () => void;
  onIntentionChange: (code: string, intention: UserIntention) => void;
}

export function SwipeableStockCard({ stock, intention, onPress, onIntentionChange }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const ACTIONS = useMemo<{ intention: UserIntention; label: string; color: string }[]>(() => [
    { intention: 'buy',     label: '買いたい', color: colors.primary       },
    { intention: 'hold',    label: '持ってる', color: colors.positive      },
    { intention: 'sell',    label: '売りたい', color: colors.negative      },
    { intention: 'neutral', label: '中立',     color: colors.textSecondary },
  ], [colors]);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  }, []);

  const handleSet = useCallback((newIntention: UserIntention) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(false);
    onIntentionChange(stock.code, newIntention);
  }, [stock.code, onIntentionChange]);

  return (
    <View style={styles.wrapper}>
      {/* Card row */}
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <StockCard
            stock={stock}
            intention={intention}
            onPress={open ? toggle : onPress}
          />
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: open ? colors.primary + '22' : colors.surface, borderColor: open ? colors.primary + '55' : colors.cardBorder }]}
          onPress={toggle}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={open ? 'chevron-forward-outline' : 'chevron-back-outline'}
            size={15}
            color={open ? colors.primary : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Stance buttons - visible when open */}
      {open && (
        <View style={[styles.actions, { backgroundColor: colors.surface }]}>
          {ACTIONS.map(a => (
            <TouchableOpacity
              key={a.intention}
              style={[
                styles.btn,
                {
                  backgroundColor: a.color + (intention === a.intention ? '30' : '12'),
                  borderColor:     a.color + (intention === a.intention ? 'CC' : '40'),
                },
              ]}
              onPress={() => handleSet(a.intention)}
              activeOpacity={0.75}
            >
              {intention === a.intention && (
                <Ionicons name="checkmark" size={10} color={a.color} />
              )}
              <Text style={[styles.btnLabel, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  toggleBtn: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    height: 46,
    gap: 4,
    padding: 4,
    marginTop: 2,
    borderRadius: BorderRadius.sm,
  },
  btn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  btnLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
});
