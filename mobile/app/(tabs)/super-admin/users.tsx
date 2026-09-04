import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Search,
  Shield,
  User,
  MoreVertical,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function SuperAdminUsersScreen() {
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
              Identity & Access
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              User Directory
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'super_admin'} />
        </View>

        {/* Search */}
        <View className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex-row items-center space-x-2.5 mb-4">
          <Search size={18} color="#64748B" />
          <Text className="flex-1 text-sm text-slate-400 font-sans">
            Search by name, email, or role...
          </Text>
        </View>

        {/* User Items */}
        <View className="space-y-2.5">
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <View className="w-11 h-11 rounded-full bg-amber-100 items-center justify-center">
                <User size={20} color="#D97706" />
              </View>
              <View>
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Fr. Miguel Bautista
                </Text>
                <Text className="text-xs text-slate-500 font-sans">
                  m.bautista@sacralink.org
                </Text>
              </View>
            </View>
            <RoleBadge role="priest" size="sm" />
          </View>

          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <View className="w-11 h-11 rounded-full bg-blue-100 items-center justify-center">
                <User size={20} color="#2563EB" />
              </View>
              <View>
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Elena Ramos
                </Text>
                <Text className="text-xs text-slate-500 font-sans">
                  elena.admin@sacralink.org
                </Text>
              </View>
            </View>
            <RoleBadge role="admin" size="sm" />
          </View>

          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
              <View className="w-11 h-11 rounded-full bg-emerald-100 items-center justify-center">
                <User size={20} color="#059669" />
              </View>
              <View>
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Maria Santos
                </Text>
                <Text className="text-xs text-slate-500 font-sans">
                  maria.santos@gmail.com
                </Text>
              </View>
            </View>
            <RoleBadge role="user" size="sm" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
