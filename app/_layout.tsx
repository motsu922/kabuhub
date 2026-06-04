import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import * as Updates from 'expo-updates';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { SettingsProvider } from '../src/contexts/SettingsContext';
import { RemoteLinkConfig } from '../src/services/remoteLinkConfig';

function AppStack() {
  const { theme, colors } = useTheme();
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="stock/[code]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

function ShareIntentRouteHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent } = useShareIntentContext();
  const lastHandled = useRef('');

  useEffect(() => {
    if (!hasShareIntent) return;

    const signature = [
      shareIntent.webUrl ?? '',
      shareIntent.text ?? '',
      shareIntent.files?.map((file) => file.path).join('|') ?? '',
    ].join('\n');

    if (!signature || signature === lastHandled.current) return;
    lastHandled.current = signature;
    router.replace('/(tabs)/articles');
  }, [hasShareIntent, router, shareIntent.files, shareIntent.text, shareIntent.webUrl]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    RemoteLinkConfig.init();
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

    // OTA 自動更新: 開発中は無視。本番では新しいバンドルがあれば即リロード。
    if (!__DEV__) {
      Updates.checkForUpdateAsync()
        .then(({ isAvailable }) => {
          if (isAvailable) {
            return Updates.fetchUpdateAsync().then(() => Updates.reloadAsync());
          }
        })
        .catch(() => {
          // ネットワーク不可・タイムアウト等は無視して既存バンドルで起動
        });
    }
  }, []);

  return (
    <ShareIntentProvider options={{ scheme: 'kabuhub', resetOnBackground: false }}>
      <ThemeProvider>
        <SettingsProvider>
          <ShareIntentRouteHandler />
          <AppStack />
        </SettingsProvider>
      </ThemeProvider>
    </ShareIntentProvider>
  );
}
