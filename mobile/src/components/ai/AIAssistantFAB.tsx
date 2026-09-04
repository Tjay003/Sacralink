import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Animated,
  Platform,
} from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { ParishionerChatbotModal } from './ParishionerChatbotModal';

export interface AIAssistantFABProps {
  churchId?: string | null;
  churchName?: string | null;
  bottomOffset?: number;
  rightOffset?: number;
  showLabel?: boolean;
}

export function AIAssistantFAB({
  churchId = null,
  churchName = null,
  bottomOffset = 20,
  rightOffset = 18,
  showLabel = false,
}: AIAssistantFABProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Gentle subtle breathing pulse effect for the Sacred Gold spark
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: bottomOffset,
          right: rightOffset,
          zIndex: 50,
          transform: [{ scale: pulseAnim }],
        }}
      >
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.88}
          accessibilityLabel="Open Parishioner AI Chatbot"
          accessibilityRole="button"
          style={{
            shadowColor: '#F59E0B',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 8,
          }}
          className={`flex-row items-center bg-slate-900 border-2 border-amber-500 ${
            showLabel
              ? 'px-4 py-3 rounded-full space-x-2'
              : 'w-14 h-14 rounded-full justify-center items-center'
          }`}
        >
          {/* Sacred Gold Spark Icon */}
          <Sparkles size={22} color="#F59E0B" />

          {showLabel && (
            <Text className="text-xs font-bold text-amber-400 font-sans tracking-tight ml-2">
              Ask Parish AI
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Parishioner Chatbot Modal */}
      <ParishionerChatbotModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialChurchId={churchId}
        initialChurchName={churchName}
      />
    </>
  );
}
