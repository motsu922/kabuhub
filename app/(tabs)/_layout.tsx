import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';

export const FLOATING_TAB_BAR_HEIGHT = 110;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<string, { icon: IoniconName; outlineIcon: IoniconName; label: string }> = {
  index:     { icon: 'home',     outlineIcon: 'home-outline',     label: 'ホーム' },
  watchlist: { icon: 'list',     outlineIcon: 'list-outline',     label: 'リスト' },
  articles:  { icon: 'funnel',   outlineIcon: 'funnel-outline',   label: '抽出'   },
  settings:  { icon: 'settings', outlineIcon: 'settings-outline', label: '設定'   },
};

function TabIcon({ tabName, focused }: { tabName: string; focused: boolean }) {
  const { colors } = useTheme();
  const cfg = TAB_CONFIG[tabName];
  if (!cfg) return null;
  const tint = focused ? colors.primary : colors.textTertiary;
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? cfg.icon : cfg.outlineIcon}
        size={26}
        color={tint}
      />
      <Text style={[styles.label, { color: tint }]}>{cfg.label}</Text>
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
          left: 16,
          right: 16,
          height: 76,
          borderRadius: 30,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          paddingBottom: 0,
          paddingTop: 0,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
            },
            android: { elevation: 20 },
          }),
        },
        tabBarBackground: () => (
          <BlurView
            intensity={70}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarItemStyle: {
          height: 76,
          paddingTop: 0,
          paddingBottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon tabName="index" focused={focused} /> }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{ tabBarIcon: ({ focused }) => <TabIcon tabName="watchlist" focused={focused} /> }}
      />
      <Tabs.Screen
        name="market"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="articles"
        options={{ tabBarIcon: ({ focused }) => <TabIcon tabName="articles" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon tabName="settings" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 58,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
