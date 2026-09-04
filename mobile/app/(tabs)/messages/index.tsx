import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  MessageSquare,
  Search,
  Plus,
  Church as ChurchIcon,
  User,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/RoleBadge';
import {
  useUserConversations,
  getOrCreateParishOfficeConversation,
  type ConversationWithDetails,
} from '@/lib/supabase/messaging';
import { useChurches, type Church } from '@/lib/supabase/churches';

/**
 * Format timestamp into relative display string.
 */
function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Extracts initials from participant or parish name.
 */
function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ churchId?: string; recipientName?: string }>();
  const { user, profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [showParishModal, setShowParishModal] = useState(false);
  const [parishSearch, setParishSearch] = useState('');
  const [creatingForChurchId, setCreatingForChurchId] = useState<string | null>(null);

  const {
    data: conversations = [],
    isLoading,
    isRefetching,
    refetch,
  } = useUserConversations(user?.id);

  const { data: churches = [], isLoading: loadingChurches } = useChurches();

  // Auto-handle churchId navigation from external screen (e.g. Church Details)
  useEffect(() => {
    if (params.churchId && user?.id) {
      let isMounted = true;
      (async () => {
        try {
          const { conversationId } = await getOrCreateParishOfficeConversation(
            params.churchId!,
            user.id
          );
          if (isMounted && conversationId) {
            router.push(`/messages/${conversationId}`);
          }
        } catch (err) {
          console.error('Error auto-navigating to church conversation:', err);
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [params.churchId, user?.id, router]);

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();

    return conversations.filter((c) => {
      const churchName = c.church?.name?.toLowerCase() || '';
      const otherName = c.otherParticipant?.full_name?.toLowerCase() || '';
      const title = c.title?.toLowerCase() || '';
      const lastMsg = c.lastMessage?.content?.toLowerCase() || '';

      return (
        churchName.includes(q) ||
        otherName.includes(q) ||
        title.includes(q) ||
        lastMsg.includes(q)
      );
    });
  }, [conversations, searchQuery]);

  // Filter parishes in picker modal
  const filteredParishes = useMemo(() => {
    if (!parishSearch.trim()) return churches;
    const q = parishSearch.toLowerCase().trim();
    return churches.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [churches, parishSearch]);

  const handleStartConversationWithChurch = async (church: Church) => {
    if (!user?.id) return;
    setCreatingForChurchId(church.id);
    try {
      const { conversationId, error } = await getOrCreateParishOfficeConversation(
        church.id,
        user.id
      );
      if (error) throw error;
      if (conversationId) {
        setShowParishModal(false);
        await refetch();
        router.push(`/messages/${conversationId}`);
      }
    } catch (err) {
      console.error('Failed to start parish conversation:', err);
    } finally {
      setCreatingForChurchId(null);
    }
  };

  const renderConversationItem = ({ item }: { item: ConversationWithDetails }) => {
    const isChurch = Boolean(item.church);
    const title =
      item.church?.name ||
      item.otherParticipant?.full_name ||
      item.title ||
      'Parish Inquiry';
    const avatarUrl = item.church?.cover_image_url || item.otherParticipant?.avatar_url;
    const lastMsg = item.lastMessage;
    const lastMessageSnippet = lastMsg?.message_type === 'call_invite'
      ? '📹 Video Consultation session'
      : lastMsg?.content || 'No messages yet';
    const timestamp = lastMsg?.created_at || item.updated_at;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/messages/${item.id}`)}
        className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex-row items-center space-x-3 mb-2.5"
      >
        {/* Avatar */}
        <View className="relative mr-3">
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              className="w-13 h-13 rounded-full bg-slate-100 border border-slate-200"
              style={{ width: 48, height: 48, borderRadius: 24 }}
            />
          ) : (
            <View
              className={`items-center justify-center rounded-full ${
                isChurch ? 'bg-blue-100' : 'bg-slate-100'
              }`}
              style={{ width: 48, height: 48, borderRadius: 24 }}
            >
              {isChurch ? (
                <ChurchIcon size={22} color="#2563EB" />
              ) : (
                <Text className="text-sm font-bold text-slate-700 font-sans">
                  {getInitials(title)}
                </Text>
              )}
            </View>
          )}

          {/* Active status indicator */}
          <View className="w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0 right-0" />
        </View>

        {/* Info */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text
              numberOfLines={1}
              className="text-sm font-bold text-slate-900 font-sans flex-1 mr-2"
            >
              {title}
            </Text>
            <Text className="text-[11px] text-slate-400 font-sans">
              {formatRelativeTime(timestamp)}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text
              numberOfLines={1}
              className={`text-xs font-sans flex-1 mr-2 ${
                item.unreadCount > 0 ? 'text-slate-900 font-semibold' : 'text-slate-500'
              }`}
            >
              {lastMessageSnippet}
            </Text>

            {item.unreadCount > 0 && (
              <View className="bg-blue-600 rounded-full px-2 py-0.5 min-w-[20px] items-center justify-center">
                <Text className="text-[10px] font-bold text-white font-sans">
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Screen Header */}
      <View className="px-5 pt-4 pb-3 bg-white border-b border-slate-200">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 font-sans">
              Parish Communication
            </Text>
            <Text className="text-2xl font-bold text-slate-900 font-sans">
              Messages
            </Text>
          </View>
          <View className="flex-row items-center space-x-2">
            <TouchableOpacity
              onPress={() => setShowParishModal(true)}
              activeOpacity={0.8}
              className="bg-blue-600 rounded-full px-3 py-1.5 flex-row items-center space-x-1.5 shadow-xs"
            >
              <Plus size={15} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white font-sans ml-1">
                New Chat
              </Text>
            </TouchableOpacity>
            <View className="ml-2">
              <RoleBadge role={profile?.role} />
            </View>
          </View>
        </View>

        {/* Search Input */}
        <View className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-row items-center">
          <Search size={16} color="#64748B" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations or parishes..."
            placeholderTextColor="#94A3B8"
            className="flex-1 ml-2 text-sm text-slate-800 font-sans p-0 m-0"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conversations Stream */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-xs text-slate-500 font-sans mt-3">
            Loading conversations...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 32,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={['#2563EB']}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16 px-6">
              <View className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 items-center justify-center mb-4">
                <MessageSquare size={30} color="#2563EB" />
              </View>
              <Text className="text-base font-bold text-slate-800 font-sans text-center mb-1">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </Text>
              <Text className="text-xs text-slate-500 font-sans text-center leading-5 mb-5 max-w-[280px]">
                {searchQuery
                  ? 'Try searching with another parish or person name.'
                  : 'Start a direct inquiry with a parish office for sacraments, mass intentions, or counseling.'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowParishModal(true)}
                className="bg-blue-600 px-5 py-2.5 rounded-xl flex-row items-center space-x-1.5 shadow-sm"
              >
                <ChurchIcon size={16} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white font-sans ml-1.5">
                  Start Inquiry with a Parish
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Parish Picker Modal ("Start New Chat") */}
      <Modal
        visible={showParishModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowParishModal(false)}
      >
        <SafeAreaView className="flex-1 bg-slate-50">
          {/* Modal Header */}
          <View className="px-5 py-4 bg-white border-b border-slate-200 flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold uppercase tracking-wider text-blue-600 font-sans">
                Parish Directory
              </Text>
              <Text className="text-lg font-bold text-slate-900 font-sans">
                Select a Parish
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowParishModal(false)}
              className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Parish Search Bar */}
          <View className="p-4 bg-white border-b border-slate-200">
            <View className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-row items-center">
              <Search size={16} color="#64748B" />
              <TextInput
                value={parishSearch}
                onChangeText={setParishSearch}
                placeholder="Search parishes by name or city..."
                placeholderTextColor="#94A3B8"
                className="flex-1 ml-2 text-sm text-slate-800 font-sans p-0 m-0"
              />
              {parishSearch.length > 0 && (
                <TouchableOpacity onPress={() => setParishSearch('')}>
                  <X size={15} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Parish List */}
          {loadingChurches ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="text-xs text-slate-500 font-sans mt-3">
                Loading parishes...
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredParishes}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const isCreating = creatingForChurchId === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => handleStartConversationWithChurch(item)}
                    disabled={Boolean(creatingForChurchId)}
                    activeOpacity={0.7}
                    className="bg-white rounded-2xl p-3.5 mb-2.5 border border-slate-200/80 shadow-xs flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center flex-1 mr-3">
                      {item.cover_image_url ? (
                        <Image
                          source={{ uri: item.cover_image_url }}
                          className="w-12 h-12 rounded-xl bg-slate-100 mr-3"
                        />
                      ) : (
                        <View className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 items-center justify-center mr-3">
                          <ChurchIcon size={22} color="#2563EB" />
                        </View>
                      )}
                      <View className="flex-1">
                        <Text
                          numberOfLines={1}
                          className="text-sm font-bold text-slate-900 font-sans"
                        >
                          {item.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="text-xs text-slate-500 font-sans mt-0.5"
                        >
                          {item.city}
                        </Text>
                      </View>
                    </View>

                    {isCreating ? (
                      <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                      <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-200">
                        <ChevronRight size={16} color="#64748B" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View className="items-center justify-center py-12">
                  <Text className="text-sm font-semibold text-slate-600 font-sans">
                    No parishes found
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
