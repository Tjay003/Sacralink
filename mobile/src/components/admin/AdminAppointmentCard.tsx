import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  X,
  UserCheck,
  Check,
  Eye,
} from 'lucide-react-native';
import type {
  ChurchAppointmentWithDetails,
  ChurchPriestProfile,
} from '@/lib/supabase/adminWorkflows';
import { useUpdateAppointmentStatus } from '@/lib/supabase/adminWorkflows';
import { formatAppointmentDate, formatAppointmentTime } from '@/lib/supabase/appointments';

export interface AdminAppointmentCardProps {
  appointment: ChurchAppointmentWithDetails;
  churchPriests?: ChurchPriestProfile[];
  onRefresh?: () => void;
}

export function AdminAppointmentCard({
  appointment,
  churchPriests = [],
  onRefresh,
}: AdminAppointmentCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [documentViewerUrl, setDocumentViewerUrl] = useState<string | null>(null);
  const [selectedPriestId, setSelectedPriestId] = useState<string | null>(
    appointment.priest_id || null
  );
  const [remarks, setRemarks] = useState(appointment.admin_feedback || '');

  const updateMutation = useUpdateAppointmentStatus();

  // Status badge coloring
  const status = appointment.status || 'pending';
  const getStatusBadge = () => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          label: 'Approved',
        };
      case 'rejected':
        return {
          bg: 'bg-rose-50',
          border: 'border-rose-200',
          text: 'text-rose-700',
          label: 'Rejected',
        };
      case 'completed':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          label: 'Completed',
        };
      default:
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          label: 'Pending Review',
        };
    }
  };

  const badgeStyle = getStatusBadge();
  const parishionerName = appointment.user?.full_name || 'Parishioner';
  const parishionerEmail = appointment.user?.email || null;
  const parishionerPhone = appointment.user?.phone_number || null;
  const documentsCount = appointment.appointment_documents?.length || 0;

  // Handle Approve Action
  const handleApprove = async () => {
    try {
      await updateMutation.mutateAsync({
        appointmentId: appointment.id,
        status: 'approved',
        remarks,
        priestId: selectedPriestId,
      });

      Alert.alert(
        'Appointment Approved',
        `The ${appointment.service_type} appointment has been approved and the parishioner has been notified.`
      );
      setModalVisible(false);
      onRefresh?.();
    } catch (err: any) {
      Alert.alert('Approval Failed', err?.message || 'Could not approve appointment.');
    }
  };

  // Handle Reject Action
  const handleReject = async () => {
    if (!remarks.trim()) {
      Alert.alert(
        'Reason Required',
        'Please enter admin remarks explaining the reason for rejection before rejecting this sacrament request.'
      );
      return;
    }

    Alert.alert(
      'Confirm Rejection',
      `Are you sure you want to reject this ${appointment.service_type} request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateMutation.mutateAsync({
                appointmentId: appointment.id,
                status: 'rejected',
                remarks,
                priestId: selectedPriestId,
              });

              Alert.alert('Appointment Rejected', 'The applicant has been notified of the decision.');
              setModalVisible(false);
              onRefresh?.();
            } catch (err: any) {
              Alert.alert('Rejection Failed', err?.message || 'Could not reject appointment.');
            }
          },
        },
      ]
    );
  };

  // Handle Mark Completed
  const handleComplete = async () => {
    try {
      await updateMutation.mutateAsync({
        appointmentId: appointment.id,
        status: 'completed',
        remarks,
        priestId: selectedPriestId,
      });

      Alert.alert('Ceremony Completed', 'Sacrament has been marked as fulfilled.');
      setModalVisible(false);
      onRefresh?.();
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not update status.');
    }
  };

  return (
    <>
      {/* Outer Card Component */}
      <View className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs mb-3.5">
        {/* Top Header: Service & Status */}
        <View className="flex-row items-start justify-between mb-2.5">
          <View className="flex-1 mr-2">
            <View className="flex-row items-center space-x-1.5 mb-0.5">
              <View className="bg-blue-100 px-2 py-0.5 rounded-md">
                <Text className="text-[10px] font-bold text-blue-800 uppercase tracking-wider font-sans">
                  {appointment.service_type}
                </Text>
              </View>
              {appointment.priest && (
                <View className="bg-amber-50 px-2 py-0.5 rounded-md flex-row items-center space-x-1">
                  <UserCheck size={10} color="#D97706" />
                  <Text className="text-[10px] font-semibold text-amber-700 font-sans">
                    {appointment.priest.full_name}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-base font-bold text-slate-900 font-heading">
              {appointment.service_type} Ceremony
            </Text>
          </View>

          <View className={`${badgeStyle.bg} ${badgeStyle.border} border px-2.5 py-1 rounded-full`}>
            <Text className={`text-[11px] font-bold ${badgeStyle.text} font-sans`}>
              {badgeStyle.label}
            </Text>
          </View>
        </View>

        {/* Applicant Details */}
        <View className="flex-row items-center space-x-2 mb-2.5">
          <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center border border-slate-200">
            {appointment.user?.avatar_url ? (
              <Image
                source={{ uri: appointment.user.avatar_url }}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <User size={16} color="#64748B" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-slate-800 font-sans">
              {parishionerName}
            </Text>
            <Text className="text-[11px] text-slate-500 font-sans" numberOfLines={1}>
              {parishionerEmail || parishionerPhone || 'Parishioner Account'}
            </Text>
          </View>
        </View>

        {/* Slot Info Banner */}
        <View className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-1.5">
            <Calendar size={14} color="#2563EB" />
            <Text className="text-xs font-semibold text-slate-700 font-sans">
              {formatAppointmentDate(appointment.appointment_date)}
            </Text>
          </View>
          <View className="flex-row items-center space-x-1.5">
            <Clock size={13} color="#64748B" />
            <Text className="text-xs font-medium text-slate-600 font-sans">
              {formatAppointmentTime(appointment.appointment_time)}
            </Text>
          </View>
          <View className="flex-row items-center space-x-1">
            <FileText size={13} color={documentsCount > 0 ? '#10B981' : '#94A3B8'} />
            <Text
              className={`text-xs font-medium ${
                documentsCount > 0 ? 'text-emerald-700' : 'text-slate-400'
              } font-sans`}
            >
              {documentsCount} {documentsCount === 1 ? 'doc' : 'docs'}
            </Text>
          </View>
        </View>

        {/* Parishioner Notes preview if available */}
        {appointment.notes && (
          <Text
            className="text-xs text-slate-600 font-sans bg-slate-50 p-2 rounded-xl mb-3 border border-slate-100 italic"
            numberOfLines={2}
          >
            "{appointment.notes}"
          </Text>
        )}

        {/* Action Button: Review & Triage */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="bg-blue-600 active:bg-blue-700 py-2.5 px-4 rounded-xl flex-row items-center justify-center space-x-1.5"
        >
          <Text className="text-xs font-bold text-white font-sans">
            {status === 'pending' ? 'Review & Triage' : 'View Full Details'}
          </Text>
          <ChevronRight size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ================================================================= */}
      {/* Triage & Review Modal                                            */}
      {/* ================================================================= */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
        transparent={Platform.OS === 'android'}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[92%] flex-1 pt-4 pb-8 px-5">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <View>
                <Text className="text-xs font-semibold text-blue-600 uppercase tracking-wider font-sans">
                  Sacrament Triage
                </Text>
                <Text className="text-xl font-bold text-slate-900 font-heading">
                  {appointment.service_type} Review
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
            >
              {/* Parishioner Profile Section */}
              <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4">
                <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 font-sans">
                  Parishioner Information
                </Text>
                <View className="flex-row items-center space-x-3 mb-3">
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center border border-blue-200">
                    {appointment.user?.avatar_url ? (
                      <Image
                        source={{ uri: appointment.user.avatar_url }}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <User size={20} color="#2563EB" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900 font-heading">
                      {parishionerName}
                    </Text>
                    <Text className="text-xs text-slate-500 font-sans">
                      Applicant ID: {appointment.user_id.slice(0, 8)}...
                    </Text>
                  </View>
                </View>

                {parishionerEmail && (
                  <View className="flex-row items-center space-x-2 py-1">
                    <Mail size={13} color="#64748B" />
                    <Text className="text-xs text-slate-700 font-sans">{parishionerEmail}</Text>
                  </View>
                )}

                {parishionerPhone && (
                  <View className="flex-row items-center space-x-2 py-1">
                    <Phone size={13} color="#64748B" />
                    <Text className="text-xs text-slate-700 font-sans">{parishionerPhone}</Text>
                  </View>
                )}

                <View className="flex-row items-center justify-between pt-2 mt-2 border-t border-slate-200">
                  <View className="flex-row items-center space-x-1.5">
                    <Calendar size={13} color="#2563EB" />
                    <Text className="text-xs font-semibold text-slate-800 font-sans">
                      {formatAppointmentDate(appointment.appointment_date)}
                    </Text>
                  </View>
                  <View className="flex-row items-center space-x-1.5">
                    <Clock size={13} color="#64748B" />
                    <Text className="text-xs font-semibold text-slate-700 font-sans">
                      {formatAppointmentTime(appointment.appointment_time)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Special Intentions / Notes */}
              {appointment.notes && (
                <View className="bg-amber-50 rounded-2xl p-4 border border-amber-200 mb-4">
                  <View className="flex-row items-center space-x-1.5 mb-1">
                    <Sparkles size={14} color="#D97706" />
                    <Text className="text-xs font-bold text-amber-800 font-heading uppercase">
                      Parishioner Notes & Intentions
                    </Text>
                  </View>
                  <Text className="text-xs text-amber-900 font-sans leading-relaxed">
                    {appointment.notes}
                  </Text>
                </View>
              )}

              {/* Attached Certificate Documents */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                    Submitted Certificates ({documentsCount})
                  </Text>
                  <Text className="text-[11px] text-slate-500 font-sans">Tap file to view</Text>
                </View>

                {documentsCount === 0 ? (
                  <View className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 items-center justify-center">
                    <FileText size={24} color="#94A3B8" />
                    <Text className="text-xs text-slate-500 font-sans mt-1">
                      No documents submitted for this appointment.
                    </Text>
                  </View>
                ) : (
                  <View className="space-y-2">
                    {appointment.appointment_documents?.map((doc) => {
                      const isImage =
                        doc.file_type?.startsWith('image/') ||
                        doc.file_url.match(/\.(jpg|jpeg|png|webp)/i);

                      return (
                        <TouchableOpacity
                          key={doc.id}
                          onPress={() => setDocumentViewerUrl(doc.file_url)}
                          className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex-row items-center justify-between"
                        >
                          <View className="flex-row items-center space-x-3 flex-1 mr-2">
                            <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center border border-blue-100">
                              <FileText size={18} color="#2563EB" />
                            </View>
                            <View className="flex-1">
                              <Text
                                className="text-xs font-bold text-slate-800 font-sans"
                                numberOfLines={1}
                              >
                                {doc.file_name || 'Uploaded Document'}
                              </Text>
                              <Text className="text-[10px] text-slate-500 font-sans">
                                {isImage ? 'Certificate Image' : 'PDF Document'}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-center space-x-1 bg-blue-50 px-2.5 py-1 rounded-lg">
                            <Eye size={12} color="#2563EB" />
                            <Text className="text-xs font-bold text-blue-700 font-sans">View</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Priest Assignment Selector */}
              <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4">
                <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-sans">
                  Assign Officiating Priest
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                  <View className="flex-row space-x-2">
                    <TouchableOpacity
                      onPress={() => setSelectedPriestId(null)}
                      className={`px-3 py-2 rounded-xl border flex-row items-center space-x-1.5 ${
                        selectedPriestId === null
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <UserCheck
                        size={14}
                        color={selectedPriestId === null ? '#FFFFFF' : '#64748B'}
                      />
                      <Text
                        className={`text-xs font-bold ${
                          selectedPriestId === null ? 'text-white' : 'text-slate-700'
                        } font-sans`}
                      >
                        Parish Clergy (Default)
                      </Text>
                    </TouchableOpacity>

                    {churchPriests.map((priest) => {
                      const isSelected = selectedPriestId === priest.id;
                      return (
                        <TouchableOpacity
                          key={priest.id}
                          onPress={() => setSelectedPriestId(priest.id)}
                          className={`px-3 py-2 rounded-xl border flex-row items-center space-x-1.5 ${
                            isSelected
                              ? 'bg-amber-600 border-amber-600'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <UserCheck
                            size={14}
                            color={isSelected ? '#FFFFFF' : '#D97706'}
                          />
                          <Text
                            className={`text-xs font-bold ${
                              isSelected ? 'text-white' : 'text-slate-800'
                            } font-sans`}
                          >
                            Fr. {priest.full_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Admin Remarks & Notification Text Input */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-sans">
                  Admin Feedback / Reason (Sent to Parishioner)
                </Text>
                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="e.g. Approved. Please bring physical PSA certificates 15 mins prior."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  className="bg-white border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-900 font-sans min-h-[80px]"
                  textAlignVertical="top"
                />
              </View>

              {/* Action Buttons */}
              <View className="space-y-2.5">
                {status === 'pending' ? (
                  <View className="flex-row space-x-3">
                    <TouchableOpacity
                      onPress={handleApprove}
                      disabled={updateMutation.isPending}
                      className="flex-1 bg-emerald-600 active:bg-emerald-700 py-3.5 rounded-2xl flex-row items-center justify-center space-x-2"
                    >
                      {updateMutation.isPending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <CheckCircle2 size={18} color="#FFFFFF" />
                          <Text className="text-sm font-bold text-white font-sans">
                            Approve Ceremony
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleReject}
                      disabled={updateMutation.isPending}
                      className="flex-1 bg-rose-50 active:bg-rose-100 border border-rose-200 py-3.5 rounded-2xl flex-row items-center justify-center space-x-2"
                    >
                      <XCircle size={18} color="#E11D48" />
                      <Text className="text-sm font-bold text-rose-600 font-sans">
                        Reject Request
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : status === 'approved' ? (
                  <TouchableOpacity
                    onPress={handleComplete}
                    disabled={updateMutation.isPending}
                    className="bg-blue-600 active:bg-blue-700 py-3.5 rounded-2xl flex-row items-center justify-center space-x-2"
                  >
                    {updateMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Check size={18} color="#FFFFFF" />
                        <Text className="text-sm font-bold text-white font-sans">
                          Mark Sacrament Completed
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View className="bg-slate-100 p-3 rounded-2xl items-center">
                    <Text className="text-xs font-semibold text-slate-500 font-sans">
                      This sacrament is {status}.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* Fullscreen Certificate Viewer Lightbox                            */}
      {/* ================================================================= */}
      <Modal
        visible={Boolean(documentViewerUrl)}
        animationType="fade"
        transparent
        onRequestClose={() => setDocumentViewerUrl(null)}
      >
        <View className="flex-1 bg-black/95 justify-between py-10 px-4">
          <View className="flex-row items-center justify-between pt-4">
            <Text className="text-sm font-bold text-white font-heading">Document Preview</Text>
            <View className="flex-row items-center space-x-3">
              {documentViewerUrl && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(documentViewerUrl)}
                  className="bg-white/20 p-2 rounded-full"
                >
                  <ExternalLink size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setDocumentViewerUrl(null)}
                className="bg-white/20 p-2 rounded-full"
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-1 items-center justify-center my-4">
            {documentViewerUrl ? (
              <Image
                source={{ uri: documentViewerUrl }}
                className="w-full h-full"
                resizeMode="contain"
              />
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() => setDocumentViewerUrl(null)}
            className="bg-white/20 py-3 rounded-2xl items-center justify-center"
          >
            <Text className="text-xs font-bold text-white font-sans">Close Preview</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}
