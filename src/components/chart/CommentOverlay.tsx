import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Animated, StyleSheet, Text } from 'react-native';
import { CommentDoc, CommentMode } from '../../services/commentService';

interface ActiveComment {
  id: string;
  text: string;
  lane: number;
  anim: Animated.Value;
}

interface Props {
  comments: CommentDoc[];
  mode: Exclude<CommentMode, 'OFF'>;
  chartWidth: number;
  chartHeight: number;
}

const LANES      = 4;
const DUR_LIVE   = 7000;
const DUR_LIGHT  = 10000;
const MAX_LIVE   = 8;
const MAX_LIGHT  = 4;

export function CommentOverlay({ comments, mode, chartWidth, chartHeight }: Props) {
  const [active, setActive] = useState<ActiveComment[]>([]);
  const laneTimes   = useRef<number[]>(new Array(LANES).fill(0));
  const seenIds     = useRef(new Set<string>());

  const getLane = useCallback((): number => {
    let best = 0;
    for (let i = 1; i < LANES; i++) {
      if (laneTimes.current[i] < laneTimes.current[best]) best = i;
    }
    laneTimes.current[best] = Date.now();
    return best;
  }, []);

  useEffect(() => {
    if (!comments.length) return;

    const duration = mode === 'LIVE' ? DUR_LIVE : DUR_LIGHT;
    const maxActive = mode === 'LIVE' ? MAX_LIVE : MAX_LIGHT;

    // LIGHT は半数だけ表示
    const candidates = mode === 'LIGHT'
      ? comments.filter((_, i) => i % 2 === 0)
      : comments;

    setActive((prev) => {
      if (prev.length >= maxActive) return prev;

      const newItems: ActiveComment[] = [];
      for (const c of candidates) {
        if (seenIds.current.has(c.id)) continue;
        if (prev.length + newItems.length >= maxActive) break;
        seenIds.current.add(c.id);

        const anim = new Animated.Value(chartWidth + 10);
        const lane = getLane();
        newItems.push({ id: c.id, text: c.text, lane, anim });

        Animated.timing(anim, {
          toValue: -280,
          duration,
          useNativeDriver: true,
        }).start(() => {
          setActive((a) => a.filter((x) => x.id !== c.id));
        });
      }

      return [...prev, ...newItems];
    });
  }, [comments, mode, chartWidth, getLane]);

  const laneY = (lane: number): number => {
    const pad = chartHeight * 0.12;
    return pad + (lane / (LANES - 1)) * (chartHeight - pad * 2);
  };

  const opacity = mode === 'LIGHT' ? 0.55 : 0.88;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      {active.map((c) => (
        <Animated.Text
          key={c.id}
          style={[
            styles.comment,
            { top: laneY(c.lane) - 8, opacity, transform: [{ translateX: c.anim }] },
          ]}
          numberOfLines={1}
        >
          {c.text.length > 22 ? c.text.slice(0, 22) + '…' : c.text}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  comment: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
});
