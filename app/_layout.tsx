import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider } from 'expo-share-intent';
import { Colors } from '../src/constants/theme';
import { RemoteLinkConfig } from '../src/services/remoteLinkConfig';

export default function RootLayout() {
  useEffect(() => { RemoteLinkConfig.init(); }, []);

  return (
    <ShareIntentProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="stock/[code]" options={{ headerShown: false }} />
      </Stack>
    </ShareIntentProvider>
  );
}
