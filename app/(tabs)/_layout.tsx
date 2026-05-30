import { Tabs } from 'expo-router';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { FontSize } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';

// スクリーンのスクロールコンテンツがタブバーに隠れないよう各画面でこの値をpaddingBottomに使う
export const FLOATING_TAB_BAR_HEIGHT = 100;

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
      <Image
        source={TAB_ICONS[name]}
        style={[styles.icon, { tintColor: focused ? colors.primary : colors.textTertiary }]}
      />
      <Text style={[styles.label, { color: focused ? colors.primary : colors.textTertiary }]}>
        {label}
      </Text>
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
          position: 'absolute',
          bottom: 24,
          left: 20,
          right: 20,
          height: 68,
          borderRadius: 28,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          paddingBottom: 0,
          paddingTop: 0,
          // shadow
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.18,
              shadowRadius: 16,
            },
            android: { elevation: 16 },
          }),
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
    gap: 3,
    paddingTop: 4,
  },
  icon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
