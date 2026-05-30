import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { Stock, OHLCBar, AlertSettings, UserIntention, NewsItem } from '../../src/types';
import { StockDataService, ChartInterval } from '../../src/services/stockData';
import { ExternalLinks, SecuritiesAppLinks } from '../../src/constants/externalLinks';
import { StatusBadge } from '../../src/components/common/StatusBadge';
import { CandlestickChart } from '../../src/components/common/CandlestickChart';
import { useWatchlist } from '../../src/hooks/useWatchlist';
import { useArticles } from '../../src/hooks/useArticles';
import { StorageService } from '../../src/services/storage';
import { detectSignals, computeScore, SIGNAL_POINTS, TechnicalScore, TechnicalSignal } from '../../src/services/technicalAnalysis';
import { CommentService, CommentDoc, CommentMode } from '../../src/services/commentService';
import { CommentOverlay } from '../../src/components/chart/CommentOverlay';

const QUICK_REACTIONS = [
  { emoji: '⬆', text: '⬆' },
  { emoji: '⬇', text: '⬇' },
  { emoji: '📉', text: '📉' },
  { emoji: '🚀', text: '🚀' },
  { emoji: '😱', text: '😱' },
] as const;

const EXTERNAL_SERVICES = [
  { key: 'yahooFinance', label: 'Yahoo!ファイナンス', icon: '📊' },
  { key: 'kabutan',      label: '株探',               icon: '🔍' },
  { key: 'minkabv',      label: 'みんかぶ',            icon: '👥' },
] as const;

export default function StockDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - Spacing.md * 2 - 16;

  const [stock, setStock] = useState<Stock | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [securitiesApp, setSecuritiesApp] = useState<string | null>(null);
  const [ohlc, setOhlc] = useState<OHLCBar[]>([]);
  const [interval, setInterval] = useState<ChartInterval>('1d');
  const [relatedStocks, setRelatedStocks] = useState<Stock[]>([]);
  const [techScore, setTechScore] = useState<TechnicalScore | null>(null);
  const [techSignals, setTechSignals] = useState<TechnicalSignal[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [commentMode, setCommentMode] = useState<CommentMode>('OFF');
  const [liveComments, setLiveComments] = useState<CommentDoc[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { isInWatchlist, addStock, removeStock, getItem, items, updateAlertSettings, updateIntention, updateGroup } = useWatchlist();
  const { articles } = useArticles(code);

  useEffect(() => {
    if (!code) return;
    StockDataService.getStockDetail(code).then(async (s) => {
      if (!s) { setIsLoading(false); return; }
      setStock(s);
      setIsLoading(false);
      // モック情報にリアル株価を上書き（前日比も含む）
      const [real, valuation] = await Promise.all([
        StockDataService.fetchQuote(code),
        StockDataService.fetchValuation(code),
      ]);
      if (real || valuation) {
        setStock((prev) => prev ? {
          ...prev,
          ...(real ?? {}),
          ...(valuation ?? {}),
        } : prev);
      }

      // ニュース取得
      StockDataService.fetchNews(code).then(setNews);

      // 関連銘柄をリアル株価付きで取得
      const candidates = StockDataService.getRelatedByTheme(code, s.themes ?? []);
      if (candidates.length) {
        setRelatedStocks(candidates);
        const quotes = await StockDataService.fetchQuotes(candidates.map((c) => c.code));
        setRelatedStocks(candidates.map((c) => {
          const q = quotes.get(c.code);
          return q ? { ...c, ...q } : c;
        }));
      }
    });
    StorageService.getSettings().then((s) => setSecuritiesApp(s.securitiesApp));
  }, [code]);

  useEffect(() => {
    if (!code) return;
    setOhlc([]);
    StockDataService.fetchOHLC(code, interval).then(setOhlc);
  }, [code, interval]);

  // 残りクールダウンを AsyncStorage から復元
  useEffect(() => {
    CommentService.remainingCooldown().then((r) => { if (r > 0) setCooldown(r); });
  }, []);

  // 1秒ごとにカウントダウン
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // コメント購読（モードが OFF 以外のとき）
  useEffect(() => {
    if (!code || commentMode === 'OFF') { setLiveComments([]); return; }
    const unsub = CommentService.subscribe(code, commentMode, setLiveComments);
    return unsub;
  }, [code, commentMode]);

  // テクニカル分析用に3ヶ月日足を取得（チャート表示と独立）
  useEffect(() => {
    if (!code) return;
    StockDataService.fetchOHLC(code, '1d').then((bars) => {
      const sigs = detectSignals(bars);
      setTechSignals(sigs);
      setTechScore(sigs.length > 0 ? computeScore(sigs) : null);
    });
  }, [code]);

  const cycleCommentMode = () => {
    setCommentMode((m) => m === 'OFF' ? 'LIGHT' : m === 'LIGHT' ? 'LIVE' : 'OFF');
  };

  const chartTime = () =>
    stock?.updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) ?? '';

  const postComment = async (text: string) => {
    const result = await CommentService.post(code ?? '', text, chartTime());
    if (result.ok) {
      setCooldown(30);
    } else {
      Alert.alert('投稿できません', result.error);
    }
    return result.ok;
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || isPosting || cooldown > 0 || !code) return;
    setIsPosting(true);
    const ok = await postComment(commentText.trim());
    if (ok) setCommentText('');
    setIsPosting(false);
  };

  const handleQuickReact = async (text: string) => {
    if (cooldown > 0 || !code) return;
    await postComment(text);
  };

  const openExternal = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(url); // web fallback
    }
  };

  const openSecurities = async () => {
    if (!securitiesApp) {
      Alert.alert('証券アプリ未設定', '設定から証券アプリを選択してください', [
        { text: 'OK' },
        { text: '設定を開く', onPress: () => router.push('/(tabs)/settings') },
      ]);
      return;
    }
    const config = SecuritiesAppLinks[securitiesApp as keyof typeof SecuritiesAppLinks];
    try {
      await Linking.openURL(config.url);
    } catch {
      // アプリ未インストールの場合はApp Storeへ
      Alert.alert(
        `${config.name}が見つかりません`,
        'App Storeでインストールしますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'App Storeを開く', onPress: () => Linking.openURL(config.appStoreUrl) },
        ]
      );
    }
  };

  const toggleWatchlist = async () => {
    if (!code) return;
    if (isInWatchlist(code)) {
      Alert.alert('ウォッチリストから削除', `${stock?.name}を削除しますか？`, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => removeStock(code) },
      ]);
    } else {
      await addStock(code);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!stock) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.notFound}>銘柄が見つかりません</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isUp = stock.change >= 0;
  const inWatchlist = isInWatchlist(code ?? '');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.stockHeader}>
          <View style={styles.stockInfo}>
            <Text style={styles.code}>{stock.code}</Text>
            <Text style={styles.name}>{stock.name}</Text>
            <StatusBadge status={stock.status} />
          </View>
          <TouchableOpacity
            style={[styles.watchButton, inWatchlist && styles.watchButtonActive]}
            onPress={toggleWatchlist}
          >
            <Text style={[styles.watchButtonText, inWatchlist && styles.watchButtonTextActive]}>
              {inWatchlist ? '★ 登録中' : '☆ 追加'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Price */}
        <View style={styles.priceCard}>
          <Text style={styles.price}>
            {stock.market === 'US'
              ? `$${stock.price.toFixed(2)}`
              : `${stock.price.toLocaleString('ja-JP')}円`}
          </Text>
          <Text style={[styles.change, { color: isUp ? Colors.positive : Colors.negative }]}>
            {StockDataService.formatChange(stock.change, stock.changePercent, stock.market)}
          </Text>
          <Text style={styles.volume}>出来高: {StockDataService.formatVolume(stock.volume)}</Text>
          {(stock.per != null || stock.pbr != null) && (
            <View style={styles.valuationRow}>
              {stock.per != null && (
                <Text style={styles.valuation}>PER <Text style={styles.valuationValue}>{stock.per}倍</Text></Text>
              )}
              {stock.pbr != null && (
                <Text style={styles.valuation}>PBR <Text style={styles.valuationValue}>{stock.pbr}倍</Text></Text>
              )}
            </View>
          )}
          {(stock.week52High != null || stock.week52Low != null) && (() => {
            const hi = stock.week52High!;
            const lo = stock.week52Low!;
            const range = hi - lo;
            const pos = range > 0 ? Math.min(Math.max((stock.price - lo) / range, 0), 1) : 0.5;
            const fmt = (v: number) => stock.market === 'US' ? `$${v.toFixed(2)}` : `${v.toLocaleString('ja-JP')}`;
            return (
              <View style={styles.week52Wrap}>
                <View style={styles.week52LabelRow}>
                  <Text style={styles.week52Label}>52週安値 {fmt(lo)}</Text>
                  <Text style={styles.week52Label}>高値 {fmt(hi)}</Text>
                </View>
                <View style={styles.week52Track}>
                  <View style={[styles.week52Dot, { left: `${pos * 100}%` as any }]} />
                </View>
              </View>
            );
          })()}
          <Text style={styles.updated}>
            更新: {stock.updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <Text style={styles.cardTitle}>ローソク足チャート</Text>
            <TouchableOpacity style={[styles.commentModeBtn, commentMode !== 'OFF' && styles.commentModeBtnActive]} onPress={cycleCommentMode}>
              {commentMode === 'OFF'  && <Text style={styles.commentModeBtnText}>💬 OFF</Text>}
              {commentMode === 'LIGHT' && <Text style={[styles.commentModeBtnText, styles.commentModeBtnTextActive]}>💬 LIGHT</Text>}
              {commentMode === 'LIVE'  && <Text style={[styles.commentModeBtnText, styles.commentModeBtnTextActive]}>💬 LIVE ●</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.rangeButtons}>
            {([
              { key: '5m',  label: '1日'   },
              { key: '5d',  label: '1週'   },
              { key: '1mo', label: '1ヶ月' },
              { key: '1d',  label: '3ヶ月' },
              { key: '1wk', label: '1年'   },
              { key: '3y',  label: '3年'   },
            ] as { key: ChartInterval; label: string }[]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.rangeBtn, interval === key && styles.rangeBtnActive]}
                onPress={() => setInterval(key)}
              >
                <Text style={[styles.rangeBtnText, interval === key && styles.rangeBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ position: 'relative' }}>
            {ohlc.length === 0 ? (
              <View style={styles.chartLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : (
              <CandlestickChart data={ohlc} width={chartWidth} height={220} />
            )}
            {commentMode !== 'OFF' && ohlc.length > 0 && (
              <CommentOverlay
                comments={liveComments}
                mode={commentMode}
                chartWidth={chartWidth}
                chartHeight={220}
              />
            )}
          </View>

          {/* コメント入力 */}
          {commentMode !== 'OFF' && (
            <View style={styles.commentArea}>
              {/* クイックリアクション */}
              <View style={styles.quickReactRow}>
                {QUICK_REACTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.emoji}
                    style={[styles.quickReactBtn, cooldown > 0 && { opacity: 0.35 }]}
                    onPress={() => handleQuickReact(r.text)}
                    disabled={cooldown > 0}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.quickReactEmoji}>{r.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* テキスト入力 */}
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="コメントを入力... (最大50文字)"
                  placeholderTextColor="#555"
                  value={commentText}
                  onChangeText={(t) => setCommentText(t.slice(0, 50))}
                  returnKeyType="send"
                  onSubmitEditing={handlePostComment}
                  maxLength={50}
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, (cooldown > 0 || !commentText.trim() || isPosting) && { opacity: 0.4 }]}
                  onPress={handlePostComment}
                  disabled={cooldown > 0 || !commentText.trim() || isPosting}
                >
                  <Text style={styles.commentSendText}>
                    {cooldown > 0 ? `${cooldown}秒` : '送信'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Technical Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>テクニカル分析</Text>
          {techScore && techScore.signals.length > 0 ? (
            <View style={[styles.techCard, { borderLeftColor: techScore.verdictColor }]}>
              {/* スコアヘッダー */}
              <View style={styles.techHeader}>
                <View style={[styles.techBadge, { backgroundColor: techScore.verdictColor + '22', borderColor: techScore.verdictColor + '60' }]}>
                  <Text style={[styles.techVerdict, { color: techScore.verdictColor }]}>{techScore.verdict}</Text>
                  <Text style={[styles.techScore, { color: techScore.verdictColor }]}>
                    {techScore.score > 0 ? `+${techScore.score}pt` : `${techScore.score}pt`}
                  </Text>
                </View>
                <Text style={styles.techHint}>過去3ヶ月の日足から算出</Text>
              </View>
              {/* スコアバー */}
              <View style={styles.techBarTrack}>
                <View style={styles.techBarCenter} />
                <View style={[
                  styles.techBarFill,
                  {
                    width: `${Math.min(Math.abs(techScore.score) / 10, 1) * 50}%`,
                    backgroundColor: techScore.verdictColor,
                    marginLeft: techScore.score > 0 ? '50%' : undefined,
                    marginRight: techScore.score <= 0 ? '50%' : undefined,
                  } as any,
                ]} />
              </View>
              {/* シグナル一覧（ポイントあり） */}
              {techScore.signals.map((sig) => {
                const pt = SIGNAL_POINTS[sig.type];
                const ptStr = pt > 0 ? `+${pt}pt` : `${pt}pt`;
                const ptColor = pt > 0 ? Colors.positive : Colors.negative;
                return (
                  <View key={sig.type} style={styles.techRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.techLabel}>{sig.label}</Text>
                      <Text style={styles.techDesc}>{sig.description}</Text>
                    </View>
                    <Text style={[styles.techPt, { color: ptColor }]}>{ptStr}</Text>
                  </View>
                );
              })}
              {/* スコア対象外のシグナル */}
              {techSignals.filter((s) => !(s.type in SIGNAL_POINTS)).map((sig) => (
                <View key={sig.type} style={styles.techRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.techLabel}>{sig.label}</Text>
                    <Text style={styles.techDesc}>{sig.description}</Text>
                  </View>
                  <Text style={styles.techPtNeutral}>参考</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.techEmpty}>
              <Text style={styles.techEmptyText}>
                現在検出されたシグナルはありません
              </Text>
              <Text style={styles.techEmptyHint}>
                3ヶ月分の日足データを使ってゴールデンクロス・逆三尊・RSIなどを分析します
              </Text>
            </View>
          )}
        </View>

        {/* Securities App (JP only) */}
        {stock.market !== 'US' && <TouchableOpacity style={styles.securitiesButton} onPress={openSecurities}>
          <Text style={styles.securitiesIcon}>🏦</Text>
          <Text style={styles.securitiesText}>
            {securitiesApp
              ? `${SecuritiesAppLinks[securitiesApp as keyof typeof SecuritiesAppLinks].name}を開く`
              : '証券アプリを開く'}
          </Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>}

        {/* External Links (JP only) */}
        {stock.market !== 'US' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>外部サービス</Text>
            <View style={styles.linkGrid}>
              {EXTERNAL_SERVICES.map(({ key, label, icon }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.linkCard}
                  onPress={() => openExternal(ExternalLinks[key](stock.code))}
                >
                  <Text style={styles.linkIcon}>{icon}</Text>
                  <Text style={styles.linkLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Themes */}
        {stock.themes && stock.themes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>関連テーマ</Text>
            <View style={styles.themes}>
              {stock.themes.map((t) => (
                <View key={t} style={styles.themeTag}>
                  <Text style={styles.themeText}>#{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 関連銘柄 */}
        {relatedStocks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>同テーマの銘柄</Text>
            {relatedStocks.map((r) => {
              const sharedThemes = (r.themes ?? []).filter((t) => stock.themes?.includes(t));
              const relIsUp = r.changePercent >= 0;
              const inList = isInWatchlist(r.code);
              return (
                <TouchableOpacity
                  key={r.code}
                  style={styles.relatedCard}
                  onPress={() => router.push(`/stock/${r.code}`)}
                  activeOpacity={0.75}
                >
                  <View style={styles.relatedLeft}>
                    <View style={styles.relatedNameRow}>
                      <Text style={styles.relatedName}>{r.name}</Text>
                      <Text style={styles.relatedCode}>{r.code}</Text>
                    </View>
                    <View style={styles.relatedThemes}>
                      {sharedThemes.map((t) => (
                        <View key={t} style={styles.sharedThemeTag}>
                          <Text style={styles.sharedThemeText}>#{t}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={[styles.relatedChange, { color: relIsUp ? Colors.positive : Colors.negative }]}>
                      {r.price.toLocaleString('ja-JP')}円{'  '}
                      {relIsUp ? '+' : ''}{r.changePercent.toFixed(2)}%
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.relatedAddBtn, inList && styles.relatedAddBtnDone]}
                    onPress={(e) => { e.stopPropagation(); if (!inList) addStock(r.code); }}
                    disabled={inList}
                  >
                    <Text style={[styles.relatedAddText, inList && styles.relatedAddTextDone]}>
                      {inList ? '登録済' : '+ 追加'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 意思・スタンス */}
        {inWatchlist && (() => {
          const item = getItem(code ?? '');
          const currentIntention: UserIntention = item?.intention ?? 'neutral';
          const INTENTIONS: { value: UserIntention; label: string; color: string }[] = [
            { value: 'buy',     label: '買いたい', color: Colors.positive },
            { value: 'neutral', label: '中立',     color: Colors.textSecondary },
            { value: 'sell',    label: '売りたい', color: Colors.negative },
          ];
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>意思・スタンス</Text>
              <View style={styles.intentionRow}>
                {INTENTIONS.map(({ value, label, color }) => {
                  const active = currentIntention === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.intentionBtn,
                        active && { borderColor: color, backgroundColor: color + '18' },
                      ]}
                      onPress={() => updateIntention(code ?? '', value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.intentionBtnText, { color: active ? color : Colors.textTertiary }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* アラート設定 */}
        {inWatchlist && (() => {
          const alerts = getItem(code ?? '')?.alertSettings;
          const ALERT_ROWS: { key: keyof AlertSettings; label: string }[] = [
            { key: 'dip',                label: '押し目候補アラート' },
            { key: 'surge',              label: '急騰アラート' },
            { key: 'volume',             label: '出来高急増アラート' },
            { key: 'highApproach',       label: '高値接近アラート' },
            { key: 'themeChange',        label: 'テーマ変化アラート' },
            { key: 'consecutiveDecline', label: '続落アラート' },
          ];
          const toggleAlert = (key: keyof AlertSettings) => {
            if (!alerts) return;
            updateAlertSettings(code ?? '', { ...alerts, [key]: !alerts[key] });
          };
          if (!alerts) return null;
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>アラート設定</Text>
              <View style={styles.detailCard}>
                {ALERT_ROWS.map(({ key, label }) => (
                  <View key={key} style={styles.alertRow}>
                    <Text style={styles.alertLabel}>{label}</Text>
                    <Switch
                      value={alerts[key]}
                      onValueChange={() => toggleAlert(key)}
                      trackColor={{ false: Colors.surface, true: Colors.primary + '60' }}
                      thumbColor={alerts[key] ? Colors.primary : Colors.textTertiary}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* グループ */}
        {inWatchlist && (() => {
          const currentGroup = getItem(code ?? '')?.group ?? null;
          const allGroups = [...new Set(items.filter((i) => i.group).map((i) => i.group!))];
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>グループ</Text>
              <View style={styles.groupRow}>
                {allGroups.map((g) => {
                  const active = currentGroup === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.groupChip, active && styles.groupChipActive]}
                      onPress={() => updateGroup(code ?? '', active ? null : g)}
                    >
                      <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.groupChipNew}
                  onPress={() => Alert.prompt('新しいグループ', 'グループ名を入力', (name) => {
                    if (name?.trim()) updateGroup(code ?? '', name.trim());
                  })}
                >
                  <Text style={styles.groupChipNewText}>＋ 新規</Text>
                </TouchableOpacity>
              </View>
              {currentGroup && (
                <Text style={styles.groupCurrent}>現在: {currentGroup}</Text>
              )}
            </View>
          );
        })()}

        {/* ニュース */}
        {news.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ニュース</Text>
            {news.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={styles.newsCard}
                onPress={() => Linking.openURL(n.url)}
              >
                <Text style={styles.newsTitle} numberOfLines={2}>{n.title}</Text>
                <View style={styles.newsMeta}>
                  <Text style={styles.newsPublisher}>{n.publisher}</Text>
                  <Text style={styles.newsDate}>
                    {n.publishedAt.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Related Articles */}
        {articles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>関連記事</Text>
            {articles.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.articleCard}
                onPress={() => Linking.openURL(a.url)}
              >
                <Text style={styles.articleTitle} numberOfLines={2}>{a.title}</Text>
                {a.summary && (
                  <Text style={styles.articleSummary} numberOfLines={2}>{a.summary}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: FontSize.lg, color: Colors.textSecondary },
  back: { marginBottom: Spacing.md },
  backText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '500' },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  stockInfo: { gap: 4 },
  code: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  name: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  watchButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  watchButtonActive: {
    backgroundColor: Colors.primary,
  },
  watchButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  watchButtonTextActive: { color: '#000' },
  priceCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 4,
  },
  price: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  change: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  volume: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  valuationRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: 4,
  },
  valuation: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  valuationValue: {
    fontWeight: '700',
    color: Colors.text,
  },
  updated: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  commentModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surface,
  },
  commentModeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  commentModeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  commentModeBtnTextActive: {
    color: Colors.primary,
  },
  commentArea: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    gap: Spacing.sm,
  },
  quickReactRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickReactBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 6,
  },
  quickReactEmoji: {
    fontSize: 20,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  commentInput: {
    flex: 1,
    height: 36,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.sm,
  },
  commentSendBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
  },
  commentSendText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#06090F',
  },
  rangeButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  rangeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rangeBtnText: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  rangeBtnTextActive: {
    color: '#000',
  },
  chartLoading: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securitiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    gap: Spacing.sm,
  },
  securitiesIcon: { fontSize: FontSize.xl },
  securitiesText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  arrow: { fontSize: FontSize.md, color: Colors.primary },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  linkGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  linkCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  linkIcon: { fontSize: 24 },
  linkLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  themeTag: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  themeText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  relatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  relatedLeft: { flex: 1, gap: 4 },
  relatedNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  relatedName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  relatedCode: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    fontWeight: '600',
  },
  relatedThemes: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  sharedThemeTag: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  sharedThemeText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
  relatedChange: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  relatedAddBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    minWidth: 60,
    alignItems: 'center',
  },
  relatedAddBtnDone: { backgroundColor: Colors.surface },
  relatedAddText: { fontSize: FontSize.xs, fontWeight: '700', color: '#000' },
  relatedAddTextDone: { color: Colors.textTertiary },
  intentionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  intentionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  intentionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  presetCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: 6,
  },
  presetCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  presetEmoji: { fontSize: 24 },
  presetLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  presetLabelActive: { color: Colors.primary },
  presetDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  presetAlerts: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  presetTag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  presetTagText: { fontSize: 9, color: Colors.textSecondary },
  presetCheck: {
    marginTop: 6,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 3,
    alignItems: 'center',
  },
  presetCheckText: { fontSize: FontSize.xs, fontWeight: '700', color: '#000' },
  detailToggle: {
    marginTop: Spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  detailToggleText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  detailCard: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  alertLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
  },
  techCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    padding: Spacing.md,
    gap: 10,
  },
  techHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  techBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  techVerdict: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  techScore: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  techHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  techBarTrack: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  techBarCenter: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Colors.separator,
  },
  techBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  techLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  techDesc: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  techPt: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'right',
  },
  techPtNeutral: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    minWidth: 40,
    textAlign: 'right',
  },
  techEmpty: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    gap: 4,
    alignItems: 'center',
  },
  techEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  techEmptyHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  week52Wrap: { marginTop: 6 },
  week52LabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  week52Label: { fontSize: FontSize.xs, color: Colors.textTertiary },
  week52Track: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    position: 'relative',
  },
  week52Dot: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: -5,
  },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  groupChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  groupChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  groupChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  groupChipTextActive: { color: Colors.primary },
  groupChipNew: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    backgroundColor: Colors.card,
  },
  groupChipNewText: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: '600' },
  groupCurrent: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  newsCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  newsTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  newsMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  newsPublisher: { fontSize: FontSize.xs, color: Colors.primary },
  newsDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  articleCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  articleTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  articleSummary: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
