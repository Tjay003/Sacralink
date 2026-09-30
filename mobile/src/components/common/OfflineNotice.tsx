import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import { useNetworkStatus } from '@/lib/network';

export function OfflineNotice() {
  const insets = useSafeAreaInsets();
  const { isOnline, isChecking, checkConnection } = useNetworkStatus();

  const [wasOffline, setWasOffline] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  // Animated values for entrance and exit transitions
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Track offline state and trigger restored notice when coming back online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRestoredNotice(false);

      // Slide and fade in offline banner
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
          speed: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (wasOffline) {
      // Just reconnected
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        // Slide and fade out
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setWasOffline(false);
          setShowRestoredNotice(false);
        });
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      // Default online state on app load
      translateY.setValue(-100);
      opacity.setValue(0);
    }
  }, [isOnline, wasOffline, translateY, opacity]);

  if (isOnline && !showRestoredNotice && !wasOffline) {
    return null;
  }

  const topInset = insets.top > 0 ? insets.top + (Platform.OS === 'ios' ? 6 : 10) : 16;

  return (
    <View
      pointerEvents="box-none"
      className="absolute top-0 left-0 right-0 z-50 items-center px-4"
      style={{ paddingTop: topInset }}
    >
      <Animated.View
        style={{
          transform: [{ translateY }],
          opacity,
          width: '100%',
          maxWidth: 440,
        }}
        className="shadow-md shadow-black/10"
      >
        {showRestoredNotice ? (
          // Reconnection Restored Banner
          <View className="flex-row items-center justify-between bg-emerald-50 border border-emerald-300/90 rounded-2xl px-3.5 py-2.5">
            <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
              <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
                <CheckCircle2 size={16} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-emerald-950 font-sans">
                  Back Online
                </Text>
                <Text className="text-[11px] text-emerald-700 font-sans leading-tight">
                  Connection restored. Syncing parish data.
                </Text>
              </View>
            </View>
            <View className="bg-emerald-100/70 px-2 py-1 rounded-lg">
              <Wifi size={13} color="#059669" />
            </View>
          </View>
        ) : (
          // Offline Banner
          <View className="flex-row items-center justify-between bg-amber-50 border border-amber-300 rounded-2xl px-3.5 py-2.5">
            <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
              <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center">
                <WifiOff size={16} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-amber-950 font-sans">
                  Offline Mode
                </Text>
                <Text className="text-[11px] text-amber-800 font-sans leading-tight">
                  Check connection. Displaying cached data.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => checkConnection()}
              disabled={isChecking}
              activeOpacity={0.7}
              className="bg-amber-600 active:bg-amber-700 px-3 py-1.5 rounded-xl flex-row items-center space-x-1.5"
            >
              {isChecking ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <RefreshCw size={12} color="#FFFFFF" />
                  <Text className="text-xs font-semibold text-white font-sans">
                    Retry
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
