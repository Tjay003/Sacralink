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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Search,
  Shield,
  User,
  Church,
  X,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Building2,
  Save,
  Phone,
  Mail,
  ShieldAlert,
  Crown,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useSystemUsers,
  useUpdateUserRole,
  useChurchesList,
  SystemUserItem,
} from '@/lib/supabase/superAdmin';

type RoleFilter = 'all' | 'user' | 'priest' | 'church_admin' | 'super_admin';

export default function SuperAdminUsersScreen() {
  const { profile: currentAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('all');
  const [editingUser, setEditingUser] = useState<SystemUserItem | null>(null);

  // Edit form state
  const [targetRole, setTargetRole] = useState<'user' | 'priest' | 'church_admin' | 'super_admin'>('user');
  const [targetChurchId, setTargetChurchId] = useState<string | null>(null);
  const [churchSearchQuery, setChurchSearchQuery] = useState('');

  const {
    data: users = [],
    isLoading,
    isRefetching,
    refetch,
  } = useSystemUsers(searchQuery, selectedRole);

  const { data: churches = [] } = useChurchesList();
  const updateRoleMutation = useUpdateUserRole();

  // Open edit modal for user
  const handleOpenEdit = (user: SystemUserItem) => {
    setEditingUser(user);
    const validRole = (user.role === 'admin' ? 'church_admin' : user.role) as
      | 'user'
      | 'priest'
      | 'church_admin'
      | 'super_admin';
    setTargetRole(validRole || 'user');
    setTargetChurchId(user.assigned_church_id || user.church_id || null);
    setChurchSearchQuery('');
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;

    // Safety check: prevent accidentally demoting oneself
    if (editingUser.id === currentAdmin?.id && targetRole !== 'super_admin') {
      Alert.alert(
        'Self-Demotion Warning',
        'You cannot revoke your own Super Administrator status while currently logged in.'
      );
      return;
    }

    try {
      await updateRoleMutation.mutateAsync({
        userId: editingUser.id,
        newRole: targetRole,
        assignedChurchId: targetChurchId,
      });

      Alert.alert(
        'Role Updated',
        `User ${editingUser.full_name || editingUser.email} has been updated to ${targetRole.replace(
          '_',
          ' '
        )}.`
      );
      setEditingUser(null);
      refetch();
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not update user role.');
    }
  };

  const filteredChurches = useMemo(() => {
    if (!churchSearchQuery.trim()) return churches;
    const q = churchSearchQuery.toLowerCase();
    return churches.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.address && c.address.toLowerCase().includes(q))
    );
  }, [churches, churchSearchQuery]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-purple-700 font-sans">
              Identity & Access
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-heading">
              User Directory
            </Text>
          </View>
          <RoleBadge role={currentAdmin?.role || 'super_admin'} />
        </View>

        {/* Search Bar */}
        <View className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex-row items-center space-x-2.5 mb-3">
          <Search size={18} color="#64748B" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or email..."
            placeholderTextColor="#94A3B8"
            className="flex-1 text-sm text-slate-900 font-sans p-0"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Role Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 10 }}
          className="flex-row space-x-2 pb-2"
        >
          {(
            [
              { key: 'all', label: 'All Users' },
              { key: 'user', label: 'Faithful' },
              { key: 'priest', label: 'Priests' },
              { key: 'church_admin', label: 'Parish Admins' },
              { key: 'super_admin', label: 'Super Admins' },
            ] as const
          ).map((pill) => {
            const isSelected = selectedRole === pill.key;
            return (
              <TouchableOpacity
                key={pill.key}
                onPress={() => setSelectedRole(pill.key)}
                className={`px-3.5 py-1.5 rounded-full border ${
                  isSelected
                    ? 'bg-purple-700 border-purple-700'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Users List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 }}
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
              Loading diocesan directory...
            </Text>
          </View>
        ) : users.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 items-center justify-center border border-slate-200 mt-6">
            <View className="w-14 h-14 rounded-2xl bg-slate-100 items-center justify-center mb-3">
              <Users size={28} color="#64748B" />
            </View>
            <Text className="text-base font-bold text-slate-900 font-heading text-center">
              No Users Found
            </Text>
            <Text className="text-xs text-slate-500 font-sans text-center mt-1">
              No accounts match the current filters or query.
            </Text>
          </View>
        ) : (
          <View className="space-y-2.5">
            {users.map((user) => {
              const churchLabel = user.assigned_church_name || 'No Parish Assigned';
              const initial = (user.full_name || user.email || 'U')[0].toUpperCase();

              return (
                <View
                  key={user.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center space-x-3 flex-1 mr-2">
                      {user.avatar_url ? (
                        <Image
                          source={{ uri: user.avatar_url }}
                          className="w-11 h-11 rounded-full bg-slate-100"
                        />
                      ) : (
                        <View className="w-11 h-11 rounded-full bg-purple-100 items-center justify-center">
                          <Text className="text-sm font-bold text-purple-800 font-heading">
                            {initial}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-slate-900 font-heading" numberOfLines={1}>
                          {user.full_name || 'Anonymous User'}
                        </Text>
                        <Text className="text-xs text-slate-500 font-sans" numberOfLines={1}>
                          {user.email || 'No email registered'}
                        </Text>
                      </View>
                    </View>
                    <RoleBadge role={user.role} size="sm" />
                  </View>

                  {/* Church Assignment Indicator */}
                  <View className="flex-row items-center justify-between bg-slate-50 rounded-xl px-3 py-2 mt-1 mb-2.5 border border-slate-100">
                    <View className="flex-row items-center space-x-1.5 flex-1 mr-2">
                      <Church size={13} color="#64748B" />
                      <Text
                        className={`text-xs font-sans ${
                          user.assigned_church_name
                            ? 'text-slate-800 font-medium'
                            : 'text-slate-400 italic'
                        }`}
                        numberOfLines={1}
                      >
                        {churchLabel}
                      </Text>
                    </View>
                    {user.phone_number && (
                      <View className="flex-row items-center space-x-1">
                        <Phone size={10} color="#94A3B8" />
                        <Text className="text-[11px] text-slate-400 font-sans">
                          {user.phone_number}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Edit Action Button */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleOpenEdit(user)}
                    className="bg-purple-50 active:bg-purple-100 border border-purple-200 py-2 rounded-xl flex-row items-center justify-center space-x-1.5"
                  >
                    <Edit3 size={14} color="#7C3AED" />
                    <Text className="text-xs font-bold text-purple-700 font-sans">
                      Edit Role & Parish
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Edit Role & Parish Modal */}
      {editingUser && (
        <Modal
          visible={Boolean(editingUser)}
          animationType="slide"
          transparent
          onRequestClose={() => setEditingUser(null)}
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
                    Access Control & Assignment
                  </Text>
                  <Text className="text-lg font-bold text-slate-900 font-heading" numberOfLines={1}>
                    {editingUser.full_name || editingUser.email}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditingUser(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                >
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Role Radio Picker */}
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-2">
                  Select Role Designation
                </Text>
                <View className="space-y-2 mb-5">
                  {(
                    [
                      {
                        key: 'user',
                        title: 'Parishioner / Faithful',
                        desc: 'General access to explore churches, book sacraments, and donate.',
                      },
                      {
                        key: 'priest',
                        title: 'Clergy / Parish Priest',
                        desc: 'Liturgical schedules, mass duties, and parish sacramental services.',
                      },
                      {
                        key: 'church_admin',
                        title: 'Parish Administrator',
                        desc: 'Triage bookings, verify offertory donations, and manage parish hub.',
                      },
                      {
                        key: 'super_admin',
                        title: 'Diocesan Super Administrator',
                        desc: 'Full diocesan telemetry, onboard new parishes, and user role management.',
                      },
                    ] as const
                  ).map((r) => {
                    const isSelected = targetRole === r.key;
                    return (
                      <TouchableOpacity
                        key={r.key}
                        onPress={() => setTargetRole(r.key)}
                        className={`p-3.5 rounded-2xl border flex-row items-start space-x-3 ${
                          isSelected
                            ? 'bg-purple-50 border-purple-600'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <View
                          className={`w-5 h-5 rounded-full border items-center justify-center mt-0.5 ${
                            isSelected
                              ? 'border-purple-600 bg-purple-600'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                        </View>
                        <View className="flex-1">
                          <Text
                            className={`text-sm font-bold font-heading ${
                              isSelected ? 'text-purple-900' : 'text-slate-900'
                            }`}
                          >
                            {r.title}
                          </Text>
                          <Text className="text-xs text-slate-500 font-sans mt-0.5 leading-relaxed">
                            {r.desc}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Parish Assignment Picker */}
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-2">
                  Assigned Parish Church
                </Text>
                <TextInput
                  value={churchSearchQuery}
                  onChangeText={setChurchSearchQuery}
                  placeholder="Filter parishes..."
                  placeholderTextColor="#94A3B8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-sans mb-2"
                />

                {/* None / Unassigned Option */}
                <TouchableOpacity
                  onPress={() => setTargetChurchId(null)}
                  className={`p-3 rounded-xl border mb-2 flex-row items-center justify-between ${
                    targetChurchId === null
                      ? 'bg-purple-50 border-purple-600'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      targetChurchId === null ? 'text-purple-900 font-bold' : 'text-slate-600'
                    }`}
                  >
                    None / Unassigned (Diocese General)
                  </Text>
                  {targetChurchId === null && <Check size={16} color="#7C3AED" />}
                </TouchableOpacity>

                {/* Parishes List */}
                <View className="max-h-48 border border-slate-200 rounded-2xl overflow-hidden mb-6">
                  <ScrollView nestedScrollEnabled className="p-1">
                    {filteredChurches.map((church) => {
                      const isSelected = targetChurchId === church.id;
                      return (
                        <TouchableOpacity
                          key={church.id}
                          onPress={() => setTargetChurchId(church.id)}
                          className={`p-2.5 rounded-xl flex-row items-center justify-between my-0.5 ${
                            isSelected ? 'bg-purple-100' : 'active:bg-slate-100'
                          }`}
                        >
                          <View className="flex-1 mr-2">
                            <Text
                              className={`text-xs font-bold ${
                                isSelected ? 'text-purple-950 font-heading' : 'text-slate-800'
                              }`}
                              numberOfLines={1}
                            >
                              {church.name}
                            </Text>
                            {church.address && (
                              <Text className="text-[10px] text-slate-500 font-sans" numberOfLines={1}>
                                {church.address}
                              </Text>
                            )}
                          </View>
                          {isSelected && <Check size={16} color="#7C3AED" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Save CTA */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={updateRoleMutation.isPending}
                  onPress={handleSaveRole}
                  className="bg-purple-700 active:bg-purple-800 py-3.5 rounded-xl flex-row items-center justify-center space-x-2 shadow-xs mb-3"
                >
                  {updateRoleMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Save size={16} color="#FFFFFF" />
                      <Text className="text-sm font-bold text-white font-sans">
                        Save Role & Assignment
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}
