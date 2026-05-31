import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAppSettings } from '../../src/contexts/SettingsContext';
import { StorageService } from '../../src/services/storage';
import { SecuritiesAppLinks } from '../../src/constants/externalLinks';
import { UserSettings, SecuritiesApp } from '../../src/types';

const BUILD_TIMESTAMP = '2026-05-28 00:00';

const SECURITIES_OPTIONS: { key: SecuritiesApp; name: string; desc: string }[] = [
  { key: 'ispeed', name: 'iSPEED', desc: '楽天証券' },
];

export default function SettingsScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const { effectsEnabled, setEffectsEnabled } = useAppSettings();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [settings, setSettings] = useState<UserSettings>({
    securitiesApp: null,
    notificationsEnabled: true,
  });

  useEffect(() => {
    StorageService.getSettings().then(setSettings);
  }, []);

  const updateApp = async (app: SecuritiesApp | null) => {
    const next = { ...settings, securitiesApp: app };
    setSettings(next);
    await StorageService.saveSettings(next);
  };

  const testOpenApp = async () => {
    if (!settings.securitiesApp) return;
    const config = SecuritiesAppLinks[settings.securitiesApp];
    const canOpen = await Linking.canOpenURL(config.url);
    if (canOpen) {
      await Linking.openURL(config.url);
    } else {
      Alert.alert(
        'アプリが見つかりません',
        `${config.name}がインストールされていません。App Storeを開きますか？`,
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'App Storeで見る', onPress: () => Linking.openURL(config.appStoreUrl) },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>設定</Text>

        {/* テーマ */}
        <SectionHeader title="テーマ" styles={styles} />
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={toggleTheme} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>
                {theme === 'dark' ? '🌙 ダーク' : '☀️ ライト'}
              </Text>
              <Text style={styles.rowDesc}>タップで切り替え</Text>
            </View>
            <View style={[styles.themeSwitch, { backgroundColor: theme === 'dark' ? colors.surface : colors.primaryMuted, borderColor: theme === 'dark' ? colors.cardBorder : colors.primary }]}>
              <Text style={styles.themeSwitchIcon}>{theme === 'dark' ? '🌙' : '☀️'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* エフェクト */}
        <View style={styles.spacer} />
        <SectionHeader title="バブルチャート" styles={styles} />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setEffectsEnabled(!effectsEnabled)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>🎆 エフェクト</Text>
              <Text style={styles.rowDesc}>
                花火・紙吹雪などのアニメーション
              </Text>
            </View>
            <View style={[
              styles.toggleTrack,
              { backgroundColor: effectsEnabled ? colors.primary : colors.surface,
                borderColor: effectsEnabled ? colors.primary : colors.cardBorder },
            ]}>
              <View style={[
                styles.toggleThumb,
                { transform: [{ translateX: effectsEnabled ? 18 : 0 }],
                  backgroundColor: effectsEnabled ? '#06090F' : colors.textTertiary },
              ]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 証券アプリ */}
        <View style={styles.spacer} />
        <SectionHeader title="証券アプリ" styles={styles} />
        <Text style={styles.sectionDesc}>ワンタップで起動する証券アプリを選択</Text>

        <View style={styles.card}>
          {SECURITIES_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.row,
                i < SECURITIES_OPTIONS.length - 1 && styles.rowBorder,
                settings.securitiesApp === opt.key && styles.rowSelected,
              ]}
              onPress={() => updateApp(settings.securitiesApp === opt.key ? null : opt.key)}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowTitle, settings.securitiesApp === opt.key && styles.rowTitleSelected]}>
                  {opt.name}
                </Text>
                <Text style={styles.rowDesc}>{opt.desc}</Text>
              </View>
              {settings.securitiesApp === opt.key && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {settings.securitiesApp && (
          <TouchableOpacity style={styles.actionBtn} onPress={testOpenApp}>
            <Text style={styles.actionBtnText}>
              {SecuritiesAppLinks[settings.securitiesApp].name} を開く
            </Text>
          </TouchableOpacity>
        )}

        {/* 免責事項 */}
        <View style={styles.spacer} />
        <SectionHeader title="免責事項" styles={styles} />
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerText}>
            本アプリは投資判断の参考情報を整理するためのツールです。{'\n'}
            特定の金融商品の売買を推奨するものではありません。{'\n'}
            投資判断は利用者自身の責任で行ってください。
          </Text>
        </View>

        {/* バージョン */}
        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>KabuHub v1.0.0</Text>
          <Text style={styles.versionText}>{BUILD_TIMESTAMP}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, styles }: { title: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { padding: Spacing.md, paddingBottom: 110 },
    title: {
      fontSize: FontSize.xxl,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.5,
      marginBottom: Spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    sectionAccent: {
      width: 3,
      height: 14,
      borderRadius: 2,
      backgroundColor: c.primary,
    },
    sectionTitle: {
      fontSize: FontSize.md,
      fontWeight: '700',
      color: c.text,
    },
    sectionDesc: {
      fontSize: FontSize.sm,
      color: c.textSecondary,
      marginBottom: Spacing.sm,
      paddingLeft: Spacing.sm + 3,
    },
    spacer: { height: Spacing.xl },
    card: {
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
      overflow: 'hidden',
      marginBottom: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: c.separator,
    },
    rowSelected: {
      backgroundColor: c.primaryMuted,
    },
    rowLeft: { gap: 2 },
    rowTitle: {
      fontSize: FontSize.md,
      fontWeight: '600',
      color: c.text,
    },
    rowTitleSelected: { color: c.primary },
    rowDesc: {
      fontSize: FontSize.xs,
      color: c.textTertiary,
    },
    toggleTrack: {
      width: 44,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    themeSwitch: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    themeSwitchIcon: { fontSize: 20 },
    checkBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#06090F',
    },
    actionBtn: {
      backgroundColor: c.primary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    actionBtnText: {
      fontSize: FontSize.md,
      fontWeight: '700',
      color: '#06090F',
    },
    disclaimerCard: {
      backgroundColor: c.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderLeftWidth: 2,
      borderLeftColor: c.textTertiary,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    disclaimerText: {
      fontSize: FontSize.sm,
      color: c.textSecondary,
      lineHeight: 22,
    },
    versionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.xl,
      paddingHorizontal: Spacing.xs,
    },
    versionLabel: {
      fontSize: FontSize.sm,
      color: c.textTertiary,
      fontWeight: '600',
    },
    versionText: {
      fontSize: FontSize.sm,
      color: c.textTertiary,
    },
  });
}
