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
  HandCoins,
  Search,
  X,
  Inbox,
  Filter,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import { useChurchDonations } from '@/lib/supabase/adminWorkflows';
import { AdminDonationCard } from '@/components/admin/AdminDonationCard';

type DonationFilterTab = 'pending' | 'verified' | 'rejected';

export default function AdminDonationsQueueScreen() {
  const { profile } = useAuth();
  const churchId = (profile as any)?.assigned_church_id || profile?.church_id;

  const [activeTab, setActiveTab] = useState<DonationFilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch donations for church with status filter
  const {
    data: donations = [],
    isLoading,
    isRefetching,
    refetch,
  } = useChurchDonations(churchId, activeTab);

  // Search filter across donor name, email, purpose, reference number
  const filteredDonations = useMemo(() => {
    if (!searchQuery.trim()) return donations;
    const q = searchQuery.toLowerCase().trim();
    return donations.filter((item) => {
      const donor = item.user?.full_name?.toLowerCase() || '';
      const email = item.user?.email?.toLowerCase() || '';
      const purpose = (item.purpose || '').toLowerCase();
      const refNum = (item.reference_number || '').toLowerCase();
      const notes = (item.donor_notes || '').toLowerCase();
      return (
        donor.includes(q) ||
        email.includes(q) ||
        purpose.includes(q) ||
        refNum.includes(q) ||
        notes.includes(q)
      );
    });
  }, [donations, searchQuery]);

  const tabs: { key: DonationFilterTab; label: string }[] = [
    { key: 'pending', label: 'Pending Verification' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1">
        {/* Top Header */}
        <View className="px-5 pt-3 pb-2 bg-white border-b border-slate-100">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-xs font-semibold uppercase tracking-wider text-blue-600 font-sans">
                Financial Stewardship
              </Text>
              <Text className="text-2xl font-bold text-slate-900 font-heading">
                Donations Queue
              </Text>
            </View>
            <RoleBadge role={profile?.role || 'admin'} />
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center bg-slate-100 rounded-2xl px-3.5 py-2.5 mb-2.5 border border-slate-200">
            <Search size={16} color="#64748B" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search donor name, ref number, or purpose..."
              placeholderTextColor="#94A3B8"
              className="flex-1 ml-2.5 text-xs text-slate-900 font-sans py-0"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Status Tabs */}
          <View className="flex-row space-x-2 py-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full border ${
                    isActive
                      ? 'bg-emerald-600 border-emerald-600'
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

        {/* Donations List */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={['#10B981']}
            />
          }
        >
          {isLoading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="large" color="#10B981" />
              <Text className="text-xs text-slate-500 font-sans mt-3">
                Loading donations ledger...
              </Text>
            </View>
          ) : filteredDonations.length === 0 ? (
            <View className="bg-white rounded-3xl p-8 border border-slate-200 items-center justify-center mt-6">
              <View className="w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-3">
                <Inbox size={26} color="#94A3B8" />
              </View>
              <Text className="text-base font-bold text-slate-800 font-heading">
                No Donations Found
              </Text>
              <Text className="text-xs text-slate-500 font-sans text-center mt-1 px-4">
                {searchQuery
                  ? `No donations match "${searchQuery}".`
                  : `There are currently no ${activeTab} cashless offerings.`}
              </Text>
            </View>
          ) : (
            filteredDonations.map((donation) => (
              <AdminDonationCard
                key={donation.id}
                donation={donation}
                onRefresh={refetch}
              />
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
