import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  HeartHandshake,
  MessageSquare,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import {
  useUserNotifications,
  type UserNotification,
} from '@/lib/supabase/notifications';

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getNotificationVisuals(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('appointment')) {
    return {
      icon: <Calendar size={18} color="#2563EB" />,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    };
  }
  if (t.includes('donation')) {
    return {
      icon: <HeartHandshake size={18} color="#059669" />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    };
  }
  if (t.includes('chat') || t.includes('message')) {
    return {
      icon: <MessageSquare size={18} color="#6366F1" />,
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
    };
  }
  if (t.includes('announcement')) {
    return {
      icon: <Sparkles size={18} color="#D97706" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    };
  }
  return {
    icon: <Bell size={18} color="#475569" />,
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  };
}

export default function NotificationsInboxScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefetching,
    refetch,
    markAsRead,
    markAllAsRead,
    isMarkingRead,
  } = useUserNotifications();

  const handleNotificationPress = useCallback(
    async (item: UserNotification) => {
      // 1. Mark notification as read if unread
      if (!item.is_read) {
        try {
          await markAsRead(item.id);
        } catch (err) {
          console.error('Failed to mark notification as read:', err);
        }
      }

      // 2. Navigate directly to target destination
      const link = item.link || '';
      const type = (item.type || '').toLowerCase();

      if (link.startsWith('/appointments') || type.includes('appointment')) {
        router.push('/(tabs)/appointments' as any);
      } else if (link.startsWith('/donations') || type.includes('donation')) {
        router.push('/(tabs)/donations' as any);
      } else if (
        link.startsWith('/messages') ||
        type.includes('message') ||
        type.includes('chat')
      ) {
        router.push('/(tabs)/messages' as any);
      } else if (link.startsWith('/churches/')) {
        const parts = link.split('/');
        const churchId = parts[2]?.split('?')[0];
        if (churchId) {
          router.push(`/church/${churchId}` as any);
        } else {
          router.push('/(tabs)/explore' as any);
        }
      } else if (link.startsWith('/announcements') || type.includes('announcement')) {
        router.push('/(tabs)/announcements' as any);
      } else if (link.startsWith('/profile')) {
        router.push('/(tabs)/profile' as any);
      } else if (link.length > 0) {
        router.push(link as any);
      }
    },
    [markAsRead, router]
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Top Header Bar */}
      <View className="px-5 pt-3 pb-3 bg-white border-b border-slate-200/80 flex-row items-center justify-between shadow-2xs">
        <View className="flex-row items-center space-x-3">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#1E293B" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-slate-900 font-heading">
              Notifications
            </Text>
            <Text className="text-xs text-slate-500 font-sans">
              {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
            </Text>
          </View>
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => markAllAsRead()}
            disabled={isMarkingRead}
            activeOpacity={0.7}
            className="flex-row items-center space-x-1 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 active:bg-blue-100"
          >
            <CheckCheck size={14} color="#2563EB" />
            <Text className="text-xs font-bold text-blue-600 font-sans">
              Mark all read
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Main List */}
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
        {isLoading && !isRefetching ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-xs text-slate-500 font-sans mt-3">
              Loading your notifications...
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <View className="py-24 items-center justify-center px-6">
            <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4 border border-slate-200/80">
              <CheckCircle2 size={32} color="#10B981" />
            </View>
            <Text className="text-lg font-bold text-slate-900 font-heading mb-1 text-center">
              You're all caught up!
            </Text>
            <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed max-w-xs">
              Important sacrament updates, cashless donation receipts, and parish bulletins will appear here.
            </Text>
          </View>
        ) : (
          <View className="space-y-3">
            {notifications.map((item) => {
              const visuals = getNotificationVisuals(item.type);
              const relativeTime = formatRelativeTime(item.created_at);

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleNotificationPress(item)}
                  activeOpacity={0.8}
                  className={`rounded-2xl p-4 border transition-all ${
                    item.is_read
                      ? 'bg-white border-slate-200/70 shadow-2xs'
                      : 'bg-blue-50/40 border-blue-300 shadow-xs'
                  }`}
                >
                  <View className="flex-row items-start space-x-3">
                    {/* Visual Icon Badge */}
                    <View
                      className={`w-10 h-10 rounded-xl items-center justify-center border ${visuals.bg} ${visuals.border}`}
                    >
                      {visuals.icon}
                    </View>

                    {/* Notification Copy */}
                    <View className="flex-1 pr-1">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text
                          className={`text-xs font-bold font-sans flex-1 pr-2 ${
                            item.is_read ? 'text-slate-800' : 'text-blue-950'
                          }`}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text className="text-[11px] text-slate-400 font-sans">
                          {relativeTime}
                        </Text>
                      </View>

                      <Text
                        className={`text-xs font-sans leading-relaxed ${
                          item.is_read ? 'text-slate-500' : 'text-slate-700'
                        }`}
                        numberOfLines={3}
                      >
                        {item.message}
                      </Text>
                    </View>

                    {/* Unread Status Pill Indicator */}
                    {!item.is_read ? (
                      <View className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5" />
                    ) : (
                      <ChevronRight size={14} color="#CBD5E1" className="mt-1.5" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
