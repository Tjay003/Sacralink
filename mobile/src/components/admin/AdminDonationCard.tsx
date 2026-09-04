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
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import {
  HandCoins,
  Receipt,
  User,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ZoomIn,
  X,
  Clock,
  ShieldCheck,
} from 'lucide-react-native';
import type { ChurchDonationWithDetails } from '@/lib/supabase/adminWorkflows';
import { useUpdateDonationStatus } from '@/lib/supabase/adminWorkflows';

export interface AdminDonationCardProps {
  donation: ChurchDonationWithDetails;
  onRefresh?: () => void;
}

export function AdminDonationCard({ donation, onRefresh }: AdminDonationCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [fullscreenReceipt, setFullscreenReceipt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adminNotes, setAdminNotes] = useState(donation.notes || '');

  const updateMutation = useUpdateDonationStatus();

  const formattedAmount = `₱${Number(donation.amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const donorName = donation.user?.full_name || 'Parishioner Donor';
  const status = donation.status || 'pending';

  const getStatusBadge = () => {
    switch (status) {
      case 'verified':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          label: 'Verified',
        };
      case 'rejected':
        return {
          bg: 'bg-rose-50',
          border: 'border-rose-200',
          text: 'text-rose-700',
          label: 'Rejected',
        };
      default:
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          label: 'Needs Verification',
        };
    }
  };

  const badge = getStatusBadge();

  const handleCopyReference = async () => {
    if (donation.reference_number) {
      await Clipboard.setStringAsync(donation.reference_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async () => {
    try {
      await updateMutation.mutateAsync({
        donationId: donation.id,
        status: 'verified',
        notes: adminNotes,
      });

      Alert.alert(
        'Donation Verified',
        `The donation of ${formattedAmount} has been verified and recorded in the parish financial ledger.`
      );
      setModalVisible(false);
      onRefresh?.();
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Could not verify donation.');
    }
  };

  const handleReject = async () => {
    if (!adminNotes.trim()) {
      Alert.alert(
        'Reason Required',
        'Please provide an administrative reason or note for rejecting this donation receipt.'
      );
      return;
    }

    Alert.alert(
      'Confirm Rejection',
      `Are you sure you want to mark this ${formattedAmount} donation as rejected?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Receipt',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateMutation.mutateAsync({
                donationId: donation.id,
                status: 'rejected',
                notes: adminNotes,
              });

              Alert.alert('Donation Rejected', 'The receipt has been marked as invalid.');
              setModalVisible(false);
              onRefresh?.();
            } catch (err: any) {
              Alert.alert('Rejection Failed', err?.message || 'Could not reject donation.');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      {/* Donation Card */}
      <View className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs mb-3.5">
        {/* Top Header: Amount & Status */}
        <View className="flex-row items-start justify-between mb-2">
          <View>
            <View className="flex-row items-center space-x-1.5 mb-1">
              <View className="bg-emerald-50 px-2 py-0.5 rounded-md">
                <Text className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-sans">
                  {donation.purpose || 'General Offering'}
                </Text>
              </View>
            </View>
            <Text className="text-xl font-bold text-slate-900 font-heading">
              {formattedAmount}
            </Text>
          </View>

          <View className={`${badge.bg} ${badge.border} border px-2.5 py-1 rounded-full`}>
            <Text className={`text-[11px] font-bold ${badge.text} font-sans`}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Donor & Reference Info */}
        <View className="flex-row items-center justify-between py-2 border-y border-slate-100 mb-2.5">
          <View className="flex-row items-center space-x-2">
            <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center border border-slate-200">
              {donation.user?.avatar_url ? (
                <Image
                  source={{ uri: donation.user.avatar_url }}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <User size={15} color="#64748B" />
              )}
            </View>
            <View>
              <Text className="text-xs font-bold text-slate-800 font-sans">{donorName}</Text>
              <Text className="text-[10px] text-slate-500 font-sans">
                {donation.user?.email || 'Parishioner'}
              </Text>
            </View>
          </View>

          {donation.reference_number && (
            <TouchableOpacity
              onPress={handleCopyReference}
              className="flex-row items-center space-x-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200"
            >
              <Receipt size={12} color="#64748B" />
              <Text className="text-[11px] font-mono font-semibold text-slate-700">
                {donation.reference_number}
              </Text>
              {copied ? (
                <Check size={12} color="#10B981" />
              ) : (
                <Copy size={12} color="#94A3B8" />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Receipt Proof Thumbnail Preview */}
        {donation.proof_url ? (
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="flex-row items-center space-x-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 mb-3"
          >
            <Image
              source={{ uri: donation.proof_url }}
              className="w-12 h-12 rounded-xl bg-slate-200"
              resizeMode="cover"
            />
            <View className="flex-1">
              <Text className="text-xs font-bold text-slate-800 font-sans">
                Payment Proof Screenshot
              </Text>
              <Text className="text-[11px] text-slate-500 font-sans">
                Tap to inspect high-resolution receipt
              </Text>
            </View>
            <ZoomIn size={16} color="#2563EB" />
          </TouchableOpacity>
        ) : (
          <View className="bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200 mb-3">
            <Text className="text-[11px] text-slate-400 font-sans text-center">
              No receipt proof attached
            </Text>
          </View>
        )}

        {/* Donor message if provided */}
        {donation.donor_notes && (
          <Text className="text-[11px] text-slate-600 font-sans italic bg-slate-50 p-2 rounded-xl mb-3 border border-slate-100">
            "{donation.donor_notes}"
          </Text>
        )}

        {/* CTA Button */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="bg-emerald-600 active:bg-emerald-700 py-2.5 px-4 rounded-xl flex-row items-center justify-center space-x-1.5"
        >
          <Text className="text-xs font-bold text-white font-sans">
            {status === 'pending' ? 'Verify Payment Receipt' : 'View Verification Details'}
          </Text>
          <ChevronRight size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ================================================================= */}
      {/* Verification Modal                                               */}
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
                <Text className="text-xs font-semibold text-emerald-600 uppercase tracking-wider font-sans">
                  Financial Stewardship
                </Text>
                <Text className="text-xl font-bold text-slate-900 font-heading">
                  Donation Verification
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
              {/* Offering Summary Card */}
              <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
                    Offering Amount
                  </Text>
                  <View className={`${badge.bg} ${badge.border} border px-2 py-0.5 rounded-md`}>
                    <Text className={`text-[10px] font-bold ${badge.text} font-sans`}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                <Text className="text-2xl font-bold text-slate-900 font-heading mb-1">
                  {formattedAmount}
                </Text>
                <Text className="text-xs text-slate-600 font-sans">
                  Purpose: {donation.purpose || 'General Offering'}
                </Text>

                <View className="pt-3 mt-3 border-t border-slate-200 flex-row items-center justify-between">
                  <View>
                    <Text className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">
                      Donor
                    </Text>
                    <Text className="text-xs font-bold text-slate-800 font-sans">{donorName}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">
                      Date Submitted
                    </Text>
                    <Text className="text-xs font-semibold text-slate-700 font-sans">
                      {new Date(donation.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Reference Number Box */}
              {donation.reference_number && (
                <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs mb-4">
                  <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-sans">
                    Payment Reference Number
                  </Text>
                  <View className="flex-row items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <Text className="text-sm font-mono font-bold text-slate-900 select-text">
                      {donation.reference_number}
                    </Text>
                    <TouchableOpacity
                      onPress={handleCopyReference}
                      className="flex-row items-center space-x-1.5 bg-blue-50 px-3 py-1.5 rounded-lg active:bg-blue-100"
                    >
                      {copied ? (
                        <>
                          <Check size={14} color="#10B981" />
                          <Text className="text-xs font-bold text-emerald-700 font-sans">
                            Copied!
                          </Text>
                        </>
                      ) : (
                        <>
                          <Copy size={14} color="#2563EB" />
                          <Text className="text-xs font-bold text-blue-700 font-sans">Copy</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Receipt Image Proof Viewer */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                    Receipt Attachment Proof
                  </Text>
                  {donation.proof_url && (
                    <TouchableOpacity
                      onPress={() => setFullscreenReceipt(true)}
                      className="flex-row items-center space-x-1"
                    >
                      <ZoomIn size={12} color="#2563EB" />
                      <Text className="text-xs font-semibold text-blue-600 font-sans">
                        Pinch / Zoom
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {donation.proof_url ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setFullscreenReceipt(true)}
                    className="bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 h-64 items-center justify-center relative"
                  >
                    <Image
                      source={{ uri: donation.proof_url }}
                      className="w-full h-full"
                      resizeMode="contain"
                    />
                    <View className="absolute bottom-2 right-2 bg-black/60 px-2.5 py-1 rounded-lg flex-row items-center space-x-1">
                      <ZoomIn size={12} color="#FFFFFF" />
                      <Text className="text-[10px] font-bold text-white font-sans">
                        Tap for Fullscreen
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 items-center justify-center">
                    <Receipt size={32} color="#94A3B8" />
                    <Text className="text-xs text-slate-500 font-sans mt-2">
                      No screenshot uploaded for this transaction.
                    </Text>
                  </View>
                )}
              </View>

              {/* Admin Notes / Reconciliation input */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-sans">
                  Admin Verification Notes / Audit Trail
                </Text>
                <TextInput
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  placeholder="e.g. Verified matched Maya merchant transaction ledger #1049"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  className="bg-white border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-900 font-sans min-h-[75px]"
                  textAlignVertical="top"
                />
              </View>

              {/* Action Buttons */}
              <View className="space-y-2.5">
                {status === 'pending' ? (
                  <View className="flex-row space-x-3">
                    <TouchableOpacity
                      onPress={handleVerify}
                      disabled={updateMutation.isPending}
                      className="flex-1 bg-emerald-600 active:bg-emerald-700 py-3.5 rounded-2xl flex-row items-center justify-center space-x-2"
                    >
                      {updateMutation.isPending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <CheckCircle2 size={18} color="#FFFFFF" />
                          <Text className="text-sm font-bold text-white font-sans">
                            Verify Payment
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
                        Reject Payment
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="bg-slate-100 p-3.5 rounded-2xl items-center">
                    <View className="flex-row items-center space-x-1.5">
                      <ShieldCheck size={16} color="#64748B" />
                      <Text className="text-xs font-bold text-slate-700 font-sans">
                        Donation status is {status}
                      </Text>
                    </View>
                    {donation.verified_at && (
                      <Text className="text-[10px] text-slate-500 font-sans mt-0.5">
                        Verified at {new Date(donation.verified_at).toLocaleString()}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* Fullscreen Pinch/Zoom Lightbox                                   */}
      {/* ================================================================= */}
      <Modal
        visible={fullscreenReceipt}
        animationType="fade"
        transparent
        onRequestClose={() => setFullscreenReceipt(false)}
      >
        <View className="flex-1 bg-black justify-between py-10 px-4">
          <View className="flex-row items-center justify-between pt-4 z-10">
            <Text className="text-sm font-bold text-white font-heading">
              Receipt Proof Inspector
            </Text>
            <View className="flex-row items-center space-x-3">
              {donation.proof_url && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(donation.proof_url!)}
                  className="bg-white/20 p-2 rounded-full"
                >
                  <ExternalLink size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setFullscreenReceipt(false)}
                className="bg-white/20 p-2 rounded-full"
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Pinch-to-zoom ScrollView container */}
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            {donation.proof_url && (
              <Image
                source={{ uri: donation.proof_url }}
                className="w-full h-full"
                resizeMode="contain"
              />
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={() => setFullscreenReceipt(false)}
            className="bg-white/20 py-3 rounded-2xl items-center justify-center z-10"
          >
            <Text className="text-xs font-bold text-white font-sans">Dismiss Inspector</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}
