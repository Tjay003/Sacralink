import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  Clock,
  Plus,
  Church,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';

export default function AppointmentsScreen() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<'upcoming' | 'history'>('upcoming');

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
              Sacramental Ministry
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              My Appointments
            </Text>
          </View>
          <RoleBadge role={profile?.role} />
        </View>

        {/* Quick Action Button */}
        <TouchableOpacity className="bg-blue-600 active:bg-blue-700 p-4 rounded-2xl flex-row items-center justify-between shadow-md shadow-blue-600/25 mb-5">
          <View className="flex-row items-center space-x-3">
            <View className="bg-white/20 p-2.5 rounded-xl">
              <Plus size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text className="text-sm font-bold text-white font-heading">
                Book Sacrament Appointment
              </Text>
              <Text className="text-xs text-blue-100 font-sans">
                Baptism, Wedding, Funeral, Confirmation
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Segmented Filter Control */}
        <View className="flex-row bg-slate-200/80 p-1 rounded-2xl mb-5">
          <TouchableOpacity
            onPress={() => setFilter('upcoming')}
            className={`flex-1 py-2 rounded-xl items-center ${
              filter === 'upcoming' ? 'bg-white shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-semibold font-sans ${
                filter === 'upcoming' ? 'text-blue-600' : 'text-slate-600'
              }`}
            >
              Upcoming (1)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('history')}
            className={`flex-1 py-2 rounded-xl items-center ${
              filter === 'history' ? 'bg-white shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-semibold font-sans ${
                filter === 'history' ? 'text-blue-600' : 'text-slate-600'
              }`}
            >
              Completed / History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Appointments List */}
        <View className="space-y-3">
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
            <View className="flex-row items-start justify-between mb-2">
              <View>
                <Text className="text-base font-bold text-slate-900 font-heading">
                  Holy Baptism
                </Text>
                <View className="flex-row items-center space-x-1 mt-0.5">
                  <Church size={13} color="#64748B" />
                  <Text className="text-xs text-slate-500 font-sans">
                    San Pedro Cathedral
                  </Text>
                </View>
              </View>
              <View className="bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex-row items-center space-x-1">
                <AlertCircle size={12} color="#D97706" />
                <Text className="text-[11px] font-bold text-amber-700">Pending Review</Text>
              </View>
            </View>

            <View className="bg-slate-50 rounded-xl p-3 my-2 border border-slate-100 flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2">
                <Calendar size={14} color="#2563EB" />
                <Text className="text-xs font-semibold text-slate-700 font-sans">
                  Saturday, Oct 10, 2026
                </Text>
              </View>
              <View className="flex-row items-center space-x-1">
                <Clock size={14} color="#64748B" />
                <Text className="text-xs text-slate-500 font-sans">10:00 AM</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between pt-2">
              <View className="flex-row items-center space-x-1">
                <FileText size={13} color="#64748B" />
                <Text className="text-xs text-slate-500 font-sans">
                  Birth Certificate uploaded
                </Text>
              </View>
              <Text className="text-xs font-semibold text-blue-600 font-sans">
                View Details →
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
