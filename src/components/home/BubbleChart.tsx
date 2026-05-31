import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Animated,
  Modal, useWindowDimensions, SafeAreaView,
} from 'react-native';
import { Stock, WatchlistItem, UserIntention } from '../../types';
import { Spacing, FontSize, BorderRadius, ColorPalette } from '../../constants/theme';
import { ExternalLinks } from '../../constants/externalLinks';
import { useAppSettings } from '../../contexts/SettingsContext';

type BubbleFilter = 'all' | 'interested' | 'watching' | 'holding';
type Period = '1d' | '7d' | '30d' | '365d';

const PERIOD_CONFIG: Record<Period, { range: number; ticks: number[]; label: string }> = {
  '1d':   { range: 10,  ticks: [10, 5, 0, -5, -10],          label: '1日' },
  '7d':   { range: 20,  ticks: [20, 10, 0, -10, -20],         label: '7日' },
  '30d':  { range: 40,  ticks: [40, 20, 0, -20, -40],         label: '30日' },
  '365d': { range: 100, ticks: [100, 50, 0, -50, -100],       label: '365日' },
};

const LAYOUT = {
  normal:     { chartH: 220, colW: 64, minR: 10, maxR: 28 },
  compact:    { chartH: 170, colW: 46, minR:  6, maxR: 18 },
  fullscreen: { chartH: 0,   colW: 80, minR: 12, maxR: 36 }, // chartH filled at runtime
} as const;

const YAXIS_W   = 36;
const SEC_LBL_H = 34;

function yPx(pct: number, yRange: number, chartH: number): number {
  return chartH / 2 - (pct / yRange) * (chartH / 2);
}

function intentionGroup(intention: UserIntention | undefined): BubbleFilter {
  if (intention === 'buy')  return 'interested';
  if (intention === 'hold') return 'holding';
  return 'watching';
}

function getPct(stock: Stock, period: Period): number {
  if (period === '7d'   && stock.change7d   != null) return stock.change7d;
  if (period === '30d'  && stock.change30d  != null) return stock.change30d;
  if (period === '365d' && stock.change365d != null) return stock.change365d;
  return stock.changePercent ?? 0;
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
  const [period, setPeriod]         = useState<Period>('1d');
  const [fullscreen, setFullscreen] = useState(false);
  const { effectsEnabled }          = useAppSettings();
  const { height: screenH }         = useWindowDimensions();
  const s = useMemo(() => createStyles(colors), [colors]);

  const pcfg  = PERIOD_CONFIG[period];
  const L     = fullscreen
    ? { ...LAYOUT.fullscreen, chartH: Math.floor(screenH * 0.52) }
    : LAYOUT[compact ? 'compact' : 'normal'];

  const filtered = useMemo(() =>
    stocks.filter(st => {
      const item = items.find(i => i.stockCode === st.code);
      return filter === 'all' || intentionGroup(item?.intention) === filter;
    }),
    [stocks, items, filter]
  );

  const sectors = useMemo(() => {
    const set = new Set(filtered.map(st => {
      const item = items.find(i => i.stockCode === st.code);
      return deriveSector(st, item);
    }));
    return [...set].sort((a, b) =>
      a === 'その他' ? 1 : b === 'その他' ? -1 : a.localeCompare(b, 'ja')
    );
  }, [filtered, items]);

  const bubbles = useMemo<Bubble[]>(() => {
    if (!filtered.length) return [];
    const rawSizes = filtered.map(st => st.volume);
    const maxSize  = Math.max(...rawSizes, 1);

    return filtered.map((st, idx) => {
      const item   = items.find(i => i.stockCode === st.code);
      const sector = deriveSector(st, item);
      const pct    = getPct(st, period);
      const r      = L.minR + (rawSizes[idx] / maxSize) * (L.maxR - L.minR);
      const yRaw   = yPx(pct, pcfg.range, L.chartH);
      const y      = Math.max(r + 2, Math.min(L.chartH - r - 2, yRaw));
      const x      = sectors.indexOf(sector) * L.colW + L.colW / 2;
      const color  = pct > 0.5 ? colors.positive : pct < -0.5 ? colors.negative : colors.neutral;
      return { stock: st, item, sector, pct, x, y, r, color, group: intentionGroup(item?.intention) };
    });
  }, [filtered, sectors, items, colors, L, period, pcfg.range]);

  const star = useMemo(() => {
    const pos = bubbles.filter(b => b.pct > 0);
    if (!pos.length) return null;
    return pos.reduce((best, b) => Math.abs(b.pct) > Math.abs(best.pct) ? b : best);
  }, [bubbles]);

  const selected = bubbles.find(b => b.stock.code === selectedCode);

  const overlapGroup = useMemo(() => {
    const sel = bubbles.find(b => b.stock.code === selectedCode);
    if (!sel) return [] as Bubble[];
    return bubbles
      .filter(b => {
        const dx = b.x - sel.x;
        const dy = b.y - sel.y;
        return Math.sqrt(dx * dx + dy * dy) < (b.r + sel.r);
      })
      .sort((a, b) => b.pct - a.pct);
  }, [selectedCode, bubbles]);

  const overlapIdx = overlapGroup.findIndex(b => b.stock.code === selectedCode);
  const chartW     = Math.max(sectors.length * L.colW, L.colW * 3);

  const chartContent = (isFS: boolean) => (
    <ChartCanvas
      bubbles={bubbles}
      sectors={sectors}
      L={L}
      pcfg={pcfg}
      chartW={chartW}
      colors={colors}
      s={s}
      selectedCode={selectedCode}
      setSelected={setSelected}
      effectsEnabled={effectsEnabled}
      isFullscreen={isFS}
    />
  );

  const controls = (isFS: boolean) => (
    <>
      {/* Period selector */}
      <View style={s.periodRow}>
        {(Object.keys(PERIOD_CONFIG) as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[s.periodChip, period === p && s.periodChipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[s.periodTxt, period === p && s.periodTxtActive]}>
              {PERIOD_CONFIG[p].label}
            </Text>
          </TouchableOpacity>
        ))}
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
    </>
  );

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>バブルビュー</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setFullscreen(true)}>
          <Text style={s.iconBtnTxt}>⛶</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.compactBtn, { marginLeft: 6 }]} onPress={() => setCompact(c => !c)}>
          <Text style={s.compactTxt}>{compact ? '⊕ 拡大' : '⊖ 縮小'}</Text>
        </TouchableOpacity>
      </View>

      {controls(false)}

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
            <Text style={[s.starPct, { color: star.pct >= 0 ? colors.positive : colors.negative }]}>
              {star.pct >= 0 ? '+' : ''}{star.pct.toFixed(2)}%
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>表示できる銘柄がありません</Text>
        </View>
      ) : chartContent(false)}

      {selected && (
        <DetailPanel
          b={selected}
          colors={colors}
          s={s}
          overlapGroup={overlapGroup}
          overlapIdx={overlapIdx}
          onClose={() => setSelected(null)}
          onSelectOverlap={setSelected}
          onNavigate={() => { setSelected(null); onPressStock(selected.stock.code); }}
        />
      )}

      {/* Fullscreen Modal */}
      <Modal
        visible={fullscreen}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setFullscreen(false)}
      >
        <SafeAreaView style={s.fsContainer}>
          {/* FS Header */}
          <View style={s.fsHeader}>
            <Text style={s.title}>バブルビュー</Text>
            <TouchableOpacity style={s.fsCloseBtn} onPress={() => setFullscreen(false)}>
              <Text style={s.fsCloseTxt}>✕ 閉じる</Text>
            </TouchableOpacity>
          </View>

          {controls(true)}

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
                <Text style={[s.starPct, { color: star.pct >= 0 ? colors.positive : colors.negative }]}>
                  {star.pct >= 0 ? '+' : ''}{star.pct.toFixed(2)}%
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>表示できる銘柄がありません</Text>
            </View>
          ) : chartContent(true)}

          {selected && (
            <DetailPanel
              b={selected}
              colors={colors}
              s={s}
              overlapGroup={overlapGroup}
              overlapIdx={overlapIdx}
              onClose={() => setSelected(null)}
              onSelectOverlap={setSelected}
              onNavigate={() => { setSelected(null); onPressStock(selected.stock.code); }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/* ── Chart canvas (shared between normal and fullscreen) ─────────────────── */

function ChartCanvas({
  bubbles, sectors, L, pcfg, chartW, colors, s,
  selectedCode, setSelected, effectsEnabled,
}: {
  bubbles: Bubble[];
  sectors: string[];
  L: { chartH: number; colW: number; minR: number; maxR: number };
  pcfg: { range: number; ticks: number[]; label: string };
  chartW: number;
  colors: ColorPalette;
  s: ReturnType<typeof createStyles>;
  selectedCode: string | null;
  setSelected: (code: string | null) => void;
  effectsEnabled: boolean;
  isFullscreen: boolean;
}) {
  return (
    <View style={s.chartWrap}>
      {/* Y-axis labels */}
      <View style={{ width: YAXIS_W, height: L.chartH, position: 'relative' }}>
        {pcfg.ticks.map(tick => (
          <Text key={tick} style={[s.yTick, { top: yPx(tick, pcfg.range, L.chartH) - 8 }]}>
            {tick > 0 ? '+' : ''}{tick}%
          </Text>
        ))}
      </View>

      {/* Scrollable canvas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={{ width: chartW, height: L.chartH + SEC_LBL_H }}>

          {/* Grid lines */}
          {pcfg.ticks.map(tick => (
            <View
              key={tick}
              style={[
                s.grid,
                { top: yPx(tick, pcfg.range, L.chartH), width: chartW },
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
                numberOfLines={2}
              >
                {sec}
              </Text>
            </React.Fragment>
          ))}

          {/* Bubbles */}
          {bubbles.map(b => {
            const isSelected = selectedCode === b.stock.code;
            const nameInside = b.stock.name.slice(0, b.r >= 26 ? 6 : b.r >= 20 ? 4 : 3);
            const showInside = b.r >= 18;
            const extTop     = Math.min(b.y + b.r + 2, L.chartH - 10);
            return (
              <React.Fragment key={b.stock.code}>
                <TouchableOpacity
                  style={[s.bubble, {
                    left: b.x - b.r,
                    top:  b.y - b.r,
                    width:  b.r * 2,
                    height: b.r * 2,
                    borderRadius: b.r,
                    backgroundColor: b.color + (isSelected ? '44' : '22'),
                    borderColor:     b.color + (isSelected ? 'FF' : '99'),
                    borderWidth: isSelected ? 2 : 1.5,
                  }]}
                  onPress={() => setSelected(isSelected ? null : b.stock.code)}
                  activeOpacity={0.75}
                >
                  {showInside && (
                    <Text style={[s.bubbleLbl, { color: b.color, fontSize: b.r >= 24 ? 9 : 7 }]} numberOfLines={1}>
                      {nameInside}
                    </Text>
                  )}
                </TouchableOpacity>
                {!showInside && (
                  <Text
                    style={[s.bubbleExtLbl, { color: b.color, left: b.x - 28, top: extTop }]}
                    numberOfLines={1}
                    pointerEvents="none"
                  >
                    {b.stock.name.length > 6 ? b.stock.name.slice(0, 6) : b.stock.name}
                  </Text>
                )}
              </React.Fragment>
            );
          })}

          {/* 持ってる銘柄エフェクト */}
          {effectsEnabled && bubbles
            .filter(b => b.group === 'holding' && b.pct >= 5)
            .map(b => (
              <BubbleEffect key={`eff-${b.stock.code}`} x={b.x} y={b.y} pct={b.pct} />
            ))
          }

        </View>
      </ScrollView>
    </View>
  );
}

/* ── Detail panel ─────────────────────────────────────────────────────────── */

function DetailPanel({ b, colors, s, overlapGroup, overlapIdx, onClose, onSelectOverlap, onNavigate }: {
  b: Bubble;
  colors: ColorPalette;
  s: ReturnType<typeof createStyles>;
  overlapGroup: Bubble[];
  overlapIdx: number;
  onClose: () => void;
  onSelectOverlap: (code: string) => void;
  onNavigate: () => void;
}) {
  const { stock, item, pct } = b;
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
        {overlapGroup.length > 1 && (
          <View style={s.overlapNav}>
            <TouchableOpacity
              onPress={() => overlapIdx > 0 && onSelectOverlap(overlapGroup[overlapIdx - 1].stock.code)}
              disabled={overlapIdx === 0}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
            >
              <Text style={[s.navArrow, overlapIdx === 0 && s.navDisabled]}>◀</Text>
            </TouchableOpacity>
            <Text style={s.navCount}>{overlapIdx + 1}/{overlapGroup.length}</Text>
            <TouchableOpacity
              onPress={() => overlapIdx < overlapGroup.length - 1 && onSelectOverlap(overlapGroup[overlapIdx + 1].stock.code)}
              disabled={overlapIdx === overlapGroup.length - 1}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
            >
              <Text style={[s.navArrow, overlapIdx === overlapGroup.length - 1 && s.navDisabled]}>▶</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statRow}>
        <Stat label="現在値" value={priceStr}                          colors={colors} />
        <Stat label="騰落率" value={`${sign}${pct.toFixed(2)}%`}       colors={colors} valueColor={pctColor} />
        <Stat label="出来高" value={fmtVol(stock.volume)}              colors={colors} />
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

/* ── Bubble Effects ──────────────────────────────────────────────────────── */

const CONFETTI_COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF922B','#CC5DE8','#F06595','#74C0FC','#51CF66','#FCC419'];
const FW_COLORS       = ['#FFD700','#FF6B35','#A8E063','#56CCF2','#FF69B4','#FFA500','#C084FC','#FB7185','#FBBF24','#34D399','#60A5FA','#F87171'];

function SparkleEffect({ x, y }: { x: number; y: number }) {
  const N = 7;
  const pieces = useRef(
    Array.from({ length: N }, (_, i) => ({
      tx:    new Animated.Value(0),
      ty:    new Animated.Value(0),
      op:    new Animated.Value(0),
      scale: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }))
  ).current;

  const animate = useCallback(() => {
    const anims = pieces.map(p => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 10 + Math.random() * 12;
      p.tx.setValue(0); p.ty.setValue(0); p.op.setValue(0); p.scale.setValue(0);
      return Animated.sequence([
        Animated.parallel([
          Animated.timing(p.tx,    { toValue: Math.cos(angle) * dist, duration: 800, useNativeDriver: true }),
          Animated.timing(p.ty,    { toValue: Math.sin(angle) * dist - 6, duration: 800, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0.8, duration: 300, useNativeDriver: true }),
          Animated.timing(p.op,    { toValue: 0.55, duration: 200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(p.scale, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(p.op,    { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.parallel(anims).start();
  }, [pieces]);

  useEffect(() => {
    const t  = setTimeout(animate, Math.random() * 800);
    const iv = setInterval(animate, 7000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [animate]);

  return (
    <View style={{ position: 'absolute', left: x, top: y }} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          width: 5, height: 5, borderRadius: 2.5,
          backgroundColor: p.color,
          left: -2.5, top: -2.5,
          opacity: p.op,
          transform: [{ translateX: p.tx }, { translateY: p.ty }, { scale: p.scale }],
        }} />
      ))}
    </View>
  );
}

function ConfettiEffect({ x, y }: { x: number; y: number }) {
  const N = 14;
  const pieces = useRef(
    Array.from({ length: N }, (_, i) => ({
      tx:    new Animated.Value(0),
      ty:    new Animated.Value(-20),
      rot:   new Animated.Value(0),
      op:    new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      wide:  i % 3 !== 0,
    }))
  ).current;

  const animate = useCallback(() => {
    const anims = pieces.map(p => {
      const sx  = (Math.random() - 0.5) * 44;
      const ex  = sx + (Math.random() - 0.5) * 24;
      const ey  = 55 + Math.random() * 25;
      const dur = 2400 + Math.random() * 800;
      const rot = (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 4);
      p.tx.setValue(sx);
      p.ty.setValue(-18 - Math.random() * 12);
      p.rot.setValue(0);
      p.op.setValue(0.75);
      return Animated.parallel([
        Animated.timing(p.ty,  { toValue: ey,  duration: dur, useNativeDriver: true }),
        Animated.timing(p.tx,  { toValue: ex,  duration: dur, useNativeDriver: true }),
        Animated.timing(p.rot, { toValue: rot, duration: dur, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.op, { toValue: 0.75, duration: dur * 0.6, useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0,    duration: dur * 0.4, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.parallel(anims).start();
  }, [pieces]);

  useEffect(() => {
    const t  = setTimeout(animate, Math.random() * 600);
    const iv = setInterval(animate, 5500);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [animate]);

  return (
    <View style={{ position: 'absolute', left: x, top: y }} pointerEvents="none">
      {pieces.map((p, i) => {
        const rotStr = p.rot.interpolate({ inputRange: [-10, 10], outputRange: ['-3600deg', '3600deg'] });
        return (
          <Animated.View key={i} style={{
            position: 'absolute',
            width: p.wide ? 7 : 4, height: p.wide ? 3.5 : 4,
            borderRadius: 1,
            backgroundColor: p.color,
            left: p.wide ? -3.5 : -2, top: p.wide ? -1.75 : -2,
            opacity: p.op,
            transform: [{ translateX: p.tx }, { translateY: p.ty }, { rotate: rotStr }],
          }} />
        );
      })}
    </View>
  );
}

type BurstAnim = { pos: Animated.ValueXY; op: Animated.Value; scale: Animated.Value };

function makeBurstAnims(n: number): BurstAnim[] {
  return Array.from({ length: n }, () => ({
    pos:   new Animated.ValueXY({ x: 0, y: 0 }),
    op:    new Animated.Value(0),
    scale: new Animated.Value(0),
  }));
}

function burstAnimation(anims: BurstAnim[], n: number, spread: number, duration: number) {
  anims.forEach(a => { a.pos.setValue({ x: 0, y: 0 }); a.op.setValue(0); a.scale.setValue(1.4); });
  return Animated.parallel(
    anims.map((a, i) => {
      const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const dist  = spread * (0.6 + Math.random() * 0.8);
      return Animated.parallel([
        Animated.timing(a.pos, {
          toValue: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - spread * 0.35 },
          duration, useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(a.op, { toValue: 1, duration: 130,             useNativeDriver: true }),
          Animated.timing(a.op, { toValue: 0, duration: duration - 130,  useNativeDriver: true }),
        ]),
        Animated.timing(a.scale, { toValue: 0, duration, useNativeDriver: true }),
      ]);
    })
  );
}

function SingleFireworkEffect({ x, y }: { x: number; y: number }) {
  const N     = 16;
  const anims = useRef(makeBurstAnims(N)).current;

  const fire = useCallback(() => {
    burstAnimation(anims, N, 36, 2200).start();
  }, [anims]);

  useEffect(() => {
    const t  = setTimeout(fire, 300 + Math.random() * 600);
    const iv = setInterval(fire, 5000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [fire]);

  return (
    <View style={{ position: 'absolute', left: x, top: y }} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: 7, height: 7, borderRadius: 3.5,
          backgroundColor: FW_COLORS[i % FW_COLORS.length],
          left: -3.5, top: -3.5,
          opacity: a.op,
          transform: [{ translateX: a.pos.x }, { translateY: a.pos.y }, { scale: a.scale }],
        }} />
      ))}
    </View>
  );
}

function TripleFireworkEffect({ x, y }: { x: number; y: number }) {
  const N      = 15;
  const burst1 = useRef(makeBurstAnims(N)).current;
  const burst2 = useRef(makeBurstAnims(N)).current;
  const burst3 = useRef(makeBurstAnims(N)).current;

  const fire = useCallback(() => {
    Animated.sequence([
      burstAnimation(burst1, N, 40, 2100),
      Animated.delay(900),
      burstAnimation(burst2, N, 40, 2100),
      Animated.delay(900),
      burstAnimation(burst3, N, 40, 2100),
    ]).start();
  }, [burst1, burst2, burst3]);

  useEffect(() => {
    const t  = setTimeout(fire, 200 + Math.random() * 400);
    const iv = setInterval(fire, 7000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [fire]);

  const allBursts = [
    { anims: burst1, cols: FW_COLORS },
    { anims: burst2, cols: FW_COLORS.slice().reverse() },
    { anims: burst3, cols: FW_COLORS },
  ];

  return (
    <View style={{ position: 'absolute', left: x, top: y }} pointerEvents="none">
      {allBursts.map(({ anims, cols }, bi) =>
        anims.map((a, i) => (
          <Animated.View key={`${bi}-${i}`} style={{
            position: 'absolute', width: 8, height: 8, borderRadius: 4,
            backgroundColor: cols[i % cols.length],
            left: -4, top: -4,
            opacity: a.op,
            transform: [{ translateX: a.pos.x }, { translateY: a.pos.y }, { scale: a.scale }],
          }} />
        ))
      )}
    </View>
  );
}

function BubbleEffect({ x, y, pct }: { x: number; y: number; pct: number }) {
  if (pct >= 20) return <TripleFireworkEffect x={x} y={y} />;
  if (pct >= 15) return <SingleFireworkEffect x={x} y={y} />;
  if (pct >= 10) return <ConfettiEffect x={x} y={y} />;
  return <SparkleEffect x={x} y={y} />;
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    root: {
      backgroundColor: '#000',
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
    iconBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.surface,
    },
    iconBtnTxt: { fontSize: 13, color: c.textSecondary },
    compactBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.surface,
    },
    compactTxt: { fontSize: 11, fontWeight: '700', color: c.textSecondary },
    periodRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingTop: 8,
      paddingBottom: 2,
    },
    periodChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.surface,
    },
    periodChipActive: {
      borderColor: c.primary,
      backgroundColor: c.primary + '20',
    },
    periodTxt: { fontSize: 12, fontWeight: '700', color: c.textTertiary },
    periodTxtActive: { color: c.primary },
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
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    zeroLine: { backgroundColor: 'rgba(255,255,255,0.25)', height: 1 },
    colDiv: {
      position: 'absolute',
      top: 0,
      width: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    secLbl: {
      position: 'absolute',
      textAlign: 'center',
      fontSize: 9,
      fontWeight: '600',
      color: c.textSecondary,
      lineHeight: 13,
    },
    bubble: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bubbleLbl: { textAlign: 'center', fontWeight: '700' },
    bubbleExtLbl: {
      position: 'absolute',
      width: 56,
      textAlign: 'center',
      fontSize: 7,
      fontWeight: '600',
    },
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
    detailHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    overlapNav: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 },
    navArrow:   { fontSize: 14, fontWeight: '800', color: c.primary },
    navDisabled:{ color: c.textTertiary },
    navCount:   { fontSize: 11, fontWeight: '600', color: c.textTertiary, fontVariant: ['tabular-nums' as any] },
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
    // Fullscreen styles
    fsContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    fsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingTop: 10,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    fsCloseBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.surface,
    },
    fsCloseTxt: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  });
}
