import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { WebView } from 'react-native-webview';
import {
  ArrowLeft,
  Video,
  ExternalLink,
  X,
  Church as ChurchIcon,
  User,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  fetchConversationMessages,
  sendMessage,
  markConversationAsRead,
  subscribeToConversationMessages,
  getJitsiMeetUrl,
  type MessageWithSender,
} from '@/lib/supabase/messaging';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { ChatInputBar } from '@/components/chat/ChatInputBar';

export default function ActiveChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isVideoModalVisible, setIsVideoModalVisible] = useState(false);

  // Conversation metadata
  const [conversationTitle, setConversationTitle] = useState('Parish Chat');
  const [conversationSubtitle, setConversationSubtitle] = useState('Active');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isChurchChat, setIsChurchChat] = useState(false);

  const flatListRef = useRef<FlatList<MessageWithSender>>(null);

  const jitsiUrl = conversationId ? getJitsiMeetUrl(conversationId) : '';

  // 1. Fetch conversation details & participant info
  useEffect(() => {
    if (!conversationId) return;

    let isMounted = true;
    (async () => {
      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('*, church:churches(*)')
          .eq('id', conversationId)
          .maybeSingle();

        if (!isMounted || !conv) return;

        if (conv.church) {
          setIsChurchChat(true);
          setConversationTitle(conv.church.name);
          setConversationSubtitle(conv.church.city || 'Parish Office');
          setAvatarUrl(conv.church.cover_image_url || null);
        } else if (conv.title) {
          setConversationTitle(conv.title);
        }

        // Fetch other participants for 1-on-1 direct chats
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('user_id, profiles(*)')
          .eq('conversation_id', conversationId)
          .neq('user_id', user?.id || '');

        if (isMounted && parts && parts.length > 0 && !conv.church) {
          const otherProfile = (parts[0] as any).profiles;
          if (otherProfile) {
            setConversationTitle(otherProfile.full_name || 'Parishioner');
            setConversationSubtitle(
              otherProfile.role === 'priest'
                ? 'Parish Priest'
                : otherProfile.role === 'church_admin'
                ? 'Church Administrator'
                : 'Parishioner'
            );
            setAvatarUrl(otherProfile.avatar_url || null);
          }
        }
      } catch (err) {
        console.error('Error fetching conversation details:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [conversationId, user?.id]);

  // 2. Fetch initial messages and mark conversation as read
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await fetchConversationMessages(conversationId);
        if (error) throw error;
        if (isMounted && data) {
          setMessages(data);
        }
        await markConversationAsRead(conversationId, user.id);
      } catch (err) {
        console.error('Error loading chat messages:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [conversationId, user?.id]);

  // 3. Realtime subscription to conversation messages
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = subscribeToConversationMessages(
      conversationId,
      (incomingMsg) => {
        setMessages((prev) => {
          // If message already exists (e.g. from optimistic send), update it
          const exists = prev.some((m) => m.id === incomingMsg.id);
          if (exists) {
            return prev.map((m) => (m.id === incomingMsg.id ? incomingMsg : m));
          }
          return [...prev, incomingMsg];
        });

        // Mark as read if received from another user
        if (user?.id && incomingMsg.sender_id !== user.id) {
          markConversationAsRead(conversationId, user.id);
        }

        // Auto-scroll to bottom on new message
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [conversationId, user?.id]);

  // Scroll to bottom when messages initially load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 150);
    }
  }, [loading, messages.length]);

  // Send message handler with optimistic local state
  const handleSendMessage = async (text: string) => {
    if (!conversationId || !user?.id || !text.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageWithSender = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: text.trim(),
      message_type: 'text',
      created_at: new Date().toISOString(),
      sender: profile,
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    setIsSending(true);
    try {
      const { data, error } = await sendMessage(
        conversationId,
        user.id,
        text.trim(),
        'text'
      );

      if (error) throw error;

      if (data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data, status: 'sent' } : m))
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Mark as error
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m))
      );
    } finally {
      setIsSending(false);
    }
  };

  // Launch video consultation session
  const handleStartVideoConsultation = async () => {
    if (!conversationId || !user?.id) return;

    // Open video conference modal
    setIsVideoModalVisible(true);

    // Send call invite into chat stream so other party sees the invite link
    try {
      await sendMessage(
        conversationId,
        user.id,
        'Started a Pastoral Video Consultation session. Tap to join the room.',
        'call_invite',
        { meeting_url: jitsiUrl }
      );
    } catch (err) {
      console.error('Error broadcasting video call invite:', err);
    }
  };

  const handleOpenExternalJitsi = async () => {
    if (!jitsiUrl) return;
    try {
      await Linking.openURL(jitsiUrl);
    } catch (err) {
      console.error('Could not open external video call link:', err);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View className="bg-white px-4 py-2.5 border-b border-slate-200 flex-row items-center justify-between shadow-xs">
        <View className="flex-row items-center flex-1 mr-2">
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center mr-2.5"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color="#334155" />
          </TouchableOpacity>

          {/* Avatar */}
          <View className="relative mr-2.5">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300"
              />
            ) : (
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isChurchChat ? 'bg-blue-100' : 'bg-slate-200'
                }`}
              >
                {isChurchChat ? (
                  <ChurchIcon size={18} color="#2563EB" />
                ) : (
                  <User size={18} color="#475569" />
                )}
              </View>
            )}
            <View className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0 right-0" />
          </View>

          {/* Title and Active Status */}
          <View className="flex-1">
            <Text
              numberOfLines={1}
              className="text-sm font-bold text-slate-900 font-sans"
            >
              {conversationTitle}
            </Text>
            <View className="flex-row items-center space-x-1">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
              <Text
                numberOfLines={1}
                className="text-[11px] font-medium text-slate-500 font-sans"
              >
                {conversationSubtitle}
              </Text>
            </View>
          </View>
        </View>

        {/* Video Consultation Launcher Button */}
        <TouchableOpacity
          onPress={handleStartVideoConsultation}
          activeOpacity={0.8}
          className="bg-blue-600 px-3 py-2 rounded-xl flex-row items-center space-x-1.5 shadow-xs"
          accessibilityLabel="Start Video Consultation"
        >
          <Video size={16} color="#FFFFFF" />
          <Text className="text-xs font-bold text-white font-sans ml-1">
            Consult
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages Stream */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        className="flex-1"
      >
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-xs text-slate-500 font-sans mt-3">
              Loading chat messages...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatMessageItem
                message={item}
                isCurrentUser={item.sender_id === user?.id}
                onPressCallInvite={() => setIsVideoModalVisible(true)}
              />
            )}
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: 16,
              flexGrow: 1,
            }}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-20 px-8">
                <View className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 items-center justify-center mb-3">
                  <ChurchIcon size={26} color="#2563EB" />
                </View>
                <Text className="text-sm font-bold text-slate-800 font-sans text-center mb-1">
                  Start Conversation
                </Text>
                <Text className="text-xs text-slate-500 font-sans text-center leading-5">
                  Send a message to inquire about sacraments, mass intentions, or request pastoral guidance.
                </Text>
              </View>
            }
          />
        )}

        {/* Input Bar */}
        <ChatInputBar
          onSend={handleSendMessage}
          onStartVideoCall={handleStartVideoConsultation}
          isSending={isSending}
          disabled={loading}
        />
      </KeyboardAvoidingView>

      {/* Video Consultation In-App WebView Modal */}
      <Modal
        visible={isVideoModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsVideoModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-slate-900">
          <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

          {/* Video Header Bar */}
          <View className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-full bg-blue-600/30 items-center justify-center mr-2">
                <Video size={16} color="#60A5FA" />
              </View>
              <View>
                <Text className="text-sm font-bold text-white font-sans">
                  Video Consultation
                </Text>
                <Text className="text-[11px] text-slate-400 font-sans">
                  SacraLink Virtual Pastoral Room
                </Text>
              </View>
            </View>

            <View className="flex-row items-center space-x-2">
              {/* External Jitsi Meet Launcher Button */}
              <TouchableOpacity
                onPress={handleOpenExternalJitsi}
                activeOpacity={0.7}
                className="bg-slate-800 px-2.5 py-1.5 rounded-lg flex-row items-center space-x-1 mr-2 border border-slate-700"
              >
                <ExternalLink size={13} color="#94A3B8" />
                <Text className="text-[11px] font-semibold text-slate-300 font-sans ml-1">
                  App / Browser
                </Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setIsVideoModalVisible(false)}
                className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center border border-slate-700"
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Jitsi Meet WebView */}
          {jitsiUrl ? (
            <WebView
              source={{ uri: jitsiUrl }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <View className="absolute inset-0 items-center justify-center bg-slate-900">
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text className="text-xs font-semibold text-slate-400 mt-3 font-sans">
                    Connecting to Virtual Consultation...
                  </Text>
                </View>
              )}
              className="flex-1 bg-slate-950"
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-slate-900 px-6">
              <Text className="text-sm text-slate-400 font-sans text-center">
                Unable to generate meeting room. Please try again.
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
