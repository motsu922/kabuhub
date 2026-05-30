import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider } from 'expo-share-intent';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
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

export default function RootLayout() {
  useEffect(() => { RemoteLinkConfig.init(); }, []);

  return (
    <ThemeProvider>
      <ShareIntentProvider>
        <AppStack />
      </ShareIntentProvider>
    </ThemeProvider>
  );
}
