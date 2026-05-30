import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Path, Line, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  showArea?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
}

export function MiniChart({
  data,
  width = 60,
  height = 28,
  positive,
  showArea = false,
  showGrid = false,
  showLabels = false,
}: Props) {
  const { colors } = useTheme();
  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const paddingLeft = showLabels ? 38 : 0;
  const paddingTop = 4;
  const paddingBottom = 4;
  const chartWidth = width - paddingLeft;
  const chartHeight = height - paddingTop - paddingBottom;
  const step = chartWidth / (data.length - 1);

  const getX = (i: number) => paddingLeft + i * step;
  const getY = (v: number) => paddingTop + chartHeight - ((v - min) / range) * chartHeight;

  const points = data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

  const isUp = data[data.length - 1] >= data[0];
  const color =
    positive !== undefined
      ? positive ? colors.positive : colors.negative
      : isUp ? colors.positive : colors.negative;

  const gradId = `g${Math.abs(data[0]) % 9999}`;

  const areaPath =
    `M${getX(0)},${getY(data[0])} ` +
    data.map((v, i) => `L${getX(i)},${getY(v)}`).join(' ') +
    ` L${getX(data.length - 1)},${paddingTop + chartHeight}` +
    ` L${getX(0)},${paddingTop + chartHeight} Z`;

  const gridRatios = showGrid ? [0, 0.5, 1] : [];

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {showArea && (
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.3} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
        )}

        {gridRatios.map((ratio, i) => {
          const y = paddingTop + chartHeight * ratio;
          const price = max - ratio * range;
          const label =
            price >= 10000
              ? `${(price / 1000).toFixed(0)}K`
              : price >= 1000
              ? `${(price / 1000).toFixed(1)}K`
              : price.toFixed(0);
          return (
            <React.Fragment key={i}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={width}
                y2={y}
                stroke={colors.cardBorder}
                strokeWidth={0.5}
                strokeDasharray="3,3"
              />
              {showLabels && (
                <SvgText
                  x={paddingLeft - 4}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={8}
                  fill={colors.textTertiary}
                >
                  {label}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}

        {showArea && <Path d={areaPath} fill={`url(#${gradId})`} />}

        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
