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
  chartWidth: number;
  chartHeight: number;
}

const LANES    = 4;
const DURATION = 7000;
const MAX      = 8;

export function CommentOverlay({ comments, chartWidth, chartHeight }: Props) {
  const [active, setActive] = useState<ActiveComment[]>([]);
  const laneTimes = useRef<number[]>(new Array(LANES).fill(0));
  const seenIds   = useRef(new Set<string>());

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

    setActive((prev) => {
      if (prev.length >= MAX) return prev;

      const newItems: ActiveComment[] = [];
      for (const c of comments) {
        if (seenIds.current.has(c.id)) continue;
        if (prev.length + newItems.length >= MAX) break;
        seenIds.current.add(c.id);

        const anim = new Animated.Value(chartWidth + 10);
        const lane = getLane();
        newItems.push({ id: c.id, text: c.text, lane, anim });

        Animated.timing(anim, {
          toValue: -280,
          duration: DURATION,
          useNativeDriver: true,
        }).start(() => {
          setActive((a) => a.filter((x) => x.id !== c.id));
        });
      }

      return [...prev, ...newItems];
    });
  }, [comments, chartWidth, getLane]);

  const laneY = (lane: number): number => {
    const pad = chartHeight * 0.12;
    return pad + (lane / (LANES - 1)) * (chartHeight - pad * 2);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      {active.map((c) => (
        <Animated.Text
          key={c.id}
          style={[
            styles.comment,
            { top: laneY(c.lane) - 8, transform: [{ translateX: c.anim }] },
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
