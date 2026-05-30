import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ClipboardDetection } from '../../hooks/useClipboardDetection';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

const TYPE_CONFIG = {
  youtube: { icon: '▶', label: 'YouTube動画', color: '#FF0000', hint: '字幕を貼ると精度UP' },
  twitter: { icon: '✕', label: 'X (Twitter)',  color: '#1DA1F2', hint: 'ポストのURLを検出' },
};

interface Props {
  detection: ClipboardDetection;
  onUse: () => void;
  onDismiss: () => void;
}

export function ClipboardBanner({ detection, onUse, onDismiss }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const fixedCfg = TYPE_CONFIG[detection.type as keyof typeof TYPE_CONFIG];
  const color = fixedCfg?.color ?? colors.primary;
  const icon  = fixedCfg?.icon  ?? (detection.type === 'url' ? '🔗' : '📋');
  const label = fixedCfg?.label ?? (detection.type === 'url' ? 'Web記事' : 'テキスト');
  const hint  = fixedCfg?.hint  ?? (detection.type === 'url' ? 'URLを検出' : 'テキストを検出');

  const preview = detection.content.length > 40
    ? detection.content.slice(0, 40) + '…'
    : detection.content;

  return (
    <View style={[styles.banner, { borderLeftColor: color }]}>
      <View style={styles.left}>
        <View style={styles.labelRow}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.label, { color }]}>{label}</Text>
          <Text style={styles.hint}>{hint}</Text>
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

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
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
    hint: { fontSize: FontSize.xs, color: c.textTertiary },
    preview: { fontSize: FontSize.xs, color: c.textSecondary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    useBtn: {
      backgroundColor: c.primary,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 5,
      borderRadius: BorderRadius.full,
    },
    useBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#000' },
    dismissBtn: { padding: 4 },
    dismissText: { fontSize: FontSize.xs, color: c.textTertiary },
  });
}
