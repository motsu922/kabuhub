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
  TextInput,
  Modal,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAppSettings } from '../../src/contexts/SettingsContext';
import { DEFAULT_SETTINGS, StorageService } from '../../src/services/storage';
import { CloudSyncService } from '../../src/services/cloudSync';
import { SecuritiesAppLinks } from '../../src/constants/externalLinks';
import { BubbleChartPeriod, RefreshInterval, SecuritiesApp, UserSettings } from '../../src/types';

const BUILD_TIMESTAMP = '2026-05-28 00:00';

const SECURITIES_OPTIONS: { key: SecuritiesApp; name: string; desc: string }[] = [
  { key: 'ispeed', name: 'iSPEED', desc: '楽天証券' },
];

const REFRESH_OPTIONS: { key: RefreshInterval; label: string }[] = [
  { key: 'manual', label: '手動' },
  { key: '1m', label: '1分' },
  { key: '3m', label: '3分' },
  { key: '5m', label: '5分' },
];

const THRESHOLD_OPTIONS = [3, 5, 10];

const PERIOD_OPTIONS: { key: BubbleChartPeriod; label: string }[] = [
  { key: '1d', label: '1日' },
  { key: '7d', label: '7日' },
  { key: '30d', label: '30日' },
  { key: '365d', label: '365日' },
];

type CameraPermissionResponse = { granted: boolean };
type CameraModule = {
  CameraView: React.ComponentType<any>;
  requestCameraPermissionsAsync?: () => Promise<CameraPermissionResponse>;
  Camera?: {
    requestCameraPermissionsAsync?: () => Promise<CameraPermissionResponse>;
  };
};

function extractSyncIdFromQr(data: string): string | null {
  const raw = data.trim();
  const direct = raw.match(/kh-[a-z0-9]{5}-[a-z0-9]{5}/i)?.[0];
  if (direct) return CloudSyncService.normalizeSyncId(direct);

  try {
    const url = new URL(raw);
    const value = url.searchParams.get('syncId') ?? url.searchParams.get('id');
    const normalized = value ? CloudSyncService.normalizeSyncId(value) : '';
    return normalized.match(/^kh-[a-z0-9]{5}-[a-z0-9]{5}$/) ? normalized : null;
  } catch {
    return null;
  }
}

export default function SettingsScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const { effectsEnabled, setEffectsEnabled } = useAppSettings();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [syncId, setSyncId] = useState('');
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [hasScannedQr, setHasScannedQr] = useState(false);
  const [cameraModule, setCameraModule] = useState<CameraModule | null>(null);

  useEffect(() => {
    StorageService.getSettings().then(setSettings);
  }, []);

  const saveSettings = async (next: UserSettings) => {
    setSettings(next);
    await StorageService.saveSettings(next);
  };

  const updateApp = async (app: SecuritiesApp | null) => {
    await saveSettings({ ...settings, securitiesApp: app });
  };

  const toggleNotificationType = async (key: keyof UserSettings['notificationTypes']) => {
    await saveSettings({
      ...settings,
      notificationTypes: {
        ...settings.notificationTypes,
        [key]: !settings.notificationTypes[key],
      },
    });
  };

  const toggleClipboardType = async (key: keyof UserSettings['clipboardDetection']['types']) => {
    await saveSettings({
      ...settings,
      clipboardDetection: {
        ...settings.clipboardDetection,
        types: {
          ...settings.clipboardDetection.types,
          [key]: !settings.clipboardDetection.types[key],
        },
      },
    });
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

  const clearStockCache = () => {
    Alert.alert('株価キャッシュを削除', '保存済みの株価キャッシュを削除します。ウォッチリストは残ります。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => StorageService.clearStockCache() },
    ]);
  };

  const clearArticles = () => {
    Alert.alert('保存記事を削除', '保存した記事データをすべて削除します。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => StorageService.clearArticles() },
    ]);
  };

  const resetSettings = () => {
    Alert.alert('設定を初期化', 'テーマ以外の設定を初期状態に戻します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '初期化',
        style: 'destructive',
        onPress: async () => {
          const next = await StorageService.resetSettings();
          setSettings(next);
          setEffectsEnabled(true);
        },
      },
    ]);
  };

  const createSyncId = () => {
    const next = CloudSyncService.generateSyncId();
    setSyncId(next);
    setCloudUpdatedAt(null);
  };

  const showSyncQr = () => {
    const normalized = CloudSyncService.normalizeSyncId(syncId);
    if (!normalized.match(/^kh-[a-z0-9]{5}-[a-z0-9]{5}$/)) {
      Alert.alert('同期IDが必要です', '先に同期IDを作成または入力してください');
      return;
    }
    setSyncId(normalized);
    setIsQrVisible(true);
  };

  const openQrScanner = async () => {
    let nextCameraModule = cameraModule;
    if (!nextCameraModule) {
      try {
        nextCameraModule = require('expo-camera') as CameraModule;
        setCameraModule(nextCameraModule);
      } catch {
        Alert.alert('読み取りは次回ビルド後に使えます', 'QR読み取りにはカメラ機能を含む新しいTestFlightビルドが必要です');
        return;
      }
    }

    const requestPermission =
      nextCameraModule.requestCameraPermissionsAsync ??
      nextCameraModule.Camera?.requestCameraPermissionsAsync;
    let permission: CameraPermissionResponse;
    try {
      permission = requestPermission ? await requestPermission() : { granted: false };
    } catch {
      Alert.alert('読み取りは次回ビルド後に使えます', 'QR読み取りにはカメラ機能を含む新しいTestFlightビルドが必要です');
      return;
    }
    if (!permission.granted) {
      Alert.alert('カメラ許可が必要です', '同期IDのQRを読み取るにはカメラへのアクセスを許可してください');
      return;
    }
    setHasScannedQr(false);
    setIsScannerVisible(true);
  };

  const handleQrScanned = ({ data }: { data: string }) => {
    if (hasScannedQr) return;
    setHasScannedQr(true);

    const nextSyncId = extractSyncIdFromQr(data);
    if (!nextSyncId) {
      Alert.alert('読み取れませんでした', 'KabuHubの同期ID QRではありません');
      setHasScannedQr(false);
      return;
    }

    setSyncId(nextSyncId);
    setCloudUpdatedAt(null);
    setIsScannerVisible(false);
    Alert.alert('同期IDを読み取りました', nextSyncId);
  };

  const ScannerCamera = cameraModule?.CameraView;

  const checkCloudData = async () => {
    const normalized = CloudSyncService.normalizeSyncId(syncId);
    setSyncId(normalized);
    if (!normalized) return;
    setIsSyncing(true);
    try {
      const meta = await CloudSyncService.getMeta(normalized);
      setCloudUpdatedAt(meta?.updatedAt ?? null);
      Alert.alert(
        meta ? 'クラウドデータがあります' : 'クラウドデータなし',
        meta?.updatedAt ? `最終保存: ${new Date(meta.updatedAt).toLocaleString('ja-JP')}` : 'この同期IDのデータはまだありません'
      );
    } catch (error) {
      Alert.alert(
        '確認できませんでした',
        `通信状態またはFirestore設定を確認してください。\n\n${CloudSyncService.formatError(error)}`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const uploadCloudData = async () => {
    const normalized = CloudSyncService.normalizeSyncId(syncId);
    if (!normalized) {
      Alert.alert('同期IDが必要です', '同期IDを作成または入力してください');
      return;
    }
    setSyncId(normalized);
    setIsSyncing(true);
    try {
      const meta = await CloudSyncService.upload(normalized);
      setCloudUpdatedAt(meta.updatedAt);
      Alert.alert('保存しました', 'この端末のウォッチリスト・設定・保存記事をクラウドへ保存しました');
    } catch (error) {
      Alert.alert(
        '保存できませんでした',
        `通信状態またはFirestore設定を確認してください。\n\n${CloudSyncService.formatError(error)}`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreCloudData = () => {
    const normalized = CloudSyncService.normalizeSyncId(syncId);
    if (!normalized) {
      Alert.alert('同期IDが必要です', '同期IDを入力してください');
      return;
    }
    Alert.alert(
      'クラウドから復元',
      'この端末のウォッチリスト・設定・保存記事をクラウドの内容で置き換えます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '復元',
          onPress: async () => {
            setSyncId(normalized);
            setIsSyncing(true);
            try {
              const meta = await CloudSyncService.restore(normalized);
              const nextSettings = await StorageService.getSettings();
              setSettings(nextSettings);
              setCloudUpdatedAt(meta.updatedAt);
              Alert.alert('復元しました', 'クラウドのデータをこの端末へ反映しました');
            } catch (error) {
              Alert.alert(
                '復元できませんでした',
                `同期IDまたはFirestore設定を確認してください。\n\n${CloudSyncService.formatError(error)}`
              );
            } finally {
              setIsSyncing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>設定</Text>

        <SectionHeader title="クラウド同期" styles={styles} />
        <Text style={styles.sectionDesc}>同じ同期IDを別端末で使うと、手動でデータを共有できます</Text>
        <View style={styles.card}>
          <View style={styles.inputBlock}>
            <Text style={styles.rowTitle}>同期ID</Text>
            <TextInput
              style={styles.syncInput}
              value={syncId}
              onChangeText={(text) => {
                setSyncId(text);
                setCloudUpdatedAt(null);
              }}
              placeholder="kh-xxxxx-xxxxx"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {cloudUpdatedAt && (
              <Text style={styles.rowDesc}>
                最終保存: {new Date(cloudUpdatedAt).toLocaleString('ja-JP')}
              </Text>
            )}
          </View>
          <View style={styles.rowBorder} />
          <ActionRow title="同期IDを作成" desc="このIDを別端末にも入力します" onPress={createSyncId} styles={styles} />
          <View style={styles.rowBorder} />
          <ActionRow title="同期IDのQRを表示" desc="別端末のカメラで読み取れます" onPress={showSyncQr} styles={styles} />
          <View style={styles.rowBorder} />
          <ActionRow title="QRから同期IDを読み取り" desc="別端末で表示した同期IDを入力" onPress={openQrScanner} styles={styles} />
          <View style={styles.rowBorder} />
          <ActionRow title="クラウドデータを確認" desc="指定IDの保存状況を確認" onPress={checkCloudData} styles={styles} />
          <View style={styles.rowBorder} />
          <ActionRow title={isSyncing ? '同期中...' : 'この端末をクラウドへ保存'} desc="ウォッチリスト・設定・保存記事を保存" onPress={uploadCloudData} styles={styles} />
          <View style={styles.rowBorder} />
          <ActionRow title="クラウドからこの端末へ復元" desc="この端末のデータを置き換え" onPress={restoreCloudData} styles={styles} destructive />
        </View>

        <SectionHeader title="テーマ" styles={styles} />
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={toggleTheme} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>{theme === 'dark' ? 'ダーク' : 'ライト'}</Text>
              <Text style={styles.rowDesc}>タップで表示テーマを切り替え</Text>
            </View>
            <Text style={styles.rowValue}>{theme === 'dark' ? 'Dark' : 'Light'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />
        <SectionHeader title="通知" styles={styles} />
        <View style={styles.card}>
          <ToggleRow
            title="通知"
            desc="ウォッチ銘柄の条件通知"
            value={settings.notificationsEnabled}
            onPress={() => saveSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
            styles={styles}
            colors={colors}
          />
          <View style={styles.rowBorder} />
          <MultiChoiceRow
            title="変動率しきい値"
            desc="急騰・急落として扱う変動幅"
            options={THRESHOLD_OPTIONS.map((n) => ({ key: String(n), label: `${n}%` }))}
            selected={String(settings.notificationThresholdPercent)}
            onSelect={(key) => saveSettings({ ...settings, notificationThresholdPercent: Number(key) })}
            styles={styles}
          />
          <View style={styles.divider} />
          <ToggleRow title="急騰" desc="しきい値以上の上昇" value={settings.notificationTypes.surge} onPress={() => toggleNotificationType('surge')} styles={styles} colors={colors} compact />
          <ToggleRow title="急落" desc="しきい値以上の下落" value={settings.notificationTypes.plunge} onPress={() => toggleNotificationType('plunge')} styles={styles} colors={colors} compact />
          <ToggleRow title="押し目" desc="軽めの下落候補" value={settings.notificationTypes.dip} onPress={() => toggleNotificationType('dip')} styles={styles} colors={colors} compact />
          <ToggleRow title="続落" desc="連続下落の検出" value={settings.notificationTypes.consecutiveDecline} onPress={() => toggleNotificationType('consecutiveDecline')} styles={styles} colors={colors} compact />
          <ToggleRow title="出来高急増" desc="今後の拡張用" value={settings.notificationTypes.volume} onPress={() => toggleNotificationType('volume')} styles={styles} colors={colors} compact />
        </View>

        <View style={styles.spacer} />
        <SectionHeader title="データ更新" styles={styles} />
        <View style={styles.card}>
          <MultiChoiceRow
            title="自動更新"
            desc="フォアグラウンド中の更新間隔"
            options={REFRESH_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
            selected={settings.refreshInterval}
            onSelect={(key) => saveSettings({ ...settings, refreshInterval: key as RefreshInterval })}
            styles={styles}
          />
          <View style={styles.rowBorder} />
          <ToggleRow
            title="復帰時に更新"
            desc="アプリを開き直した時に即更新"
            value={settings.refreshOnAppActive}
            onPress={() => saveSettings({ ...settings, refreshOnAppActive: !settings.refreshOnAppActive })}
            styles={styles}
            colors={colors}
          />
        </View>

        <View style={styles.spacer} />
        <SectionHeader title="クリップボード検出" styles={styles} />
        <View style={styles.card}>
          <ToggleRow
            title="検出を有効化"
            desc="コピーしたURLや文章を銘柄抽出へ送る"
            value={settings.clipboardDetection.enabled}
            onPress={() => saveSettings({
              ...settings,
              clipboardDetection: { ...settings.clipboardDetection, enabled: !settings.clipboardDetection.enabled },
            })}
            styles={styles}
            colors={colors}
          />
          <View style={styles.rowBorder} />
          <ToggleRow
            title="復帰時にチェック"
            desc="アプリに戻った時だけ確認"
            value={settings.clipboardDetection.onAppActive}
            onPress={() => saveSettings({
              ...settings,
              clipboardDetection: { ...settings.clipboardDetection, onAppActive: !settings.clipboardDetection.onAppActive },
            })}
            styles={styles}
            colors={colors}
          />
          <View style={styles.divider} />
          <ToggleRow title="YouTube" desc="動画URL" value={settings.clipboardDetection.types.youtube} onPress={() => toggleClipboardType('youtube')} styles={styles} colors={colors} compact />
          <ToggleRow title="X" desc="ポストURL" value={settings.clipboardDetection.types.twitter} onPress={() => toggleClipboardType('twitter')} styles={styles} colors={colors} compact />
          <ToggleRow title="Web記事" desc="一般URL" value={settings.clipboardDetection.types.url} onPress={() => toggleClipboardType('url')} styles={styles} colors={colors} compact />
          <ToggleRow title="長文テキスト" desc="50文字以上の文章" value={settings.clipboardDetection.types.text} onPress={() => toggleClipboardType('text')} styles={styles} colors={colors} compact />
        </View>

        <View style={styles.spacer} />
        <SectionHeader title="バブルチャート" styles={styles} />
        <View style={styles.card}>
          <ToggleRow
            title="ホームに表示"
            desc="ウォッチ銘柄をバブルで俯瞰"
            value={settings.bubbleChart.showOnHome}
            onPress={() => saveSettings({
              ...settings,
              bubbleChart: { ...settings.bubbleChart, showOnHome: !settings.bubbleChart.showOnHome },
            })}
            styles={styles}
            colors={colors}
          />
          <View style={styles.rowBorder} />
          <ToggleRow
            title="エフェクト"
            desc="花火・紙吹雪などのアニメーション"
            value={effectsEnabled}
            onPress={() => setEffectsEnabled(!effectsEnabled)}
            styles={styles}
            colors={colors}
          />
          <View style={styles.rowBorder} />
          <ToggleRow
            title="コンパクトで開始"
            desc="小さめの表示密度で開く"
            value={settings.bubbleChart.compactDefault}
            onPress={() => saveSettings({
              ...settings,
              bubbleChart: { ...settings.bubbleChart, compactDefault: !settings.bubbleChart.compactDefault },
            })}
            styles={styles}
            colors={colors}
          />
          <View style={styles.divider} />
          <MultiChoiceRow
            title="初期期間"
            desc="最初に選ばれるパフォーマンス期間"
            options={PERIOD_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
            selected={settings.bubbleChart.defaultPeriod}
            onSelect={(key) => saveSettings({
              ...settings,
              bubbleChart: { ...settings.bubbleChart, defaultPeriod: key as BubbleChartPeriod },
            })}
            styles={styles}
          />
        </View>

        <View style={styles.spacer} />
        <SectionHeader title="証券アプリ" styles={styles} />
        <Text style={styles.sectionDesc}>ワンタップで起動する証券アプリを選択</Text>
        <View style={styles.card}>
          {SECURITIES_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.row,
                i < SECURITIES_OPTIONS.length - 1 && styles.rowBottomLine,
                settings.securitiesApp === opt.key && styles.rowSelected,
              ]}
              onPress={() => updateApp(settings.securitiesApp === opt.key ? null : opt.key)}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowTitle, settings.securitiesApp === opt.key && styles.rowTitleSelected]}>{opt.name}</Text>
                <Text style={styles.rowDesc}>{opt.desc}</Text>
              </View>
              {settings.securitiesApp === opt.key && <Text style={styles.checkText}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
        {settings.securitiesApp && (
          <TouchableOpacity style={styles.actionBtn} onPress={testOpenApp}>
            <Text style={styles.actionBtnText}>{SecuritiesAppLinks[settings.securitiesApp].name} を開く</Text>
          </TouchableOpacity>
        )}

        <View style={styles.spacer} />
        <SectionHeader title="データ管理" styles={styles} />
        <View style={styles.card}>
          <ActionRow title="株価キャッシュを削除" desc="表示データを次回再取得" onPress={clearStockCache} styles={styles} />
          <View style={styles.rowBorder} />
          <ActionRow title="保存記事を削除" desc="銘柄抽出で保存した記事データ" onPress={clearArticles} styles={styles} />
          <View style={styles.rowBorder} />
          <ActionRow title="設定を初期化" desc="通知・更新・表示設定を初期状態へ" onPress={resetSettings} styles={styles} destructive />
        </View>

        <View style={styles.spacer} />
        <SectionHeader title="免責事項" styles={styles} />
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerText}>
            本アプリは投資判断の参考情報を整理するためのツールです。{'\n'}
            特定の金融商品の売買を推奨するものではありません。{'\n'}
            投資判断は利用者自身の責任で行ってください。
          </Text>
        </View>

        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>KabuHub v1.0.0</Text>
          <Text style={styles.versionText}>{BUILD_TIMESTAMP}</Text>
        </View>
      </ScrollView>

      <Modal visible={isQrVisible} transparent animationType="fade" onRequestClose={() => setIsQrVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.qrSheet}>
            <Text style={styles.modalTitle}>同期ID QR</Text>
            <View style={styles.qrBox}>
              <QRCode value={syncId} size={220} backgroundColor="#FFFFFF" color="#06090F" />
            </View>
            <Text style={styles.qrSyncId}>{syncId}</Text>
            <TouchableOpacity style={styles.modalPrimaryButton} onPress={() => setIsQrVisible(false)}>
              <Text style={styles.modalPrimaryButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isScannerVisible} animationType="slide" onRequestClose={() => setIsScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          {ScannerCamera && (
            <ScannerCamera
              style={styles.scannerCamera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={hasScannedQr ? undefined : handleQrScanned}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerTopBar}>
                  <Text style={styles.scannerTitle}>同期IDを読み取り</Text>
                  <TouchableOpacity style={styles.scannerCloseButton} onPress={() => setIsScannerVisible(false)}>
                    <Text style={styles.scannerCloseText}>閉じる</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerHint}>別端末に表示したKabuHub同期IDのQRを枠内に合わせてください</Text>
              </View>
            </ScannerCamera>
          )}
        </View>
      </Modal>
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

function ToggleRow({
  title, desc, value, onPress, styles, colors, compact,
}: {
  title: string;
  desc: string;
  value: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ColorPalette;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.row, compact && styles.compactRow]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <View style={[
        styles.toggleTrack,
        {
          backgroundColor: value ? colors.primary : colors.surface,
          borderColor: value ? colors.primary : colors.cardBorder,
        },
      ]}>
        <View style={[
          styles.toggleThumb,
          {
            transform: [{ translateX: value ? 18 : 0 }],
            backgroundColor: value ? '#06090F' : colors.textTertiary,
          },
        ]} />
      </View>
    </TouchableOpacity>
  );
}

function MultiChoiceRow({
  title, desc, options, selected, onSelect, styles,
}: {
  title: string;
  desc: string;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.choiceBlock}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.choiceChip, selected === option.key && styles.choiceChipActive]}
            onPress={() => onSelect(option.key)}
          >
            <Text style={[styles.choiceText, selected === option.key && styles.choiceTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ActionRow({
  title, desc, onPress, styles, destructive,
}: {
  title: string;
  desc: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, destructive && styles.destructiveText]}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Text style={[styles.chevron, destructive && styles.destructiveText]}>›</Text>
    </TouchableOpacity>
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
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    compactRow: { minHeight: 54 },
    rowBorder: {
      height: 1,
      backgroundColor: c.separator,
      marginLeft: Spacing.md,
    },
    rowBottomLine: {
      borderBottomWidth: 1,
      borderBottomColor: c.separator,
    },
    divider: {
      height: 1,
      backgroundColor: c.cardBorder,
      marginVertical: Spacing.xs,
    },
    rowSelected: {
      backgroundColor: c.primaryMuted,
    },
    rowLeft: { flex: 1, gap: 2 },
    rowTitle: {
      fontSize: FontSize.md,
      fontWeight: '600',
      color: c.text,
    },
    rowTitleSelected: { color: c.primary },
    rowDesc: {
      fontSize: FontSize.xs,
      color: c.textTertiary,
      lineHeight: 16,
    },
    rowValue: {
      fontSize: FontSize.sm,
      fontWeight: '700',
      color: c.primary,
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
    choiceBlock: {
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    choiceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    choiceChip: {
      minHeight: 34,
      justifyContent: 'center',
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.surface,
    },
    choiceChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    choiceText: {
      fontSize: FontSize.sm,
      fontWeight: '700',
      color: c.textSecondary,
    },
    choiceTextActive: {
      color: '#06090F',
    },
    inputBlock: {
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    syncInput: {
      height: 44,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.surface,
      color: c.text,
      paddingHorizontal: Spacing.md,
      fontSize: FontSize.md,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.58)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    qrSheet: {
      width: '100%',
      maxWidth: 340,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      padding: Spacing.lg,
      alignItems: 'center',
      gap: Spacing.md,
    },
    modalTitle: {
      color: c.text,
      fontSize: FontSize.lg,
      fontWeight: '800',
    },
    qrBox: {
      backgroundColor: '#FFFFFF',
      padding: Spacing.md,
      borderRadius: BorderRadius.sm,
    },
    qrSyncId: {
      color: c.textSecondary,
      fontSize: FontSize.md,
      fontWeight: '700',
    },
    modalPrimaryButton: {
      width: '100%',
      minHeight: 44,
      borderRadius: BorderRadius.sm,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalPrimaryButtonText: {
      color: '#06090F',
      fontSize: FontSize.md,
      fontWeight: '800',
    },
    scannerContainer: {
      flex: 1,
      backgroundColor: '#000000',
    },
    scannerCamera: {
      flex: 1,
    },
    scannerOverlay: {
      flex: 1,
      justifyContent: 'space-between',
      padding: Spacing.lg,
      paddingTop: 56,
      backgroundColor: 'rgba(0,0,0,0.12)',
    },
    scannerTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    scannerTitle: {
      color: '#FFFFFF',
      fontSize: FontSize.lg,
      fontWeight: '800',
    },
    scannerCloseButton: {
      minHeight: 36,
      borderRadius: BorderRadius.sm,
      backgroundColor: 'rgba(0,0,0,0.46)',
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scannerCloseText: {
      color: '#FFFFFF',
      fontSize: FontSize.sm,
      fontWeight: '700',
    },
    scannerFrame: {
      alignSelf: 'center',
      width: 240,
      height: 240,
      borderRadius: BorderRadius.sm,
      borderWidth: 3,
      borderColor: c.primary,
      backgroundColor: 'transparent',
    },
    scannerHint: {
      color: '#FFFFFF',
      fontSize: FontSize.sm,
      fontWeight: '600',
      lineHeight: 20,
      textAlign: 'center',
      paddingHorizontal: Spacing.md,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowRadius: 6,
    },
    checkText: {
      fontSize: 18,
      fontWeight: '800',
      color: c.primary,
    },
    chevron: {
      fontSize: 24,
      color: c.textTertiary,
      lineHeight: 28,
    },
    destructiveText: { color: c.negative },
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
