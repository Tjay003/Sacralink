import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Check, CheckCheck, Clock, Video, User } from 'lucide-react-native';
import type { MessageWithSender } from '@/lib/supabase/messaging';

interface ChatMessageItemProps {
  message: MessageWithSender;
  isCurrentUser: boolean;
  onPressCallInvite?: (meetingUrl?: string) => void;
}

/**
 * Formats a message timestamp into a clean, human-readable string.
 */
function formatMessageTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const timeStr = `${displayHours}:${minutes} ${ampm}`;

  if (isToday) return timeStr;

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Yesterday ${timeStr}`;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${timeStr}`;
}

/**
 * Extracts initials from a sender's full name.
 */
function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ChatMessageItem({
  message,
  isCurrentUser,
  onPressCallInvite,
}: ChatMessageItemProps) {
  const isCallInvite = message.message_type === 'call_invite';
  const timeFormatted = formatMessageTime(message.created_at);
  const senderName = message.sender?.full_name || 'Parishioner';
  const avatarUrl = message.sender?.avatar_url;

  return (
    <View
      className={`flex-row mb-3.5 px-4 ${
        isCurrentUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Incoming Avatar */}
      {!isCurrentUser && (
        <View className="mr-2.5 self-end mb-1">
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300"
            />
          ) : (
            <View className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 items-center justify-center">
              <Text className="text-[11px] font-bold text-slate-600 font-sans">
                {getInitials(senderName)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Message Content Container */}
      <View
        className={`max-w-[78%] ${
          isCurrentUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Sender Name for incoming messages */}
        {!isCurrentUser && (
          <Text className="text-[11px] font-semibold text-slate-500 mb-1 ml-1 font-sans">
            {senderName}
          </Text>
        )}

        {/* Message Bubble */}
        {isCallInvite ? (
          /* Video Consultation Invite Card */
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => onPressCallInvite?.(message.metadata?.meeting_url as string | undefined)}
            className={`p-4 rounded-2xl border shadow-xs ${
              isCurrentUser
                ? 'bg-blue-600 border-blue-700 rounded-br-xs'
                : 'bg-white border-blue-200 rounded-bl-xs'
            }`}
          >
            <View className="flex-row items-center space-x-2.5 mb-2">
              <View
                className={`w-9 h-9 rounded-full items-center justify-center ${
                  isCurrentUser ? 'bg-blue-500' : 'bg-blue-100'
                }`}
              >
                <Video
                  size={18}
                  color={isCurrentUser ? '#FFFFFF' : '#2563EB'}
                />
              </View>
              <View className="flex-1 ml-2">
                <Text
                  className={`text-sm font-bold font-sans ${
                    isCurrentUser ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Video Consultation
                </Text>
                <Text
                  className={`text-xs font-sans ${
                    isCurrentUser ? 'text-blue-100' : 'text-blue-600 font-medium'
                  }`}
                >
                  Virtual Pastoral Session
                </Text>
              </View>
            </View>

            <Text
              className={`text-xs leading-5 font-sans mb-3 ${
                isCurrentUser ? 'text-blue-100' : 'text-slate-600'
              }`}
            >
              {message.content || 'A pastoral video consultation session has been started.'}
            </Text>

            <View
              className={`py-2 px-3 rounded-xl flex-row items-center justify-center space-x-1.5 ${
                isCurrentUser ? 'bg-white' : 'bg-blue-600'
              }`}
            >
              <Video
                size={14}
                color={isCurrentUser ? '#2563EB' : '#FFFFFF'}
              />
              <Text
                className={`text-xs font-bold ml-1.5 font-sans ${
                  isCurrentUser ? 'text-blue-600' : 'text-white'
                }`}
              >
                Join Consultation Now
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          /* Regular Text Message Bubble */
          <View
            className={`py-2.5 px-4 rounded-2xl shadow-xs ${
              isCurrentUser
                ? 'bg-blue-600 rounded-br-xs'
                : 'bg-slate-100 border border-slate-200/70 rounded-bl-xs'
            }`}
          >
            <Text
              className={`text-sm leading-5 font-sans select-text ${
                isCurrentUser ? 'text-white' : 'text-slate-900'
              }`}
            >
              {message.content}
            </Text>
          </View>
        )}

        {/* Timestamp and Delivery Status */}
        <View
          className={`flex-row items-center mt-1 space-x-1 px-1 ${
            isCurrentUser ? 'justify-end' : 'justify-start'
          }`}
        >
          <Text className="text-[10px] text-slate-400 font-sans">
            {timeFormatted}
          </Text>

          {isCurrentUser && (
            <View className="ml-1">
              {message.status === 'sending' ? (
                <Clock size={11} color="#94A3B8" />
              ) : (
                <CheckCheck size={12} color="#2563EB" />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
