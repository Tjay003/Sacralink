import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800; // Android KeyStore safe chunking threshold (< 2048 bytes)

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }

    try {
      const isChunked = await SecureStore.getItemAsync(`${key}_chunked`);
      if (isChunked === 'true') {
        const countStr = await SecureStore.getItemAsync(`${key}_count`);
        const count = countStr ? parseInt(countStr, 10) : 0;
        let combined = '';
        for (let i = 0; i < count; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
          if (chunk) {
            combined += chunk;
          }
        }
        return combined || null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }

    try {
      if (value.length > CHUNK_SIZE) {
        await SecureStore.setItemAsync(`${key}_chunked`, 'true');
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.slice(i, i + CHUNK_SIZE));
        }
        await SecureStore.setItemAsync(`${key}_count`, chunks.length.toString());
        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
        }
      } else {
        await SecureStore.setItemAsync(`${key}_chunked`, 'false');
        await SecureStore.setItemAsync(key, value);
      }
    } catch (err) {
      console.error('Failed to securely persist auth session in SecureStore:', err);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }

    try {
      const isChunked = await SecureStore.getItemAsync(`${key}_chunked`);
      if (isChunked === 'true') {
        const countStr = await SecureStore.getItemAsync(`${key}_count`);
        const count = countStr ? parseInt(countStr, 10) : 0;
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_count`);
        await SecureStore.deleteItemAsync(`${key}_chunked`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.error('Failed to securely remove auth session from SecureStore:', err);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://oaczurouvaevebpimply.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hY3p1cm91dmFldmVicGltcGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2ODQyNjUsImV4cCI6MjA4MzI2MDI2NX0.bA98oV-XWr4znveh5nWlfKeZpcFNEeXy6qhssSi6kFU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
