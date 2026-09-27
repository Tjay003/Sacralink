import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Church, Cross, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { handleAuthUrlSession, parseAuthUrl } from '@/lib/authUrl';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const navigateToRoleRoute = async (userId: string) => {
      try {
        let role = profile?.role;
        if (!role) {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
          role = data?.role;
        }

        if (!isMounted) return;

        if (role === 'priest') {
          router.replace('/(tabs)/priest');
        } else if (role === 'admin' || (role as string) === 'church_admin') {
          router.replace('/(tabs)/admin');
        } else if (role === 'super_admin') {
          router.replace('/(tabs)/super-admin');
        } else {
          router.replace('/(tabs)/explore');
        }
      } catch {
        if (isMounted) {
          router.replace('/(tabs)/explore');
        }
      }
    };

    const processAuth = async () => {
      try {
        // 1. Check if a session already exists
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          setStatus('success');
          await navigateToRoleRoute(sessionData.session.user.id);
          return;
        }

        // 2. Check for URL from Linking.getInitialURL() or current location
        const initialUrl = await Linking.getInitialURL();
        let targetUrl = initialUrl;

        // If local params exist (e.g. passed through Expo Router query params)
        if (!targetUrl && (params?.code || params?.access_token)) {
          targetUrl = Linking.createURL('auth/callback', { queryParams: params as Record<string, string> });
        }

        if (targetUrl) {
          const authResult = await handleAuthUrlSession(targetUrl);
          if (!isMounted) return;

          if (authResult.success && authResult.session?.user) {
            if (authResult.params.type === 'recovery') {
              router.replace('/(auth)/reset-password');
              return;
            }
            setStatus('success');
            await navigateToRoleRoute(authResult.session.user.id);
            return;
          }

          if (authResult.error && authResult.params.error) {
            setStatus('error');
            setErrorMessage(authResult.params.errorDescription || authResult.error.message);
            return;
          }
        }

        // 3. Fallback: Wait briefly for AuthProvider's deep link listener to establish session
        let attempts = 0;
        const maxAttempts = 10;
        const interval = setInterval(async () => {
          if (!isMounted) {
            clearInterval(interval);
            return;
          }

          attempts += 1;
          const { data: retrySession } = await supabase.auth.getSession();
          if (retrySession?.session?.user) {
            clearInterval(interval);
            setStatus('success');
            await navigateToRoleRoute(retrySession.session.user.id);
            return;
          }

          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setStatus('error');
            setErrorMessage('Sign in timed out. No valid authentication credentials received.');
          }
        }, 500);

        return () => clearInterval(interval);
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(err?.message || 'Failed to complete sign in. Please try again.');
      }
    };

    // Also listen for incoming URL while on this screen
    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (!isMounted) return;
      try {
        const result = await handleAuthUrlSession(url);
        if (result.success && result.session?.user) {
          if (result.params.type === 'recovery') {
            router.replace('/(auth)/reset-password');
            return;
          }
          setStatus('success');
          await navigateToRoleRoute(result.session.user.id);
        } else if (result.error && result.params.error) {
          setStatus('error');
          setErrorMessage(result.params.errorDescription || result.error.message);
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err?.message || 'Error processing authentication link.');
      }
    });

    void processAuth();

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center px-6">
      {/* Brand Header */}
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-2xl bg-blue-600 items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
          <Church size={32} color="#FFFFFF" />
        </View>
        <View className="flex-row items-center space-x-1.5">
          <Text className="text-3xl font-bold text-slate-900 font-heading">
            SacraLink
          </Text>
          <Cross size={22} color="#F59E0B" />
        </View>
      </View>

      {/* Card Body */}
      <View className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm shadow-slate-200 w-full max-w-sm items-center text-center">
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color="#2563EB" className="mb-4" />
            <Text className="text-xl font-bold text-slate-900 font-heading mb-2 text-center">
              Completing sign in...
            </Text>
            <Text className="text-sm text-slate-500 font-sans text-center leading-relaxed">
              Please wait while we verify your credentials and secure your parish session.
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <ActivityIndicator size="large" color="#2563EB" className="mb-4" />
            <Text className="text-xl font-bold text-slate-900 font-heading mb-2 text-center">
              Sign In Successful
            </Text>
            <Text className="text-sm text-slate-500 font-sans text-center leading-relaxed">
              Redirecting you to SacraLink...
            </Text>
          </>
        )}

        {status === 'error' && (
          <>
            <View className="w-12 h-12 rounded-2xl bg-rose-100 items-center justify-center mb-4">
              <AlertCircle size={28} color="#E11D48" />
            </View>
            <Text className="text-xl font-bold text-slate-900 font-heading mb-2 text-center">
              Sign In Failed
            </Text>
            <Text className="text-sm text-rose-600 font-sans text-center leading-relaxed mb-6">
              {errorMessage || 'Unable to authenticate. The session may have expired.'}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              className="w-full bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row space-x-2"
            >
              <ArrowLeft size={16} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white font-sans">
                Return to Login
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
