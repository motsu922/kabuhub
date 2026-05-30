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
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { StorageService } from '../../src/services/storage';
import { SecuritiesAppLinks } from '../../src/constants/externalLinks';
import { UserSettings, SecuritiesApp } from '../../src/types';

const BUILD_TIMESTAMP = '2026-05-28 00:00';

const SECURITIES_OPTIONS: { key: SecuritiesApp; name: string; desc: string }[] = [
  { key: 'rakuten', name: 'iSPEED', desc: '楽天証券' },
  { key: 'sbi', name: 'SBI証券', desc: 'SBI証券' },
];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>({
    securitiesApp: undefined,
  });

  useEffect(() => {
    StorageService.getSettings().then(setSettings);
  }, []);

  const updateApp = async (app: SecuritiesApp | null) => {
    const next: UserSettings = { ...settings, securitiesApp: app ?? undefined };
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

        {/* 証券アプリ */}
        <SectionHeader title="証券アプリ" />
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
        <SectionHeader title="免責事項" />
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

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
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
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.sm + 3,
  },
  spacer: { height: Spacing.xl },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    borderBottomColor: Colors.separator,
  },
  rowSelected: {
    backgroundColor: Colors.primaryMuted,
  },
  rowLeft: { gap: 2 },
  rowTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  rowTitleSelected: { color: Colors.primary },
  rowDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#06090F',
  },
  actionBtn: {
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.textTertiary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  disclaimerText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  versionText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
});
