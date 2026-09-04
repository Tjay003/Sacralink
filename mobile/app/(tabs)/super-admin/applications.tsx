import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Church,
  MapPin,
  Check,
  X,
  FileCheck,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function SuperAdminApplicationsScreen() {
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
              Diocesan Governance
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Parish Applications
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'super_admin'} />
        </View>

        {/* Application Cards */}
        <View className="space-y-3">
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <View className="flex-row items-start justify-between mb-2">
              <View>
                <Text className="text-base font-bold text-slate-900 font-heading">
                  St. Francis of Assisi Parish
                </Text>
                <View className="flex-row items-center space-x-1 mt-0.5">
                  <MapPin size={13} color="#64748B" />
                  <Text className="text-xs text-slate-500 font-sans">
                    Maa, Davao City
                  </Text>
                </View>
              </View>
              <View className="bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <Text className="text-[11px] font-bold text-amber-700">Under Review</Text>
              </View>
            </View>

            <View className="bg-slate-50 rounded-xl p-3 my-2 border border-slate-100">
              <Text className="text-xs text-slate-600 font-sans">
                Parish Priest in charge: Rev. Fr. Miguel Bautista
              </Text>
              <Text className="text-xs text-slate-500 font-sans mt-0.5">
                Submitted 4 verification credentials (Chancery endorsement, boundary map)
              </Text>
            </View>

            <View className="flex-row space-x-2 pt-2">
              <TouchableOpacity className="flex-1 bg-purple-600 active:bg-purple-700 py-2.5 rounded-xl flex-row items-center justify-center space-x-1.5">
                <Check size={16} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white font-sans">Approve Parish</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-slate-100 active:bg-rose-50 border border-slate-200 py-2.5 rounded-xl flex-row items-center justify-center space-x-1.5">
                <X size={16} color="#E11D48" />
                <Text className="text-xs font-bold text-rose-600 font-sans">Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
