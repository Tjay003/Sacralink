import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Pin,
  Calendar,
  Church,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function AnnouncementsScreen() {
  const { profile } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-blue-600 font-sans">
              Diocese & Parish News
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Announcements
            </Text>
          </View>
          <RoleBadge role={profile?.role} />
        </View>

        {/* Pinned Announcement */}
        <View className="bg-amber-500/10 border border-amber-300/80 rounded-3xl p-5 mb-5 shadow-2xs">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-1.5 bg-amber-500/20 px-2.5 py-1 rounded-full">
              <Pin size={12} color="#D97706" />
              <Text className="text-[11px] font-bold text-amber-800">Pinned Announcement</Text>
            </View>
            <Text className="text-[11px] text-amber-700 font-sans">Oct 2026</Text>
          </View>

          <Text className="text-base font-bold text-slate-900 font-heading mb-1.5">
            Diocesan Feast Day Celebrations & Novena Masses
          </Text>
          <Text className="text-xs text-slate-600 font-sans leading-relaxed mb-3">
            Join the clergy and religious community for our annual feast novena masses starting this Sunday. All parish appointment slots for the feast week are now open.
          </Text>

          <View className="flex-row items-center justify-between pt-2 border-t border-amber-200/60">
            <View className="flex-row items-center space-x-1">
              <Church size={13} color="#64748B" />
              <Text className="text-xs text-slate-500 font-sans">Diocese of Davao</Text>
            </View>
            <Text className="text-xs font-bold text-amber-700">Read Full Notice →</Text>
          </View>
        </View>

        {/* Recent Bulletins */}
        <Text className="text-base font-bold text-slate-900 font-heading mb-3">
          Latest Updates
        </Text>

        <View className="space-y-3">
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <View className="flex-row items-center space-x-1 mb-1.5">
              <Calendar size={12} color="#64748B" />
              <Text className="text-[11px] text-slate-500 font-sans">October 4, 2026</Text>
            </View>
            <Text className="text-sm font-bold text-slate-900 font-heading mb-1">
              Parish Office Schedule Adjustment for All Saints Day
            </Text>
            <Text className="text-xs text-slate-600 font-sans leading-relaxed">
              Please note our administrative office operating hours during the upcoming solemnity.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
