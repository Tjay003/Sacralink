import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, Church, CheckCircle, Info } from 'lucide-react-native';

export default function BookAppointmentScreen() {
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
          Book Sacrament
        </Text>
        <View className="w-9" />
      </View>

      <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
        {/* Selected Church Banner */}
        {churchName && (
          <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex-row items-center gap-3 mb-5">
            <View className="w-10 h-10 rounded-xl bg-blue-600 items-center justify-center">
              <Church size={20} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider font-sans">
                Selected Parish
              </Text>
              <Text className="text-sm font-bold text-slate-900 font-sans">
                {churchName}
              </Text>
            </View>
          </View>
        )}

        <View className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm items-center text-center">
          <View className="w-14 h-14 rounded-2xl bg-amber-50 items-center justify-center mb-3">
            <Calendar size={28} color="#D97706" />
          </View>
          <Text className="text-lg font-bold text-slate-900 font-sans text-center mb-1">
            Sacrament Booking Engine
          </Text>
          <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed mb-6">
            Choose from Baptism, Wedding, Funeral Mass, Confirmation, or Pastoral Counseling. Schedule validation and document upload wizard will guide your submission.
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/appointments' as any)}
            className="w-full bg-blue-600 py-3.5 rounded-2xl items-center shadow-md shadow-blue-600/20"
          >
            <Text className="text-xs font-bold text-white font-sans uppercase tracking-wider">
              Go to Appointments Hub
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
