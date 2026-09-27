import '../global.css';
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Prevent splash screen from auto-hiding until fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function RootNavigation() {
  const { session, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const segmentList = segments as string[];
    const inAuthGroup = segmentList[0] === '(auth)' || segmentList[0] === 'auth';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Do not auto-redirect away if user is on the password reset screen or processing auth callback
      const isResetPassword = inAuthGroup && segmentList[1] === 'reset-password';
      const isCallback =
        (inAuthGroup && segmentList[1] === 'callback') ||
        (segmentList[0] === 'auth' && segmentList[1] === 'callback');

      if (isResetPassword || isCallback) {
        return;
      }

      // If user has session, but profile is null AND profileError exists:
      // A network failure occurred and no cached profile was found.
      // Do NOT default role to 'user' and demote priest/admin to parishioner!
      if (!profile && profileError) {
        return;
      }

      if (inAuthGroup || segmentList.length === 0 || segmentList[0] === 'index') {
        const role = profile?.role || 'user';
        if (role === 'priest') {
          router.replace('/(tabs)/priest');
        } else if (role === 'admin' || (role as string) === 'church_admin') {
          router.replace('/(tabs)/admin');
        } else if (role === 'super_admin') {
          router.replace('/(tabs)/super-admin');
        } else {
          router.replace('/(tabs)/explore');
        }
      }
    }
  }, [session, profile?.role, profileError, loading, segments, router]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // If user is authenticated but profile completely failed to load with no local cache
  if (session && !profile && profileError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <View className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 items-center justify-center mb-4">
          <ActivityIndicator size="small" color="#D97706" />
        </View>
        <Text className="text-lg font-bold text-foreground text-center mb-2 font-sans">
          Unable to Verify Permissions
        </Text>
        <Text className="text-xs text-muted text-center mb-6 leading-relaxed font-sans">
          A network disruption prevented retrieving your parish account role. Please check your internet connection and retry.
        </Text>
        <View className="w-full max-w-xs space-y-3">
          <TouchableOpacity
            onPress={() => refreshProfile()}
            className="bg-primary active:bg-blue-700 py-3.5 px-4 rounded-xl flex-row items-center justify-center mb-2"
          >
            <Text className="text-xs font-bold text-white font-sans">Retry Connection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => signOut()}
            className="bg-white border border-border py-3.5 px-4 rounded-xl flex-row items-center justify-center"
          >
            <Text className="text-xs font-semibold text-secondary-700 font-sans">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="church/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="appointments/book" options={{ headerShown: false }} />
      <Stack.Screen name="donations/give" options={{ headerShown: false }} />
      <Stack.Screen name="messages/[conversationId]" options={{ headerShown: false }} />
      <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 1200);

    if (fontsLoaded || fontError) {
      setIsReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
