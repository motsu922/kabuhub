import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useWatchlist } from '../../src/hooks/useWatchlist';
import { fetchStockCandidates, XUrlError } from '../../src/services/stockExtraction';
import { StockCandidateCard } from '../../src/components/discover/StockCandidateCard';
import { PaywallModal } from '../../src/components/common/PaywallModal';
import { SubscriptionService, FREE_AI_WEEKLY_LIMIT } from '../../src/services/subscriptionService';
import { StockCandidate } from '../../src/types';

type InputMode = 'url' | 'text';

export default function ArticlesScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const { isInWatchlist, addStock } = useWatchlist();
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [input, setInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [candidates, setCandidates] = useState<StockCandidate[]>([]);
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());
  const [extractionStage, setExtractionStage] = useState('');
  const [aiUsageThisWeek, setAiUsageThisWeek] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    SubscriptionService.getAIUsageThisWeek().then(setAiUsageThisWeek);
  }, []);

  const handleExtract = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      Alert.alert('エラー', 'テキストまたはURLを入力してください');
      return;
    }
    const canUse = await SubscriptionService.canUseAI();
    if (!canUse) {
      setShowPaywall(true);
      return;
    }
    await SubscriptionService.incrementAIUsage();
    setAiUsageThisWeek((n) => n + 1);
    setIsExtracting(true);
    setCandidates([]);
    setExtractionStage('');
    try {
      const { candidates: found, sourceText } = await fetchStockCandidates(
        trimmed,
        (stage) => setExtractionStage(stage),
      );
      setCandidates(found);
      setExtractionStage('');
      if (!found.length) {
        Alert.alert(
          '銘柄が見つかりません',
          sourceText.length > 10
            ? `取得したテキスト:\n${sourceText.slice(0, 120)}...`
            : 'テキストから銘柄を検出できませんでした',
        );
      }
    } catch (e) {
      setExtractionStage('');
      if (e instanceof XUrlError) {
        Alert.alert(
          'X(Twitter)のURLは読み込めません',
          'ポストのテキストをコピーして、テキストモードで貼り付けてください。',
          [
            { text: 'テキストモードへ', onPress: () => { setInputMode('text'); setInput(''); } },
            { text: 'キャンセル', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('エラー', '銘柄の抽出に失敗しました');
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAdd = async (code: string) => {
    await addStock(code);
    setAddedCodes((prev) => new Set([...prev, code]));
  };

  return (
    <SafeAreaView style={styles.container}>
      <PaywallModal
        visible={showPaywall}
        reason="ai"
        onClose={() => setShowPaywall(false)}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.titleRow}>
          <Text style={styles.title}>銘柄抽出</Text>
          <View style={[styles.usageChip, aiUsageThisWeek >= FREE_AI_WEEKLY_LIMIT && styles.usageChipLimit]}>
            <Text style={[styles.usageChipText, aiUsageThisWeek >= FREE_AI_WEEKLY_LIMIT && styles.usageChipTextLimit]}>
              今週 {aiUsageThisWeek}/{FREE_AI_WEEKLY_LIMIT}回
            </Text>
          </View>
        </View>

        {/* モード切替 */}
        <View style={styles.modeRow}>
          {(['url', 'text'] as InputMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, inputMode === m && styles.modeBtnActive]}
              onPress={() => setInputMode(m)}
            >
              <Text style={[styles.modeBtnText, inputMode === m && styles.modeBtnTextActive]}>
                {m === 'url' ? 'URL' : 'テキスト'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.hintText}>
          {inputMode === 'url'
            ? 'X・ニュース記事のURLを貼り付け'
            : 'Xポスト・記事文章などを貼り付け'}
        </Text>

        {/* 入力欄 */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, inputMode === 'text' && styles.inputMulti]}
            placeholder={inputMode === 'url' ? 'https://...' : 'テキストを貼り付け'}
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            keyboardType={inputMode === 'url' ? 'url' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
            multiline={inputMode === 'text'}
            numberOfLines={inputMode === 'text' ? 6 : 1}
            textAlignVertical={inputMode === 'text' ? 'top' : 'center'}
          />
          {input.length > 0 && (
            <TouchableOpacity
              style={[styles.clearBtn, inputMode === 'text' && styles.clearBtnTop]}
              onPress={() => setInput('')}
            >
              <Text style={styles.clearBtnText}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 抽出ボタン */}
        <TouchableOpacity
          style={[styles.extractBtn, (!input.trim() || isExtracting) && styles.extractBtnDisabled]}
          onPress={handleExtract}
          disabled={!input.trim() || isExtracting}
        >
          {isExtracting ? (
            <><ActivityIndicator size="small" color="#06090F" /><Text style={styles.extractBtnText}>  抽出中...</Text></>
          ) : (
            <Text style={styles.extractBtnText}>銘柄を抽出する</Text>
          )}
        </TouchableOpacity>

        {isExtracting && extractionStage !== '' && (
          <Text style={styles.stageText}>{extractionStage}</Text>
        )}

        {/* 候補リスト */}
        {candidates.length > 0 && (
          <View style={styles.candidateSection}>
            <View style={styles.candidateHeader}>
              <View style={styles.sectionAccent} />
              <Text style={styles.candidateTitle}>抽出結果</Text>
              <View style={styles.countChip}>
                <Text style={styles.countChipText}>{candidates.length}銘柄</Text>
              </View>
            </View>
            {candidates.map((c) => (
              <StockCandidateCard
                key={c.code ?? c.name}
                candidate={c}
                isAdded={(c.code ? isInWatchlist(c.code) : false) || (c.code ? addedCodes.has(c.code) : false)}
                onAdd={() => c.code && handleAdd(c.code)}
              />
            ))}
          </View>
        )}

        {!isExtracting && candidates.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptySymbol}>◈</Text>
            <Text style={styles.emptyTitle}>銘柄を抽出しよう</Text>
            <Text style={styles.emptyText}>
              X・ニュース記事のURLやテキストを貼り付けると、言及された銘柄を自動でリストアップします
            </Text>
            <View style={styles.emptyTip}>
              <Text style={styles.emptyTipText}>iOSのシェアボタン → KabuHub でも送れます</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { padding: Spacing.md, paddingBottom: 110 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: FontSize.xxl,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.5,
    },
    usageChip: {
      backgroundColor: c.surface,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    usageChipLimit: { borderColor: c.negative + '80', backgroundColor: c.negative + '14' },
    usageChipText: { fontSize: FontSize.xs, fontWeight: '600', color: c.textSecondary },
    usageChipTextLimit: { color: c.negative },
    modeRow: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: BorderRadius.md,
      padding: 3,
      gap: 3,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    modeBtn: { flex: 1, paddingVertical: 9, borderRadius: BorderRadius.sm, alignItems: 'center' },
    modeBtnActive: { backgroundColor: c.card },
    modeBtnText: { fontSize: FontSize.sm, color: c.textTertiary, fontWeight: '600' },
    modeBtnTextActive: { color: c.primary },
    hintText: {
      fontSize: FontSize.xs,
      color: c.textTertiary,
      marginBottom: Spacing.sm,
      paddingHorizontal: 2,
    },
    inputWrapper: { position: 'relative', marginBottom: Spacing.sm },
    input: {
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      paddingLeft: Spacing.md,
      paddingRight: 36,
      height: 48,
      color: c.text,
      fontSize: FontSize.sm,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    inputMulti: {
      height: 'auto',
      minHeight: 120,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      textAlignVertical: 'top',
    },
    clearBtn: {
      position: 'absolute',
      right: 0, top: 0, bottom: 0,
      width: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    clearBtnTop: { top: 4, bottom: 'auto' },
    clearBtnText: { fontSize: 18, color: c.textTertiary, lineHeight: 22 },
    extractBtn: {
      backgroundColor: c.primary,
      borderRadius: BorderRadius.md,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      marginBottom: Spacing.md,
    },
    extractBtnDisabled: { opacity: 0.4 },
    extractBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#06090F' },
    stageText: {
      textAlign: 'center',
      fontSize: FontSize.xs,
      color: c.textSecondary,
      marginTop: -Spacing.sm,
      marginBottom: Spacing.sm,
    },
    candidateSection: { marginTop: Spacing.sm },
    candidateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: c.primary },
    candidateTitle: { fontSize: FontSize.md, fontWeight: '700', color: c.text },
    countChip: {
      backgroundColor: c.primaryMuted,
      borderRadius: BorderRadius.full,
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderWidth: 1,
      borderColor: c.primaryDim,
    },
    countChipText: { fontSize: FontSize.xs, fontWeight: '700', color: c.primary },
    empty: {
      alignItems: 'center',
      gap: Spacing.sm,
      paddingTop: Spacing.xxl,
      padding: Spacing.xl,
    },
    emptySymbol: { fontSize: 40, color: c.textTertiary, lineHeight: 50 },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.text },
    emptyText: {
      fontSize: FontSize.sm,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyTip: {
      marginTop: Spacing.sm,
      backgroundColor: c.primaryMuted,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: c.primaryDim,
    },
    emptyTipText: { fontSize: FontSize.xs, color: c.primary, textAlign: 'center' },
  });
}
