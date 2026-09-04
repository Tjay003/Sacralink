import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import {
  Video,
  Calendar,
  Clock,
  User,
  Shield,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import { getJitsiMeetUrl } from '@/lib/supabase/messaging';
import { usePriestSchedule } from '@/lib/supabase/adminWorkflows';
import { formatAppointmentDate, formatAppointmentTime } from '@/lib/supabase/appointments';

export default function PriestConsultationsScreen() {
  const { profile } = useAuth();
  const priestId = profile?.id;
  const churchId = (profile as any)?.assigned_church_id || profile?.church_id;

  const {
    data: scheduleData,
    isLoading,
    isRefetching,
    refetch,
  } = usePriestSchedule(priestId, churchId);

  // Filter counseling and spiritual direction appointments
  const counselingSessions = useMemo(() => {
    const appts = scheduleData?.appointments || [];
    return appts.filter((a) => {
      const type = a.service_type.toLowerCase();
      const notes = (a.notes || '').toLowerCase();
      return (
        type.includes('counsel') ||
        type.includes('confession') ||
        notes.includes('counsel') ||
        notes.includes('virtual')
      );
    });
  }, [scheduleData?.appointments]);

  const handleLaunchMeeting = (roomId: string) => {
    const url = getJitsiMeetUrl(roomId);
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open video consultation URL:', err);
      Alert.alert('Connection Error', 'Could not open video consultation room.');
    });
  };

  const handleLaunchInstantRoom = () => {
    const cleanPriestId = priestId ? priestId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : 'general';
    const instantRoomId = `pastoral-priest-${cleanPriestId}`;
    handleLaunchMeeting(instantRoomId);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={['#4F46E5']}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 mr-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-indigo-600 font-sans">
              Pastoral Care & Tele-Ministry
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Virtual Consultations
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'priest'} />
        </View>

        {/* Video Consultation Room Hero Card */}
        <View className="bg-slate-900 rounded-3xl p-5 mb-5 shadow-sm">
          <View className="flex-row items-center space-x-2 mb-2">
            <View className="bg-indigo-600 p-2 rounded-xl">
              <Video size={18} color="#FFFFFF" />
            </View>
            <Text className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-sans">
              Encrypted Video Counseling
            </Text>
          </View>
          <Text className="text-lg font-bold text-white font-heading mb-1">
            Jitsi Meet Pastoral Chambers
          </Text>
          <Text className="text-xs text-slate-400 font-sans leading-relaxed mb-4">
            Conduct 1-on-1 private spiritual guidance, pre-cana interviews, and pastoral counseling sessions over peer-to-peer encrypted WebRTC video.
          </Text>

          <TouchableOpacity
            onPress={handleLaunchInstantRoom}
            className="bg-indigo-600 active:bg-indigo-700 py-3 px-4 rounded-xl flex-row items-center justify-center space-x-2"
          >
            <Video size={16} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white font-sans">
              Launch Instant Consultation Chamber
            </Text>
          </TouchableOpacity>
        </View>

        {/* Scheduled Sessions Header */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-slate-900 font-heading">
            Pastoral Appointments ({counselingSessions.length})
          </Text>
          <View className="bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            <Text className="text-[10px] font-bold text-indigo-700 font-sans">
              Virtual Ready
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text className="text-xs text-slate-500 font-sans mt-2">
              Loading pastoral sessions...
            </Text>
          </View>
        ) : counselingSessions.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 border border-slate-200 items-center justify-center">
            <View className="w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-3">
              <Video size={24} color="#94A3B8" />
            </View>
            <Text className="text-base font-bold text-slate-800 font-heading">
              No Pending Video Consultations
            </Text>
            <Text className="text-xs text-slate-500 font-sans text-center mt-1 mb-4 px-2">
              Parishioners requesting virtual spiritual direction or pre-cana counseling will appear in this dedicated dispatch room.
            </Text>
            <TouchableOpacity
              onPress={handleLaunchInstantRoom}
              className="bg-slate-100 active:bg-slate-200 py-2.5 px-4 rounded-xl flex-row items-center space-x-1.5"
            >
              <ExternalLink size={13} color="#4F46E5" />
              <Text className="text-xs font-bold text-indigo-700 font-sans">
                Open Personal Meeting Link
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="space-y-3.5">
            {counselingSessions.map((session) => {
              const roomId = `counseling-${session.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`;
              const isApproved = session.status === 'approved';

              return (
                <View
                  key={session.id}
                  className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center space-x-1.5 mb-1">
                        <View className="bg-indigo-50 px-2 py-0.5 rounded-md">
                          <Text className="text-[10px] font-bold text-indigo-800 uppercase font-sans">
                            {session.service_type}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-base font-bold text-slate-900 font-heading">
                        Virtual Counseling Session
                      </Text>
                    </View>

                    <View
                      className={`px-2.5 py-0.5 rounded-full border ${
                        isApproved
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          isApproved ? 'text-emerald-700' : 'text-amber-700'
                        } font-sans capitalize`}
                      >
                        {session.status}
                      </Text>
                    </View>
                  </View>

                  {/* Parishioner Info */}
                  <View className="flex-row items-center space-x-2 py-2 border-y border-slate-100 mb-2">
                    <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
                      <User size={15} color="#64748B" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-slate-800 font-sans">
                        {session.user?.full_name || 'Parishioner'}
                      </Text>
                      <Text className="text-[10px] text-slate-500 font-sans">
                        {session.user?.email || session.user?.phone_number || 'Parishioner Contact'}
                      </Text>
                    </View>
                  </View>

                  {/* Date & Time Slot */}
                  <View className="bg-slate-50 rounded-xl p-2.5 flex-row items-center justify-between mb-3 border border-slate-100">
                    <View className="flex-row items-center space-x-1.5">
                      <Calendar size={13} color="#4F46E5" />
                      <Text className="text-xs font-semibold text-slate-800 font-sans">
                        {formatAppointmentDate(session.appointment_date)}
                      </Text>
                    </View>
                    <View className="flex-row items-center space-x-1.5">
                      <Clock size={12} color="#64748B" />
                      <Text className="text-xs font-medium text-slate-600 font-sans">
                        {formatAppointmentTime(session.appointment_time)}
                      </Text>
                    </View>
                  </View>

                  {/* Spiritual Intention Note */}
                  {session.notes && (
                    <View className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 mb-3">
                      <View className="flex-row items-center space-x-1 mb-0.5">
                        <Sparkles size={11} color="#4F46E5" />
                        <Text className="text-[10px] font-bold text-indigo-800 uppercase font-sans">
                          Counseling Topic / Needs
                        </Text>
                      </View>
                      <Text className="text-xs text-indigo-950 font-sans italic" numberOfLines={2}>
                        "{session.notes}"
                      </Text>
                    </View>
                  )}

                  {/* Launch Video Room CTA Button */}
                  <TouchableOpacity
                    onPress={() => handleLaunchMeeting(roomId)}
                    className="bg-indigo-600 active:bg-indigo-700 py-3 rounded-xl flex-row items-center justify-center space-x-2"
                  >
                    <Video size={16} color="#FFFFFF" />
                    <Text className="text-xs font-bold text-white font-sans">
                      Launch Video Room (Jitsi Meet)
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
