import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  AlertTriangle,
  Sparkles,
  Calendar,
  Church,
  ChevronRight,
  Bell,
  AlertCircle,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import { NotificationBell } from '@/components/NotificationBell';
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard';
import {
  useAnnouncements,
  type Announcement,
  type AnnouncementFilterTab,
} from '@/lib/supabase/announcements';

const FILTER_TABS: { id: AnnouncementFilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'diocesan', label: 'Diocesan' },
  { id: 'parish', label: 'Parish Updates' },
  { id: 'events', label: 'Events' },
];

export default function AnnouncementsScreen() {
  const { profile } = useAuth();
  const { data: announcements = [], isLoading, isRefetching, refetch } = useAnnouncements();

  const [activeTab, setActiveTab] = useState<AnnouncementFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerModalVisible, setBannerModalVisible] = useState(false);

  // Identify any urgent system or pinned alert for top banner
  const urgentBannerAnnouncement = useMemo(() => {
    return announcements.find(
      (item) => item.priority === 'urgent' || (item.kind === 'system' && item.is_pinned)
    );
  }, [announcements]);

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return announcements.filter((item) => {
      // 1. Tab filter
      if (activeTab === 'diocesan') {
        const isDiocesan = item.kind === 'system' || item.church_name.toLowerCase().includes('diocese');
        if (!isDiocesan) return false;
      } else if (activeTab === 'parish') {
        const isParish = item.kind === 'church' && item.category !== 'event';
        if (!isParish) return false;
      } else if (activeTab === 'events') {
        const isEvent =
          item.category === 'event' ||
          item.priority === 'event' ||
          item.priority === 'holy_week' ||
          item.category === 'mass_schedule';
        if (!isEvent) return false;
      }

      // 2. Search query filter
      if (query.length > 0) {
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesContent = item.content.toLowerCase().includes(query);
        const matchesParish = item.church_name.toLowerCase().includes(query);
        if (!matchesTitle && !matchesContent && !matchesParish) {
          return false;
        }
      }

      return true;
    });
  }, [announcements, activeTab, searchQuery]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="px-5 pt-3 pb-3 bg-white border-b border-slate-200/80">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <View className="flex-row items-center space-x-1 mb-0.5">
              <Sparkles size={12} color="#2563EB" />
              <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-sans">
                Diocese & Parish News
              </Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Announcements
            </Text>
          </View>

          <View className="flex-row items-center space-x-2">
            <NotificationBell />
            <RoleBadge role={profile?.role} />
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-100 rounded-2xl px-3.5 py-2 border border-slate-200/80">
          <Search size={16} color="#64748B" />
          <TextInput
            placeholder="Search bulletins, events, feasts..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-xs font-sans text-slate-800 p-0"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Tabs */}
        <View className="flex-row mt-3 space-x-2">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
                className={`px-3.5 py-1.5 rounded-full border transition-all ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 shadow-xs'
                    : 'bg-white border-slate-200/80 active:bg-slate-100'
                }`}
              >
                <Text
                  className={`text-xs font-bold font-sans ${
                    isActive ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Feed */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
      >
        {/* Urgent System Announcement Banner */}
        {urgentBannerAnnouncement && activeTab === 'all' && !searchQuery ? (
          <TouchableOpacity
            onPress={() => setBannerModalVisible(true)}
            activeOpacity={0.9}
            className="bg-amber-500/15 border border-amber-400/80 rounded-3xl p-4 mb-4 shadow-xs"
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center space-x-1.5 bg-amber-500/25 px-2.5 py-0.5 rounded-full">
                <AlertTriangle size={12} color="#B45309" />
                <Text className="text-[10px] font-bold text-amber-900 uppercase tracking-wider font-sans">
                  Urgent Diocesan Notice
                </Text>
              </View>
              <Text className="text-[11px] font-semibold text-amber-800 font-sans">
                {urgentBannerAnnouncement.created_at
                  ? new Date(urgentBannerAnnouncement.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : ''}
              </Text>
            </View>

            <Text className="text-sm font-bold text-slate-900 font-heading mb-1 leading-snug">
              {urgentBannerAnnouncement.title}
            </Text>

            <Text className="text-xs text-slate-700 font-sans leading-relaxed mb-2.5" numberOfLines={2}>
              {urgentBannerAnnouncement.content}
            </Text>

            <View className="flex-row items-center justify-between pt-2 border-t border-amber-300/60">
              <View className="flex-row items-center space-x-1">
                <Church size={12} color="#78350F" />
                <Text className="text-[11px] font-medium text-amber-900 font-sans">
                  {urgentBannerAnnouncement.church_name}
                </Text>
              </View>
              <Text className="text-[11px] font-bold text-amber-900">
                View Advisory Details →
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Section Heading */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-bold uppercase tracking-wider text-slate-400 font-sans">
            {activeTab === 'all'
              ? 'All Bulletins'
              : activeTab === 'diocesan'
              ? 'Diocesan Notices'
              : activeTab === 'parish'
              ? 'Parish Updates'
              : 'Upcoming Events'}
          </Text>
          <Text className="text-xs font-semibold text-slate-500 font-sans">
            {filteredAnnouncements.length} item{filteredAnnouncements.length === 1 ? '' : 's'}
          </Text>
        </View>

        {/* Feed List or States */}
        {isLoading && !isRefetching ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-xs text-slate-500 font-sans mt-3">
              Loading parish announcements...
            </Text>
          </View>
        ) : filteredAnnouncements.length === 0 ? (
          <View className="py-20 items-center justify-center px-6">
            <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-3 border border-slate-200">
              <Bell size={28} color="#94A3B8" />
            </View>
            <Text className="text-base font-bold text-slate-900 font-heading mb-1 text-center">
              No announcements found
            </Text>
            <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed max-w-xs">
              {searchQuery
                ? `No bulletins matched "${searchQuery}". Try a different keyword.`
                : 'There are currently no announcements in this category.'}
            </Text>
          </View>
        ) : (
          filteredAnnouncements.map((item) => (
            <AnnouncementCard key={item.id} announcement={item} />
          ))
        )}
      </ScrollView>

      {/* Banner Detail Modal */}
      {urgentBannerAnnouncement ? (
        <Modal
          visible={bannerModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setBannerModalVisible(false)}
        >
          <View className="flex-1 bg-slate-900/60 justify-end">
            <Pressable className="flex-1" onPress={() => setBannerModalVisible(false)} />
            <View className="bg-white rounded-t-3xl max-h-[80%] p-6">
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <View className="flex-row items-center space-x-1.5 bg-amber-500/20 px-3 py-1 rounded-full">
                  <AlertTriangle size={13} color="#B45309" />
                  <Text className="text-xs font-bold text-amber-900 uppercase tracking-wider font-sans">
                    Diocesan Notice
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setBannerModalVisible(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-xl font-bold text-slate-900 font-heading mb-2 leading-snug">
                  {urgentBannerAnnouncement.title}
                </Text>
                <Text className="text-xs text-slate-500 font-sans mb-4">
                  Issued by {urgentBannerAnnouncement.church_name}
                </Text>

                <Text className="text-sm text-slate-700 font-sans leading-relaxed whitespace-pre-line mb-6">
                  {urgentBannerAnnouncement.content}
                </Text>

                <TouchableOpacity
                  onPress={() => setBannerModalVisible(false)}
                  className="w-full bg-blue-600 py-3.5 rounded-2xl items-center justify-center shadow-xs"
                >
                  <Text className="text-white font-bold text-sm font-sans">
                    Close Notice
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}
