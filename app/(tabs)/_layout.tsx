import { Tabs } from 'expo-router';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FontSize } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';

const TAB_ICONS = {
  index:     require('../../assets/icons/tab-home.png'),
  watchlist: require('../../assets/icons/tab-watchlist.png'),
  articles:  require('../../assets/icons/tab-extract.png'),
  settings:  require('../../assets/icons/tab-settings.png'),
} as const;

type TabName = keyof typeof TAB_ICONS;

function TabIcon({ name, label, focused }: { name: TabName; label: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.tabItem}>
      <View style={[styles.pill, focused && { backgroundColor: colors.primaryMuted }]}>
        <Image
          source={TAB_ICONS[name]}
          style={[styles.icon, { tintColor: focused ? colors.primary : colors.textTertiary }]}
        />
      </View>
      <Text style={[styles.label, { color: focused ? colors.primary : colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          borderTopWidth: 0.5,
          height: 72,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="index" label="ホーム" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="watchlist" label="ウォッチ" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="articles"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="articles" label="抽出" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="settings" label="設定" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    gap: 2,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  icon: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    width: 52,
    textAlign: 'center',
  },
});
