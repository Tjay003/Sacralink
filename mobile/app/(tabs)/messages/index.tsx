import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MessageSquare,
  User,
  Clock,
  Circle,
  Search,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function MessagesScreen() {
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
              Parish Communication
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Messages
            </Text>
          </View>
          <RoleBadge role={profile?.role} />
        </View>

        {/* Search Bar */}
        <View className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex-row items-center space-x-2.5 mb-4">
          <Search size={18} color="#64748B" />
          <Text className="flex-1 text-sm text-slate-400 font-sans">
            Search conversations or parishioners...
          </Text>
        </View>

        {/* Message Threads */}
        <View className="space-y-2.5">
          <TouchableOpacity className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center space-x-3">
            <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center relative">
              <User size={22} color="#2563EB" />
              <View className="w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0 right-0" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Maria Santos
                </Text>
                <Text className="text-[11px] text-slate-400 font-sans">10:45 AM</Text>
              </View>
              <Text className="text-xs text-slate-600 font-sans numberOfLines={1}">
                Father, can we reschedule our pre-cana counseling session?
              </Text>
            </View>
            <View className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          </TouchableOpacity>

          <TouchableOpacity className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center space-x-3">
            <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center">
              <User size={22} color="#64748B" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Parish Office Admin
                </Text>
                <Text className="text-[11px] text-slate-400 font-sans">Yesterday</Text>
              </View>
              <Text className="text-xs text-slate-500 font-sans numberOfLines={1}">
                The baptism certificate requested by Mendoza has been printed.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
