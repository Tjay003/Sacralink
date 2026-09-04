import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, Church, QrCode } from 'lucide-react-native';

export default function GiveDonationScreen() {
  const { churchId, churchName } = useLocalSearchParams<{
    churchId?: string;
    churchName?: string;
  }>();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-5 py-4 bg-white border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
        >
          <ArrowLeft size={18} color="#0F172A" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-slate-900 font-sans">
          Cashless Parish Donation
        </Text>
        <View className="w-9" />
      </View>

      <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
        {/* Selected Church Banner */}
        {churchName && (
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex-row items-center gap-3 mb-5">
            <View className="w-10 h-10 rounded-xl bg-amber-500 items-center justify-center">
              <Church size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider font-sans">
                Recipient Parish
              </Text>
              <Text className="text-sm font-bold text-slate-900 font-sans">
                {churchName}
              </Text>
            </View>
          </View>
        )}

        <View className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm items-center text-center">
          <View className="w-14 h-14 rounded-2xl bg-amber-50 items-center justify-center mb-3">
            <QrCode size={28} color="#D97706" />
          </View>
          <Text className="text-lg font-bold text-slate-900 font-sans text-center mb-1">
            Cashless Giving & Verification
          </Text>
          <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed mb-6">
            Support parish maintenance, charitable ministries, and liturgical needs with GCash or Maya cashless payment verification.
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/donations' as any)}
            className="w-full bg-amber-500 py-3.5 rounded-2xl items-center shadow-md shadow-amber-500/20"
          >
            <Text className="text-xs font-bold text-white font-sans uppercase tracking-wider">
              Go to Donations Hub
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
