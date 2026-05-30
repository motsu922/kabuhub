import React from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { BorderRadius, Spacing } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

export function SkeletonCard() {
  const { colors } = useTheme();
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
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.cardBorder }]} />
      <Animated.View style={[styles.content, { opacity }]}>
        <View style={styles.left}>
          <View style={[styles.bone, { width: '62%', height: 14, backgroundColor: colors.cardBorder }]} />
          <View style={[styles.bone, { width: '22%', height: 10, marginTop: 3, backgroundColor: colors.cardBorder }]} />
          <View style={[styles.bone, { width: '48%', height: 18, marginTop: 5, backgroundColor: colors.cardBorder }]} />
          <View style={[styles.bone, { width: '30%', height: 10, marginTop: 3, backgroundColor: colors.cardBorder }]} />
        </View>
        <View style={styles.right}>
          <View style={[styles.bone, { width: 68, height: 36, borderRadius: 6, backgroundColor: colors.cardBorder }]} />
          <View style={[styles.bone, { width: 32, height: 10, marginTop: 3, backgroundColor: colors.cardBorder }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    overflow: 'hidden',
    height: 92,
  },
  accentBar: { width: 3 },
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
  bone: { borderRadius: 4 },
});
