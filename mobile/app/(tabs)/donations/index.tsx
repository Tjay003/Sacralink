import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  HeartHandshake,
  QrCode,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
  Church,
  Plus,
  ArrowUpRight,
  Maximize2,
  Copy,
  Check,
  X,
  AlertTriangle,
  FileText,
  Calendar,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useUserDonations,
  type DonationWithChurch,
} from '@/lib/supabase/donations';

type FilterTab = 'all' | 'pending' | 'verified' | 'rejected';

function formatCurrency(amount: number): string {
  return `₱${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export default function DonationsScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  // Queries
  const { data, isLoading, refetch, isRefetching } = useUserDonations();
  const donations = data?.data || [];
  const totalVerifiedAmount = data?.totalVerifiedAmount || 0;

  // Filter state
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Inspection modal state
  const [selectedDonation, setSelectedDonation] = useState<DonationWithChurch | null>(null);
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [imageLightboxVisible, setImageLightboxVisible] = useState(false);

  // Filtered donations
  const filteredDonations = useMemo(() => {
    if (activeFilter === 'all') return donations;
    return donations.filter((d) => d.status === activeFilter);
  }, [donations, activeFilter]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: donations.length,
      pending: donations.filter((d) => d.status === 'pending').length,
      verified: donations.filter((d) => d.status === 'verified').length,
      rejected: donations.filter((d) => d.status === 'rejected').length,
    };
  }, [donations]);

  const handleCopyReference = async (refNum?: string | null) => {
    if (!refNum) return;
    await Clipboard.setStringAsync(refNum);
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 2000);
  };

  const handleOpenInspection = (donation: DonationWithChurch) => {
    setSelectedDonation(donation);
    setInspectionModalVisible(true);
  };

  const windowWidth = Dimensions.get('window').width;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-5 pt-3 pb-3 bg-white border-b border-slate-200 flex-row items-center justify-between">
        <View>
          <Text className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-sans">
            Parish Stewardship
          </Text>
          <Text className="text-xl font-bold text-slate-900 font-sans">
            My Donations
          </Text>
        </View>
        <View className="flex-row items-center space-x-2">
          <RoleBadge role={profile?.role} />
          <TouchableOpacity
            onPress={() => router.push('/donations/give' as any)}
            className="bg-blue-600 px-3.5 py-2 rounded-xl flex-row items-center space-x-1.5 shadow-sm shadow-blue-600/20"
          >
            <Plus size={15} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white font-sans">Give</Text>
          </TouchableOpacity>
        </View>
      </View>

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
        {/* Total Contributions Summary Card */}
        <View className="bg-slate-900 rounded-3xl p-5 mb-5 shadow-lg shadow-slate-900/15 overflow-hidden relative">
          {/* Subtle background decoration */}
          <View className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-600/20 pointer-events-none" />

          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-2">
              <View className="w-7 h-7 rounded-lg bg-blue-500/20 items-center justify-center">
                <HeartHandshake size={16} color="#60A5FA" />
              </View>
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-sans">
                Verified Offerings
              </Text>
            </View>

            <View className="bg-blue-500/20 px-2.5 py-1 rounded-full border border-blue-500/30">
              <Text className="text-[10px] font-bold text-blue-300 font-sans">
                {counts.verified} Verified
              </Text>
            </View>
          </View>

          <Text className="text-3xl font-extrabold text-white font-sans mb-1">
            {formatCurrency(totalVerifiedAmount)}
          </Text>

          <Text className="text-xs text-slate-400 font-sans leading-relaxed mb-4">
            Total verified cashless contributions to diocesan parishes and ministries.
          </Text>

          <View className="pt-3 border-t border-slate-800 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-4">
              <View>
                <Text className="text-[10px] uppercase font-bold text-slate-400 font-sans">
                  Pending
                </Text>
                <Text className="text-xs font-bold text-amber-400 font-sans">
                  {counts.pending}
                </Text>
              </View>
              <View className="h-6 w-px bg-slate-800" />
              <View>
                <Text className="text-[10px] uppercase font-bold text-slate-400 font-sans">
                  Total Records
                </Text>
                <Text className="text-xs font-bold text-white font-sans">
                  {counts.all}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/donations/give' as any)}
              className="bg-blue-600 px-3.5 py-1.5 rounded-xl flex-row items-center space-x-1"
            >
              <Text className="text-xs font-bold text-white font-sans">
                New Donation
              </Text>
              <ArrowUpRight size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row bg-slate-200/80 p-1 rounded-2xl mb-4">
          <TouchableOpacity
            onPress={() => setActiveFilter('all')}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center space-x-1 ${
              activeFilter === 'all' ? 'bg-white shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold font-sans ${
                activeFilter === 'all' ? 'text-slate-900' : 'text-slate-600'
              }`}
            >
              All
            </Text>
            <View
              className={`px-1.5 py-0.2 rounded-full ${
                activeFilter === 'all' ? 'bg-slate-100' : 'bg-slate-300/60'
              }`}
            >
              <Text className="text-[10px] font-bold text-slate-700">
                {counts.all}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('pending')}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center space-x-1 ${
              activeFilter === 'pending' ? 'bg-white shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold font-sans ${
                activeFilter === 'pending' ? 'text-amber-700' : 'text-slate-600'
              }`}
            >
              Pending
            </Text>
            <View
              className={`px-1.5 py-0.2 rounded-full ${
                activeFilter === 'pending' ? 'bg-amber-100' : 'bg-slate-300/60'
              }`}
            >
              <Text className="text-[10px] font-bold text-amber-800">
                {counts.pending}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('verified')}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center space-x-1 ${
              activeFilter === 'verified' ? 'bg-white shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold font-sans ${
                activeFilter === 'verified' ? 'text-emerald-700' : 'text-slate-600'
              }`}
            >
              Verified
            </Text>
            <View
              className={`px-1.5 py-0.2 rounded-full ${
                activeFilter === 'verified' ? 'bg-emerald-100' : 'bg-slate-300/60'
              }`}
            >
              <Text className="text-[10px] font-bold text-emerald-800">
                {counts.verified}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('rejected')}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center space-x-1 ${
              activeFilter === 'rejected' ? 'bg-white shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold font-sans ${
                activeFilter === 'rejected' ? 'text-rose-700' : 'text-slate-600'
              }`}
            >
              Rejected
            </Text>
            <View
              className={`px-1.5 py-0.2 rounded-full ${
                activeFilter === 'rejected' ? 'bg-rose-100' : 'bg-slate-300/60'
              }`}
            >
              <Text className="text-[10px] font-bold text-rose-800">
                {counts.rejected}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Donations Ledger List */}
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-xs text-slate-500 font-sans mt-3">
              Loading donation records...
            </Text>
          </View>
        ) : filteredDonations.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 border border-slate-200 items-center text-center my-4">
            <View className="w-14 h-14 rounded-2xl bg-slate-100 items-center justify-center mb-3">
              <Receipt size={26} color="#94A3B8" />
            </View>
            <Text className="text-base font-bold text-slate-900 font-sans mb-1 text-center">
              No Donations Found
            </Text>
            <Text className="text-xs text-slate-500 font-sans text-center leading-relaxed mb-5 max-w-xs">
              {activeFilter === 'all'
                ? 'You have not submitted any cashless parish donations yet.'
                : `No ${activeFilter} donations found in your history.`}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/donations/give' as any)}
              className="bg-blue-600 px-5 py-3 rounded-2xl shadow-sm shadow-blue-600/20"
            >
              <Text className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                Make an Offering Now
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="space-y-3">
            {filteredDonations.map((item) => {
              const churchName = item.church?.name || 'Parish Church';
              const isPending = item.status === 'pending';
              const isVerified = item.status === 'verified';
              const isRejected = item.status === 'rejected';

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleOpenInspection(item)}
                  activeOpacity={0.75}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs"
                >
                  {/* Top Row: Church Name & Status Badge */}
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center space-x-1.5 mb-1">
                        <Church size={14} color="#2563EB" />
                        <Text
                          numberOfLines={1}
                          className="text-xs font-bold text-slate-900 font-sans flex-1"
                        >
                          {churchName}
                        </Text>
                      </View>

                      {/* Purpose Pill */}
                      {item.purpose && (
                        <View className="self-start bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          <Text className="text-[10px] font-semibold text-slate-700 font-sans">
                            {item.purpose}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Status Chip */}
                    {isPending && (
                      <View className="bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex-row items-center space-x-1">
                        <Clock size={11} color="#D97706" />
                        <Text className="text-[10px] font-bold text-amber-800 font-sans">
                          Pending
                        </Text>
                      </View>
                    )}

                    {isVerified && (
                      <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-row items-center space-x-1">
                        <CheckCircle2 size={11} color="#059669" />
                        <Text className="text-[10px] font-bold text-emerald-800 font-sans">
                          Verified
                        </Text>
                      </View>
                    )}

                    {isRejected && (
                      <View className="bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 flex-row items-center space-x-1">
                        <XCircle size={11} color="#E11D48" />
                        <Text className="text-[10px] font-bold text-rose-800 font-sans">
                          Rejected
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Middle Row: Amount */}
                  <View className="my-1 flex-row items-baseline justify-between">
                    <Text className="text-lg font-extrabold text-slate-900 font-sans">
                      {formatCurrency(item.amount)}
                    </Text>
                    <Text className="text-[11px] text-slate-400 font-sans">
                      {formatDate(item.created_at)}
                    </Text>
                  </View>

                  {/* Bottom Row: Reference Number & Action */}
                  <View className="flex-row items-center justify-between pt-2 border-t border-slate-100 mt-2">
                    <View className="flex-row items-center space-x-1 flex-1 pr-2">
                      <Receipt size={12} color="#64748B" />
                      <Text
                        numberOfLines={1}
                        className="text-[11px] font-semibold text-slate-600 font-sans"
                      >
                        Ref: {item.reference_number || 'N/A'}
                      </Text>
                    </View>

                    <Text className="text-[11px] font-bold text-blue-600 font-sans">
                      View Details →
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Inspection Modal */}
      <Modal
        visible={inspectionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInspectionModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900/60 justify-end">
          <View
            style={{ maxHeight: '90%' }}
            className="bg-white rounded-t-3xl border-t border-slate-200 overflow-hidden"
          >
            {/* Modal Header */}
            <View className="px-5 py-4 border-b border-slate-100 flex-row items-center justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-semibold uppercase tracking-wider text-blue-600 font-sans">
                  Donation Verification Details
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-base font-bold text-slate-900 font-sans"
                >
                  {selectedDonation?.church?.name || 'Parish Donation'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInspectionModalVisible(false)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedDonation && (
              <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Status Notice Banner */}
                {selectedDonation.status === 'verified' && (
                  <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex-row items-center space-x-3 mb-4">
                    <View className="w-9 h-9 rounded-xl bg-emerald-500 items-center justify-center">
                      <CheckCircle2 size={20} color="#FFFFFF" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-emerald-900 font-sans">
                        Donation Verified
                      </Text>
                      <Text className="text-[11px] text-emerald-700 font-sans mt-0.5">
                        {selectedDonation.verified_at
                          ? `Officially acknowledged on ${formatDateTime(selectedDonation.verified_at)}.`
                          : 'Officially verified and recorded by the parish office.'}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedDonation.status === 'pending' && (
                  <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex-row items-center space-x-3 mb-4">
                    <View className="w-9 h-9 rounded-xl bg-amber-500 items-center justify-center">
                      <Clock size={20} color="#FFFFFF" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-amber-900 font-sans">
                        Verification in Progress
                      </Text>
                      <Text className="text-[11px] text-amber-700 font-sans mt-0.5">
                        Your cashless proof is queued for parish audit. Verification typically takes 24 to 48 hours.
                      </Text>
                    </View>
                  </View>
                )}

                {selectedDonation.status === 'rejected' && (
                  <View className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex-row items-start space-x-3 mb-4">
                    <View className="w-9 h-9 rounded-xl bg-rose-500 items-center justify-center mt-0.5">
                      <AlertTriangle size={18} color="#FFFFFF" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-rose-900 font-sans">
                        Verification Notice / Rejected
                      </Text>
                      <Text className="text-xs text-rose-700 font-sans mt-1 leading-relaxed">
                        {selectedDonation.notes ||
                          'Proof could not be verified against the parish statement. Please verify reference details.'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Amount & Purpose Hero Card */}
                <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4">
                  <View className="flex-row items-baseline justify-between mb-2">
                    <Text className="text-2xl font-extrabold text-slate-900 font-sans">
                      {formatCurrency(selectedDonation.amount)}
                    </Text>
                    <View className="bg-blue-100 px-2.5 py-1 rounded-full">
                      <Text className="text-[10px] font-bold text-blue-800 font-sans">
                        {selectedDonation.purpose || 'General Offering'}
                      </Text>
                    </View>
                  </View>

                  <View className="pt-2 border-t border-slate-200/80 space-y-1">
                    <View className="flex-row justify-between">
                      <Text className="text-[11px] text-slate-500 font-sans">Date Submitted</Text>
                      <Text className="text-[11px] font-semibold text-slate-800 font-sans">
                        {formatDateTime(selectedDonation.created_at)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-[11px] text-slate-500 font-sans">Parish</Text>
                      <Text className="text-[11px] font-semibold text-slate-800 font-sans">
                        {selectedDonation.church?.name || 'Parish Church'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Reference Number Card */}
                <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-2xs">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-sans mb-1.5">
                    Payment Reference Number
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-slate-900 font-sans">
                      {selectedDonation.reference_number || 'No reference'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleCopyReference(selectedDonation.reference_number)}
                      className={`px-3 py-1.5 rounded-xl flex-row items-center space-x-1 ${
                        refCopied ? 'bg-emerald-50 border border-emerald-300' : 'bg-slate-100'
                      }`}
                    >
                      {refCopied ? (
                        <>
                          <Check size={13} color="#059669" />
                          <Text className="text-[11px] font-bold text-emerald-700 font-sans">
                            Copied
                          </Text>
                        </>
                      ) : (
                        <>
                          <Copy size={13} color="#0F172A" />
                          <Text className="text-[11px] font-bold text-slate-700 font-sans">
                            Copy
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Donor Notes / Intentions */}
                {(selectedDonation.donor_notes || selectedDonation.notes) && (
                  <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-2xs">
                    <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-sans mb-1.5">
                      Prayer Intentions / Notes
                    </Text>
                    <Text className="text-xs text-slate-700 font-sans leading-relaxed">
                      {selectedDonation.donor_notes || selectedDonation.notes}
                    </Text>
                  </View>
                )}

                {/* Receipt Screenshot Viewer */}
                <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-2xs">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-sans">
                      Payment Proof Screenshot
                    </Text>
                    {selectedDonation.proof_url && (
                      <TouchableOpacity
                        onPress={() => setImageLightboxVisible(true)}
                        className="flex-row items-center space-x-1"
                      >
                        <Maximize2 size={13} color="#2563EB" />
                        <Text className="text-xs font-semibold text-blue-600 font-sans">
                          Expand
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {selectedDonation.proof_url ? (
                    <TouchableOpacity
                      onPress={() => setImageLightboxVisible(true)}
                      activeOpacity={0.85}
                      className="bg-slate-100 rounded-xl overflow-hidden items-center justify-center relative border border-slate-200"
                    >
                      <Image
                        source={{ uri: selectedDonation.proof_url }}
                        style={{ width: '100%', height: 240 }}
                        resizeMode="contain"
                      />
                      <View className="absolute bottom-2 right-2 bg-slate-900/80 px-2.5 py-1 rounded-lg flex-row items-center space-x-1">
                        <Maximize2 size={11} color="#FFFFFF" />
                        <Text className="text-[10px] font-semibold text-white font-sans">
                          Tap to inspect
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View className="py-6 items-center bg-slate-50 rounded-xl">
                      <FileText size={24} color="#94A3B8" />
                      <Text className="text-xs text-slate-400 font-sans mt-2">
                        No receipt image attached
                      </Text>
                    </View>
                  )}
                </View>

                {/* Close button */}
                <TouchableOpacity
                  onPress={() => setInspectionModalVisible(false)}
                  className="w-full bg-slate-100 py-3.5 rounded-2xl items-center"
                >
                  <Text className="text-xs font-bold text-slate-700 font-sans uppercase tracking-wider">
                    Close Details
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Full-Screen Receipt Lightbox Modal */}
      <Modal
        visible={imageLightboxVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageLightboxVisible(false)}
      >
        <View className="flex-1 bg-black/95 items-center justify-center p-4">
          <TouchableOpacity
            onPress={() => setImageLightboxVisible(false)}
            className="absolute top-12 right-6 w-10 h-10 rounded-full bg-white/20 items-center justify-center z-10"
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedDonation?.proof_url && (
            <Image
              source={{ uri: selectedDonation.proof_url }}
              style={{ width: windowWidth * 0.95, height: '80%' }}
              resizeMode="contain"
            />
          )}

          <Text className="text-slate-400 text-xs font-sans mt-3 text-center">
            Reference: {selectedDonation?.reference_number || 'N/A'}
          </Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
