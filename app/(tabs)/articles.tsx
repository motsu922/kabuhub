import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { useArticles } from '../../src/hooks/useArticles';
import { useWatchlist } from '../../src/hooks/useWatchlist';
import { useClipboardDetection } from '../../src/hooks/useClipboardDetection';
import { AISummaryService } from '../../src/services/aiSummary';
import { fetchStockCandidates, YouTubeTranscriptError, XUrlError } from '../../src/services/stockExtraction';
import { StockCandidateCard } from '../../src/components/discover/StockCandidateCard';
import { ClipboardBanner } from '../../src/components/common/ClipboardBanner';
import { Article, StockCandidate } from '../../src/types';

type InputMode = 'url' | 'text';
type TabMode = 'save' | 'discover';

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com/watch') || url.includes('youtu.be/');
}

export default function ArticlesScreen() {
  const { articles, isLoading, saveArticle, deleteArticle } = useArticles();
  const { isInWatchlist, addStock } = useWatchlist();
  const { detection, dismiss, consume } = useClipboardDetection();

  // ── 記事保存タブ ──
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── 銘柄発掘タブ ──
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [discoverInput, setDiscoverInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [candidates, setCandidates] = useState<StockCandidate[]>([]);
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());
  const [extractionStage, setExtractionStage] = useState<string>('');

  // ── 共通 ──
  const [tab, setTab] = useState<TabMode>('save');

  const isYouTube = isYouTubeUrl(url.trim());

  const handleClipboardUse = () => {
    const d = consume();
    if (!d) return;
    if (d.type === 'text') {
      // テキストは銘柄発掘タブのテキストモードへ
      setTab('discover');
      setInputMode('text');
      setDiscoverInput(d.content);
    } else {
      // URL系は記事保存タブへ（YouTubeなら自動でトランスクリプト欄も表示）
      setTab('save');
      setUrl(d.content);
    }
  };

  // ── 記事保存 ──
  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed || !trimmed.startsWith('http')) {
      Alert.alert('エラー', '有効なURLを入力してください');
      return;
    }
    if (isYouTube && !transcript.trim()) {
      Alert.alert(
        'YouTube動画の場合',
        '字幕や概要欄のテキストを貼り付けると、AI要約の精度が上がります。\nそのまま保存しますか？',
        [
          { text: 'テキストを貼る', style: 'cancel' },
          { text: 'そのまま保存', onPress: () => doSave(trimmed) },
        ]
      );
      return;
    }
    doSave(trimmed);
  };

  const doSave = async (trimmed: string) => {
    setIsSaving(true);
    try {
      const content = transcript.trim() || undefined;
      const result = await AISummaryService.summarizeArticle(trimmed, content);
      const article: Article = {
        id: Date.now().toString(),
        ...AISummaryService.createArticle(trimmed, result),
      };
      await saveArticle(article);
      setUrl('');
      setTranscript('');
    } catch (e: any) {
      if (e?.message === 'OPENAI_API_KEY_NOT_SET') {
        Alert.alert(
          'OpenAI APIキーが未設定',
          '.envファイルに EXPO_PUBLIC_OPENAI_API_KEY を設定してください。\n\nURLのみで保存します。',
        );
      }
      const article: Article = {
        id: Date.now().toString(),
        url: trimmed,
        title: trimmed.slice(0, 50) + '...',
        savedAt: new Date(),
        isProcessed: false,
      };
      await saveArticle(article);
      setUrl('');
      setTranscript('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert('記事を削除', `「${title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => deleteArticle(id) },
    ]);
  };

  // ── 銘柄発掘 ──
  const handleExtract = async () => {
    const input = discoverInput.trim();
    if (!input) {
      Alert.alert('エラー', 'テキストまたはURLを入力してください');
      return;
    }
    setIsExtracting(true);
    setCandidates([]);
    setExtractionStage('');
    try {
      const { candidates: found, sourceText } = await fetchStockCandidates(
        input,
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
          'この動画は字幕が無効または非公開です。\n\n字幕テキストを手動で貼り付けてください。\nYouTubeアプリ → 動画下の「...」→「文字起こしを表示」からコピーできます。',
          [
            { text: 'テキストモードに切替', onPress: () => { setInputMode('text'); setDiscoverInput(''); } },
            { text: 'キャンセル', style: 'cancel' },
          ]
        );
      } else if (e instanceof XUrlError) {
        Alert.alert(
          'X(Twitter)のURLは読み込めません',
          'ポストのテキストをコピーして、テキストモードで貼り付けてください。',
          [
            { text: 'テキストモードへ', onPress: () => { setInputMode('text'); setDiscoverInput(''); } },
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

  // ── 記事リスト ──
  const renderArticle = ({ item }: { item: Article }) => (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => Linking.openURL(item.url)}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      </TouchableOpacity>

      {item.summary && (
        <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text>
      )}

      {item.relatedStocks && item.relatedStocks.length > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>関連銘柄</Text>
          <View style={styles.tags}>
            {item.relatedStocks.map((code) => (
              <View key={code} style={styles.stockTag}>
                <Text style={styles.stockTagText}>{code}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {item.relatedThemes && item.relatedThemes.length > 0 && (
        <View style={styles.themes}>
          {item.relatedThemes.map((t) => (
            <Text key={t} style={styles.theme}>#{t}</Text>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.time}>{timeAgo(item.savedAt)}</Text>
        <TouchableOpacity onPress={() => handleDelete(item.id, item.title)}>
          <Text style={styles.deleteText}>削除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* タブ */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'save' && styles.tabBtnActive]}
          onPress={() => setTab('save')}
        >
          <Text style={[styles.tabText, tab === 'save' && styles.tabTextActive]}>📰 記事保存</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'discover' && styles.tabBtnActive]}
          onPress={() => setTab('discover')}
        >
          <Text style={[styles.tabText, tab === 'discover' && styles.tabTextActive]}>🔍 銘柄発掘</Text>
        </TouchableOpacity>
      </View>

      {/* クリップボード検出バナー */}
      {detection && (
        <ClipboardBanner
          detection={detection}
          onUse={handleClipboardUse}
          onDismiss={dismiss}
        />
      )}

      {tab === 'save' ? (
        <>
          {/* URL入力 */}
          <View style={styles.inputSection}>
            <TextInput
              style={styles.urlInput}
              placeholder="記事・YouTube URLを貼り付け"
              placeholderTextColor={Colors.textTertiary}
              value={url}
              onChangeText={setUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.actionButton, (!url || isSaving) && styles.actionButtonDisabled]}
              onPress={handleSave}
              disabled={!url || isSaving}
            >
              {isSaving
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.actionButtonText}>AI保存</Text>}
            </TouchableOpacity>
          </View>

          {isYouTube && (
            <View style={styles.transcriptSection}>
              <View style={styles.youtubeBadge}>
                <Text style={styles.youtubeBadgeText}>YouTube</Text>
                <Text style={styles.youtubeHint}>字幕・概要欄を貼ると精度が上がります</Text>
              </View>
              <TextInput
                style={styles.transcriptInput}
                placeholder="字幕や概要欄のテキストをここに貼り付け（省略可）"
                placeholderTextColor={Colors.textTertiary}
                value={transcript}
                onChangeText={setTranscript}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : articles.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📰</Text>
              <Text style={styles.emptyTitle}>記事がありません</Text>
              <Text style={styles.emptyText}>URLを貼り付けて保存してください</Text>
            </View>
          ) : (
            <FlatList
              data={articles}
              keyExtractor={(item) => item.id}
              renderItem={renderArticle}
              contentContainerStyle={styles.list}
            />
          )}
        </>
      ) : (
        /* ── 銘柄発掘タブ ── */
        <ScrollView contentContainerStyle={styles.discoverScroll} keyboardShouldPersistTaps="handled">
          {/* 入力モード切替 */}
          <View style={styles.modeRow}>
            {(['url', 'text'] as InputMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, inputMode === m && styles.modeBtnActive]}
                onPress={() => setInputMode(m)}
              >
                <Text style={[styles.modeBtnText, inputMode === m && styles.modeBtnTextActive]}>
                  {m === 'url' ? '🔗 URL' : '📋 テキスト'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ヒント */}
          <View style={styles.hint}>
            {inputMode === 'url' ? (
              <Text style={styles.hintText}>
                YouTubeのURLを貼ると字幕を自動取得して銘柄を抽出します。字幕なし動画はテキストモードで手動入力してください
              </Text>
            ) : (
              <Text style={styles.hintText}>
                YouTube「文字起こしを表示」・Xのポスト・記事文章などを貼り付けてください
              </Text>
            )}
          </View>

          {/* テキスト入力 */}
          <View style={styles.discoverInputRow}>
            <TextInput
              style={[styles.discoverInput, inputMode === 'text' && styles.discoverInputMulti]}
              placeholder={inputMode === 'url' ? 'https://...' : 'テキストを貼り付け'}
              placeholderTextColor={Colors.textTertiary}
              value={discoverInput}
              onChangeText={setDiscoverInput}
              keyboardType={inputMode === 'url' ? 'url' : 'default'}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={inputMode === 'text'}
              numberOfLines={inputMode === 'text' ? 6 : 1}
              textAlignVertical={inputMode === 'text' ? 'top' : 'center'}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonFull, (!discoverInput || isExtracting) && styles.actionButtonDisabled]}
            onPress={handleExtract}
            disabled={!discoverInput || isExtracting}
          >
            {isExtracting
              ? <><ActivityIndicator size="small" color="#000" /><Text style={styles.actionButtonText}>  抽出中...</Text></>
              : <Text style={styles.actionButtonText}>🔍 銘柄を抽出</Text>}
          </TouchableOpacity>

          {isExtracting && extractionStage !== '' && (
            <Text style={styles.stageText}>{extractionStage}</Text>
          )}

          {/* 候補リスト */}
          {candidates.length > 0 && (
            <View style={styles.candidateSection}>
              <View style={styles.candidateHeader}>
                <Text style={styles.candidateTitle}>銘柄候補 {candidates.length}件</Text>
                <Text style={styles.candidateHint}>
                  {candidates[0].source === 'ai' ? 'AI抽出' : 'コード検出'}
                </Text>
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
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>銘柄を発掘しよう</Text>
              <Text style={styles.emptyText}>
                YouTube・X・ニュース記事のURLやテキストを貼り付けると、言及された銘柄を自動でリストアップします
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.card },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: Colors.text },
  inputSection: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  urlInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
    minWidth: 72,
    flexDirection: 'row',
    gap: 4,
  },
  actionButtonFull: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: FontSize.sm, fontWeight: '700', color: '#000' },
  transcriptSection: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  youtubeBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  youtubeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#FF0000',
    backgroundColor: '#FF000020',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  youtubeHint: { fontSize: FontSize.xs, color: Colors.textTertiary, flex: 1 },
  transcriptInput: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 100,
  },
  list: { padding: Spacing.md },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  summary: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '600' },
  tags: { flexDirection: 'row', gap: 4 },
  stockTag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stockTagText: { fontSize: FontSize.xs, color: Colors.text, fontWeight: '600' },
  themes: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  theme: { fontSize: FontSize.xs, color: Colors.primary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  time: { fontSize: FontSize.xs, color: Colors.textTertiary },
  deleteText: { fontSize: FontSize.xs, color: Colors.negative, fontWeight: '600' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  // 銘柄発掘タブ
  discoverScroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 3,
    marginBottom: Spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: Colors.card },
  modeBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  modeBtnTextActive: { color: Colors.text },
  hint: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  hintText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  discoverInputRow: { marginBottom: Spacing.sm },
  discoverInput: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  discoverInputMulti: {
    height: 'auto',
    minHeight: 120,
    paddingVertical: Spacing.sm,
    textAlignVertical: 'top',
  },
  candidateSection: { marginTop: Spacing.md },
  candidateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  candidateTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  candidateHint: { fontSize: FontSize.xs, color: Colors.textTertiary },
  stageText: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
  },
});
