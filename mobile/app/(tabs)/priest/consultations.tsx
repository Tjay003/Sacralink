import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Video,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function PriestConsultationsScreen() {
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
            <Text className="text-xs font-semibold uppercase tracking-wider text-amber-600 font-sans">
              Pastoral Care
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Consultations
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'priest'} />
        </View>

        {/* Video Consultation Room Banner */}
        <View className="bg-slate-900 rounded-3xl p-5 mb-5 shadow-md">
          <View className="flex-row items-center space-x-2 mb-2">
            <View className="bg-blue-600 p-2 rounded-xl">
              <Video size={18} color="#FFFFFF" />
            </View>
            <Text className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Encrypted Video Counseling
            </Text>
          </View>
          <Text className="text-lg font-bold text-white font-heading mb-1">
            Virtual Pastoral Counseling
          </Text>
          <Text className="text-xs text-slate-400 font-sans leading-relaxed mb-4">
            Conduct 1-on-1 private spiritual guidance and pre-cana consultations via secure Jitsi Meet video rooms.
          </Text>
        </View>

        {/* Scheduled Consultations */}
        <Text className="text-base font-bold text-slate-900 font-heading mb-3">
          Upcoming Sessions
        </Text>

        <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900 font-heading">
                Pre-Cana Spiritual Counseling
              </Text>
              <View className="flex-row items-center space-x-1 mt-1">
                <User size={13} color="#64748B" />
                <Text className="text-xs text-slate-600 font-sans">
                  John Doe & Maria Ramos
                </Text>
              </View>
            </View>
            <View className="bg-emerald-50 px-2 py-0.5 rounded-md">
              <Text className="text-[10px] font-bold text-emerald-700">Confirmed</Text>
            </View>
          </View>

          <View className="bg-slate-50 rounded-xl p-2.5 my-2 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-1.5">
              <Calendar size={13} color="#2563EB" />
              <Text className="text-xs text-slate-700 font-sans">Today</Text>
            </View>
            <View className="flex-row items-center space-x-1.5">
              <Clock size={13} color="#64748B" />
              <Text className="text-xs text-slate-600 font-sans">3:00 PM - 3:45 PM</Text>
            </View>
          </View>

          <TouchableOpacity className="bg-blue-600 active:bg-blue-700 py-2.5 px-4 rounded-xl flex-row items-center justify-center space-x-2 mt-1">
            <Video size={15} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white font-sans">
              Launch Video Consultation Room
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
