import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  lines: string[];
  isLoading: boolean;
  error: string | null;
  generatedAt: Date | null;
  onRefresh: () => void;
}

function timeLabel(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  return `${Math.floor(mins / 60)}時間前`;
}

export function DailyBriefingCard({ lines, isLoading, error, generatedAt, onRefresh }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.sparkle}>✦</Text>
        <Text style={styles.title}>今日の3行ニュース</Text>
        <TouchableOpacity onPress={onRefresh} disabled={isLoading} style={styles.refreshBtn}>
          <Text style={[styles.refreshIcon, isLoading && { opacity: 0.3 }]}>↻</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.skeletonWrap}>
          <View style={[styles.skeletonLine, { width: '95%' }]} />
          <View style={[styles.skeletonLine, { width: '82%' }]} />
          <View style={[styles.skeletonLine, { width: '88%' }]} />
          <Text style={styles.generating}>AI生成中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>取得に失敗しました</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>再試行</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.linesWrap}>
          {lines.map((line, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.bullet}>▸</Text>
              <Text style={styles.lineText}>{line}</Text>
            </View>
          ))}
          {generatedAt && (
            <Text style={styles.timestamp}>AI生成 · {timeLabel(generatedAt)}</Text>
          )}
        </View>
      )}
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
      borderTopWidth: 2,
      borderTopColor: c.primary,
      marginBottom: Spacing.sm,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingTop: 10,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    sparkle: { fontSize: 12, color: c.primary },
    title: { fontSize: FontSize.sm, fontWeight: '700', color: c.text, flex: 1 },
    refreshBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
    refreshIcon: { fontSize: 18, color: c.textSecondary },
    skeletonWrap: { padding: Spacing.md, gap: 10 },
    skeletonLine: {
      height: 13,
      borderRadius: 6,
      backgroundColor: c.surface,
    },
    generating: {
      fontSize: FontSize.xs,
      color: c.textTertiary,
      textAlign: 'right',
      marginTop: 2,
    },
    errorWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    errorText: { fontSize: FontSize.sm, color: c.textSecondary, flex: 1 },
    retryBtn: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.primary,
    },
    retryText: { fontSize: FontSize.xs, color: c.primary, fontWeight: '700' },
    linesWrap: {
      paddingHorizontal: Spacing.md,
      paddingTop: 10,
      paddingBottom: 8,
      gap: 8,
    },
    lineRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    bullet: { fontSize: FontSize.sm, color: c.primary, lineHeight: 20 },
    lineText: { fontSize: FontSize.sm, color: c.text, flex: 1, lineHeight: 20 },
    timestamp: {
      fontSize: FontSize.xs,
      color: c.textTertiary,
      textAlign: 'right',
      marginTop: 2,
    },
  });
}
