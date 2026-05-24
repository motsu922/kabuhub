import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useWatchlist } from '../src/hooks/useWatchlist';
import { StockDataService } from '../src/services/stockData';
import { backtestSignals, aggregateBacktest, BacktestResult } from '../src/services/technicalAnalysis';

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function BacktestScreen() {
  const router = useRouter();
  const { stocks } = useWatchlist();
  const [status, setStatus]   = useState<Status>('idle');
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [stockCount, setStockCount] = useState(0);
  const [barCount,   setBarCount]   = useState(0);

  const run = useCallback(async () => {
    if (!stocks.length) return;
    setStatus('loading');
    try {
      // 全ウォッチリスト銘柄の2年分日足を並列取得
      const allBarsArr = await Promise.all(
        stocks.map((s) => StockDataService.fetchOHLCLong(s.code).catch(() => []))
      );

      const allEntries = allBarsArr.flatMap((bars) => backtestSignals(bars));
      const total = allBarsArr.reduce((s, b) => s + b.length, 0);

      setStockCount(allBarsArr.filter((b) => b.length > 0).length);
      setBarCount(total);
      setResults(aggregateBacktest(allEntries));
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [stocks]);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>バックテスト</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* 説明 */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>検証方法</Text>
          <Text style={s.infoBody}>
            ウォッチリストの銘柄を使い、過去2年の日足データで各テクニカルシグナルが
            発生した翌5・10営業日後の価格変動を集計します。
            買いシグナルは上昇した場合、売りシグナルは下落した場合を「勝ち」とします。
          </Text>
        </View>

        {/* 実行ボタン */}
        {status !== 'done' && (
          <TouchableOpacity
            style={[s.runBtn, (status === 'loading' || !stocks.length) && s.runBtnDisabled]}
            onPress={run}
            disabled={status === 'loading' || !stocks.length}
          >
            {status === 'loading' ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.runBtnText}>
                {stocks.length === 0 ? 'ウォッチリストが空です' : `${stocks.length}銘柄でバックテスト実行`}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {status === 'loading' && (
          <Text style={s.loadingNote}>
            2年分のデータを取得中... しばらくお待ちください
          </Text>
        )}

        {status === 'error' && (
          <Text style={s.errorText}>データ取得に失敗しました。再度お試しください。</Text>
        )}

        {/* 結果 */}
        {status === 'done' && (
          <>
            <View style={s.summary}>
              <Text style={s.summaryText}>
                {stockCount}銘柄 · 約{barCount}本のデータを分析
              </Text>
              <TouchableOpacity onPress={run} style={s.rerunBtn}>
                <Text style={s.rerunText}>再実行</Text>
              </TouchableOpacity>
            </View>

            {results.length === 0 ? (
              <Text style={s.emptyText}>シグナルが検出されませんでした（データ不足の可能性があります）</Text>
            ) : (
              <>
                <ResultTable results={results.filter((r) => r.bullish)}  title="📈 買いシグナル" />
                <ResultTable results={results.filter((r) => !r.bullish)} title="📉 売りシグナル" />
                <Text style={s.disclaimer}>
                  ※ サンプル数が少ない（≤5件）シグナルは統計的信頼性が低い可能性があります。
                  過去の結果は将来の成果を保証しません。
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 結果テーブル ──────────────────────────────────────────────────────────────

function ResultTable({ results, title }: { results: BacktestResult[]; title: string }) {
  if (!results.length) return null;
  return (
    <View style={s.table}>
      <Text style={s.tableTitle}>{title}</Text>

      {/* ヘッダー */}
      <View style={[s.row, s.headerRow]}>
        <Text style={[s.cell, s.cellLabel, s.headerText]}>シグナル</Text>
        <Text style={[s.cell, s.cellNum, s.headerText]}>件数</Text>
        <Text style={[s.cell, s.cellNum, s.headerText]}>勝率5d</Text>
        <Text style={[s.cell, s.cellNum, s.headerText]}>騰落5d</Text>
        <Text style={[s.cell, s.cellNum, s.headerText]}>勝率10d</Text>
        <Text style={[s.cell, s.cellNum, s.headerText]}>騰落10d</Text>
      </View>

      {results.map((r) => (
        <ResultRow key={r.signalType} result={r} />
      ))}
    </View>
  );
}

function winColor(wr: number, count: number) {
  if (count <= 5) return Colors.textTertiary;
  if (wr >= 0.6) return Colors.positive;
  if (wr <= 0.4) return Colors.negative;
  return Colors.statusWatch;
}

function retStr(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function ResultRow({ result: r }: { result: BacktestResult }) {
  const c5  = winColor(r.winRate5d,  r.count);
  const c10 = winColor(r.winRate10d, r.count);
  const lowSample = r.count <= 5;
  return (
    <View style={[s.row, lowSample && s.rowLowSample]}>
      <View style={[s.cell, s.cellLabel]}>
        <Text style={s.labelText} numberOfLines={1}>{r.label}</Text>
        {lowSample && <Text style={s.lowSampleBadge}>少</Text>}
      </View>
      <Text style={[s.cell, s.cellNum, s.bodyText]}>{r.count}件</Text>
      <Text style={[s.cell, s.cellNum, s.bodyText, { color: c5  }]}>{(r.winRate5d  * 100).toFixed(0)}%</Text>
      <Text style={[s.cell, s.cellNum, s.bodyText, { color: c5  }]}>{retStr(r.avgRet5d)}</Text>
      <Text style={[s.cell, s.cellNum, s.bodyText, { color: c10 }]}>{(r.winRate10d * 100).toFixed(0)}%</Text>
      <Text style={[s.cell, s.cellNum, s.bodyText, { color: c10 }]}>{retStr(r.avgRet10d)}</Text>
    </View>
  );
}

// ── スタイル ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  backBtn: { width: 60 },
  backText: { fontSize: FontSize.md, color: Colors.primary },
  navTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },

  infoCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, gap: 6,
  },
  infoTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  infoBody:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  runBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  runBtnDisabled: { opacity: 0.4 },
  runBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#000' },
  loadingNote: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  errorText:   { fontSize: FontSize.sm, color: Colors.negative, textAlign: 'center' },

  summary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  summaryText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  rerunBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  rerunText: { fontSize: FontSize.sm, color: Colors.primary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  table: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden',
  },
  tableTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.text,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  headerRow: { backgroundColor: Colors.surface },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
    paddingVertical: 10,
  },
  rowLowSample: { opacity: 0.55 },
  cell: { paddingHorizontal: 6 },
  cellLabel: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: Spacing.sm },
  cellNum:   { flex: 1.2, textAlign: 'right', paddingRight: Spacing.sm },
  headerText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: '600' },
  bodyText:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  labelText:  { fontSize: FontSize.xs, color: Colors.text, flexShrink: 1 },
  lowSampleBadge: {
    fontSize: 9, color: Colors.statusAlert, borderWidth: 1,
    borderColor: Colors.statusAlert, borderRadius: 3, paddingHorizontal: 2,
  },
  disclaimer: { fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 18 },
});
