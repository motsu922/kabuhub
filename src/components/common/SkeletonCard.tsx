import React from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';

export function SkeletonCard() {
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] });

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <Animated.View style={[styles.content, { opacity }]}>
        <View style={styles.left}>
          <View style={[styles.bone, { width: '62%', height: 14 }]} />
          <View style={[styles.bone, { width: '22%', height: 10, marginTop: 3 }]} />
          <View style={[styles.bone, { width: '48%', height: 18, marginTop: 5 }]} />
          <View style={[styles.bone, { width: '30%', height: 10, marginTop: 3 }]} />
        </View>
        <View style={styles.right}>
          <View style={[styles.bone, { width: 68, height: 36, borderRadius: 6 }]} />
          <View style={[styles.bone, { width: 32, height: 10, marginTop: 3 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    height: 92,
  },
  accentBar: {
    width: 3,
    backgroundColor: Colors.cardBorder,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    paddingLeft: Spacing.sm + 2,
  },
  left: { flex: 1, gap: 0 },
  right: { alignItems: 'flex-end', gap: 0, marginLeft: Spacing.md },
  bone: {
    backgroundColor: Colors.cardBorder,
    borderRadius: 4,
  },
});
