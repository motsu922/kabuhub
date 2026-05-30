import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { Stock, WatchlistItem, UserIntention } from '../../types';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../constants/theme';
import { ExternalLinks } from '../../constants/externalLinks';

type SizeMode  = 'volume' | 'ratio';
type BubbleFilter = 'all' | 'interested' | 'watching' | 'holding';

const CHART_H    = 220;
const COL_W      = 120;
const Y_RANGE    = 10;   // ±10%
const MIN_R      = 14;
const MAX_R      = 36;
const YAXIS_W    = 36;
const SEC_LBL_H  = 28;
const Y_TICKS    = [10, 5, 0, -5, -10];

function yPx(pct: number): number {
  return CHART_H / 2 - (pct / Y_RANGE) * (CHART_H / 2);
}

function intentionGroup(intention: UserIntention | undefined): BubbleFilter {
  if (intention === 'buy')  return 'interested';
  if (intention === 'hold') return 'holding';
  return 'watching';
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

interface Bubble {
  stock: Stock;
  item?: WatchlistItem;
  sector: string;
  pct: number;
  x: number;
  y: number;
  r: number;
  color: string;
  group: BubbleFilter;
  volumeRatio?: number;
}

interface Props {
  stocks: Stock[];
  items: WatchlistItem[];
  colors: ColorPalette;
  onPressStock: (code: string) => void;
}

export function BubbleChart({ stocks, items, colors, onPressStock }: Props) {
  const [sizeMode, setSizeMode]     = useState<SizeMode>('ratio');
  const [filter, setFilter]         = useState<BubbleFilter>('all');
  const [selectedCode, setSelected] = useState<string | null>(null);
  const s = useMemo(() => createStyles(colors), [colors]);

  /* ── filtered stocks ─────────────────────── */
  const filtered = useMemo(() =>
    stocks.filter(st => {
      const item = items.find(i => i.stockCode === st.code);
      return filter === 'all' || intentionGroup(item?.intention) === filter;
    }),
    [stocks, items, filter]
  );

  /* ── sectors (X-axis) ────────────────────── */
  const sectors = useMemo(() => {
    const set = new Set(filtered.map(st => {
      const item = items.find(i => i.stockCode === st.code);
      return item?.group?.trim() || 'その他';
    }));
    return [...set].sort((a, b) =>
      a === 'その他' ? 1 : b === 'その他' ? -1 : a.localeCompare(b, 'ja')
    );
  }, [filtered, items]);

  const chartW = Math.max(sectors.length * COL_W, COL_W * 3);

  /* ── bubble data ─────────────────────────── */
  const bubbles = useMemo<Bubble[]>(() => {
    if (!filtered.length) return [];
    const rawSizes = filtered.map(st =>
      sizeMode === 'ratio' && (st.avgVolume20d ?? 0) > 0
        ? st.volume / st.avgVolume20d!
        : st.volume
    );
    const maxSize = Math.max(...rawSizes, 1);

    return filtered.map((st, idx) => {
      const item   = items.find(i => i.stockCode === st.code);
      const sector = item?.group?.trim() || 'その他';
      const pct    = st.changePercent ?? 0;
      const r      = MIN_R + (rawSizes[idx] / maxSize) * (MAX_R - MIN_R);
      const y      = Math.max(r + 2, Math.min(CHART_H - r - 2, yPx(pct)));
      const x      = sectors.indexOf(sector) * COL_W + COL_W / 2;
      const color  = pct > 0.5 ? colors.positive : pct < -0.5 ? colors.negative : colors.neutral;
      const volumeRatio = (st.avgVolume20d ?? 0) > 0 ? st.volume / st.avgVolume20d! : undefined;
      return { stock: st, item, sector, pct, x, y, r, color, group: intentionGroup(item?.intention), volumeRatio };
    });
  }, [filtered, sectors, sizeMode, items, colors]);

  /* ── 今日の主役 ──────────────────────────── */
  const star = useMemo(() => {
    const pos = bubbles.filter(b => b.pct > 0 && b.volumeRatio !== undefined);
    if (!pos.length) return null;
    return pos.reduce((best, b) => (b.volumeRatio ?? 0) > (best.volumeRatio ?? 0) ? b : best);
  }, [bubbles]);

  const selected = bubbles.find(b => b.stock.code === selectedCode);

  /* ── render ──────────────────────────────── */
  return (
    <View style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>バブルビュー</Text>
        <View style={s.modeToggle}>
          {(['volume', 'ratio'] as SizeMode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[s.modeBtn, sizeMode === m && s.modeBtnOn]}
              onPress={() => setSizeMode(m)}
            >
              <Text style={[s.modeTxt, sizeMode === m && { color: colors.primary }]}>
                {m === 'volume' ? '出来高' : '倍率'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {([
          ['all',        'すべて',   colors.textSecondary],
          ['interested', '気になる', colors.primary],
          ['watching',   '監視中',   colors.textSecondary],
          ['holding',    '保有中',   colors.positive],
        ] as [BubbleFilter, string, string][]).map(([f, lbl, col]) => (
          <TouchableOpacity
            key={f}
            style={[s.chip, filter === f && { borderColor: col, backgroundColor: col + '18' }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.chipTxt, { color: filter === f ? col : colors.textTertiary }]}>
              {lbl}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 今日の主役 */}
      {star && (
        <TouchableOpacity
          style={s.starBanner}
          onPress={() => setSelected(star.stock.code)}
          activeOpacity={0.8}
        >
          <Text style={s.starEmoji}>🔥</Text>
          <View style={s.starMid}>
            <Text style={s.starLabel}>今日の主役</Text>
            <Text style={s.starName} numberOfLines={1}>{star.stock.name}</Text>
          </View>
          <View style={s.starRight}>
            <Text style={[s.starPct, { color: colors.positive }]}>+{star.pct.toFixed(2)}%</Text>
            {star.volumeRatio !== undefined && (
              <Text style={s.starRatio}>出来高 {star.volumeRatio.toFixed(1)}倍</Text>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Chart */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>表示できる銘柄がありません</Text>
        </View>
      ) : (
        <View style={s.chartWrap}>
          {/* Y-axis labels */}
          <View style={{ width: YAXIS_W, height: CHART_H, position: 'relative' }}>
            {Y_TICKS.map(tick => (
              <Text key={tick} style={[s.yTick, { top: yPx(tick) - 8 }]}>
                {tick > 0 ? '+' : ''}{tick}%
              </Text>
            ))}
          </View>

          {/* Scrollable canvas */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={{ width: chartW, height: CHART_H + SEC_LBL_H }}>

              {/* Grid lines */}
              {Y_TICKS.map(tick => (
                <View
                  key={tick}
                  style={[s.grid, { top: yPx(tick), width: chartW }, tick === 0 && s.zeroLine]}
                />
              ))}

              {/* Sector columns */}
              {sectors.map((sec, i) => (
                <React.Fragment key={sec}>
                  {i > 0 && <View style={[s.colDiv, { left: i * COL_W }]} />}
                  <Text style={[s.secLbl, { left: i * COL_W, width: COL_W }]} numberOfLines={1}>
                    {sec}
                  </Text>
                </React.Fragment>
              ))}

              {/* Bubbles */}
              {bubbles.map(b => (
                <TouchableOpacity
                  key={b.stock.code}
                  style={[s.bubble, {
                    left: b.x - b.r,
                    top:  b.y - b.r,
                    width:  b.r * 2,
                    height: b.r * 2,
                    borderRadius: b.r,
                    backgroundColor: b.color + (selectedCode === b.stock.code ? '40' : '22'),
                    borderColor: b.color + (selectedCode === b.stock.code ? 'FF' : '99'),
                    borderWidth: selectedCode === b.stock.code ? 2 : 1.5,
                  }]}
                  onPress={() => setSelected(selectedCode === b.stock.code ? null : b.stock.code)}
                  activeOpacity={0.75}
                >
                  {b.r >= 18 && (
                    <Text style={[s.bubbleLbl, { color: b.color, fontSize: b.r >= 26 ? 9 : 8 }]}>
                      {b.stock.code}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}

            </View>
          </ScrollView>
        </View>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          b={selected}
          colors={colors}
          s={s}
          onClose={() => setSelected(null)}
          onNavigate={() => { setSelected(null); onPressStock(selected.stock.code); }}
        />
      )}
    </View>
  );
}

/* ── Detail panel ─────────────────────────────────────────────────────────── */

function DetailPanel({ b, colors, s, onClose, onNavigate }: {
  b: Bubble;
  colors: ColorPalette;
  s: ReturnType<typeof createStyles>;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const { stock, item, pct, volumeRatio } = b;
  const isJP    = stock.market !== 'US';
  const sign    = pct >= 0 ? '+' : '';
  const pctColor = pct >= 0 ? colors.positive : colors.negative;
  const priceStr = isJP
    ? `¥${stock.price.toLocaleString('ja-JP')}`
    : `$${stock.price.toFixed(2)}`;

  const links = isJP ? [
    { label: 'Yahoo掲示板', onPress: () => Linking.openURL(`https://finance.yahoo.co.jp/cm/message/${stock.code}`) },
    { label: '株探',        onPress: () => Linking.openURL(ExternalLinks.kabutan(stock.code)) },
    { label: 'X検索',       onPress: () => Linking.openURL(`https://x.com/search?q=${encodeURIComponent(stock.name + ' 株')}&f=live`) },
  ] : [
    { label: 'Yahoo Finance', onPress: () => Linking.openURL(ExternalLinks.yahooFinanceUS(stock.code)) },
    { label: 'X検索',         onPress: () => Linking.openURL(`https://x.com/search?q=${encodeURIComponent(stock.code + ' stock')}&f=live`) },
  ];

  return (
    <View style={s.detail}>
      {/* Title row */}
      <View style={s.detailHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.detailName} numberOfLines={1}>{stock.name}</Text>
          <Text style={s.detailCode}>{stock.code}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={s.statRow}>
        <Stat label="現在値"  value={priceStr}                            colors={colors} />
        <Stat label="騰落率"  value={`${sign}${pct.toFixed(2)}%`}         colors={colors} valueColor={pctColor} />
        <Stat label="出来高"  value={fmtVol(stock.volume)}                colors={colors} />
        {volumeRatio !== undefined && (
          <Stat label="倍率" value={`${volumeRatio.toFixed(1)}倍`}        colors={colors} valueColor={colors.primary} />
        )}
      </View>

      {/* Avg volume (if available) */}
      {stock.avgVolume20d !== undefined && (
        <Text style={s.avgVol}>
          20日平均出来高: {fmtVol(Math.round(stock.avgVolume20d))}
        </Text>
      )}

      {/* Memo */}
      {item?.memo ? (
        <Text style={s.memo} numberOfLines={2}>{item.memo}</Text>
      ) : null}

      {/* Links + navigate */}
      <View style={s.linkRow}>
        {links.map(l => (
          <TouchableOpacity key={l.label} style={s.linkBtn} onPress={l.onPress}>
            <Text style={s.linkTxt}>{l.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.linkBtn, s.linkBtnPrimary]} onPress={onNavigate}>
          <Text style={[s.linkTxt, { color: colors.primary }]}>詳細 →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Stat({ label, value, valueColor, colors }: {
  label: string; value: string; valueColor?: string; colors: ColorPalette;
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: valueColor ?? colors.text }}>{value}</Text>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    root: {
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: c.cardBorder,
      marginBottom: Spacing.sm,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: 10,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    title: { fontSize: FontSize.sm, fontWeight: '700', color: c.text, flex: 1 },
    modeToggle: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
      overflow: 'hidden',
    },
    modeBtn: { paddingHorizontal: 10, paddingVertical: 4 },
    modeBtnOn: { backgroundColor: c.primaryMuted },
    modeTxt: { fontSize: 11, fontWeight: '700', color: c.textTertiary },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    chipTxt: { fontSize: 11, fontWeight: '600' },
    starBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: Spacing.md,
      marginBottom: 8,
      padding: 8,
      backgroundColor: c.surface,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: c.cardBorder,
    },
    starEmoji: { fontSize: 20 },
    starMid: { flex: 1 },
    starLabel: { fontSize: 10, color: c.textTertiary, fontWeight: '600' },
    starName: { fontSize: FontSize.sm, fontWeight: '700', color: c.text },
    starRight: { alignItems: 'flex-end' },
    starPct: { fontSize: FontSize.md, fontWeight: '800' },
    starRatio: { fontSize: 10, color: c.textTertiary },
    chartWrap: {
      flexDirection: 'row',
      paddingLeft: Spacing.sm,
      paddingBottom: 4,
    },
    yTick: {
      position: 'absolute',
      right: 2,
      fontSize: 9,
      color: c.textTertiary,
      fontVariant: ['tabular-nums' as any],
    },
    grid: {
      position: 'absolute',
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator,
    },
    zeroLine: { backgroundColor: c.textTertiary, opacity: 0.5, height: 1 },
    colDiv: {
      position: 'absolute',
      top: 0,
      width: StyleSheet.hairlineWidth,
      height: CHART_H,
      backgroundColor: c.separator,
    },
    secLbl: {
      position: 'absolute',
      top: CHART_H + 4,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '600',
      color: c.textTertiary,
    },
    bubble: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bubbleLbl: {
      textAlign: 'center',
      fontWeight: '700',
    },
    empty: {
      height: 100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyTxt: { fontSize: FontSize.sm, color: c.textTertiary },
    detail: {
      margin: Spacing.md,
      marginTop: 4,
      backgroundColor: c.surface,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: c.cardBorder,
      padding: Spacing.md,
    },
    detailHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    detailName: { fontSize: FontSize.md, fontWeight: '700', color: c.text },
    detailCode: { fontSize: FontSize.xs, color: c.textTertiary, marginTop: 2 },
    closeBtn: { padding: 4, marginLeft: 8 },
    closeTxt: { fontSize: 14, color: c.textTertiary },
    statRow: {
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: BorderRadius.sm,
      padding: 10,
      marginBottom: 8,
    },
    avgVol: {
      fontSize: FontSize.xs,
      color: c.textTertiary,
      marginBottom: 6,
    },
    memo: {
      fontSize: FontSize.xs,
      color: c.textSecondary,
      marginBottom: 8,
      lineHeight: 18,
    },
    linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    linkBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
    },
    linkBtnPrimary: { borderColor: c.primaryDim },
    linkTxt: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
  });
}
