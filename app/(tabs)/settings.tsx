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
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { StorageService } from '../../src/services/storage';
import { SecuritiesAppLinks } from '../../src/constants/externalLinks';
import { UserSettings, SecuritiesApp } from '../../src/types';

const SECURITIES_OPTIONS: { key: SecuritiesApp; name: string }[] = [
  { key: 'sbi',     name: 'SBI証券' },
  { key: 'rakuten', name: '楽天証券' },
  { key: 'ispeed',  name: 'iSPEED（楽天）' },
  { key: 'moomoo',  name: 'moomoo' },
  { key: 'matsui',  name: '松井証券' },
  { key: 'monex',   name: 'マネックス証券' },
];

export default function SettingsScreen() {
  const router = useRouter();
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>設定</Text>

        {/* 証券アプリ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>証券アプリ</Text>
          <Text style={styles.sectionDesc}>
            ワンタップで起動する証券アプリを選択してください
          </Text>

          <View style={styles.optionList}>
            {SECURITIES_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.option,
                  settings.securitiesApp === opt.key && styles.optionSelected,
                ]}
                onPress={() =>
                  updateApp(settings.securitiesApp === opt.key ? null : opt.key)
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    settings.securitiesApp === opt.key && styles.optionTextSelected,
                  ]}
                >
                  {opt.name}
                </Text>
                {settings.securitiesApp === opt.key && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {settings.securitiesApp && (
            <TouchableOpacity style={styles.testButton} onPress={testOpenApp}>
              <Text style={styles.testButtonText}>
                {SecuritiesAppLinks[settings.securitiesApp].name}を開く
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* テクニカル分析 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>テクニカル分析</Text>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/backtest')}
          >
            <Text style={styles.navRowText}>📊 バックテスト（シグナル信頼性検証）</Text>
            <Text style={styles.navRowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 免責事項 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>免責事項</Text>
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              本アプリは投資判断の参考情報を整理するためのツールです。{'\n'}
              特定の金融商品の売買を推奨するものではありません。{'\n'}
              投資判断は利用者自身の責任で行ってください。
            </Text>
          </View>
        </View>

        {/* バージョン */}
        <View style={styles.section}>
          <Text style={styles.versionText}>KabuHub v1.0.0 MVP</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  optionList: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  optionSelected: {
    backgroundColor: Colors.primaryMuted,
  },
  optionText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '700',
  },
  testButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#000',
  },
  disclaimer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.textTertiary,
  },
  disclaimerText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  versionText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  navRowText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  navRowArrow: {
    fontSize: FontSize.xl,
    color: Colors.textTertiary,
  },
});
