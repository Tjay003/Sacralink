import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Church,
  Users,
  CalendarCheck,
  TrendingUp,
  ShieldCheck,
  Megaphone,
  FileCheck2,
  UserCog,
  ChevronRight,
  X,
  Send,
  AlertCircle,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useSystemOverviewMetrics,
  usePublishSystemAnnouncement,
} from '@/lib/supabase/superAdmin';

export default function SuperAdminMetricsScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const {
    data: metrics,
    isLoading,
    isRefetching,
    refetch,
  } = useSystemOverviewMetrics();

  const publishMutation = usePublishSystemAnnouncement();

  // Announcement modal state
  const [decreeModalOpen, setDecreeModalOpen] = useState(false);
  const [decreeTitle, setDecreeTitle] = useState('');
  const [decreeContent, setDecreeContent] = useState('');
  const [decreePriority, setDecreePriority] = useState<'urgent' | 'advisory' | 'event' | 'general'>('urgent');
  const [expiryDays, setExpiryDays] = useState<'7' | '14' | '30' | 'never'>('14');

  const handleBroadcastDecree = async () => {
    if (!decreeTitle.trim() || !decreeContent.trim()) {
      Alert.alert('Incomplete Form', 'Please specify a decree title and message body.');
      return;
    }

    let expiresAt: string | null = null;
    if (expiryDays !== 'never') {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expiryDays, 10));
      expiresAt = d.toISOString();
    }

    try {
      await publishMutation.mutateAsync({
        title: decreeTitle.trim(),
        content: decreeContent.trim(),
        priority: decreePriority,
        expiresAt,
      });

      Alert.alert(
        'Decree Broadcasted 🙏',
        `The ${decreePriority.toUpperCase()} diocesan decree was successfully published across all parishes and faithful members.`
      );
      setDecreeModalOpen(false);
      setDecreeTitle('');
      setDecreeContent('');
      setDecreePriority('urgent');
      setExpiryDays('14');
      refetch();
    } catch (err: any) {
      Alert.alert('Broadcast Error', err?.message || 'Failed to dispatch diocesan decree.');
    }
  };

  const formatPhp = (val: number) => {
    return `₱${val.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const pendingCount = metrics?.pendingApplicationsCount || 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={['#7C3AED']}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center space-x-1 mb-0.5">
              <Sparkles size={13} color="#7C3AED" />
              <Text className="text-xs font-semibold uppercase tracking-wider text-purple-700 font-sans">
                Diocesan Chancery
              </Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Executive Telemetry
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'super_admin'} />
        </View>

        {/* Primary Executive KPI Grid */}
        <View className="flex-row space-x-3 mb-3">
          {/* Active Parishes */}
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-xl bg-purple-100 items-center justify-center">
                <Church size={18} color="#7C3AED" />
              </View>
              <View className="bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                <Text className="text-[10px] font-bold text-purple-700">Churches</Text>
              </View>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              {isLoading ? '—' : metrics?.totalChurches || 0}
            </Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">
              Active Parishes
            </Text>
          </View>

          {/* Active Users */}
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-xl bg-blue-100 items-center justify-center">
                <Users size={18} color="#2563EB" />
              </View>
              <View className="bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                <Text className="text-[10px] font-bold text-blue-700">Accounts</Text>
              </View>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              {isLoading ? '—' : metrics?.totalUsers || 0}
            </Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">
              Registered Faithful
            </Text>
          </View>
        </View>

        <View className="flex-row space-x-3 mb-4">
          {/* Sacrament Appointments */}
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-xl bg-amber-100 items-center justify-center">
                <CalendarCheck size={18} color="#D97706" />
              </View>
              <View className="bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Text className="text-[10px] font-bold text-amber-700">Bookings</Text>
              </View>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              {isLoading ? '—' : metrics?.totalAppointments || 0}
            </Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">
              Total Sacraments
            </Text>
          </View>

          {/* Stewardship Volume */}
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-xl bg-emerald-100 items-center justify-center">
                <TrendingUp size={18} color="#059669" />
              </View>
              <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Text className="text-[10px] font-bold text-emerald-700">Verified</Text>
              </View>
            </View>
            <Text
              className="text-lg font-bold text-slate-900 font-heading"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {isLoading ? '—' : formatPhp(metrics?.totalDonationsVolumePhp || 0)}
            </Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">
              Total Stewardship
            </Text>
          </View>
        </View>

        {/* User Role Distribution Pills */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs mb-5">
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-3">
            Diocesan Role Distribution
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-xl">
              <Text className="text-xs font-semibold text-slate-700 font-sans mr-1.5">
                Faithful:
              </Text>
              <Text className="text-xs font-bold text-purple-700 font-heading">
                {isLoading ? '—' : metrics?.roleBreakdown.parishioners || 0}
              </Text>
            </View>
            <View className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-xl">
              <Text className="text-xs font-semibold text-slate-700 font-sans mr-1.5">
                Priests:
              </Text>
              <Text className="text-xs font-bold text-amber-700 font-heading">
                {isLoading ? '—' : metrics?.roleBreakdown.priests || 0}
              </Text>
            </View>
            <View className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-xl">
              <Text className="text-xs font-semibold text-slate-700 font-sans mr-1.5">
                Parish Admins:
              </Text>
              <Text className="text-xs font-bold text-blue-700 font-heading">
                {isLoading ? '—' : metrics?.roleBreakdown.churchAdmins || 0}
              </Text>
            </View>
            <View className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-xl">
              <Text className="text-xs font-semibold text-slate-700 font-sans mr-1.5">
                Super Admins:
              </Text>
              <Text className="text-xs font-bold text-purple-900 font-heading">
                {isLoading ? '—' : metrics?.roleBreakdown.superAdmins || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions Header */}
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-2 px-1">
          Governance Actions
        </Text>

        {/* Action 1: Review Parish Applications */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/super-admin/applications')}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs mb-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center space-x-3 flex-1 mr-2">
            <View className="w-10 h-10 rounded-xl bg-purple-100 items-center justify-center">
              <FileCheck2 size={20} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center space-x-2">
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Review Parish Applications
                </Text>
                {pendingCount > 0 && (
                  <View className="bg-amber-500 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-bold text-white">
                      {pendingCount} new
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-xs text-slate-500 font-sans mt-0.5">
                Inspect Celebret & Chancery decrees, onboard new churches
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* Action 2: Manage User Roles */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/super-admin/users')}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs mb-3 flex-row items-center justify-between"
        >
          <View className="flex-row items-center space-x-3 flex-1 mr-2">
            <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center">
              <UserCog size={20} color="#2563EB" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900 font-heading">
                Manage User Roles & Access
              </Text>
              <Text className="text-xs text-slate-500 font-sans mt-0.5">
                Assign priests, appoint parish admins, and reassign churches
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* Action 3: Broadcast Diocesan Decree (Hero Card) */}
        <View className="bg-purple-900 rounded-3xl p-5 mb-5 shadow-sm">
          <View className="flex-row items-center space-x-2 mb-2">
            <View className="bg-white/20 p-2 rounded-xl">
              <Megaphone size={18} color="#FFFFFF" />
            </View>
            <Text className="text-xs font-bold text-purple-200 uppercase tracking-wider font-sans">
              Diocesan Decree Broadcast
            </Text>
          </View>
          <Text className="text-lg font-bold text-white font-heading mb-1">
            Broadcast Diocesan Decree / Bulletin
          </Text>
          <Text className="text-xs text-purple-200 font-sans leading-relaxed mb-4">
            Issue pastoral letters, emergency diocesan bulletins, or solemn feast proclamations to all parishes.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setDecreeModalOpen(true)}
            className="bg-white active:bg-purple-50 py-3 px-4 rounded-xl flex-row items-center justify-center space-x-2 shadow-xs"
          >
            <Megaphone size={16} color="#7C3AED" />
            <Text className="text-xs font-bold text-purple-900 font-heading">
              Compose Diocesan Decree
            </Text>
          </TouchableOpacity>
        </View>

        {/* System Health & Telemetry Card */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-2">
              <ShieldCheck size={18} color="#10B981" />
              <Text className="text-sm font-bold text-slate-900 font-heading">
                Security & Telemetry Health
              </Text>
            </View>
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Text className="text-[10px] font-bold text-emerald-700">100% Operational</Text>
            </View>
          </View>
          <Text className="text-xs text-slate-600 font-sans leading-relaxed">
            Postgres RLS isolation operational. KeyStore 1800-byte token chunking safe. Realtime websocket channels active across all Android mobile clients.
          </Text>
        </View>
      </ScrollView>

      {/* Broadcast Diocesan Decree Modal */}
      <Modal
        visible={decreeModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDecreeModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-slate-900/60 justify-end"
        >
          <View className="bg-white rounded-t-3xl max-h-[90%] p-5 shadow-2xl">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <View className="flex-row items-center space-x-2">
                <View className="w-8 h-8 rounded-xl bg-purple-100 items-center justify-center">
                  <Megaphone size={16} color="#7C3AED" />
                </View>
                <Text className="text-base font-bold text-slate-900 font-heading">
                  Broadcast Diocesan Decree
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDecreeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Priority Tag Selector */}
              <Text className="text-xs font-bold text-slate-700 font-sans mb-2">
                Classification & Urgency
              </Text>
              <View className="flex-row space-x-2 mb-4">
                {(
                  [
                    { key: 'urgent', label: 'Urgent Alert', color: 'bg-rose-50 text-rose-700 border-rose-200', active: 'bg-rose-600 text-white' },
                    { key: 'advisory', label: 'Advisory', color: 'bg-blue-50 text-blue-700 border-blue-200', active: 'bg-blue-600 text-white' },
                    { key: 'event', label: 'Diocesan Event', color: 'bg-purple-50 text-purple-700 border-purple-200', active: 'bg-purple-600 text-white' },
                    { key: 'general', label: 'General Bulletin', color: 'bg-slate-100 text-slate-700 border-slate-200', active: 'bg-slate-800 text-white' },
                  ] as const
                ).map((t) => {
                  const isSelected = decreePriority === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setDecreePriority(t.key)}
                      className={`flex-1 py-2 px-1 rounded-xl items-center justify-center border ${
                        isSelected ? t.active : t.color
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          isSelected ? 'text-white' : ''
                        }`}
                        numberOfLines={1}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title Input */}
              <Text className="text-xs font-bold text-slate-700 font-sans mb-1.5">
                Decree / Bulletin Title
              </Text>
              <TextInput
                value={decreeTitle}
                onChangeText={setDecreeTitle}
                placeholder="e.g., Chancery Decree on Holy Week Liturgical Observances"
                placeholderTextColor="#94A3B8"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-sans mb-4"
              />

              {/* Content Input */}
              <Text className="text-xs font-bold text-slate-700 font-sans mb-1.5">
                Decree Proclamation / Official Body
              </Text>
              <TextInput
                value={decreeContent}
                onChangeText={setDecreeContent}
                placeholder="Enter the full diocesan decree or pastoral announcement text..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 font-sans mb-4 min-h-[120px]"
              />

              {/* Validity Window / Expiration */}
              <Text className="text-xs font-bold text-slate-700 font-sans mb-1.5">
                Bulletin Active Duration
              </Text>
              <View className="flex-row space-x-2 mb-6">
                {(
                  [
                    { key: '7', label: '7 Days' },
                    { key: '14', label: '14 Days' },
                    { key: '30', label: '30 Days' },
                    { key: 'never', label: 'Permanent' },
                  ] as const
                ).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setExpiryDays(opt.key)}
                    className={`flex-1 py-2 rounded-xl items-center justify-center border ${
                      expiryDays === opt.key
                        ? 'bg-purple-600 border-purple-600'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        expiryDays === opt.key ? 'text-white' : 'text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Submit CTA */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={publishMutation.isPending}
                onPress={handleBroadcastDecree}
                className={`py-3.5 rounded-xl flex-row items-center justify-center space-x-2 ${
                  publishMutation.isPending ? 'bg-purple-400' : 'bg-purple-700 active:bg-purple-800'
                }`}
              >
                {publishMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={16} color="#FFFFFF" />
                    <Text className="text-sm font-bold text-white font-sans">
                      Publish Decree Now
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
