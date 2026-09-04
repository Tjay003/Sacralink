import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BarChart3,
  Church,
  Users,
  CalendarCheck,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function SuperAdminMetricsScreen() {
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
            <Text className="text-xs font-semibold uppercase tracking-wider text-purple-600 font-sans">
              Ecosystem Telemetry
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              System Metrics
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'super_admin'} />
        </View>

        {/* Metrics Grid */}
        <View className="flex-row space-x-3 mb-3">
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="w-8 h-8 rounded-xl bg-purple-50 items-center justify-center mb-2">
              <Church size={18} color="#7C3AED" />
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">42</Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">Active Parishes</Text>
          </View>

          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="w-8 h-8 rounded-xl bg-blue-50 items-center justify-center mb-2">
              <Users size={18} color="#2563EB" />
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">12.8k</Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">Registered Faithful</Text>
          </View>
        </View>

        <View className="flex-row space-x-3 mb-5">
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="w-8 h-8 rounded-xl bg-amber-50 items-center justify-center mb-2">
              <CalendarCheck size={18} color="#D97706" />
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">1,490</Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">Sacraments Booked</Text>
          </View>

          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center mb-2">
              <TrendingUp size={18} color="#10B981" />
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">₱485k</Text>
            <Text className="text-xs text-slate-500 font-sans mt-0.5">Donations Verified</Text>
          </View>
        </View>

        {/* System Health */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-2">
              <ShieldCheck size={18} color="#10B981" />
              <Text className="text-sm font-bold text-slate-900 font-heading">
                Backend Services Health
              </Text>
            </View>
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Text className="text-[10px] font-bold text-emerald-700">100% Uptime</Text>
            </View>
          </View>
          <Text className="text-xs text-slate-600 font-sans leading-relaxed">
            Postgres RLS policies operational. KeyStore session encryption active across Android devices.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
