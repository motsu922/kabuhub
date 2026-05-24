import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ClipboardDetection } from '../../hooks/useClipboardDetection';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const CONFIG = {
  youtube: { icon: '▶', label: 'YouTube動画', color: '#FF0000', hint: '字幕を貼ると精度UP' },
  twitter: { icon: '✕', label: 'X (Twitter)',  color: '#1DA1F2', hint: 'ポストのURLを検出' },
  url:     { icon: '🔗', label: 'Web記事',      color: Colors.primary, hint: 'URLを検出' },
  text:    { icon: '📋', label: 'テキスト',     color: Colors.primary, hint: 'テキストを検出' },
};

interface Props {
  detection: ClipboardDetection;
  onUse: () => void;
  onDismiss: () => void;
}

export function ClipboardBanner({ detection, onUse, onDismiss }: Props) {
  const cfg = CONFIG[detection.type];
  const preview = detection.content.length > 40
    ? detection.content.slice(0, 40) + '…'
    : detection.content;

  return (
    <View style={[styles.banner, { borderLeftColor: cfg.color }]}>
      <View style={styles.left}>
        <View style={styles.labelRow}>
          <Text style={[styles.icon]}>{cfg.icon}</Text>
          <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={styles.hint}>{cfg.hint}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.useBtn} onPress={onUse}>
          <Text style={styles.useBtnText}>使う</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  left: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 12 },
  label: { fontSize: FontSize.xs, fontWeight: '700' },
  hint: { fontSize: FontSize.xs, color: Colors.textTertiary },
  preview: { fontSize: FontSize.xs, color: Colors.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  useBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  useBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#000' },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: FontSize.xs, color: Colors.textTertiary },
});
