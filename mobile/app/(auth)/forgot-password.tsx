import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import {
  Church,
  Cross,
  Mail,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  MailCheck,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (): boolean => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    setErrorMessage(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'sacralink://reset-password',
      });
      if (error) throw error;
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send password reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 px-6 justify-center items-center">
          <View className="w-20 h-20 rounded-3xl bg-blue-100 items-center justify-center mb-6 shadow-sm">
            <MailCheck size={40} color="#2563EB" />
          </View>

          <View className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm w-full items-center text-center">
            <Text className="text-2xl font-bold text-slate-900 font-heading text-center mb-2">
              Reset Link Sent
            </Text>
            <Text className="text-sm text-slate-600 font-sans text-center leading-relaxed mb-4">
              We've emailed instructions to reset your password to:
            </Text>
            <View className="bg-slate-100 px-4 py-2 rounded-xl mb-4">
              <Text className="text-sm font-semibold text-slate-800 font-sans">
                {email}
              </Text>
            </View>
            <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed mb-6">
              Follow the instructions in the email to set a new password, then return to sign in.
            </Text>

            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              className="w-full bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row space-x-2"
            >
              <Text className="text-sm font-bold text-white font-sans">
                Return to Login
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
              Password Recovery
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm shadow-slate-200">
            <Text className="text-xl font-bold text-slate-900 font-heading mb-1">
              Reset Your Password
            </Text>
            <Text className="text-xs text-slate-500 mb-6 font-sans">
              Enter your email address and we'll send you a link to reset your account password.
            </Text>

            {/* Error Message */}
            {errorMessage && (
              <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-5 flex-row items-start space-x-3">
                <AlertCircle size={20} color="#E11D48" className="mt-0.5" />
                <Text className="flex-1 text-xs text-rose-700 font-sans leading-relaxed">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Email Field */}
            <View className="mb-5">
              <Text className="text-xs font-semibold text-slate-700 mb-1.5 font-sans">
                Registered Email Address
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 focus:border-blue-600">
                <Mail size={18} color="#64748B" />
                <TextInput
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="parishioner@sacralink.org"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  className="flex-1 ml-2.5 text-sm text-slate-900 font-sans"
                />
              </View>
            </View>

            {/* Send Reset Link Button */}
            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={isLoading}
              className="bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row space-x-2"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-sm font-bold text-white font-sans">
                    Send Reset Link
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Back to Login */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row justify-center items-center mt-6 space-x-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={16} color="#64748B" />
            <Text className="text-sm font-medium text-slate-600 font-sans">
              Back to Login
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
