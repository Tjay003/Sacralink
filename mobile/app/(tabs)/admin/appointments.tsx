import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarCheck,
  Search,
  X,
  Filter,
  Inbox,
  AlertCircle,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useChurchAppointments,
  useChurchPriests,
} from '@/lib/supabase/adminWorkflows';
import { AdminAppointmentCard } from '@/components/admin/AdminAppointmentCard';

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all';

export default function AdminAppointmentsQueueScreen() {
  const { profile } = useAuth();
  const churchId = (profile as any)?.assigned_church_id || profile?.church_id;

  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch appointments for this church
  const {
    data: appointments = [],
    isLoading,
    isRefetching,
    refetch,
  } = useChurchAppointments(churchId, activeTab === 'all' ? undefined : activeTab);

  // Fetch available priests for appointment assignment
  const { data: churchPriests = [] } = useChurchPriests(churchId);

  // Client-side search filtering across applicant name, sacrament, and notes
  const filteredAppointments = useMemo(() => {
    if (!searchQuery.trim()) return appointments;
    const q = searchQuery.toLowerCase().trim();
    return appointments.filter((appt) => {
      const applicant = appt.user?.full_name?.toLowerCase() || '';
      const email = appt.user?.email?.toLowerCase() || '';
      const sacrament = appt.service_type.toLowerCase();
      const notes = (appt.notes || '').toLowerCase();
      return (
        applicant.includes(q) ||
        email.includes(q) ||
        sacrament.includes(q) ||
        notes.includes(q)
      );
    });
  }, [appointments, searchQuery]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1">
        {/* Top Header */}
        <View className="px-5 pt-3 pb-2 bg-white border-b border-slate-100">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-xs font-semibold uppercase tracking-wider text-blue-600 font-sans">
                Sacrament Triage
              </Text>
              <Text className="text-2xl font-bold text-slate-900 font-heading">
                Appointments Queue
              </Text>
            </View>
            <RoleBadge role={profile?.role || 'admin'} />
          </View>

          {/* Search Input Bar */}
          <View className="flex-row items-center bg-slate-100 rounded-2xl px-3.5 py-2.5 mb-2.5 border border-slate-200">
            <Search size={16} color="#64748B" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by parishioner name or sacrament..."
              placeholderTextColor="#94A3B8"
              className="flex-1 ml-2.5 text-xs text-slate-900 font-sans py-0"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Status Tabs */}
          <View className="flex-row space-x-2 py-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full border ${
                    isActive
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold font-sans ${
                      isActive ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Appointments List */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={['#2563EB']}
            />
          }
        >
          {isLoading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="text-xs text-slate-500 font-sans mt-3">
                Loading appointments queue...
              </Text>
            </View>
          ) : filteredAppointments.length === 0 ? (
            <View className="bg-white rounded-3xl p-8 border border-slate-200 items-center justify-center mt-6">
              <View className="w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-3">
                <Inbox size={26} color="#94A3B8" />
              </View>
              <Text className="text-base font-bold text-slate-800 font-heading">
                No Appointments Found
              </Text>
              <Text className="text-xs text-slate-500 font-sans text-center mt-1 px-4">
                {searchQuery
                  ? `No sacrament requests match "${searchQuery}".`
                  : `There are no ${activeTab === 'all' ? '' : activeTab} appointment requests in the parish queue.`}
              </Text>
            </View>
          ) : (
            filteredAppointments.map((appt) => (
              <AdminAppointmentCard
                key={appt.id}
                appointment={appt}
                churchPriests={churchPriests}
                onRefresh={refetch}
              />
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
