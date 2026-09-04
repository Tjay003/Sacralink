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
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  MailCheck,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

interface PasswordCriteria {
  label: string;
  met: boolean;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Password strength evaluation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const criteria: PasswordCriteria[] = [
    { label: '8+ characters', met: hasMinLength },
    { label: 'Uppercase (A-Z)', met: hasUppercase },
    { label: 'Lowercase (a-z)', met: hasLowercase },
    { label: 'Number (0-9)', met: hasNumber },
    { label: 'Special symbol', met: hasSpecialChar },
  ];

  const metCount = criteria.filter((c) => c.met).length;

  let strengthLabel = 'Weak';
  let strengthColor = 'bg-rose-500';
  let strengthTextColor = 'text-rose-600';
  let barWidth = '20%';

  if (metCount === 0) {
    strengthLabel = 'Empty';
    strengthColor = 'bg-slate-200';
    strengthTextColor = 'text-slate-400';
    barWidth = '0%';
  } else if (metCount <= 2) {
    strengthLabel = 'Weak';
    strengthColor = 'bg-rose-500';
    strengthTextColor = 'text-rose-600';
    barWidth = '25%';
  } else if (metCount === 3 || metCount === 4) {
    strengthLabel = 'Medium';
    strengthColor = 'bg-amber-500';
    strengthTextColor = 'text-amber-600';
    barWidth = '65%';
  } else if (metCount === 5) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-500';
    strengthTextColor = 'text-emerald-600';
    barWidth = '100%';
  }

  const validate = (): boolean => {
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full legal name.');
      return false;
    }
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    if (metCount < 3) {
      setErrorMessage('Please create a stronger password meeting at least 3 criteria.');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    setErrorMessage(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      await signUp(email.trim(), password, fullName.trim());
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success State View
  if (isSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 px-6 justify-center items-center">
          <View className="w-20 h-20 rounded-3xl bg-emerald-100 items-center justify-center mb-6 shadow-sm">
            <MailCheck size={40} color="#059669" />
          </View>

          <View className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm w-full items-center text-center">
            <Text className="text-2xl font-bold text-slate-900 font-heading text-center mb-2">
              Account Created!
            </Text>
            <Text className="text-sm text-slate-600 font-sans text-center leading-relaxed mb-4">
              We have sent a confirmation link to:
            </Text>
            <View className="bg-slate-100 px-4 py-2 rounded-xl mb-4">
              <Text className="text-sm font-semibold text-slate-800 font-sans">
                {email}
              </Text>
            </View>
            <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed mb-6">
              Please check your email and click the confirmation link to verify your account before logging in.
            </Text>

            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              className="w-full bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row space-x-2"
            >
              <Text className="text-sm font-bold text-white font-sans">
                Back to Login
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
            paddingTop: 24,
            paddingBottom: 40,
            flexGrow: 1,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Brand */}
          <View className="items-center mb-6">
            <View className="w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center shadow-md shadow-blue-500/30 mb-2">
              <Church size={28} color="#FFFFFF" />
            </View>
            <View className="flex-row items-center space-x-1.5">
              <Text className="text-2xl font-bold text-slate-900 font-heading">
                Join SacraLink
              </Text>
              <Cross size={20} color="#F59E0B" />
            </View>
            <Text className="text-xs text-slate-500 mt-0.5 text-center font-sans">
              Create your account to schedule sacraments and connect with your parish
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm shadow-slate-200">
            <Text className="text-lg font-bold text-slate-900 font-heading mb-1">
              Parishioner Registration
            </Text>
            <Text className="text-xs text-slate-500 mb-5 font-sans">
              Enter your details to create your verified account
            </Text>

            {/* Error Message */}
            {errorMessage && (
              <View className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 mb-4 flex-row items-start space-x-2.5">
                <AlertCircle size={18} color="#E11D48" className="mt-0.5" />
                <Text className="flex-1 text-xs text-rose-700 font-sans leading-relaxed">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Full Name Field */}
            <View className="mb-3.5">
              <Text className="text-xs font-semibold text-slate-700 mb-1 font-sans">
                Full Name
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 focus:border-blue-600">
                <User size={18} color="#64748B" />
                <TextInput
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. Maria Santos"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                  className="flex-1 ml-2.5 text-sm text-slate-900 font-sans"
                />
              </View>
            </View>

            {/* Email Field */}
            <View className="mb-3.5">
              <Text className="text-xs font-semibold text-slate-700 mb-1 font-sans">
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
            <View className="mb-3">
              <Text className="text-xs font-semibold text-slate-700 mb-1 font-sans">
                Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 focus:border-blue-600">
                <Lock size={18} color="#64748B" />
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Create a secure password"
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

            {/* Dynamic Password Strength Meter */}
            {password.length > 0 && (
              <View className="bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-3.5">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="flex-row items-center space-x-1">
                    <Sparkles size={14} color="#64748B" />
                    <Text className="text-[11px] font-semibold text-slate-600 font-sans">
                      Password Strength:
                    </Text>
                  </View>
                  <Text className={`text-[11px] font-bold font-sans ${strengthTextColor}`}>
                    {strengthLabel}
                  </Text>
                </View>

                {/* Strength Meter Bar */}
                <View className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mb-2.5">
                  <View
                    style={{ width: barWidth as any }}
                    className={`h-full ${strengthColor} rounded-full`}
                  />
                </View>

                {/* Criteria Checklist Chips */}
                <View className="flex-row flex-wrap gap-1.5">
                  {criteria.map((c) => (
                    <View
                      key={c.label}
                      className={`flex-row items-center space-x-1 px-2 py-0.5 rounded-full border ${
                        c.met
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <CheckCircle2
                        size={12}
                        color={c.met ? '#10B981' : '#94A3B8'}
                      />
                      <Text
                        className={`text-[10px] font-sans ${
                          c.met ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {c.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Confirm Password Field */}
            <View className="mb-5">
              <Text className="text-xs font-semibold text-slate-700 mb-1 font-sans">
                Confirm Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 focus:border-blue-600">
                <Lock size={18} color="#64748B" />
                <TextInput
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Repeat your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
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

            {/* Create Account Submit Button */}
            <TouchableOpacity
              onPress={handleSignUp}
              disabled={isLoading}
              className="bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row space-x-2"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-sm font-bold text-white font-sans">
                    Create Account
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Link to Login */}
          <View className="flex-row justify-center items-center mt-6 space-x-1.5">
            <Text className="text-sm text-slate-500 font-sans">
              Already have an account?
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/login')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text className="text-sm font-bold text-blue-600 font-sans">
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
