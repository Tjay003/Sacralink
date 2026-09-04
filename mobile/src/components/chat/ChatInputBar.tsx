import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Send, Video, Sparkles } from 'lucide-react-native';

interface ChatInputBarProps {
  onSend: (text: string) => void;
  onStartVideoCall?: () => void;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
}

export function ChatInputBar({
  onSend,
  onStartVideoCall,
  disabled = false,
  isSending = false,
  placeholder = 'Type your message...',
}: ChatInputBarProps) {
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !disabled && !isSending;

  const handleSend = () => {
    if (!canSend) return;
    const toSend = text;
    setText('');
    onSend(toSend);
  };

  return (
    <View className="bg-white border-t border-slate-200 px-3 py-2.5 flex-row items-end space-x-2">
      {/* Video Consultation Quick Action Button */}
      {onStartVideoCall && (
        <TouchableOpacity
          onPress={onStartVideoCall}
          disabled={disabled}
          activeOpacity={0.7}
          className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 items-center justify-center mb-0.5"
          accessibilityLabel="Launch Video Consultation"
        >
          <Video size={18} color="#2563EB" />
        </TouchableOpacity>
      )}

      {/* Auto-expanding Multiline Text Input */}
      <View className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-1.5 min-h-[42px] max-h-[120px] justify-center ml-1">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={2000}
          editable={!disabled && !isSending}
          className="text-sm text-slate-800 font-sans p-0 m-0"
          style={{
            maxHeight: 100,
            textAlignVertical: 'center',
            paddingTop: Platform.OS === 'ios' ? 6 : 4,
            paddingBottom: Platform.OS === 'ios' ? 6 : 4,
          }}
        />
      </View>

      {/* Send Button */}
      <TouchableOpacity
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.8}
        className={`w-10 h-10 rounded-full items-center justify-center mb-0.5 ml-1 ${
          canSend ? 'bg-blue-600 shadow-sm' : 'bg-slate-100'
        }`}
        accessibilityLabel="Send message"
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Send
            size={18}
            color={canSend ? '#FFFFFF' : '#94A3B8'}
            style={{ marginLeft: 2 }}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}
