import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  HeartHandshake,
  QrCode,
  Upload,
  Receipt,
  CheckCircle2,
  Clock,
  Church,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function DonationsScreen() {
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
              Parish Stewardship
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Give Donation
            </Text>
          </View>
          <RoleBadge role={profile?.role} />
        </View>

        {/* Hero Card */}
        <View className="bg-blue-600 rounded-3xl p-5 mb-5 shadow-md shadow-blue-600/25">
          <View className="flex-row items-center space-x-2 mb-2">
            <HeartHandshake size={20} color="#F59E0B" />
            <Text className="text-xs font-bold text-blue-100 uppercase tracking-wider">
              Cashless Parish Giving
            </Text>
          </View>
          <Text className="text-lg font-bold text-white font-heading mb-1">
            Support Your Parish Ministries
          </Text>
          <Text className="text-xs text-blue-100 font-sans leading-relaxed mb-4">
            Scan official parish GCash or Maya QR codes directly on your mobile device and submit your verification receipt.
          </Text>
          <View className="flex-row space-x-2">
            <TouchableOpacity className="bg-white/20 px-3.5 py-2 rounded-xl flex-row items-center space-x-1.5 border border-white/30">
              <QrCode size={15} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">View QR Codes</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-white px-3.5 py-2 rounded-xl flex-row items-center space-x-1.5">
              <Upload size={15} color="#2563EB" />
              <Text className="text-xs font-bold text-blue-700">Submit Proof</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Donations Ledger */}
        <Text className="text-base font-bold text-slate-900 font-heading mb-3">
          Giving History
        </Text>

        <View className="space-y-3">
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <View className="flex-row items-start justify-between mb-2">
              <View>
                <Text className="text-base font-bold text-slate-900 font-heading">
                  ₱500.00
                </Text>
                <View className="flex-row items-center space-x-1 mt-0.5">
                  <Church size={13} color="#64748B" />
                  <Text className="text-xs text-slate-500 font-sans">
                    San Pedro Cathedral (Parish Tithe)
                  </Text>
                </View>
              </View>
              <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-row items-center space-x-1">
                <CheckCircle2 size={12} color="#10B981" />
                <Text className="text-[11px] font-bold text-emerald-700">Verified</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between pt-2 border-t border-slate-100">
              <View className="flex-row items-center space-x-1">
                <Receipt size={13} color="#64748B" />
                <Text className="text-xs text-slate-500 font-sans">
                  Ref: GCASH-99482103
                </Text>
              </View>
              <Text className="text-xs text-slate-400 font-sans">Yesterday</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
