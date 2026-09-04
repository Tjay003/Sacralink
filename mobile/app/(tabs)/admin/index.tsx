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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Building2,
  CalendarCheck,
  HandCoins,
  Bell,
  Megaphone,
  MessageSquare,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Info,
  Calendar,
  X,
  Send,
  User,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useAdminParishMetrics,
  useCreateParishAnnouncement,
} from '@/lib/supabase/adminWorkflows';

export default function AdminHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const churchId = (profile as any)?.assigned_church_id || profile?.church_id;

  const {
    data: metrics,
    isLoading: metricsLoading,
    isRefetching,
    refetch,
  } = useAdminParishMetrics(churchId);

  // Announcement modal state
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<'urgent' | 'advisory' | 'event' | 'general'>('urgent');
  const [annImageUrl, setAnnImageUrl] = useState('');

  const createAnnouncementMutation = useCreateParishAnnouncement();

  const handlePublishAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) {
      Alert.alert('Incomplete Form', 'Please provide both a title and announcement content.');
      return;
    }

    const targetChurchId = churchId || metrics?.churchId;
    if (!targetChurchId) {
      Alert.alert('Error', 'No parish church assigned to your administrator account.');
      return;
    }

    try {
      await createAnnouncementMutation.mutateAsync({
        churchId: targetChurchId,
        title: annTitle.trim(),
        content: annContent.trim(),
        priority: annPriority,
        imageUrl: annImageUrl.trim() || undefined,
      });

      Alert.alert(
        'Announcement Broadcasted',
        `Your ${annPriority} parish announcement has been published to all parishioners.`
      );
      setAnnouncementModalOpen(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnImageUrl('');
      setAnnPriority('urgent');
      refetch();
    } catch (err: any) {
      Alert.alert('Publish Failed', err?.message || 'Could not broadcast announcement.');
    }
  };

  const churchDisplayName = metrics?.churchName || 'Your Parish Church';

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={['#2563EB']}
          />
        }
      >
        {/* Header with Church Name & Role Badge */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center space-x-1 mb-0.5">
              <Building2 size={13} color="#2563EB" />
              <Text
                className="text-xs font-semibold uppercase tracking-wider text-blue-600 font-sans"
                numberOfLines={1}
              >
                {churchDisplayName}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Parish Admin Hub
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'admin'} />
        </View>

        {/* Triage Dashboard Counters */}
        <View className="flex-row space-x-3 mb-5">
          {/* Pending Bookings Badge Card */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/admin/appointments')}
            className="flex-1 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs"
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-xl bg-blue-50 items-center justify-center">
                <CalendarCheck size={18} color="#2563EB" />
              </View>
              <View className="bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                <Text className="text-[10px] font-bold text-blue-700">Triage</Text>
              </View>
            </View>
            <Text className="text-3xl font-bold text-slate-900 font-heading">
              {metricsLoading ? '—' : metrics?.pendingAppointmentsCount || 0}
            </Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">
              Pending Bookings
            </Text>
          </TouchableOpacity>

          {/* Pending Donations Badge Card */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/admin/donations')}
            className="flex-1 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs"
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center">
                <HandCoins size={18} color="#10B981" />
              </View>
              <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Text className="text-[10px] font-bold text-emerald-700">Receipts</Text>
              </View>
            </View>
            <Text className="text-3xl font-bold text-slate-900 font-heading">
              {metricsLoading ? '—' : metrics?.pendingDonationsCount || 0}
            </Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">
              Pending Offerings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Publish Urgent Announcement Hero CTA Banner */}
        <View className="bg-gradient-to-r from-blue-700 to-indigo-800 bg-blue-600 rounded-3xl p-5 mb-6 shadow-sm">
          <View className="flex-row items-center space-x-2 mb-2">
            <View className="bg-white/20 p-2 rounded-xl">
              <Megaphone size={18} color="#FFFFFF" />
            </View>
            <Text className="text-xs font-bold text-blue-100 uppercase tracking-wider font-sans">
              Urgent Broadcast
            </Text>
          </View>
          <Text className="text-lg font-bold text-white font-heading mb-1">
            Broadcast Urgent Announcement
          </Text>
          <Text className="text-xs text-blue-100 font-sans leading-relaxed mb-4">
            Push real-time alerts, liturgical schedule changes, or holy day notices to all parishioners.
          </Text>

          <TouchableOpacity
            onPress={() => setAnnouncementModalOpen(true)}
            className="bg-white active:bg-blue-50 py-3 px-4 rounded-xl flex-row items-center justify-center space-x-2"
          >
            <Megaphone size={15} color="#2563EB" />
            <Text className="text-xs font-bold text-blue-700 font-sans">
              Compose Parish Announcement
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Shortcuts */}
        <Text className="text-base font-bold text-slate-900 font-heading mb-3">
          Parish Operations & Shortcuts
        </Text>

        <View className="space-y-3">
          {/* Appointments Queue Shortcut */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/admin/appointments')}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3 flex-1 mr-2">
              <View className="bg-blue-50 p-2.5 rounded-xl">
                <CalendarCheck size={18} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Sacrament Appointments Triage
                </Text>
                <Text className="text-xs text-slate-500 font-sans">
                  Approve or reject baptisms, weddings, and funeral ceremonies
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Donations Verification Shortcut */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/admin/donations')}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3 flex-1 mr-2">
              <View className="bg-emerald-50 p-2.5 rounded-xl">
                <HandCoins size={18} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Cashless Donations Verification
                </Text>
                <Text className="text-xs text-slate-500 font-sans">
                  Inspect GCash and Maya screenshots against reference records
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Parish Real-Time Messages */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/messages')}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3 flex-1 mr-2">
              <View className="bg-amber-50 p-2.5 rounded-xl">
                <MessageSquare size={18} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Parishioner Inquiries & Chat
                </Text>
                <Text className="text-xs text-slate-500 font-sans">
                  Respond to direct messages and sacrament consultation requests
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ================================================================= */}
      {/* Broadcast Announcement Composer Modal                             */}
      {/* ================================================================= */}
      <Modal
        visible={announcementModalOpen}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
        transparent={Platform.OS === 'android'}
        onRequestClose={() => setAnnouncementModalOpen(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[90%] flex-1 pt-4 pb-8 px-5">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <View>
                <Text className="text-xs font-semibold text-blue-600 uppercase tracking-wider font-sans">
                  Parish Bulletin
                </Text>
                <Text className="text-xl font-bold text-slate-900 font-heading">
                  Publish Announcement
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAnnouncementModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
            >
              {/* Priority Tags Selector */}
              <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-sans">
                Announcement Priority & Category
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {[
                  { key: 'urgent', label: 'Urgent Alert', icon: AlertTriangle, color: 'rose' },
                  { key: 'advisory', label: 'Schedule Advisory', icon: Info, color: 'amber' },
                  { key: 'event', label: 'Parish Event', icon: Calendar, color: 'blue' },
                  { key: 'general', label: 'General Bulletin', icon: Bell, color: 'slate' },
                ].map((item) => {
                  const isSelected = annPriority === item.key;
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setAnnPriority(item.key as any)}
                      className={`flex-row items-center space-x-1.5 px-3 py-2 rounded-xl border ${
                        isSelected
                          ? item.key === 'urgent'
                            ? 'bg-rose-600 border-rose-600'
                            : item.key === 'advisory'
                            ? 'bg-amber-600 border-amber-600'
                            : item.key === 'event'
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-slate-800 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <Icon size={14} color={isSelected ? '#FFFFFF' : '#64748B'} />
                      <Text
                        className={`text-xs font-bold font-sans ${
                          isSelected ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title Input */}
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-sans">
                  Announcement Title
                </Text>
                <TextInput
                  value={annTitle}
                  onChangeText={setAnnTitle}
                  placeholder="e.g. Holy Week Liturgical Services Schedule"
                  placeholderTextColor="#94A3B8"
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-900 font-sans"
                />
              </View>

              {/* Content Input */}
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-sans">
                  Content / Message Details
                </Text>
                <TextInput
                  value={annContent}
                  onChangeText={setAnnContent}
                  placeholder="Provide complete mass schedules, confession timings, or advisory details..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={5}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-900 font-sans min-h-[110px]"
                  textAlignVertical="top"
                />
              </View>

              {/* Optional Image URL Input */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-sans">
                  Cover Image URL (Optional)
                </Text>
                <TextInput
                  value={annImageUrl}
                  onChangeText={setAnnImageUrl}
                  placeholder="https://example.com/banner.jpg"
                  placeholderTextColor="#94A3B8"
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-900 font-sans"
                />
              </View>

              {/* Publish CTA Button */}
              <TouchableOpacity
                onPress={handlePublishAnnouncement}
                disabled={createAnnouncementMutation.isPending}
                className="bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl flex-row items-center justify-center space-x-2"
              >
                {createAnnouncementMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={16} color="#FFFFFF" />
                    <Text className="text-sm font-bold text-white font-sans">
                      Publish to Parishioners
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
