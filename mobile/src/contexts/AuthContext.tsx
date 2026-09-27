import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { handleAuthUrlSession } from '../lib/authUrl';
import type { Profile } from '@/shared/types';
import { registerForPushNotificationsAsync } from '../lib/notifications';

const PROFILE_CACHE_PREFIX = 'sacralink_cached_profile_';

async function cacheProfileToStorage(userId: string, profile: Profile): Promise<void> {
  try {
    const serialized = JSON.stringify(profile);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${PROFILE_CACHE_PREFIX}${userId}`, serialized);
      }
      return;
    }
    await SecureStore.setItemAsync(`${PROFILE_CACHE_PREFIX}${userId}`, serialized);
  } catch (err) {
    console.warn('[AuthContext] Failed to cache profile in SecureStore:', err);
  }
}

async function getCachedProfileFromStorage(userId: string): Promise<Profile | null> {
  try {
    let serialized: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        serialized = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
      }
    } else {
      serialized = await SecureStore.getItemAsync(`${PROFILE_CACHE_PREFIX}${userId}`);
    }
    if (serialized) {
      return JSON.parse(serialized) as Profile;
    }
    return null;
  } catch (err) {
    console.warn('[AuthContext] Failed to read cached profile from SecureStore:', err);
    return null;
  }
}

async function clearCachedProfileFromStorage(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`);
      }
      return;
    }
    await SecureStore.deleteItemAsync(`${PROFILE_CACHE_PREFIX}${userId}`);
  } catch {
    // Ignore cleanup errors
  }
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  profileError: Error | null;
  isOfflineFallback: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<Error | null>(null);
  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);

  const fetchProfile = async (
    userId: string,
    maxRetries = 3
  ): Promise<Profile | null> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch request timed out')), 6000)
        );

        const queryPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        const { data, error } = (await Promise.race([
          queryPromise,
          timeoutPromise,
        ])) as any;

        if (error) {
          throw error;
        }

        if (data) {
          const profileData = data as Profile;
          // Successfully fetched live profile; persist to SecureStore cache
          void cacheProfileToStorage(userId, profileData);
          setProfileError(null);
          setIsOfflineFallback(false);
          return profileData;
        }

        return null;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[AuthContext] fetchProfile attempt ${attempt}/${maxRetries} failed for user ${userId}:`,
          lastError.message
        );

        if (attempt < maxRetries) {
          // Exponential backoff delay (500ms, 1000ms...)
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
    }

    // Network or server error exhausted all retries. Attempt fallback to SecureStore cache.
    console.warn(
      `[AuthContext] Network/Supabase profile fetch failed after ${maxRetries} attempts. Checking SecureStore fallback...`
    );
    const cachedProfile = await getCachedProfileFromStorage(userId);
    if (cachedProfile) {
      console.info(
        `[AuthContext] Restored cached profile for role: ${cachedProfile.role}`
      );
      setProfileError(lastError);
      setIsOfflineFallback(true);
      return cachedProfile;
    }

    console.error(
      '[AuthContext] No cached profile found in SecureStore. Setting profileError.'
    );
    setProfileError(lastError);
    setIsOfflineFallback(false);
    return null;
  };

  const refreshProfile = async (): Promise<void> => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
      }
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) throw error;

    if (data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      const profileData = await fetchProfile(data.session.user.id);
      if (profileData) {
        setProfile(profileData);
      }
    }
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<void> => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) throw error;
  };

  const resendConfirmationEmail = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });

    if (error) throw error;
  };

  const signInWithGoogle = async (): Promise<void> => {
    const redirectUrl = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    if (data?.url) {
      const supported = await Linking.canOpenURL(data.url);
      if (supported) {
        await Linking.openURL(data.url);
      } else {
        throw new Error('Unable to open web browser for Google authentication.');
      }
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      const currentUserId = user?.id;
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase sign out error:', error);
      }
      if (currentUserId) {
        await clearCachedProfileFromStorage(currentUserId);
      }
    } catch (err) {
      console.error('Sign out exception:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      setProfileError(null);
      setIsOfflineFallback(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session retrieval error during initialization:', error);
        }

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            const profileData = await fetchProfile(initialSession.user.id);
            if (isMounted && profileData) {
              setProfile(profileData);
            }
            void registerForPushNotificationsAsync(initialSession.user.id);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          const profileData = await fetchProfile(currentSession.user.id);
          if (isMounted && profileData) {
            setProfile(profileData);
          }
          void registerForPushNotificationsAsync(currentSession.user.id);
        } else {
          setProfile(null);
          setProfileError(null);
          setIsOfflineFallback(false);
        }

        setLoading(false);
      }
    );

    const handleDeepLinkUrl = async (url: string) => {
      if (!url) return;
      try {
        const result = await handleAuthUrlSession(url);
        if (result.success && result.session?.user && isMounted) {
          setSession(result.session);
          setUser(result.session.user);
          const profileData = await fetchProfile(result.session.user.id);
          if (isMounted && profileData) {
            setProfile(profileData);
          }
          void registerForPushNotificationsAsync(result.session.user.id);
        }
      } catch (err) {
        console.error('Error handling deep link in AuthProvider:', err);
      }
    };

    // Deep link listener for warm starts / incoming URLs while app is open
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLinkUrl(url);
    });

    // Check cold-start initial deep link URL
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl && isMounted) {
          void handleDeepLinkUrl(initialUrl);
        }
      })
      .catch((err) => {
        console.error('Error reading initial deep link URL in AuthProvider:', err);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        profileError,
        isOfflineFallback,
        signIn,
        signUp,
        signInWithGoogle,
        resendConfirmationEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useIsAdmin(): boolean {
  const { profile } = useAuth();
  return profile?.role === 'admin' || profile?.role === 'super_admin';
}

export function useIsSuperAdmin(): boolean {
  const { profile } = useAuth();
  return profile?.role === 'super_admin';
}

export function useIsPriest(): boolean {
  const { profile } = useAuth();
  return profile?.role === 'priest';
}

export function useIsChurchAdmin(): boolean {
  const { profile } = useAuth();
  return profile?.role === 'admin' || (profile?.role as string) === 'church_admin';
}
