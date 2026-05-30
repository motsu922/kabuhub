import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { FREE_AI_WEEKLY_LIMIT, FREE_WATCHLIST_LIMIT } from '../../services/subscriptionService';

export type PaywallReason = 'watchlist' | 'ai' | 'alert';

const REASON_CONFIG: Record<PaywallReason, { title: string; body: string }> = {
  watchlist: {
    title: `上限 ${FREE_WATCHLIST_LIMIT}銘柄`,
    body: `無料は${FREE_WATCHLIST_LIMIT}銘柄まで。プレミアムで無制限。`,
  },
  ai: {
    title: 'AI抽出の上限（週1回）',
    body: `無料は週${FREE_AI_WEEKLY_LIMIT}回まで。プレミアムは無制限。`,
  },
  alert: {
    title: 'プレミアム限定アラート',
    body: '無料は1種類まで。プレミアムで全種類利用可。',
  },
};

const FEATURES = [
  { icon: '◎', label: 'ウォッチリスト無制限' },
  { icon: '✦', label: 'AI銘柄抽出 無制限' },
  { icon: '◈', label: '全アラート種類' },
  { icon: '⟳', label: '優先データ更新' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  reason: PaywallReason;
}

export function PaywallModal({ visible, onClose, reason }: Props) {
  const { title, body } = REASON_CONFIG[reason];

  const handleUpgrade = () => {
    Alert.alert('準備中', 'プレミアムは準備中です。', [{ text: 'OK' }]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.crown}>♛</Text>
          <Text style={styles.heading}>KabuHub Premium</Text>

          <View style={styles.reasonCard}>
            <Text style={styles.reasonTitle}>{title}</Text>
            <Text style={styles.reasonBody}>{body}</Text>
          </View>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>¥480</Text>
            <Text style={styles.priceUnit}> / 月</Text>
          </View>

          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} activeOpacity={0.85}>
            <Text style={styles.upgradeBtnText}>プレミアムにアップグレード</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>このまま続ける（無料）</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  crown: {
    fontSize: 36,
    color: Colors.primary,
    lineHeight: 44,
  },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  reasonCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
    gap: 6,
  },
  reasonTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  reasonBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  features: {
    width: '100%',
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureIcon: {
    fontSize: FontSize.md,
    color: Colors.primary,
    width: 20,
    textAlign: 'center',
  },
  featureLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  price: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  priceUnit: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  upgradeBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#06090F',
    letterSpacing: 0.3,
  },
  closeText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 4,
  },
});
