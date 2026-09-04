import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  Bell,
  Church,
  Calendar,
  AlertCircle,
  Pin,
  Sparkles,
  X,
  ChevronRight,
  Share2,
} from 'lucide-react-native';
import type { Announcement, AnnouncementPriority } from '@/lib/supabase/announcements';

interface AnnouncementCardProps {
  announcement: Announcement;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // Badge configurations based on priority
  const renderPriorityBadge = (priority: AnnouncementPriority, isPinned: boolean) => {
    if (isPinned) {
      return (
        <View className="flex-row items-center space-x-1 bg-amber-500/15 border border-amber-300 px-2.5 py-1 rounded-full">
          <Pin size={11} color="#D97706" />
          <Text className="text-[10px] font-bold text-amber-800 uppercase tracking-wider font-sans">
            Pinned
          </Text>
        </View>
      );
    }

    switch (priority) {
      case 'urgent':
        return (
          <View className="flex-row items-center space-x-1 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
            <AlertCircle size={11} color="#E11D48" />
            <Text className="text-[10px] font-bold text-rose-700 uppercase tracking-wider font-sans">
              Urgent Alert
            </Text>
          </View>
        );
      case 'holy_week':
        return (
          <View className="flex-row items-center space-x-1 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full">
            <Sparkles size={11} color="#7C3AED" />
            <Text className="text-[10px] font-bold text-purple-700 uppercase tracking-wider font-sans">
              Holy Week / Liturgy
            </Text>
          </View>
        );
      case 'event':
        return (
          <View className="flex-row items-center space-x-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <Calendar size={11} color="#059669" />
            <Text className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-sans">
              Parish Event
            </Text>
          </View>
        );
      case 'advisory':
        return (
          <View className="flex-row items-center space-x-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <Bell size={11} color="#D97706" />
            <Text className="text-[10px] font-bold text-amber-800 uppercase tracking-wider font-sans">
              Advisory
            </Text>
          </View>
        );
      default:
        return (
          <View className="flex-row items-center space-x-1 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
            <Bell size={11} color="#2563EB" />
            <Text className="text-[10px] font-bold text-blue-700 uppercase tracking-wider font-sans">
              Bulletin
            </Text>
          </View>
        );
    }
  };

  const formattedDate = announcement.created_at
    ? new Date(announcement.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.88}
        className={`bg-white rounded-3xl mb-4 border overflow-hidden shadow-xs ${
          announcement.is_pinned
            ? 'border-amber-300 bg-amber-50/20'
            : announcement.priority === 'urgent'
            ? 'border-rose-300 bg-rose-50/10'
            : 'border-slate-200/80'
        }`}
      >
        {/* Cover Image (if available) */}
        {announcement.cover_image_url ? (
          <View className="w-full h-40 bg-slate-100 relative">
            <Image
              source={{ uri: announcement.cover_image_url }}
              className="w-full h-full"
              resizeMode="cover"
            />
            <View className="absolute top-3 left-3">
              {renderPriorityBadge(announcement.priority, announcement.is_pinned)}
            </View>
          </View>
        ) : null}

        <View className="p-4">
          {/* Header metadata (when no cover image, or below cover image) */}
          {!announcement.cover_image_url ? (
            <View className="flex-row items-center justify-between mb-2.5">
              {renderPriorityBadge(announcement.priority, announcement.is_pinned)}
              <Text className="text-[11px] text-slate-500 font-sans">{formattedDate}</Text>
            </View>
          ) : (
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center space-x-1.5">
                <Church size={13} color="#2563EB" />
                <Text className="text-xs font-semibold text-blue-700 font-sans" numberOfLines={1}>
                  {announcement.church_name}
                </Text>
              </View>
              <Text className="text-[11px] text-slate-500 font-sans">{formattedDate}</Text>
            </View>
          )}

          {/* Parish indicator if no cover image */}
          {!announcement.cover_image_url ? (
            <View className="flex-row items-center space-x-1.5 mb-1.5">
              <Church size={13} color="#64748B" />
              <Text className="text-xs font-semibold text-slate-600 font-sans" numberOfLines={1}>
                {announcement.church_name}
              </Text>
            </View>
          ) : null}

          {/* Title */}
          <Text
            className="text-base font-bold text-slate-900 font-heading mb-1.5 leading-snug"
            numberOfLines={2}
          >
            {announcement.title}
          </Text>

          {/* Content snippet */}
          <Text
            className="text-xs text-slate-600 font-sans leading-relaxed mb-3"
            numberOfLines={3}
          >
            {announcement.content}
          </Text>

          {/* Card Footer */}
          <View className="flex-row items-center justify-between pt-2.5 border-t border-slate-100">
            <Text className="text-xs font-bold text-blue-600 font-sans">
              Read Full Notice
            </Text>
            <ChevronRight size={14} color="#2563EB" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Full Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900/60 justify-end">
          <Pressable className="flex-1" onPress={() => setModalVisible(false)} />
          <View className="bg-white rounded-t-3xl max-h-[85%] overflow-hidden">
            {/* Modal Header */}
            <View className="px-5 py-4 border-b border-slate-200/80 flex-row items-center justify-between bg-slate-50/50">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center space-x-2 mb-1">
                  {renderPriorityBadge(announcement.priority, announcement.is_pinned)}
                  <Text className="text-xs text-slate-500 font-sans">{formattedDate}</Text>
                </View>
                <Text className="text-xs font-semibold text-blue-700 font-sans" numberOfLines={1}>
                  {announcement.church_name}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 items-center justify-center"
                accessibilityLabel="Close announcement"
              >
                <X size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {announcement.cover_image_url ? (
                <View className="w-full h-48 rounded-2xl overflow-hidden bg-slate-100 mb-4 shadow-sm">
                  <Image
                    source={{ uri: announcement.cover_image_url }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              <Text className="text-xl font-bold text-slate-900 font-heading mb-3 leading-snug">
                {announcement.title}
              </Text>

              <Text className="text-sm text-slate-700 font-sans leading-relaxed whitespace-pre-line mb-6">
                {announcement.content}
              </Text>

              {announcement.scheduled_at ? (
                <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-4 flex-row items-center space-x-2.5">
                  <Calendar size={16} color="#2563EB" />
                  <View>
                    <Text className="text-[11px] font-bold text-slate-500 uppercase font-sans">
                      Scheduled Date & Time
                    </Text>
                    <Text className="text-xs font-semibold text-slate-800 font-sans">
                      {new Date(announcement.scheduled_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="w-full bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl items-center justify-center shadow-sm shadow-blue-500/30"
              >
                <Text className="text-white font-bold text-sm font-sans">
                  Dismiss
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
