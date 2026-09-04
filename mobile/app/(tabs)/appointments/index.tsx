import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Calendar,
  Clock,
  Plus,
  Church,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CheckCheck,
  FileText,
  MapPin,
  MessageSquare,
  AlertTriangle,
  X,
  Phone,
  Ban,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useUserAppointments,
  cancelAppointment,
  formatAppointmentDate,
  formatAppointmentTime,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/supabase/appointments';
import { formatFileSize } from '@/components/appointments/DocumentUploader';

export default function AppointmentsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [filter, setFilter] = useState<'upcoming' | 'history'>('upcoming');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // TanStack Query hook
  const {
    data: appointments = [],
    isLoading,
    isRefetching,
    refetch,
  } = useUserAppointments(profile?.id);

  // Separate upcoming vs history
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { upcomingList, historyList } = useMemo(() => {
    const upcoming: Appointment[] = [];
    const history: Appointment[] = [];

    appointments.forEach((appt) => {
      const isPastDate = appt.appointment_date < todayStr;
      const isTerminalStatus =
        appt.status === 'completed' ||
        appt.status === 'cancelled' ||
        appt.status === 'rejected';

      if (isTerminalStatus || isPastDate) {
        history.push(appt);
      } else {
        upcoming.push(appt);
      }
    });

    return { upcomingList: upcoming, historyList: history };
  }, [appointments, todayStr]);

  const displayedList = filter === 'upcoming' ? upcomingList : historyList;

  // Handle Cancel Appointment
  const handlePromptCancel = (appt: Appointment) => {
    Alert.alert(
      'Cancel Appointment',
      `Are you sure you want to cancel your ${appt.service_type} appointment at ${appt.church?.name || 'the parish'}?`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(appt.id);
            try {
              await cancelAppointment(appt.id, 'Cancelled by parishioner');
              await refetch();
              setSelectedAppointment(null);
              Alert.alert('Appointment Cancelled', 'Your booking request has been cancelled.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not cancel appointment.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Helper to render status chip
   */
  const renderStatusChip = (status: AppointmentStatus) => {
    switch (status) {
      case 'approved':
        return (
          <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-row items-center space-x-1">
            <CheckCircle2 size={12} color="#059669" />
            <Text className="text-[11px] font-bold text-emerald-700">Approved</Text>
          </View>
        );
      case 'rejected':
        return (
          <View className="bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 flex-row items-center space-x-1">
            <XCircle size={12} color="#E11D48" />
            <Text className="text-[11px] font-bold text-rose-700">Declined</Text>
          </View>
        );
      case 'rescheduled':
        return (
          <View className="bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex-row items-center space-x-1">
            <Clock size={12} color="#2563EB" />
            <Text className="text-[11px] font-bold text-blue-700">Rescheduled</Text>
          </View>
        );
      case 'completed':
        return (
          <View className="bg-slate-100 px-2.5 py-1 rounded-full border border-slate-300 flex-row items-center space-x-1">
            <CheckCheck size={12} color="#475569" />
            <Text className="text-[11px] font-bold text-slate-700">Completed</Text>
          </View>
        );
      case 'cancelled':
        return (
          <View className="bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 flex-row items-center space-x-1">
            <Ban size={12} color="#94A3B8" />
            <Text className="text-[11px] font-bold text-slate-500">Cancelled</Text>
          </View>
        );
      case 'pending':
      default:
        return (
          <View className="bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex-row items-center space-x-1">
            <AlertCircle size={12} color="#D97706" />
            <Text className="text-[11px] font-bold text-amber-700">Pending Review</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      >
        {/* Screen Header */}
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

        {/* Quick Action Button: Book Sacrament */}
        <TouchableOpacity
          onPress={() => router.push('/appointments/book' as any)}
          className="bg-blue-600 active:bg-blue-700 p-4 rounded-2xl flex-row items-center justify-between shadow-md shadow-blue-600/25 mb-5"
        >
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
          <ChevronRight size={18} color="#FFFFFF" />
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
              Upcoming ({upcomingList.length})
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
              History & Completed ({historyList.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading ? (
          <View className="bg-white rounded-2xl p-8 border border-slate-200 items-center justify-center my-4">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-xs text-slate-500 font-sans mt-3">
              Loading your appointments...
            </Text>
          </View>
        ) : displayedList.length === 0 ? (
          /* Empty State */
          <View className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs items-center text-center my-4">
            <View className="w-16 h-16 rounded-2xl bg-blue-50 items-center justify-center mb-3">
              <Calendar size={30} color="#2563EB" />
            </View>
            <Text className="text-base font-bold text-slate-900 font-heading mb-1">
              {filter === 'upcoming'
                ? 'No Upcoming Appointments'
                : 'No Appointment History'}
            </Text>
            <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed mb-6 px-4">
              {filter === 'upcoming'
                ? 'You do not have any pending or confirmed sacrament schedules. Reserve a slot at your parish church.'
                : 'Your completed or archived sacramental ministry records will appear here.'}
            </Text>
            {filter === 'upcoming' && (
              <TouchableOpacity
                onPress={() => router.push('/appointments/book' as any)}
                className="bg-blue-600 px-6 py-3 rounded-xl shadow-sm shadow-blue-600/25"
              >
                <Text className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                  Book Sacrament Now
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Appointments Cards List */
          <View className="space-y-3.5">
            {displayedList.map((appointment) => {
              const docCount = appointment.appointment_documents?.length || 0;

              return (
                <TouchableOpacity
                  key={appointment.id}
                  onPress={() => setSelectedAppointment(appointment)}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs mb-3 active:bg-slate-50/80"
                >
                  {/* Top Bar: Sacrament Title & Status Chip */}
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-bold text-slate-900 font-heading">
                        {appointment.service_type}
                      </Text>
                      <View className="flex-row items-center space-x-1 mt-0.5">
                        <Church size={13} color="#64748B" />
                        <Text
                          className="text-xs text-slate-500 font-sans flex-1"
                          numberOfLines={1}
                        >
                          {appointment.church?.name || 'Parish Church'}
                        </Text>
                      </View>
                    </View>
                    {renderStatusChip(appointment.status)}
                  </View>

                  {/* Schedule Box */}
                  <View className="bg-slate-50 rounded-xl p-3 my-2 border border-slate-100 flex-row items-center justify-between">
                    <View className="flex-row items-center space-x-2">
                      <Calendar size={14} color="#2563EB" />
                      <Text className="text-xs font-semibold text-slate-700 font-sans">
                        {formatAppointmentDate(appointment.appointment_date)}
                      </Text>
                    </View>
                    <View className="flex-row items-center space-x-1">
                      <Clock size={14} color="#64748B" />
                      <Text className="text-xs font-semibold text-slate-600 font-sans">
                        {formatAppointmentTime(appointment.appointment_time)}
                      </Text>
                    </View>
                  </View>

                  {/* Admin Feedback Notice if any */}
                  {appointment.admin_feedback && (
                    <View className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 mb-2 flex-row items-start space-x-1.5">
                      <AlertCircle size={13} color="#D97706" style={{ marginTop: 1 }} />
                      <Text className="text-[11px] text-amber-800 font-sans flex-1" numberOfLines={2}>
                        Parish Note: {appointment.admin_feedback}
                      </Text>
                    </View>
                  )}

                  {/* Footer: Documents Count & View Details Link */}
                  <View className="flex-row items-center justify-between pt-1 border-t border-slate-100 mt-1">
                    <View className="flex-row items-center space-x-1">
                      <FileText size={13} color="#64748B" />
                      <Text className="text-xs text-slate-500 font-sans">
                        {docCount > 0 ? `${docCount} document(s) uploaded` : 'No documents attached'}
                      </Text>
                    </View>
                    <Text className="text-xs font-bold text-blue-600 font-sans">
                      View Details →
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Appointment Detail Inspection Modal */}
      <Modal
        visible={Boolean(selectedAppointment)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedAppointment(null)}
      >
        <SafeAreaView edges={['bottom']} className="flex-1 bg-slate-900/60 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[88%] p-6 border-t border-slate-200">
            {/* Modal Header */}
            <View className="flex-row items-start justify-between pb-3.5 border-b border-slate-100 mb-4">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-semibold text-blue-600 uppercase tracking-wider font-sans">
                  Sacrament Booking Inspection
                </Text>
                <Text className="text-xl font-bold text-slate-900 font-heading">
                  {selectedAppointment?.service_type}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedAppointment(null)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
              {/* Status Banner */}
              <View className="flex-row items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-4">
                <Text className="text-xs font-bold text-slate-700 font-sans">
                  Current Status
                </Text>
                {selectedAppointment && renderStatusChip(selectedAppointment.status)}
              </View>

              {/* Parish Details */}
              <View className="bg-white p-4 rounded-2xl border border-slate-200 mb-4">
                <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans mb-2">
                  Parish Church
                </Text>
                <View className="flex-row items-start space-x-3">
                  <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center">
                    <Church size={20} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900 font-sans">
                      {selectedAppointment?.church?.name || 'San Jose Del Monte Parish'}
                    </Text>
                    {selectedAppointment?.church?.address && (
                      <View className="flex-row items-center space-x-1 mt-1">
                        <MapPin size={12} color="#64748B" />
                        <Text className="text-xs text-slate-500 font-sans">
                          {selectedAppointment.church.address}
                        </Text>
                      </View>
                    )}
                    {selectedAppointment?.church?.contact_number && (
                      <View className="flex-row items-center space-x-1 mt-1">
                        <Phone size={12} color="#64748B" />
                        <Text className="text-xs text-slate-500 font-sans">
                          {selectedAppointment.church.contact_number}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Schedule Info */}
              <View className="bg-white p-4 rounded-2xl border border-slate-200 mb-4">
                <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans mb-2">
                  Confirmed / Requested Schedule
                </Text>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center space-x-2">
                    <Calendar size={16} color="#2563EB" />
                    <Text className="text-xs font-bold text-slate-800 font-sans">
                      {formatAppointmentDate(selectedAppointment?.appointment_date)}
                    </Text>
                  </View>
                  <View className="flex-row items-center space-x-1">
                    <Clock size={16} color="#2563EB" />
                    <Text className="text-xs font-bold text-blue-700 font-sans">
                      {formatAppointmentTime(selectedAppointment?.appointment_time)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Admin Feedback / Remarks */}
              {selectedAppointment?.admin_feedback && (
                <View className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-4">
                  <View className="flex-row items-center space-x-1.5 mb-1">
                    <AlertTriangle size={15} color="#D97706" />
                    <Text className="text-xs font-bold text-amber-900 font-sans">
                      Admin Remarks / Instructions
                    </Text>
                  </View>
                  <Text className="text-xs text-amber-800 font-sans leading-relaxed">
                    {selectedAppointment.admin_feedback}
                  </Text>
                </View>
              )}

              {/* Special Notes & Intentions */}
              {selectedAppointment?.notes && (
                <View className="bg-white p-4 rounded-2xl border border-slate-200 mb-4">
                  <View className="flex-row items-center space-x-1.5 mb-1.5">
                    <MessageSquare size={14} color="#64748B" />
                    <Text className="text-xs font-bold text-slate-700 font-sans">
                      Special Intentions & Contact Information
                    </Text>
                  </View>
                  <Text className="text-xs text-slate-600 font-sans leading-relaxed whitespace-pre-wrap">
                    {selectedAppointment.notes}
                  </Text>
                </View>
              )}

              {/* Uploaded Documents */}
              <View className="bg-white p-4 rounded-2xl border border-slate-200 mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
                    Uploaded Documents ({selectedAppointment?.appointment_documents?.length || 0})
                  </Text>
                </View>

                {(!selectedAppointment?.appointment_documents ||
                  selectedAppointment.appointment_documents.length === 0) ? (
                  <Text className="text-xs text-slate-400 font-sans italic">
                    No documents were submitted for this appointment.
                  </Text>
                ) : (
                  selectedAppointment.appointment_documents.map((doc) => {
                    const isPdf =
                      doc.file_type?.includes('pdf') ||
                      doc.file_name?.toLowerCase().endsWith('.pdf');

                    return (
                      <View
                        key={doc.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2 flex-row items-center space-x-3"
                      >
                        {isPdf ? (
                          <View className="w-10 h-10 rounded-lg bg-rose-100 items-center justify-center border border-rose-200">
                            <FileText size={18} color="#E11D48" />
                          </View>
                        ) : (
                          <Image
                            source={{ uri: doc.file_url }}
                            className="w-10 h-10 rounded-lg bg-slate-200 border border-slate-300"
                            resizeMode="cover"
                          />
                        )}
                        <View className="flex-1">
                          <Text
                            className="text-xs font-bold text-slate-800 font-sans"
                            numberOfLines={1}
                            ellipsizeMode="middle"
                          >
                            {doc.file_name}
                          </Text>
                          <Text className="text-[11px] text-slate-400 font-sans mt-0.5">
                            {isPdf ? 'PDF File' : 'Image'} {doc.file_size ? `• ${formatFileSize(doc.file_size)}` : ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View className="pt-3 border-t border-slate-100 flex-row items-center space-x-3">
              {selectedAppointment?.status === 'pending' && (
                <TouchableOpacity
                  onPress={() => selectedAppointment && handlePromptCancel(selectedAppointment)}
                  disabled={Boolean(cancellingId)}
                  className="flex-1 py-3 rounded-xl border border-rose-200 bg-rose-50 active:bg-rose-100 items-center justify-center"
                >
                  {cancellingId === selectedAppointment?.id ? (
                    <ActivityIndicator size="small" color="#E11D48" />
                  ) : (
                    <Text className="text-xs font-bold text-rose-700 font-sans">
                      Cancel Appointment
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setSelectedAppointment(null)}
                className="flex-1 py-3 rounded-xl bg-slate-900 active:bg-slate-800 items-center justify-center"
              >
                <Text className="text-xs font-bold text-white font-sans">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
