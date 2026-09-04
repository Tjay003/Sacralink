import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  ShieldCheck,
  LogOut,
  KeyRound,
  Smartphone,
  CheckCircle2,
  Lock,
  Bell,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import { NotificationBell } from '@/components/NotificationBell';
import { useUserNotifications } from '@/lib/supabase/notifications';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { unreadCount } = useUserNotifications();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'SacraLink Member';
  const displayEmail = profile?.email || user?.email || 'No email registered';
  const displayRole = profile?.role || 'user';

  // Get user initials
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Row with Notification Bell */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-slate-900 font-heading">
            My Profile
          </Text>
          <NotificationBell />
        </View>

        {/* User Card */}
        <View className="items-center mb-6 pt-2">
          {/* Avatar / Profile Initials */}
          <View className="w-20 h-20 rounded-full bg-blue-600 items-center justify-center shadow-md shadow-blue-500/30 mb-3 relative">
            <Text className="text-2xl font-bold text-white font-heading">
              {initials || 'SL'}
            </Text>
            <View className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0 items-center justify-center">
              <CheckCircle2 size={12} color="#FFFFFF" />
            </View>
          </View>

          {/* Full Name */}
          <Text className="text-xl font-bold text-slate-900 font-heading text-center">
            {displayName}
          </Text>

          {/* Email */}
          <Text className="text-xs text-slate-500 font-sans mt-0.5 text-center mb-2">
            {displayEmail}
          </Text>

          {/* Role Badge */}
          <RoleBadge role={displayRole} />
        </View>

        {/* Notifications Shortcut Card */}
        <TouchableOpacity
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.8}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs mb-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center space-x-3">
            <View className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 items-center justify-center">
              <Bell size={18} color="#2563EB" />
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-900 font-sans">
                Notifications Inbox
              </Text>
              <Text className="text-xs text-slate-500 font-sans">
                {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'View past alerts & updates'}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center space-x-2">
            {unreadCount > 0 ? (
              <View className="px-2 py-0.5 rounded-full bg-rose-500">
                <Text className="text-[10px] font-bold text-white font-sans">{unreadCount}</Text>
              </View>
            ) : null}
            <ChevronRight size={16} color="#94A3B8" />
          </View>
        </TouchableOpacity>

        {/* Account Details Card */}
        <View className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs mb-4">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 font-sans">
            Account Information
          </Text>

          <View className="space-y-3">
            <View className="flex-row items-center justify-between py-1.5 border-b border-slate-100">
              <View className="flex-row items-center space-x-2.5">
                <User size={16} color="#64748B" />
                <Text className="text-xs font-medium text-slate-600 font-sans">Full Name</Text>
              </View>
              <Text className="text-xs font-semibold text-slate-900 font-sans">
                {displayName}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-1.5 border-b border-slate-100">
              <View className="flex-row items-center space-x-2.5">
                <Mail size={16} color="#64748B" />
                <Text className="text-xs font-medium text-slate-600 font-sans">Email Address</Text>
              </View>
              <Text className="text-xs font-semibold text-slate-900 font-sans">
                {displayEmail}
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-1.5">
              <View className="flex-row items-center space-x-2.5">
                <ShieldCheck size={16} color="#64748B" />
                <Text className="text-xs font-medium text-slate-600 font-sans">Account Role</Text>
              </View>
              <RoleBadge role={displayRole} size="sm" />
            </View>
          </View>
        </View>

        {/* Security & Hardware Keystore Card */}
        <View className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs mb-5">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 font-sans">
            Device & Session Security
          </Text>

          <View className="space-y-3">
            <View className="flex-row items-center justify-between py-1.5 border-b border-slate-100">
              <View className="flex-row items-center space-x-2.5">
                <Lock size={16} color="#10B981" />
                <Text className="text-xs font-medium text-slate-600 font-sans">
                  Android KeyStore Protection
                </Text>
              </View>
              <Text className="text-xs font-semibold text-emerald-700 font-sans">
                Active (Encrypted)
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-1.5">
              <View className="flex-row items-center space-x-2.5">
                <Smartphone size={16} color="#64748B" />
                <Text className="text-xs font-medium text-slate-600 font-sans">App Build</Text>
              </View>
              <Text className="text-xs font-semibold text-slate-700 font-sans">
                v1.0.0 (API Level 35)
              </Text>
            </View>
          </View>
        </View>

        {/* Sign Out Action Button */}
        <TouchableOpacity
          onPress={handleSignOut}
          disabled={isSigningOut}
          className="bg-rose-50 border border-rose-200 active:bg-rose-100 py-3.5 px-4 rounded-2xl flex-row items-center justify-center space-x-2 shadow-2xs"
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color="#E11D48" />
          ) : (
            <>
              <LogOut size={18} color="#E11D48" />
              <Text className="text-sm font-bold text-rose-600 font-sans">
                Sign Out of SacraLink
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
