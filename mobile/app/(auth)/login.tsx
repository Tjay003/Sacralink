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
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Send,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, resendConfirmationEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

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
    if (!password) {
      setErrorMessage('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleSignIn = async () => {
    setErrorMessage(null);
    setUnconfirmedEmail(null);
    setResendSuccess(false);

    if (!validate()) return;

    setIsLoading(true);
    try {
      await signIn(email.trim(), password);
      // Navigation is handled automatically by auth listener in RootNavigator
    } catch (err: any) {
      const message = err?.message || 'Failed to sign in. Please check your credentials.';
      if (
        message.toLowerCase().includes('email not confirmed') ||
        message.toLowerCase().includes('not confirmed')
      ) {
        setUnconfirmedEmail(email.trim());
        setErrorMessage(null);
      } else if (
        message.toLowerCase().includes('invalid login credentials') ||
        message.toLowerCase().includes('invalid email or password')
      ) {
        setErrorMessage('Invalid email or password. Please try again.');
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setIsResending(true);
    try {
      await resendConfirmationEmail(unconfirmedEmail);
      setResendSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend confirmation email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

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
              Connect to your faith, parish sacraments, and community
            </Text>
          </View>

          {/* Card Container */}
          <View className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm shadow-slate-200">
            <Text className="text-xl font-bold text-slate-900 font-heading mb-1">
              Welcome Back
            </Text>
            <Text className="text-xs text-slate-500 mb-6 font-sans">
              Sign in to manage appointments, donations, and parish duties
            </Text>

            {/* Amber Alert Banner: Email Not Confirmed */}
            {unconfirmedEmail && (
              <View className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-5">
                <View className="flex-row items-start space-x-3">
                  <View className="mt-0.5">
                    <AlertCircle size={20} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-amber-900 font-heading">
                      Email Confirmation Required
                    </Text>
                    <Text className="text-xs text-amber-700 mt-1 leading-relaxed font-sans">
                      Your email <Text className="font-semibold">{unconfirmedEmail}</Text> is not confirmed yet. Please verify your email before logging in.
                    </Text>

                    {resendSuccess ? (
                      <View className="flex-row items-center space-x-1.5 mt-3 bg-amber-100/70 py-1.5 px-3 rounded-lg self-start">
                        <CheckCircle2 size={15} color="#15803D" />
                        <Text className="text-xs font-semibold text-emerald-800 font-sans">
                          Verification email resent! Check your inbox.
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={handleResendConfirmation}
                        disabled={isResending}
                        className="mt-3 bg-amber-500 active:bg-amber-600 py-2 px-3.5 rounded-xl self-start flex-row items-center space-x-2"
                      >
                        {isResending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Send size={14} color="#FFFFFF" />
                            <Text className="text-xs font-bold text-white font-sans">
                              Resend Confirmation Email
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Standard Error Message Banner */}
            {errorMessage && (
              <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-5 flex-row items-start space-x-3">
                <AlertCircle size={20} color="#E11D48" className="mt-0.5" />
                <Text className="flex-1 text-xs text-rose-700 font-sans leading-relaxed">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Email Field */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-700 mb-1.5 font-sans">
                Email Address
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

            {/* Password Field */}
            <View className="mb-2">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-semibold text-slate-700 font-sans">
                  Password
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/forgot-password')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text className="text-xs font-semibold text-blue-600 font-sans">
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 focus:border-blue-600">
                <Lock size={18} color="#64748B" />
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
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

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleSignIn}
              disabled={isLoading}
              className="mt-5 bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row space-x-2"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-sm font-bold text-white font-sans">
                    Sign In to SacraLink
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Social Divider */}
            <View className="flex-row items-center my-5">
              <View className="flex-1 h-[1px] bg-slate-200" />
              <Text className="mx-3 text-xs text-slate-400 font-medium font-sans">
                OR CONTINUE WITH
              </Text>
              <View className="flex-1 h-[1px] bg-slate-200" />
            </View>

            {/* Google OAuth Button */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="bg-white border border-slate-200 active:bg-slate-50 py-3.5 rounded-2xl items-center justify-center flex-row space-x-2.5 shadow-2xs"
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <>
                  <GoogleIcon size={18} />
                  <Text className="text-sm font-semibold text-slate-700 font-sans">
                    Sign in with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Link to Register */}
          <View className="flex-row justify-center items-center mt-6 space-x-1.5">
            <Text className="text-sm text-slate-500 font-sans">
              Don't have an account?
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text className="text-sm font-bold text-blue-600 font-sans">
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
