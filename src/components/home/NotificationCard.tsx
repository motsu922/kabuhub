import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Notification } from '../../types';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const TYPE_CONFIG = {
  dip:         { label: '押し目候補', color: Colors.statusWatch },
  surge:       { label: '急騰',       color: Colors.positive },
  plunge:      { label: '急落',       color: Colors.negative },
  volume:      { label: '出来高増加', color: Colors.statusAlert },
  highApproach:{ label: '高値接近',  color: Colors.statusWatch },
  lowApproach: { label: '安値接近',  color: Colors.statusAlert },
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

interface Props {
  notification: Notification;
  onPress?: () => void;
}

export function NotificationCard({ notification, onPress }: Props) {
  const config = TYPE_CONFIG[notification.type];
  return (
    <TouchableOpacity
      style={[styles.card, !notification.isRead && styles.unread]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <View style={[styles.tag, { backgroundColor: config.color + '20' }]}>
          <Text style={[styles.tagText, { color: config.color }]}>{config.label}</Text>
        </View>
        <Text style={styles.time}>{timeAgo(notification.createdAt)}</Text>
      </View>
      <Text style={styles.stockName}>{notification.stockName}</Text>
      <Text style={styles.message}>{notification.message}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 4,
  },
  unread: {
    borderColor: Colors.primary + '40',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  stockName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
});
