import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OnboardingOverlay } from '@/components/onboarding-overlay';
import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { flushPendingQueue } from '@/lib/entries';

SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = 'worksite-diary.hasSeenOnboarding';

function RootNavigator() {
  const { session, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!session) return;
    flushPendingQueue().catch(() => {});
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) flushPendingQueue().catch(() => {});
    });
    return unsubscribe;
  }, [session]);

  useEffect(() => {
    if (!session) return;
    AsyncStorage.getItem(ONBOARDING_KEY).then((seen) => {
      if (!seen) setShowOnboarding(true);
    });
  }, [session]);

  function finishOnboarding() {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
    setShowOnboarding(false);
  }

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="entry/[id]/index" options={{ headerShown: false }} />
          <Stack.Screen name="entry/[id]/edit" options={{ headerShown: false }} />
          <Stack.Screen name="summary" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>

      <Modal visible={showOnboarding} animationType="slide" presentationStyle="fullScreen">
        <OnboardingOverlay onDone={finishOnboarding} />
      </Modal>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
