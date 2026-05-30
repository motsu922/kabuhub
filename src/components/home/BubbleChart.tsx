import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { Stock, WatchlistItem, UserIntention } from '../../types';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../constants/theme';
import { ExternalLinks } from '../../constants/externalLinks';

type BubbleFilter = 'all' | 'interested' | 'watching' | 'holding';

// レイアウト定数（通常 / 縮小）
const LAYOUT = {
  normal:  { chartH: 220, colW: 88, minR: 12, maxR: 32 },
  compact: { chartH: 170, colW: 64, minR:  8, maxR: 22 },
} as const;

const Y_RANGE   = 10;   // ±10%
const YAXIS_W   = 36;
const SEC_LBL_H = 26;
const Y_TICKS   = [10, 5, 0, -5, -10];

function yPx(pct: number, chartH: number): number {
  return chartH / 2 - (pct / Y_RANGE) * (chartH / 2);
}

function intentionGroup(intention: UserIntention | undefined): BubbleFilter {
  if (intention === 'buy')  return 'interested';
  if (intention === 'hold') return 'holding';
  return 'watching';
}

// ── セクター自動判定 ──────────────────────────────────────────────────────────
const KEYWORD_SECTORS: [RegExp, string][] = [
  [/レーザーテック|SCREEN|スクリーン|東京エレクトロン|アドバンテスト|コクサイ|ウルトラファブ/i, '半導体装置'],
  [/キオクシア|ルネサス|ソシオネクスト|マクニカ|ローム|シリコン|メモリ/i,                      '半導体'],
  [/信越化学|住友化学|東レ|化学|素材|プラスチック|樹脂|JSR/i,                                  '素材・化学'],
  [/フジクラ|古河電|住友電|電線|データセンター|冷却|液冷|光ファイバー/i,                         'AI・電線'],
  [/ファナック|安川|キーエンス|オムロン|SMC|THK|ロボット|FA|精密機器/i,                         '精密・ロボット'],
  [/三菱重工|川崎重工|IHI|SUBARU|富士重工|防衛|護衛艦|戦闘機|ミサイル/i,                        '防衛'],
  [/QPS|ispace|アイスペース|宇宙|スペース|天地人|インターステラ|衛星/i,                          '宇宙'],
  [/トヨタ|ホンダ|日産|マツダ|スズキ|デンソー|豊田|アイシン|EV|電気自動車/i,                     '自動車'],
  [/NTT|KDDI|ソフトバンク|楽天|通信キャリア|携帯|無線/i,                                        '通信'],
  [/銀行|証券|保険|フィナンシャル|リース|信託|三菱UFJ|三井住友|みずほ/i,                         '金融'],
  [/伊藤忠|丸紅|住友商事|三井物産|三菱商事|商事|物産/i,                                          '商社'],
  [/ソフトウェア|サイバー|DX|SaaS|クラウド|情報技術|システム/i,                                  'IT・DX'],
  [/医薬|製薬|バイオ|医療|ゲノム|アステラス|第一三共|エーザイ|中外製薬/i,                        '医薬・バイオ'],
  [/電力|ガス|石油|エネルギー|原発|再生可能|太陽光|風力/i,                                        'エネルギー'],
  [/不動産|住友不動産|三井不動産|大和ハウス|建設|鹿島|大成|清水建設/i,                            '不動産・建設'],
  [/ゲーム|任天堂|ソニー|エンタメ|コンテンツ|アニメ/i,                                            'エンタメ'],
];

const CODE_SECTOR: Record<string, string> = {
  '1': '建設・農林',
  '2': '食品・消費',
  '3': '繊維・紙',
  '4': '素材・化学',
  '5': '鉄鋼・金属',
  '6': '機械・電機',
  '7': '自動車・輸送',
  '8': '商社・金融',
  '9': '情報・通信',
};

function deriveSector(stock: Stock, item?: WatchlistItem): string {
  if (item?.group?.trim()) return item.group.trim();
  for (const [pattern, sector] of KEYWORD_SECTORS) {
    if (pattern.test(stock.name)) return sector;
  }
  if (stock.market !== 'US' && /^\d/.test(stock.code)) {
    return CODE_SECTOR[stock.code[0]] ?? 'その他';
  }
  return 'その他';
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
  const [compact, setCompact]       = useState(false);
  const [filter, setFilter]         = useState<BubbleFilter>('all');
  const [selectedCode, setSelected] = useState<string | null>(null);
  const s = useMemo(() => createStyles(colors), [colors]);

  const L = LAYOUT[compact ? 'compact' : 'normal'];

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
      return deriveSector(st, item);
    }));
    return [...set].sort((a, b) =>
      a === 'その他' ? 1 : b === 'その他' ? -1 : a.localeCompare(b, 'ja')
    );
  }, [filtered, items]);

  /* ── bubble data ─────────────────────────── */
  const bubbles = useMemo<Bubble[]>(() => {
    if (!filtered.length) return [];
    const rawSizes = filtered.map(st => st.volume);
    const maxSize  = Math.max(...rawSizes, 1);

    return filtered.map((st, idx) => {
      const item        = items.find(i => i.stockCode === st.code);
      const sector      = deriveSector(st, item);
      const pct         = st.changePercent ?? 0;
      const r           = L.minR + (rawSizes[idx] / maxSize) * (L.maxR - L.minR);
      const yRaw        = yPx(pct, L.chartH);
      const y           = Math.max(r + 2, Math.min(L.chartH - r - 2, yRaw));
      const x           = sectors.indexOf(sector) * L.colW + L.colW / 2;
      const color       = pct > 0.5 ? colors.positive : pct < -0.5 ? colors.negative : colors.neutral;
      const volumeRatio = (st.avgVolume20d ?? 0) > 0 ? st.volume / st.avgVolume20d! : undefined;
      return { stock: st, item, sector, pct, x, y, r, color, group: intentionGroup(item?.intention), volumeRatio };
    });
  }, [filtered, sectors, items, colors, L]);

  /* ── 今日の主役 ──────────────────────────── */
  const star = useMemo(() => {
    const pos = bubbles.filter(b => b.pct > 0);
    if (!pos.length) return null;
    return pos.reduce((best, b) =>
      Math.abs(b.pct) > Math.abs(best.pct) ? b : best
    );
  }, [bubbles]);

  const selected  = bubbles.find(b => b.stock.code === selectedCode);
  const chartW    = Math.max(sectors.length * L.colW, L.colW * 3);

  /* ── render ──────────────────────────────── */
  return (
    <View style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>バブルビュー</Text>
        <TouchableOpacity
          style={s.compactBtn}
          onPress={() => setCompact(c => !c)}
        >
          <Text style={s.compactTxt}>{compact ? '⊕ 拡大' : '⊖ 縮小'}</Text>
        </TouchableOpacity>
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
          <View style={{ width: YAXIS_W, height: L.chartH, position: 'relative' }}>
            {Y_TICKS.map(tick => (
              <Text key={tick} style={[s.yTick, { top: yPx(tick, L.chartH) - 8 }]}>
                {tick > 0 ? '+' : ''}{tick}%
              </Text>
            ))}
          </View>

          {/* Scrollable canvas */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={{ width: chartW, height: L.chartH + SEC_LBL_H }}>

              {/* Grid lines */}
              {Y_TICKS.map(tick => (
                <View
                  key={tick}
                  style={[
                    s.grid,
                    { top: yPx(tick, L.chartH), width: chartW },
                    tick === 0 && s.zeroLine,
                  ]}
                />
              ))}

              {/* Sector columns */}
              {sectors.map((sec, i) => (
                <React.Fragment key={sec}>
                  {i > 0 && (
                    <View style={[s.colDiv, { left: i * L.colW, height: L.chartH }]} />
                  )}
                  <Text
                    style={[s.secLbl, { left: i * L.colW, width: L.colW, top: L.chartH + 4 }]}
                    numberOfLines={1}
                  >
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
                    backgroundColor: b.color + (selectedCode === b.stock.code ? '44' : '22'),
                    borderColor:     b.color + (selectedCode === b.stock.code ? 'FF' : '99'),
                    borderWidth: selectedCode === b.stock.code ? 2 : 1.5,
                  }]}
                  onPress={() => setSelected(selectedCode === b.stock.code ? null : b.stock.code)}
                  activeOpacity={0.75}
                >
                  {b.r >= 16 && (
                    <Text style={[s.bubbleLbl, { color: b.color, fontSize: b.r >= 22 ? 9 : 7 }]}>
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
  const isJP     = stock.market !== 'US';
  const sign     = pct >= 0 ? '+' : '';
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
      <View style={s.detailHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.detailName} numberOfLines={1}>{stock.name}</Text>
          <Text style={s.detailCode}>{stock.code}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statRow}>
        <Stat label="現在値" value={priceStr}                          colors={colors} />
        <Stat label="騰落率" value={`${sign}${pct.toFixed(2)}%`}       colors={colors} valueColor={pctColor} />
        <Stat label="出来高" value={fmtVol(stock.volume)}              colors={colors} />
        {volumeRatio !== undefined && (
          <Stat label="倍率"  value={`${volumeRatio.toFixed(1)}倍`}    colors={colors} valueColor={colors.primary} />
        )}
      </View>

      {stock.avgVolume20d !== undefined && (
        <Text style={s.avgVol}>20日平均出来高: {fmtVol(Math.round(stock.avgVolume20d))}</Text>
      )}
      {item?.memo ? <Text style={s.memo} numberOfLines={2}>{item.memo}</Text> : null}

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
    compactBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.surface,
    },
    compactTxt: { fontSize: 11, fontWeight: '700', color: c.textSecondary },
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
      backgroundColor: c.separator,
    },
    secLbl: {
      position: 'absolute',
      textAlign: 'center',
      fontSize: 10,
      fontWeight: '600',
      color: c.textTertiary,
    },
    bubble: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bubbleLbl: { textAlign: 'center', fontWeight: '700' },
    empty: { height: 100, justifyContent: 'center', alignItems: 'center' },
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
    avgVol: { fontSize: FontSize.xs, color: c.textTertiary, marginBottom: 6 },
    memo: { fontSize: FontSize.xs, color: c.textSecondary, marginBottom: 8, lineHeight: 18 },
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
