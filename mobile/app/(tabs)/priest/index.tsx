import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Users,
  Cross,
  Sparkles,
  Phone,
  Mail,
  User,
  Calendar,
  AlertCircle,
  Building2,
  Video,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  usePriestSchedule,
  usePriestAvailability,
  useTogglePriestDayAvailability,
} from '@/lib/supabase/adminWorkflows';
import { formatAppointmentDate, formatAppointmentTime } from '@/lib/supabase/appointments';

export default function PriestScheduleScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const priestId = profile?.id;
  const churchId = (profile as any)?.assigned_church_id || profile?.church_id;

  // Date constants
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowObj = new Date(now);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = dayNames[now.getDay()];

  // Fetch priest schedule (appointments + mass schedules)
  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    isRefetching,
    refetch,
  } = usePriestSchedule(priestId, churchId);

  // Fetch availability for Today and Tomorrow
  const { data: todayAvail, refetch: refetchTodayAvail } = usePriestAvailability(priestId, todayStr);
  const { data: tomorrowAvail, refetch: refetchTomorrowAvail } = usePriestAvailability(
    priestId,
    tomorrowStr
  );

  const toggleMutation = useTogglePriestDayAvailability();

  const isTodayAvailable = todayAvail ? todayAvail.isAvailable : true;
  const isTomorrowAvailable = tomorrowAvail ? tomorrowAvail.isAvailable : true;

  const handleToggleAvailability = async (targetDate: string, currentValue: boolean) => {
    if (!priestId) return;
    const newValue = !currentValue;
    try {
      await toggleMutation.mutateAsync({
        priestId,
        churchId: churchId || '',
        date: targetDate,
        isAvailable: newValue,
      });

      if (targetDate === todayStr) {
        refetchTodayAvail();
      } else {
        refetchTomorrowAvail();
      }
    } catch (err: any) {
      Alert.alert('Status Update Failed', err?.message || 'Could not update availability.');
    }
  };

  // Filter today's masses based on day of week
  const todayMasses = useMemo(() => {
    const list = scheduleData?.massSchedules || [];
    return list.filter(
      (m) => m.day_of_week.toLowerCase() === todayDayName.toLowerCase()
    );
  }, [scheduleData?.massSchedules, todayDayName]);

  const assignedAppointments = scheduleData?.appointments || [];
  const churchName = scheduleData?.churchName || 'Parish Church';

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              refetchTodayAvail();
              refetchTomorrowAvail();
            }}
            colors={['#F59E0B']}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center space-x-1 mb-0.5">
              <Building2 size={13} color="#D97706" />
              <Text
                className="text-xs font-semibold uppercase tracking-wider text-amber-600 font-sans"
                numberOfLines={1}
              >
                {churchName}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Liturgical Schedule
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'priest'} />
        </View>

        {/* Quick Availability Toggles (Today & Tomorrow) */}
        <View className="bg-white rounded-3xl p-5 border border-slate-200 mb-5 shadow-xs">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-sm font-bold text-slate-900 font-heading">
                Pastoral Duty & Availability
              </Text>
              <Text className="text-xs text-slate-500 font-sans">
                Set active hours for sacramental bookings
              </Text>
            </View>
            <View
              className={`px-2 py-0.5 rounded-full border ${
                isTodayAvailable
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-slate-100 border-slate-200'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  isTodayAvailable ? 'text-emerald-700' : 'text-slate-500'
                } font-sans`}
              >
                {isTodayAvailable ? 'On-Duty' : 'Off-Duty'}
              </Text>
            </View>
          </View>

          {/* Today Toggle Row */}
          <View className="flex-row items-center justify-between py-2 border-t border-slate-100">
            <View className="flex-1 mr-3">
              <Text className="text-xs font-bold text-slate-800 font-sans">
                Today ({todayDayName}, {formatAppointmentDate(todayStr)})
              </Text>
              <Text className="text-[11px] text-slate-500 font-sans">
                {isTodayAvailable
                  ? 'Available for baptisms, confessions & sick calls'
                  : 'Off-duty / Resting day'}
              </Text>
            </View>
            <Switch
              value={isTodayAvailable}
              onValueChange={() => handleToggleAvailability(todayStr, isTodayAvailable)}
              trackColor={{ false: '#CBD5E1', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Tomorrow Toggle Row */}
          <View className="flex-row items-center justify-between py-2 border-t border-slate-100">
            <View className="flex-1 mr-3">
              <Text className="text-xs font-bold text-slate-800 font-sans">
                Tomorrow ({formatAppointmentDate(tomorrowStr)})
              </Text>
              <Text className="text-[11px] text-slate-500 font-sans">
                {isTomorrowAvailable
                  ? 'Open for parish liturgical ceremonies'
                  : 'Marked as Off-duty'}
              </Text>
            </View>
            <Switch
              value={isTomorrowAvailable}
              onValueChange={() => handleToggleAvailability(tomorrowStr, isTomorrowAvailable)}
              trackColor={{ false: '#CBD5E1', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Today's Liturgies & Masses Timetable */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-slate-900 font-heading">
            Today's Mass Timetable ({todayDayName})
          </Text>
          <View className="bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <Text className="text-[10px] font-bold text-amber-700 font-sans">
              {todayMasses.length} {todayMasses.length === 1 ? 'Mass' : 'Masses'}
            </Text>
          </View>
        </View>

        {todayMasses.length === 0 ? (
          <View className="bg-white rounded-2xl p-5 border border-dashed border-slate-200 mb-6 items-center justify-center">
            <Cross size={24} color="#94A3B8" />
            <Text className="text-xs font-semibold text-slate-500 font-sans mt-2">
              No regular scheduled public masses listed for {todayDayName}.
            </Text>
          </View>
        ) : (
          <View className="space-y-2.5 mb-6">
            {todayMasses.map((mass) => (
              <View
                key={mass.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex-row items-center justify-between"
              >
                <View className="flex-row items-center space-x-3 flex-1 mr-2">
                  <View className="w-10 h-10 rounded-xl bg-amber-50 items-center justify-center border border-amber-100">
                    <Cross size={18} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900 font-heading">
                      Holy Sacrifice of the Mass
                    </Text>
                    <Text className="text-xs text-slate-500 font-sans">
                      {mass.language} Liturgy • Main Altar
                    </Text>
                  </View>
                </View>

                <View className="bg-amber-100 px-3 py-1.5 rounded-xl">
                  <Text className="text-xs font-bold text-amber-800 font-sans">
                    {formatAppointmentTime(mass.time)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Assigned Sacrament Appointments */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-slate-900 font-heading">
            Assigned Sacrament Ceremonies
          </Text>
          <View className="bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            <Text className="text-[10px] font-bold text-blue-700 font-sans">
              {assignedAppointments.length} Active
            </Text>
          </View>
        </View>

        {scheduleLoading ? (
          <View className="py-10 items-center justify-center">
            <ActivityIndicator size="small" color="#D97706" />
            <Text className="text-xs text-slate-500 font-sans mt-2">
              Loading priestly liturgical schedule...
            </Text>
          </View>
        ) : assignedAppointments.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 border border-slate-200 items-center justify-center">
            <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center mb-2">
              <CalendarDays size={22} color="#94A3B8" />
            </View>
            <Text className="text-sm font-bold text-slate-800 font-heading">
              No Assigned Appointments
            </Text>
            <Text className="text-xs text-slate-500 font-sans text-center mt-0.5">
              You currently have no sacrament ceremonies assigned to your calendar.
            </Text>
          </View>
        ) : (
          <View className="space-y-3">
            {assignedAppointments.map((appt) => {
              const isCounseling =
                appt.service_type.toLowerCase() === 'counseling' ||
                appt.service_type.toLowerCase().includes('counsel');

              return (
                <View
                  key={appt.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center space-x-1.5 mb-1">
                        <View className="bg-blue-50 px-2 py-0.5 rounded-md">
                          <Text className="text-[10px] font-bold text-blue-800 uppercase font-sans">
                            {appt.service_type}
                          </Text>
                        </View>
                        {isCounseling && (
                          <View className="bg-indigo-50 px-2 py-0.5 rounded-md flex-row items-center space-x-1">
                            <Video size={10} color="#4F46E5" />
                            <Text className="text-[10px] font-semibold text-indigo-700 font-sans">
                              Virtual Counseling
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-sm font-bold text-slate-900 font-heading">
                        {appt.service_type} Rite
                      </Text>
                    </View>

                    <View
                      className={`px-2.5 py-0.5 rounded-full border ${
                        appt.status === 'approved'
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          appt.status === 'approved' ? 'text-emerald-700' : 'text-amber-700'
                        } font-sans capitalize`}
                      >
                        {appt.status}
                      </Text>
                    </View>
                  </View>

                  {/* Slot & Parishioner Contact */}
                  <View className="bg-slate-50 rounded-xl p-3 my-1.5 border border-slate-100">
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center space-x-1.5">
                        <Calendar size={13} color="#2563EB" />
                        <Text className="text-xs font-bold text-slate-800 font-sans">
                          {formatAppointmentDate(appt.appointment_date)}
                        </Text>
                      </View>
                      <View className="flex-row items-center space-x-1">
                        <Clock size={12} color="#64748B" />
                        <Text className="text-xs font-medium text-slate-600 font-sans">
                          {formatAppointmentTime(appt.appointment_time)}
                        </Text>
                      </View>
                    </View>

                    {/* Parishioner Info */}
                    <View className="flex-row items-center space-x-2 pt-1 border-t border-slate-200">
                      <User size={13} color="#64748B" />
                      <Text className="text-xs font-semibold text-slate-800 font-sans">
                        {appt.user?.full_name || 'Parishioner'}
                      </Text>
                      {appt.user?.phone_number && (
                        <Text className="text-xs text-slate-500 font-sans">
                          • {appt.user.phone_number}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Prayer Intentions / Notes */}
                  {appt.notes && (
                    <View className="mt-2 bg-amber-50/70 p-2 rounded-xl border border-amber-100">
                      <View className="flex-row items-center space-x-1 mb-0.5">
                        <Sparkles size={11} color="#D97706" />
                        <Text className="text-[10px] font-bold text-amber-800 uppercase font-sans">
                          Special Intention
                        </Text>
                      </View>
                      <Text className="text-xs text-amber-900 font-sans italic" numberOfLines={2}>
                        "{appt.notes}"
                      </Text>
                    </View>
                  )}

                  {/* Quick Shortcut for Virtual Consultations */}
                  {isCounseling && (
                    <TouchableOpacity
                      onPress={() => router.push('/(tabs)/priest/consultations')}
                      className="mt-2.5 bg-blue-600 active:bg-blue-700 py-2 px-3 rounded-xl flex-row items-center justify-center space-x-1.5"
                    >
                      <Video size={13} color="#FFFFFF" />
                      <Text className="text-xs font-bold text-white font-sans">
                        Go to Consultation Room
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
