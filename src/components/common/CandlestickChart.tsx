import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Path, Text as SvgText, G } from 'react-native-svg';
import { Colors, FontSize } from '../../constants/theme';
import { OHLCBar } from '../../types';

const MA5_COLOR  = '#FF9F0A';
const MA25_COLOR = '#BF5AF2';
const GRID_COLOR = '#2C2C2E';
const AXIS_W     = 56;  // right price axis width
const PL         = 2;
const PT         = 8;
const DATE_H     = 18;
const VOL_H      = 40;
const VOL_GAP    = 6;

function calcMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    return closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

function fmtPrice(p: number): string {
  if (p >= 1000) return Math.round(p).toLocaleString('ja-JP');
  return p.toFixed(p < 10 ? 2 : 1);
}

interface Props {
  data: OHLCBar[];
  width: number;
  height?: number;
}

export function CandlestickChart({ data, width, height = 300 }: Props) {
  const chartH = height - PT - VOL_H - VOL_GAP - DATE_H;
  const chartW = width - PL - AXIS_W;

  const { minP, maxP, rangeP } = useMemo(() => {
    if (!data.length) return { minP: 0, maxP: 1, rangeP: 1 };
    const lows  = data.map(d => d.low);
    const highs = data.map(d => d.high);
    const mn = Math.min(...lows);
    const mx = Math.max(...highs);
    const pad = (mx - mn) * 0.07 || mx * 0.01 || 1;
    return { minP: mn - pad, maxP: mx + pad, rangeP: mx - mn + pad * 2 };
  }, [data]);

  const maxVol = useMemo(() => Math.max(...data.map(d => d.volume || 0), 1), [data]);

  const getY = (p: number) =>
    PT + chartH - ((p - minP) / rangeP) * chartH;

  const spacing = chartW / Math.max(data.length, 1);
  const candleW = Math.max(spacing * 0.7, 1.5);
  const getX    = (i: number) => PL + (i + 0.5) * spacing;

  const closes = useMemo(() => data.map(d => d.close), [data]);
  const ma5    = useMemo(() => calcMA(closes, 5),  [closes]);
  const ma25   = useMemo(() => calcMA(closes, 25), [closes]);

  // Build SVG path for an MA series (handles nulls by lifting pen)
  const maPath = (ma: (number | null)[]): string => {
    let d = '';
    for (let i = 0; i < ma.length; i++) {
      if (ma[i] === null) continue;
      const cmd = (i === 0 || ma[i - 1] === null) ? 'M' : 'L';
      d += `${cmd}${getX(i).toFixed(1)},${getY(ma[i]!).toFixed(1)} `;
    }
    return d.trim();
  };

  // 4 horizontal grid lines
  const gridPrices = Array.from({ length: 4 }, (_, i) =>
    minP + (rangeP * i) / 3
  );

  const xInterval = Math.max(1, Math.floor(data.length / 5));
  const currentPrice = data.length ? data[data.length - 1].close : null;
  const currentY     = currentPrice !== null ? getY(currentPrice) : null;
  const volY0        = PT + chartH + VOL_GAP;

  if (!data.length) {
    return (
      <View style={[{ width, height }, styles.empty]}>
        <Text style={styles.emptyText}>取得中...</Text>
      </View>
    );
  }

  return (
    <View>
      <Svg width={width} height={height}>

        {/* ── Grid lines ── */}
        {gridPrices.map((p, i) => (
          <Line
            key={i}
            x1={PL} y1={getY(p)} x2={PL + chartW} y2={getY(p)}
            stroke={GRID_COLOR} strokeWidth={0.5}
          />
        ))}

        {/* ── Volume separator ── */}
        <Line
          x1={PL} y1={volY0} x2={PL + chartW} y2={volY0}
          stroke={GRID_COLOR} strokeWidth={0.5}
        />

        {/* ── Volume bars ── */}
        {data.map((d, i) => {
          const barH = ((d.volume || 0) / maxVol) * VOL_H;
          return (
            <Rect
              key={i}
              x={getX(i) - candleW / 2}
              y={volY0 + VOL_H - barH}
              width={candleW}
              height={Math.max(barH, 1)}
              fill={d.close >= d.open ? Colors.positive : Colors.negative}
              opacity={0.55}
            />
          );
        })}

        {/* ── Candlesticks ── */}
        {data.map((d, i) => {
          const cx    = getX(i);
          const isUp  = d.close >= d.open;
          const color = isUp ? Colors.positive : Colors.negative;
          const bTop  = getY(Math.max(d.open, d.close));
          const bBot  = getY(Math.min(d.open, d.close));
          const bH    = Math.max(bBot - bTop, 1);
          return (
            <G key={i}>
              <Line x1={cx} y1={getY(d.high)} x2={cx} y2={getY(d.low)}
                stroke={color} strokeWidth={1} />
              <Rect x={cx - candleW / 2} y={bTop} width={candleW} height={bH}
                fill={color} />
            </G>
          );
        })}

        {/* ── MA lines ── */}
        {ma5.some(v => v !== null) && (
          <Path d={maPath(ma5)} fill="none" stroke={MA5_COLOR} strokeWidth={1.2} />
        )}
        {ma25.some(v => v !== null) && (
          <Path d={maPath(ma25)} fill="none" stroke={MA25_COLOR} strokeWidth={1.2} />
        )}

        {/* ── Current price dashed line ── */}
        {currentY !== null && (
          <Line
            x1={PL} y1={currentY} x2={PL + chartW} y2={currentY}
            stroke={Colors.textSecondary} strokeWidth={0.6} strokeDasharray="4,3"
          />
        )}

        {/* ── Right price axis labels ── */}
        {gridPrices.map((p, i) => (
          <SvgText
            key={i}
            x={PL + chartW + 4}
            y={getY(p) + 3.5}
            fontSize={9}
            fill={Colors.textTertiary}
          >
            {fmtPrice(p)}
          </SvgText>
        ))}

        {/* ── Current price highlight on axis ── */}
        {currentY !== null && currentPrice !== null && (
          <G>
            <Rect
              x={PL + chartW + 2} y={currentY - 8}
              width={AXIS_W - 4} height={16}
              fill={Colors.textSecondary} rx={2}
            />
            <SvgText
              x={PL + chartW + AXIS_W / 2 + 1}
              y={currentY + 3.5}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill={Colors.background}
            >
              {fmtPrice(currentPrice)}
            </SvgText>
          </G>
        )}

        {/* ── X-axis date labels ── */}
        {data.map((d, i) => {
          if (i % xInterval !== 0) return null;
          return (
            <SvgText
              key={i}
              x={getX(i)} y={height - 3}
              textAnchor="middle" fontSize={8} fill={Colors.textTertiary}
            >
              {d.date}
            </SvgText>
          );
        })}

      </Svg>

      {/* MA legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: MA5_COLOR }]} />
          <Text style={styles.legendText}>MA5</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: MA25_COLOR }]} />
          <Text style={styles.legendText}>MA25</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty:      { justifyContent: 'center', alignItems: 'center' },
  emptyText:  { fontSize: FontSize.sm, color: Colors.textTertiary },
  legend:     { flexDirection: 'row', gap: 12, paddingHorizontal: 4, paddingTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  legendText: { fontSize: 10, color: Colors.textTertiary },
});
