import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Building2,
  CalendarCheck,
  HandCoins,
  Bell,
  Clock,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function AdminHubScreen() {
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
              Administration & Operations
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Parish Hub
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'admin'} />
        </View>

        {/* Triage Dashboard Counters */}
        <View className="flex-row space-x-3 mb-5">
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <CalendarCheck size={18} color="#2563EB" />
              <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-blue-700">Pending</Text>
              </View>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">4</Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">
              Appointments to review
            </Text>
          </View>

          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <HandCoins size={18} color="#10B981" />
              <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                <Text className="text-[10px] font-bold text-emerald-700">Receipts</Text>
              </View>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">2</Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">
              Donations to verify
            </Text>
          </View>
        </View>

        {/* Operational Quick Actions */}
        <Text className="text-base font-bold text-slate-900 font-heading mb-3">
          Parish Admin Quick Actions
        </Text>

        <View className="space-y-3">
          <TouchableOpacity className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <View className="bg-blue-50 p-2.5 rounded-xl">
                <Bell size={18} color="#2563EB" />
              </View>
              <View>
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Broadcast Parish Announcement
                </Text>
                <Text className="text-xs text-slate-500 font-sans">
                  Publish emergency alert or parish bulletin
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <View className="bg-amber-50 p-2.5 rounded-xl">
                <Clock size={18} color="#D97706" />
              </View>
              <View>
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Manage Mass Schedules
                </Text>
                <Text className="text-xs text-slate-500 font-sans">
                  Configure regular, anticipated & feast timetables
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
