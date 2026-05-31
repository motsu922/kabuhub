import { Tabs } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';

export const FLOATING_TAB_BAR_HEIGHT = 110;

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 0,
          letterSpacing: -0.2,
        },
        tabBarItemStyle: {
          paddingTop: 10,
          paddingBottom: 8,
        },
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
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'ホーム',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          tabBarLabel: 'リスト',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="articles"
        options={{
          tabBarLabel: '抽出',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'funnel' : 'funnel-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: '設定',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({});
