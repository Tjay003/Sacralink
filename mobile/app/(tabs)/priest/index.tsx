import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Users,
  Cross,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function PriestScheduleScreen() {
  const { profile } = useAuth();
  const [isOnDuty, setIsOnDuty] = useState(true);

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
              Priestly Ministry
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Liturgical Schedule
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'priest'} />
        </View>

        {/* Availability Status Card */}
        <View className="bg-white rounded-3xl p-5 border border-slate-200 mb-5 shadow-xs">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-slate-900 font-heading">
                Pastoral Availability
              </Text>
              <Text className="text-xs text-slate-500 font-sans mt-0.5">
                {isOnDuty ? 'Accepting sacrament appointments today' : 'Marked as Off-Duty / On Leave'}
              </Text>
            </View>
            <Switch
              value={isOnDuty}
              onValueChange={setIsOnDuty}
              trackColor={{ false: '#CBD5E1', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Today's Liturgies */}
        <Text className="text-base font-bold text-slate-900 font-heading mb-3">
          Today's Liturgies & Masses
        </Text>

        <View className="space-y-3 mb-6">
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center space-x-2">
                <Cross size={16} color="#D97706" />
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Morning Holy Mass (English)
                </Text>
              </View>
              <View className="bg-emerald-50 px-2 py-0.5 rounded-md">
                <Text className="text-[10px] font-bold text-emerald-700">6:00 AM</Text>
              </View>
            </View>
            <Text className="text-xs text-slate-500 font-sans">
              Main Cathedral Altar • Celebrant
            </Text>
          </View>

          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center space-x-2">
                <Users size={16} color="#2563EB" />
                <Text className="text-sm font-bold text-slate-900 font-heading">
                  Sacrament of Reconciliation (Confessions)
                </Text>
              </View>
              <View className="bg-blue-50 px-2 py-0.5 rounded-md">
                <Text className="text-[10px] font-bold text-blue-700">4:30 PM</Text>
              </View>
            </View>
            <Text className="text-xs text-slate-500 font-sans">
              Confessional Box 2 • 3 Penitents in queue
            </Text>
          </View>
        </View>

        {/* Assigned Sacrament Appointments */}
        <Text className="text-base font-bold text-slate-900 font-heading mb-3">
          Assigned Sacrament Ceremonies
        </Text>

        <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <View className="flex-row items-start justify-between mb-2">
            <View>
              <Text className="text-sm font-bold text-slate-900 font-heading">
                Wedding Rite: Dela Cruz & Reyes
              </Text>
              <Text className="text-xs text-slate-500 font-sans mt-0.5">
                Tomorrow, 2:00 PM • Main Altar
              </Text>
            </View>
            <View className="bg-amber-50 px-2 py-1 rounded-lg">
              <Text className="text-xs font-bold text-amber-700">Confirmed</Text>
            </View>
          </View>
          <Text className="text-xs text-slate-500 font-sans mt-1">
            Pre-Cana documents verified • Rehearsal complete
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
