import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sparkles,
  X,
  Send,
  Church as ChurchIcon,
  ChevronDown,
  RotateCcw,
  ShieldCheck,
  Check,
  Bot,
  HelpCircle,
  Clock,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useChurches, type Church } from '@/lib/supabase/churches';
import {
  askParishAIAssistant,
  type ChatMessage as AIAssistantMessage,
} from '@/lib/supabase/aiAssistant';

interface ParishionerChatbotModalProps {
  visible: boolean;
  onClose: () => void;
  initialChurchId?: string | null;
  initialChurchName?: string | null;
}

const QUICK_SUGGESTIONS = [
  'Baptism requirements?',
  'Sunday Mass times?',
  'How to donate cashless?',
  'Confirmation eligibility?',
  'Wedding / Matrimony documents?',
  'Parish office hours?',
];

/**
 * Animated Bouncing Dots Typing Indicator
 */
function AnimatedTypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: -5,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.delay(640 - delay),
        ])
      );
    };

    const a1 = createAnimation(dot1, 0);
    const a2 = createAnimation(dot2, 160);
    const a3 = createAnimation(dot3, 320);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View className="flex-row items-center py-1">
      <Animated.View
        style={{ transform: [{ translateY: dot1 }] }}
        className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"
      />
      <Animated.View
        style={{ transform: [{ translateY: dot2 }] }}
        className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"
      />
      <Animated.View
        style={{ transform: [{ translateY: dot3 }] }}
        className="w-2 h-2 rounded-full bg-amber-500"
      />
    </View>
  );
}

/**
 * Custom formatted Markdown line renderer for AI responses.
 * Renders bold headers, bullet items with gold dots, and line breaks.
 */
function renderFormattedContent(rawContent: string) {
  const lines = rawContent.split('\n');

  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <View key={`spacer-${idx}`} className="h-1.5" />;
    }

    const isBullet =
      trimmed.startsWith('* ') ||
      trimmed.startsWith('- ') ||
      trimmed.startsWith('• ');

    const cleanLine = isBullet
      ? trimmed.replace(/^[\*\-•]\s+/, '')
      : trimmed;

    // Split for **bold** highlighting
    const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);

    const inlineElements = parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <Text key={pIdx} className="font-bold text-slate-900 font-sans">
            {part.slice(2, -2)}
          </Text>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <Text key={pIdx} className="italic text-slate-600 font-sans">
            {part.slice(1, -1)}
          </Text>
        );
      }
      return (
        <Text key={pIdx} className="text-slate-800 font-sans">
          {part}
        </Text>
      );
    });

    if (isBullet) {
      return (
        <View key={idx} className="flex-row items-start mb-1 pl-0.5 pr-2">
          <View className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 mr-2 shrink-0" />
          <Text className="text-xs leading-relaxed text-slate-800 font-sans flex-1">
            {inlineElements}
          </Text>
        </View>
      );
    }

    return (
      <Text
        key={idx}
        className="text-xs leading-relaxed text-slate-800 font-sans mb-1"
      >
        {inlineElements}
      </Text>
    );
  });
}

/**
 * Format timestamp to 12-hour AM/PM string
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return '';
  }
}

export function ParishionerChatbotModal({
  visible,
  onClose,
  initialChurchId = null,
  initialChurchName = null,
}: ParishionerChatbotModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: churches = [] } = useChurches();

  // Active Church Context
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(
    initialChurchId
  );
  const [selectedChurchName, setSelectedChurchName] = useState<string | null>(
    initialChurchName
  );
  const [isChurchPickerOpen, setIsChurchPickerOpen] = useState(false);

  // Sync props when initialChurchId changes
  useEffect(() => {
    setSelectedChurchId(initialChurchId);
    setSelectedChurchName(initialChurchName);
  }, [initialChurchId, initialChurchName]);

  // Messages State
  const [messages, setMessages] = useState<AIAssistantMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize greeting on open
  useEffect(() => {
    if (visible && messages.length === 0) {
      const activeName = selectedChurchName || 'SacraLink Diocese';
      setMessages([
        {
          id: 'welcome-msg',
          role: 'assistant',
          content: `Peace be with you! 🙏 I am your **SacraLink Parish Assistant** for **${activeName}**.\n\nAsk me anything about Mass times, sacrament requirements, parish office hours, or cashless giving.`,
          timestamp: new Date().toISOString(),
          sourcesUsed: 1,
        },
      ]);
    }
  }, [visible, selectedChurchName, messages.length]);

  // Scroll to bottom on new message or loading change
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  useEffect(() => {
    if (visible) {
      scrollToBottom();
    }
  }, [messages, isAsking, visible, scrollToBottom]);

  // Handle Send Message
  const handleSend = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || isAsking) return;

    const userMessage: AIAssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setIsAsking(true);

    try {
      const historyPayload = updatedMessages
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await askParishAIAssistant({
        churchId: selectedChurchId,
        churchName: selectedChurchName,
        message: trimmed,
        conversationHistory: historyPayload,
        userId: user?.id,
      });

      const assistantMessage: AIAssistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        sourcesUsed: response.sourcesUsed,
        isFallback: response.isFallback,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content:
            'I am momentarily unable to access the knowledge base. Please check back shortly or consult your parish office.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  // Switch Active Church
  const handleSelectChurch = (church: Church | null) => {
    if (church) {
      setSelectedChurchId(church.id);
      setSelectedChurchName(church.name);
      setMessages((prev) => [
        ...prev,
        {
          id: `switch-${Date.now()}`,
          role: 'assistant',
          content: `Parish context set to **${church.name}**. What would you like to know about this parish?`,
          timestamp: new Date().toISOString(),
          sourcesUsed: 1,
        },
      ]);
    } else {
      setSelectedChurchId(null);
      setSelectedChurchName('General Diocesan Knowledge');
      setMessages((prev) => [
        ...prev,
        {
          id: `switch-${Date.now()}`,
          role: 'assistant',
          content:
            'Parish context switched to **General Diocesan Knowledge**. You can ask about diocese-wide sacrament guidelines and procedures.',
          timestamp: new Date().toISOString(),
          sourcesUsed: 1,
        },
      ]);
    }
    setIsChurchPickerOpen(false);
  };

  // Reset Conversation
  const handleResetChat = () => {
    const activeName = selectedChurchName || 'SacraLink Diocese';
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Peace be with you! 🙏 I am your **SacraLink Parish Assistant** for **${activeName}**.\n\nAsk me anything about Mass times, sacrament requirements, parish office hours, or cashless giving.`,
        timestamp: new Date().toISOString(),
        sourcesUsed: 1,
      },
    ]);
  };

  const showQuickSuggestions =
    messages.length <= 2 && !isAsking;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView
        edges={['top', 'bottom']}
        className="flex-1 bg-slate-900"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-slate-50"
        >
          {/* Catholic AI Assistant Header */}
          <View className="bg-slate-900 px-4 pt-3 pb-3.5 border-b border-amber-500/20 shadow-md">
            <View className="flex-row items-center justify-between">
              {/* Branding Icon & Titles */}
              <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
                <View className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 items-center justify-center mr-2">
                  <Sparkles size={20} color="#F59E0B" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center space-x-1.5">
                    <Text className="text-[10px] font-bold tracking-widest text-amber-400 uppercase font-sans">
                      Catholic Knowledge Assistant
                    </Text>
                  </View>
                  <Text
                    className="text-base font-bold text-white font-sans tracking-tight"
                    numberOfLines={1}
                  >
                    Parish AI Assistant
                  </Text>
                </View>
              </View>

              {/* Action Buttons: Reset & Close */}
              <View className="flex-row items-center space-x-1.5">
                <TouchableOpacity
                  onPress={handleResetChat}
                  className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center mr-1"
                  accessibilityLabel="Restart conversation"
                >
                  <RotateCcw size={15} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                  accessibilityLabel="Close assistant"
                >
                  <X size={17} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Active Church Selector Pill */}
            <View className="mt-2.5">
              <TouchableOpacity
                onPress={() => setIsChurchPickerOpen(true)}
                activeOpacity={0.8}
                className="flex-row items-center justify-between bg-slate-800/90 border border-amber-500/30 rounded-xl px-3 py-1.5"
              >
                <View className="flex-row items-center space-x-2 flex-1 mr-2">
                  <ChurchIcon size={14} color="#F59E0B" />
                  <Text
                    className="text-xs font-semibold text-amber-200 font-sans ml-1.5 flex-1"
                    numberOfLines={1}
                  >
                    {selectedChurchName || 'General Diocesan Knowledge'}
                  </Text>
                </View>
                <ChevronDown size={14} color="#F59E0B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Chat Messages List */}
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-4 pt-3.5"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <View
                  key={msg.id}
                  className={`flex-row mb-3.5 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Assistant Spark Avatar */}
                  {!isUser && (
                    <View className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 items-center justify-center mr-2.5 self-start mt-0.5">
                      <Sparkles size={16} color="#F59E0B" />
                    </View>
                  )}

                  {/* Message Bubble */}
                  <View
                    className={`max-w-[82%] p-3.5 rounded-2xl shadow-xs ${
                      isUser
                        ? 'bg-blue-600 rounded-tr-xs'
                        : 'bg-white border border-slate-200/90 rounded-tl-xs'
                    }`}
                  >
                    {/* Sources Badge if verified chunks used */}
                    {!isUser && (msg.sourcesUsed ?? 0) > 0 && (
                      <View className="flex-row items-center self-start bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md mb-2">
                        <Sparkles size={10} color="#D97706" />
                        <Text className="text-[10px] font-bold text-amber-800 font-sans ml-1">
                          ✦ Verified Parish Knowledge ({msg.sourcesUsed}{' '}
                          {msg.sourcesUsed === 1 ? 'source' : 'sources'})
                        </Text>
                      </View>
                    )}

                    {/* Fallback Badge if fallback diocesan source was used */}
                    {!isUser && msg.isFallback && (
                      <View className="flex-row items-center self-start bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md mb-2">
                        <ShieldCheck size={10} color="#2563EB" />
                        <Text className="text-[10px] font-semibold text-blue-800 font-sans ml-1">
                          ✦ SacraLink Diocesan Records
                        </Text>
                      </View>
                    )}

                    {/* Content */}
                    {isUser ? (
                      <Text className="text-xs leading-relaxed text-white font-sans">
                        {msg.content}
                      </Text>
                    ) : (
                      <View>{renderFormattedContent(msg.content)}</View>
                    )}

                    {/* Timestamp */}
                    <View className="flex-row justify-end mt-1.5">
                      <Text
                        className={`text-[9px] font-sans ${
                          isUser ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      >
                        {formatTime(msg.timestamp)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Animated Typing Indicator Bubble */}
            {isAsking && (
              <View className="flex-row mb-3.5 justify-start">
                <View className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 items-center justify-center mr-2.5 self-start mt-0.5">
                  <Sparkles size={16} color="#F59E0B" />
                </View>
                <View className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs">
                  <View className="flex-row items-center space-x-2">
                    <AnimatedTypingIndicator />
                    <Text className="text-xs text-slate-500 font-sans ml-2">
                      Searching parish records...
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quick Suggestion Prompt Pills */}
            {showQuickSuggestions && (
              <View className="mt-3 pt-2">
                <View className="flex-row items-center space-x-1.5 mb-2.5">
                  <HelpCircle size={13} color="#64748B" />
                  <Text className="text-xs font-bold text-slate-500 font-sans uppercase tracking-wider ml-1">
                    Suggested Inquiries
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {QUICK_SUGGESTIONS.map((pill) => (
                    <TouchableOpacity
                      key={pill}
                      onPress={() => handleSend(pill)}
                      activeOpacity={0.7}
                      className="bg-white border border-amber-500/40 px-3 py-2 rounded-xl shadow-xs"
                    >
                      <Text className="text-xs font-semibold text-slate-700 font-sans">
                        {pill}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Disclaimer Banner */}
          <View className="px-4 py-1.5 bg-amber-50/70 border-t border-amber-200/50">
            <Text className="text-[10px] text-amber-800 text-center font-sans">
              ✦ Answers verified from diocese databases. For sacraments, consult the parish office.
            </Text>
          </View>

          {/* Input Bar */}
          <View className="bg-white border-t border-slate-200/90 px-3 py-2.5 flex-row items-end space-x-2">
            <View className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-1.5 min-h-[42px] max-h-[110px] justify-center ml-1">
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask about Mass schedules, sacraments..."
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={1000}
                editable={!isAsking}
                className="text-xs text-slate-800 font-sans p-0 m-0"
                style={{
                  maxHeight: 90,
                  textAlignVertical: 'center',
                  paddingTop: Platform.OS === 'ios' ? 6 : 4,
                  paddingBottom: Platform.OS === 'ios' ? 6 : 4,
                }}
              />
            </View>

            {/* Send Button */}
            <TouchableOpacity
              onPress={() => handleSend(inputText)}
              disabled={!inputText.trim() || isAsking}
              activeOpacity={0.8}
              className={`w-10 h-10 rounded-full items-center justify-center mb-0.5 ml-1 ${
                inputText.trim() && !isAsking
                  ? 'bg-amber-500 shadow-sm'
                  : 'bg-slate-100'
              }`}
              accessibilityLabel="Send inquiry"
            >
              <Send
                size={16}
                color={inputText.trim() && !isAsking ? '#FFFFFF' : '#94A3B8'}
                style={{ marginLeft: 2 }}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Church Picker Modal Overlay */}
        <Modal
          visible={isChurchPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsChurchPickerOpen(false)}
        >
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-white rounded-t-3xl max-h-[75%] p-5">
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-200">
                <View className="flex-row items-center space-x-2">
                  <ChurchIcon size={18} color="#F59E0B" />
                  <Text className="text-base font-bold text-slate-900 font-sans ml-1.5">
                    Select Parish Context
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsChurchPickerOpen(false)}
                  className="p-1"
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView className="mt-3" showsVerticalScrollIndicator={false}>
                {/* General Diocesan Option */}
                <TouchableOpacity
                  onPress={() => handleSelectChurch(null)}
                  className={`p-3.5 rounded-2xl border mb-2 flex-row items-center justify-between ${
                    !selectedChurchId
                      ? 'bg-amber-50/70 border-amber-400'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <View>
                    <Text className="text-sm font-bold text-slate-900 font-sans">
                      General Diocesan Knowledge
                    </Text>
                    <Text className="text-xs text-slate-500 font-sans">
                      Diocese-wide guidelines, sacraments, and schedules
                    </Text>
                  </View>
                  {!selectedChurchId && <Check size={18} color="#D97706" />}
                </TouchableOpacity>

                {/* Parish List */}
                {churches.map((church) => {
                  const isSelected = selectedChurchId === church.id;
                  return (
                    <TouchableOpacity
                      key={church.id}
                      onPress={() => handleSelectChurch(church)}
                      className={`p-3.5 rounded-2xl border mb-2 flex-row items-center justify-between ${
                        isSelected
                          ? 'bg-amber-50/70 border-amber-400'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-bold text-slate-900 font-sans">
                          {church.name}
                        </Text>
                        <Text className="text-xs text-slate-500 font-sans">
                          {church.city}
                        </Text>
                      </View>
                      {isSelected && <Check size={18} color="#D97706" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
