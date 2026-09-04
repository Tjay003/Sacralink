import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  HandCoins,
  Receipt,
  User,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function AdminDonationsQueueScreen() {
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
              Financial Stewardship
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Donations Queue
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'admin'} />
        </View>

        {/* Verification Item */}
        <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <View className="flex-row items-start justify-between mb-2">
            <View>
              <Text className="text-lg font-bold text-slate-900 font-heading">
                ₱1,000.00
              </Text>
              <View className="flex-row items-center space-x-1 mt-0.5">
                <User size={13} color="#64748B" />
                <Text className="text-xs text-slate-500 font-sans">
                  Donor: Anthony Cruz
                </Text>
              </View>
            </View>
            <View className="bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <Text className="text-[11px] font-bold text-amber-700">Pending Proof</Text>
            </View>
          </View>

          <View className="bg-slate-50 rounded-xl p-3 my-2 border border-slate-100 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-1.5">
              <Receipt size={14} color="#64748B" />
              <Text className="text-xs font-semibold text-slate-700 font-sans">
                Ref: GCASH-8817260
              </Text>
            </View>
            <TouchableOpacity className="flex-row items-center space-x-1">
              <Text className="text-xs font-semibold text-blue-600 font-sans">View Proof</Text>
              <ExternalLink size={12} color="#2563EB" />
            </TouchableOpacity>
          </View>

          <View className="flex-row space-x-2 pt-2">
            <TouchableOpacity className="flex-1 bg-emerald-600 active:bg-emerald-700 py-2.5 rounded-xl flex-row items-center justify-center space-x-1.5">
              <Check size={16} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white font-sans">Verify Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-slate-100 active:bg-rose-50 border border-slate-200 py-2.5 rounded-xl flex-row items-center justify-center space-x-1.5">
              <X size={16} color="#E11D48" />
              <Text className="text-xs font-bold text-rose-600 font-sans">Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
