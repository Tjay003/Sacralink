import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  Church,
  Cross,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { handleAuthUrlSession } from '@/lib/authUrl';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        // 1. Check existing session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          if (isMounted) {
            setHasValidSession(true);
            setIsCheckingSession(false);
          }
          return;
        }

        // 2. Check if URL contains recovery tokens/code
        const initialUrl = await Linking.getInitialURL();
        let targetUrl = initialUrl;

        if (!targetUrl && (params?.code || params?.access_token)) {
          targetUrl = Linking.createURL('reset-password', {
            queryParams: params as Record<string, string>,
          });
        }

        if (targetUrl) {
          const authResult = await handleAuthUrlSession(targetUrl);
          if (authResult.success && authResult.session) {
            if (isMounted) {
              setHasValidSession(true);
              setIsCheckingSession(false);
            }
            return;
          }
        }

        // If no session found
        if (isMounted) {
          setHasValidSession(false);
          setIsCheckingSession(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setHasValidSession(false);
          setIsCheckingSession(false);
          setErrorMessage(err?.message || 'Failed to verify password reset session.');
        }
      }
    };

    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (!isMounted) return;
      try {
        const authResult = await handleAuthUrlSession(url);
        if (authResult.success && authResult.session) {
          setHasValidSession(true);
          setErrorMessage(null);
        }
      } catch {
        // ignore
      }
    });

    void verifySession();

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, []);

  const validate = (): boolean => {
    if (!password) {
      setErrorMessage('Please enter your new password.');
      return false;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return false;
    }
    if (!confirmPassword) {
      setErrorMessage('Please confirm your new password.');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify and try again.');
      return false;
    }
    return true;
  };

  const handleUpdatePassword = async () => {
    setErrorMessage(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) throw error;

      // Log out of the recovery session so the user signs in fresh
      await supabase.auth.signOut().catch(() => {});

      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Failed to update password. Your reset link may have expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center px-6">
        <ActivityIndicator size="large" color="#2563EB" className="mb-4" />
        <Text className="text-base font-semibold text-slate-800 font-sans">
          Verifying security link...
        </Text>
      </SafeAreaView>
    );
  }

  if (isSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 px-6 justify-center items-center">
          <View className="w-20 h-20 rounded-3xl bg-emerald-100 items-center justify-center mb-6 shadow-sm">
            <CheckCircle2 size={40} color="#10B981" />
          </View>

          <View className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm shadow-slate-200 w-full items-center text-center">
            <Text className="text-2xl font-bold text-slate-900 font-heading text-center mb-2">
              Password Reset Complete
            </Text>
            <Text className="text-sm text-slate-600 font-sans text-center leading-relaxed mb-6">
              Your password has been successfully updated. You can now sign in with your new credentials.
            </Text>

            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              className="w-full bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row space-x-2"
            >
              <Text className="text-sm font-bold text-white font-sans">
                Continue to Sign In
              </Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 40,
            flexGrow: 1,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Brand */}
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
            <Text className="text-sm text-slate-500 mt-1 text-center font-sans">
              Create New Password
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm shadow-slate-200">
            <View className="flex-row items-center space-x-2 mb-1">
              <KeyRound size={20} color="#2563EB" />
              <Text className="text-xl font-bold text-slate-900 font-heading">
                Set New Password
              </Text>
            </View>
            <Text className="text-xs text-slate-500 mb-6 font-sans">
              Please enter and confirm your new secure account password below.
            </Text>

            {/* Invalid or Expired Session Warning */}
            {!hasValidSession && (
              <View className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-5">
                <View className="flex-row items-start space-x-3">
                  <AlertCircle size={20} color="#D97706" className="mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-amber-900 font-heading">
                      Session Expired or Missing
                    </Text>
                    <Text className="text-xs text-amber-700 mt-1 leading-relaxed font-sans">
                      Your reset link may have expired or is invalid. If updating fails, please request a new reset link.
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.replace('/(auth)/forgot-password')}
                      className="mt-3 bg-amber-500 active:bg-amber-600 py-2 px-3 rounded-xl self-start"
                    >
                      <Text className="text-xs font-bold text-white font-sans">
                        Request New Link
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Error Message */}
            {errorMessage && (
              <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-5 flex-row items-start space-x-3">
                <AlertCircle size={20} color="#E11D48" className="mt-0.5" />
                <Text className="flex-1 text-xs text-rose-700 font-sans leading-relaxed">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* New Password Field */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-700 mb-1.5 font-sans">
                New Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 focus:border-blue-600">
                <Lock size={18} color="#64748B" />
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 ml-2.5 text-sm text-slate-900 font-sans"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#64748B" />
                  ) : (
                    <Eye size={18} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Field */}
            <View className="mb-6">
              <Text className="text-xs font-semibold text-slate-700 mb-1.5 font-sans">
                Confirm New Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 focus:border-blue-600">
                <Lock size={18} color="#64748B" />
                <TextInput
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 ml-2.5 text-sm text-slate-900 font-sans"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color="#64748B" />
                  ) : (
                    <Eye size={18} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleUpdatePassword}
              disabled={isLoading}
              className="bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row space-x-2"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-sm font-bold text-white font-sans">
                    Update Password
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Back to Login */}
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            className="flex-row justify-center items-center mt-6 space-x-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={16} color="#64748B" />
            <Text className="text-sm font-medium text-slate-600 font-sans">
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
