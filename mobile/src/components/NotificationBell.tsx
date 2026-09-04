import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useUserNotifications } from '@/lib/supabase/notifications';

interface NotificationBellProps {
  color?: string;
  size?: number;
}

export function NotificationBell({ color = '#1E293B', size = 22 }: NotificationBellProps) {
  const router = useRouter();
  const { unreadCount } = useUserNotifications();

  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications' as any)}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      className="relative p-2 rounded-full bg-slate-100/80 active:bg-slate-200 border border-slate-200/60"
      accessibilityLabel={`Notifications, ${unreadCount} unread`}
    >
      <Bell size={size} color={color} />
      {unreadCount > 0 ? (
        <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-600 items-center justify-center px-1 border-2 border-white shadow-xs">
          <Text className="text-[10px] font-bold text-white font-sans text-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
