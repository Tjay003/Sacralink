import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Configure foreground notification presentation handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure Android notification channels for distinct SacraLink event streams.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // appointments: High priority, vibration, sound
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Sacrament Appointments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      sound: 'default',
      lightColor: '#2563EB',
    });

    // donations: High priority, sound
    await Notifications.setNotificationChannelAsync('donations', {
      name: 'Cashless Donations',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      lightColor: '#10B981',
    });

    // messages: Max priority, sound
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Parish Chat Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 150, 100, 150],
      enableVibrate: true,
      sound: 'default',
      lightColor: '#3B82F6',
    });

    // announcements: Default priority
    await Notifications.setNotificationChannelAsync('announcements', {
      name: 'Diocesan Bulletins',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      lightColor: '#F59E0B',
    });
  } catch (err) {
    console.warn('Failed to configure Android notification channels:', err);
  }
}

/**
 * Requests notification permissions, generates Expo push token, and saves it
 * to profiles.push_token in Supabase.
 * Skips gracefully if running on Android emulator or web.
 */
export async function registerForPushNotificationsAsync(
  userId?: string
): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      console.log('[Push] Push notifications are not supported on web.');
      return null;
    }

    if (!Device.isDevice) {
      console.log('[Push] Running on emulator/simulator; skipping push token generation.');
      return null;
    }

    // Configure Android channels first
    if (Platform.OS === 'android') {
      await setupAndroidNotificationChannels();
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted for push notifications.');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenData.data;

    if (userId && pushToken) {
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: pushToken })
        .eq('id', userId);

      if (error) {
        console.error('[Push] Failed to persist push token to profiles:', error);
      } else {
        console.log('[Push] Registered push token successfully for user:', userId);
      }
    }

    return pushToken;
  } catch (err) {
    console.warn('[Push] Error during push notification registration:', err);
    return null;
  }
}

/**
 * Helper to display a local notification within a designated channel.
 */
export async function scheduleLocalNotification({
  title,
  body,
  channelId = 'announcements',
  data = {},
}: {
  title: string;
  body: string;
  channelId?: 'appointments' | 'donations' | 'messages' | 'announcements';
  data?: Record<string, unknown>;
}): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: {
      channelId,
    },
  });
}
