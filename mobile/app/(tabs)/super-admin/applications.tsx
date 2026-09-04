import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Church,
  MapPin,
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  User,
  X,
  CreditCard,
  Building2,
  Clock,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useParishApplications,
  useReviewParishApplication,
  ParishApplicationItem,
} from '@/lib/supabase/superAdmin';

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all';

export default function SuperAdminApplicationsScreen() {
  const { profile } = useAuth();
  const [selectedTab, setSelectedTab] = useState<FilterTab>('pending');
  const [selectedApp, setSelectedApp] = useState<ParishApplicationItem | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');

  const {
    data: allApplications = [],
    isLoading,
    isRefetching,
    refetch,
  } = useParishApplications('all');

  const reviewMutation = useReviewParishApplication();

  // Tab counts calculation
  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    allApplications.forEach((app) => {
      if (app.status === 'pending' || app.status === 'under_review') {
        pending++;
      } else if (app.status === 'verified_active' || app.status === 'approved') {
        approved++;
      } else if (app.status === 'rejected') {
        rejected++;
      }
    });

    return {
      pending,
      approved,
      rejected,
      all: allApplications.length,
    };
  }, [allApplications]);

  // Filtered applications based on current tab
  const filteredApplications = useMemo(() => {
    if (selectedTab === 'pending') {
      return allApplications.filter(
        (app) => app.status === 'pending' || app.status === 'under_review'
      );
    }
    if (selectedTab === 'approved') {
      return allApplications.filter(
        (app) => app.status === 'verified_active' || app.status === 'approved'
      );
    }
    if (selectedTab === 'rejected') {
      return allApplications.filter((app) => app.status === 'rejected');
    }
    return allApplications;
  }, [allApplications, selectedTab]);

  const resolveDocUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://oaczurouvaevebpimply.supabase.co/storage/v1/object/public/church-images/${url}`;
  };

  const handleOpenDoc = async (url?: string | null, docLabel = 'Document') => {
    const fullUrl = resolveDocUrl(url);
    if (!fullUrl) {
      Alert.alert('Not Available', `No accreditation link attached for ${docLabel}.`);
      return;
    }

    try {
      const supported = await Linking.canOpenURL(fullUrl);
      if (supported) {
        await Linking.openURL(fullUrl);
      } else {
        Alert.alert('External Link', `Document URL: ${fullUrl}`);
      }
    } catch {
      Alert.alert('Error', 'Unable to launch document viewer on this device.');
    }
  };

  const handleApprove = (app: ParishApplicationItem) => {
    Alert.alert(
      'Approve & Onboard Parish',
      `Are you sure you want to approve "${app.parish_name}"? This will officially register the parish in the diocese and promote the applicant to Parish Administrator.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Activate',
          style: 'default',
          onPress: async () => {
            try {
              await reviewMutation.mutateAsync({
                applicationId: app.id,
                status: 'approved',
                adminFeedback: reviewFeedback.trim() || undefined,
              });
              Alert.alert(
                'Parish Onboarded! 🎉',
                `"${app.parish_name}" is now active in the SacraLink directory.`
              );
              setSelectedApp(null);
              setReviewFeedback('');
            } catch (err: any) {
              Alert.alert('Approval Error', err?.message || 'Could not approve application.');
            }
          },
        },
      ]
    );
  };

  const handleReject = (app: ParishApplicationItem) => {
    if (!reviewFeedback.trim()) {
      Alert.alert(
        'Feedback Required',
        'Please enter a rejection reason or guidance for the applicant before rejecting.'
      );
      return;
    }

    Alert.alert(
      'Reject Parish Application',
      `Are you sure you want to reject "${app.parish_name}"? The applicant will be notified with your feedback.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Application',
          style: 'destructive',
          onPress: async () => {
            try {
              await reviewMutation.mutateAsync({
                applicationId: app.id,
                status: 'rejected',
                adminFeedback: reviewFeedback.trim(),
              });
              Alert.alert(
                'Application Rejected',
                `The applicant has been notified of the decision.`
              );
              setSelectedApp(null);
              setReviewFeedback('');
            } catch (err: any) {
              Alert.alert('Rejection Error', err?.message || 'Could not reject application.');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'verified_active' || status === 'approved') {
      return (
        <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-row items-center space-x-1">
          <CheckCircle2 size={11} color="#059669" />
          <Text className="text-[11px] font-bold text-emerald-700">Approved</Text>
        </View>
      );
    }
    if (status === 'rejected') {
      return (
        <View className="bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 flex-row items-center space-x-1">
          <XCircle size={11} color="#E11D48" />
          <Text className="text-[11px] font-bold text-rose-700">Rejected</Text>
        </View>
      );
    }
    return (
      <View className="bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex-row items-center space-x-1">
        <Clock size={11} color="#D97706" />
        <Text className="text-[11px] font-bold text-amber-700">Pending Review</Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="px-5 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-purple-700 font-sans">
              Diocesan Governance
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              Parish Applications
            </Text>
          </View>
          <RoleBadge role={profile?.role || 'super_admin'} />
        </View>

        {/* Filter Tabs */}
        <View className="flex-row bg-slate-200/80 p-1 rounded-2xl">
          {(
            [
              { key: 'pending', label: 'Pending', count: counts.pending },
              { key: 'approved', label: 'Approved', count: counts.approved },
              { key: 'rejected', label: 'Rejected', count: counts.rejected },
              { key: 'all', label: 'All', count: counts.all },
            ] as const
          ).map((tab) => {
            const isSelected = selectedTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setSelectedTab(tab.key)}
                className={`flex-1 py-2 px-1 rounded-xl items-center justify-center flex-row space-x-1 ${
                  isSelected ? 'bg-white shadow-xs' : ''
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? 'text-purple-950 font-bold' : 'text-slate-600'
                  }`}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                <View
                  className={`px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-purple-100' : 'bg-slate-300/60'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      isSelected ? 'text-purple-800' : 'text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Applications List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={['#7C3AED']}
          />
        }
      >
        {isLoading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text className="text-xs text-slate-500 font-sans mt-3">
              Loading parish verification queue...
            </Text>
          </View>
        ) : filteredApplications.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 items-center justify-center border border-slate-200 mt-6">
            <View className="w-14 h-14 rounded-2xl bg-purple-50 items-center justify-center mb-3">
              <Church size={28} color="#7C3AED" />
            </View>
            <Text className="text-base font-bold text-slate-900 font-heading text-center">
              No Applications Found
            </Text>
            <Text className="text-xs text-slate-500 font-sans text-center mt-1 leading-relaxed">
              {selectedTab === 'pending'
                ? 'All proposed parish applications have been reviewed.'
                : `No parish onboarding records categorized under "${selectedTab}".`}
            </Text>
          </View>
        ) : (
          <View className="space-y-3">
            {filteredApplications.map((app) => {
              const isPending = app.status === 'pending' || app.status === 'under_review';
              const submittedDate = app.created_at
                ? new Date(app.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recently';

              return (
                <View
                  key={app.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-2">
                      <Text className="text-base font-bold text-slate-900 font-heading">
                        {app.parish_name}
                      </Text>
                      <View className="flex-row items-center space-x-1 mt-0.5">
                        <MapPin size={13} color="#64748B" />
                        <Text className="text-xs text-slate-500 font-sans" numberOfLines={1}>
                          {app.address}
                        </Text>
                      </View>
                    </View>
                    {getStatusBadge(app.status)}
                  </View>

                  {/* Applicant Details Pill */}
                  <View className="bg-slate-50 rounded-xl p-3 my-2 border border-slate-100">
                    <View className="flex-row items-center space-x-1.5 mb-1">
                      <User size={13} color="#7C3AED" />
                      <Text className="text-xs font-semibold text-slate-800 font-sans">
                        Applicant: {app.applicant?.full_name || 'Priest / Coordinator'}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-slate-500 font-sans">
                        {app.contact_number || app.applicant?.phone_number || 'No contact provided'}
                      </Text>
                      <View className="flex-row items-center space-x-1">
                        <Calendar size={11} color="#94A3B8" />
                        <Text className="text-[11px] text-slate-400 font-sans">
                          {submittedDate}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row space-x-2 pt-1">
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedApp(app);
                        setReviewFeedback(app.rejection_reason || '');
                      }}
                      className="flex-1 bg-purple-50 active:bg-purple-100 border border-purple-200 py-2.5 rounded-xl flex-row items-center justify-center space-x-1.5"
                    >
                      <FileText size={15} color="#7C3AED" />
                      <Text className="text-xs font-bold text-purple-700 font-sans">
                        Inspect Dossier
                      </Text>
                    </TouchableOpacity>

                    {isPending && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleApprove(app)}
                        className="bg-emerald-600 active:bg-emerald-700 px-4 py-2.5 rounded-xl flex-row items-center justify-center space-x-1"
                      >
                        <CheckCircle2 size={15} color="#FFFFFF" />
                        <Text className="text-xs font-bold text-white font-sans">
                          Approve
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Inspection Modal */}
      {selectedApp && (
        <Modal
          visible={Boolean(selectedApp)}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedApp(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-slate-900/60 justify-end"
          >
            <View className="bg-white rounded-t-3xl max-h-[92%] p-5 shadow-2xl">
              {/* Modal Header */}
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-purple-700 font-sans">
                    Parish Accreditation Dossier
                  </Text>
                  <Text className="text-lg font-bold text-slate-900 font-heading" numberOfLines={1}>
                    {selectedApp.parish_name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedApp(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                >
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Status Indicator */}
                <View className="flex-row items-center justify-between bg-slate-50 p-3 rounded-2xl mb-4 border border-slate-100">
                  <View>
                    <Text className="text-[11px] text-slate-500 font-sans">Current Status</Text>
                    <Text className="text-xs font-bold text-slate-800 font-sans mt-0.5">
                      {selectedApp.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                  {getStatusBadge(selectedApp.status)}
                </View>

                {/* Parish Details */}
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-2">
                  Parish Specifications
                </Text>
                <View className="bg-white p-3.5 rounded-2xl border border-slate-200 mb-4 space-y-2">
                  <View className="flex-row items-start space-x-2">
                    <MapPin size={15} color="#64748B" className="mt-0.5" />
                    <View className="flex-1">
                      <Text className="text-xs font-medium text-slate-500 font-sans">Location</Text>
                      <Text className="text-sm font-semibold text-slate-800 font-sans">
                        {selectedApp.address}
                      </Text>
                    </View>
                  </View>

                  {selectedApp.description ? (
                    <View className="pt-2 border-t border-slate-100">
                      <Text className="text-xs font-medium text-slate-500 font-sans">Overview</Text>
                      <Text className="text-xs text-slate-700 font-sans mt-0.5 leading-relaxed">
                        {selectedApp.description}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Applicant Contact */}
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-2">
                  Applicant Information
                </Text>
                <View className="bg-white p-3.5 rounded-2xl border border-slate-200 mb-4 space-y-2">
                  <View className="flex-row items-center space-x-2">
                    <User size={15} color="#64748B" />
                    <Text className="text-sm font-semibold text-slate-800 font-sans">
                      {selectedApp.applicant?.full_name || 'Designated Parish Administrator'}
                    </Text>
                  </View>

                  <View className="flex-row items-center space-x-2">
                    <Mail size={15} color="#64748B" />
                    <Text className="text-xs text-slate-600 font-sans">
                      {selectedApp.email || selectedApp.applicant?.email || 'No email attached'}
                    </Text>
                  </View>

                  <View className="flex-row items-center space-x-2">
                    <Phone size={15} color="#64748B" />
                    <Text className="text-xs text-slate-600 font-sans">
                      {selectedApp.contact_number || selectedApp.applicant?.phone_number || 'No contact attached'}
                    </Text>
                  </View>
                </View>

                {/* Accreditation Proofs & Documents */}
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-2">
                  Accreditation Credentials
                </Text>
                <View className="flex-row space-x-2 mb-4">
                  {/* Celebret / Endorsement */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleOpenDoc(selectedApp.celebret_url, 'Celebret Document')}
                    className="flex-1 bg-purple-50 active:bg-purple-100 border border-purple-200 p-3 rounded-2xl items-center justify-center"
                  >
                    <FileText size={20} color="#7C3AED" />
                    <Text className="text-xs font-bold text-purple-900 font-sans mt-1.5">
                      Priest Celebret
                    </Text>
                    <View className="flex-row items-center space-x-1 mt-0.5">
                      <ExternalLink size={10} color="#7C3AED" />
                      <Text className="text-[10px] text-purple-700 font-sans">View Proof</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Chancery Decree */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleOpenDoc(selectedApp.decree_url, 'Chancery Decree')}
                    className="flex-1 bg-blue-50 active:bg-blue-100 border border-blue-200 p-3 rounded-2xl items-center justify-center"
                  >
                    <ShieldCheck size={20} color="#2563EB" />
                    <Text className="text-xs font-bold text-blue-900 font-sans mt-1.5">
                      Chancery Decree
                    </Text>
                    <View className="flex-row items-center space-x-1 mt-0.5">
                      <ExternalLink size={10} color="#2563EB" />
                      <Text className="text-[10px] text-blue-700 font-sans">View Proof</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Financial Offertory Channels if configured */}
                {(selectedApp.gcash_number || selectedApp.maya_number) && (
                  <>
                    <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-2">
                      Verified Stewardship Channels
                    </Text>
                    <View className="bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4 flex-row items-center justify-around">
                      {selectedApp.gcash_number && (
                        <View className="items-center">
                          <Text className="text-[11px] text-blue-600 font-bold font-sans">GCash Account</Text>
                          <Text className="text-xs text-slate-800 font-mono mt-0.5">{selectedApp.gcash_number}</Text>
                        </View>
                      )}
                      {selectedApp.maya_number && (
                        <View className="items-center">
                          <Text className="text-[11px] text-emerald-600 font-bold font-sans">Maya Account</Text>
                          <Text className="text-xs text-slate-800 font-mono mt-0.5">{selectedApp.maya_number}</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}

                {/* Review Feedback Input */}
                <Text className="text-xs font-bold text-slate-700 font-sans mb-1.5">
                  Chancery Review Feedback & Directives
                </Text>
                <TextInput
                  value={reviewFeedback}
                  onChangeText={setReviewFeedback}
                  placeholder="Provide approval comments, onboarding directives, or rejection reasons..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 font-sans mb-5 min-h-[80px]"
                />

                {/* Decision Actions */}
                <View className="flex-row space-x-3 mb-4">
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={reviewMutation.isPending}
                    onPress={() => handleReject(selectedApp)}
                    className="flex-1 bg-rose-50 active:bg-rose-100 border border-rose-300 py-3 rounded-xl flex-row items-center justify-center space-x-1.5"
                  >
                    <XCircle size={16} color="#E11D48" />
                    <Text className="text-xs font-bold text-rose-700 font-sans">
                      Reject Application
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={reviewMutation.isPending}
                    onPress={() => handleApprove(selectedApp)}
                    className="flex-1 bg-emerald-600 active:bg-emerald-700 py-3 rounded-xl flex-row items-center justify-center space-x-1.5 shadow-xs"
                  >
                    {reviewMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text className="text-xs font-bold text-white font-sans">
                          Approve & Onboard
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}
