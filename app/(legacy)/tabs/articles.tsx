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
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { useWatchlist } from '../../src/hooks/useWatchlist';
import { fetchStockCandidates, YouTubeTranscriptError, XUrlError } from '../../src/services/stockExtraction';
import { StockCandidateCard } from '../../src/components/discover/StockCandidateCard';
import { PaywallModal } from '../../src/components/common/PaywallModal';
import { SubscriptionService, FREE_AI_WEEKLY_LIMIT } from '../../src/services/subscriptionService';
import { StockCandidate } from '../../src/types';
import { useShareIntent } from 'expo-share-intent';

type InputMode = 'url' | 'text';

export default function ArticlesScreen() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
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

  useEffect(() => {
    if (hasShareIntent && shareIntent?.webUrl) {
      setInputMode('url');
      setInput(shareIntent.webUrl);
      resetShareIntent();
    } else if (hasShareIntent && shareIntent?.text) {
      setInputMode('text');
      setInput(shareIntent.text);
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent]);

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
      if (e instanceof YouTubeTranscriptError) {
        Alert.alert(
          '字幕を取得できませんでした',
          'この動画は字幕が無効または非公開です。\n\nYouTubeアプリ → 動画下の「...」→「文字起こしを表示」からテキストをコピーして貼り付けてください。',
          [
            { text: 'テキストモードへ', onPress: () => { setInputMode('text'); setInput(''); } },
            { text: 'キャンセル', style: 'cancel' },
          ]
        );
      } else if (e instanceof XUrlError) {
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

        {/* ヒント */}
        <Text style={styles.hintText}>
          {inputMode === 'url'
            ? 'YouTube・X・ニュース記事のURLを貼り付け'
            : 'YouTube文字起こし・Xポスト・記事文章などを貼り付け'}
        </Text>

        {/* 入力欄 */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, inputMode === 'text' && styles.inputMulti]}
            placeholder={inputMode === 'url' ? 'https://...' : 'テキストを貼り付け'}
            placeholderTextColor={Colors.textTertiary}
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
                key={c.code}
                candidate={c}
                isAdded={isInWatchlist(c.code) || addedCodes.has(c.code)}
                onAdd={() => handleAdd(c.code)}
              />
            ))}
          </View>
        )}

        {!isExtracting && candidates.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptySymbol}>◈</Text>
            <Text style={styles.emptyTitle}>銘柄を抽出しよう</Text>
            <Text style={styles.emptyText}>
              YouTube・X・ニュース記事のURLやテキストを貼り付けると、言及された銘柄を自動でリストアップします
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  usageChip: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  usageChipLimit: {
    borderColor: Colors.negative + '80',
    backgroundColor: Colors.negative + '14',
  },
  usageChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  usageChipTextLimit: {
    color: Colors.negative,
  },

  modeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 3,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: Colors.card },
  modeBtnText: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '600' },
  modeBtnTextActive: { color: Colors.primary },

  hintText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },

  inputWrapper: { position: 'relative', marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.md,
    paddingRight: 36,
    height: 48,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnTop: { top: 4, bottom: 'auto' },
  clearBtnText: { fontSize: 18, color: Colors.textTertiary, lineHeight: 22 },

  extractBtn: {
    backgroundColor: Colors.primary,
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
    color: Colors.textSecondary,
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
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  candidateTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  countChip: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
  },
  countChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxl,
    padding: Spacing.xl,
  },
  emptySymbol: {
    fontSize: 40,
    color: Colors.textTertiary,
    lineHeight: 50,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyTip: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
  },
  emptyTipText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    textAlign: 'center',
  },
});
