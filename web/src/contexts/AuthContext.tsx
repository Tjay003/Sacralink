/**
 * AuthContext.tsx - Authentication Context Provider
 * 
 * This file manages the entire authentication state for the SacraLink application.
 * It uses React's Context API to share authentication data across all components.
 * 
 * Key Concepts:
 * - Context API: Allows sharing data without passing props through every component
 * - Hooks: useState, useEffect, useContext for managing state and side effects
 * - Supabase Auth: Handles user authentication and session management
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User, type Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { directFetchProfile } from '../lib/directApi';
import type { Profile } from '../types/database';

/**
 * AuthContextType - Defines what data and functions are available through the context
 * 
 * This interface describes all the authentication-related data and actions
 * that any component can access by using the useAuth() hook.
 */
interface AuthContextType {
    user: User | null;              // Supabase user object (email, id, etc.)
    profile: Profile | null;        // Our custom profile data (role, church_id, etc.)
    session: Session | null;        // Supabase session (includes access token)
    loading: boolean;               // True while checking authentication status
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithFacebook: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

/**
 * Create the Context
 * 
 * This creates a "container" that will hold our authentication data.
 * Initially undefined - it gets filled when we create the Provider below.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Component
 * 
 * This is the "Provider" component that wraps your entire app.
 * It manages all authentication state and provides it to child components.
 * 
 * Usage: In main.tsx, we wrap <App /> with <AuthProvider>
 * This makes auth data available everywhere in the app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    /**
     * State Management with useState
     * 
     * These are "state variables" - when they change, React re-renders components.
     * Think of them as the "memory" of this component.
     */

    // user: The Supabase user object (contains email, id, etc.)
    const [user, setUser] = useState<User | null>(null);

    // profile: Our custom profile data from the database (role, church_id, full_name, etc.)
    const [profile, setProfile] = useState<Profile | null>(null);

    // session: The Supabase session (contains access token for API calls)
    const [session, setSession] = useState<Session | null>(null);

    // loading: True while we're checking if user is logged in
    // This prevents showing the wrong page while auth is initializing
    const [loading, setLoading] = useState(true);

    /**
     * fetchProfile - Retrieves user profile data from the database
     * 
     * Why Direct API instead of Supabase Client?
     * - For now use direct API calls but supabase client is the ideal
     * - The Supabase JS client has an "AbortError" issue in our environment
     * - Direct REST API calls bypass this problem
     * - We use the user's access token for authentication
     * 
     * @param userId - The user's unique ID from Supabase Auth
     * @param accessToken - The user's session access token (proves they're logged in)
     * @returns Profile data or null if fetch fails
     */
    const fetchProfile = async (userId: string, accessToken: string) => {
        console.log('🔧 Fetching profile for user:', userId);

        // Call our direct API helper (see lib/directApi.ts)
        // This makes a direct HTTP request to Supabase REST API
        const profileData = await directFetchProfile(userId, accessToken);
        if (profileData) {
            console.log('✅ Profile fetched via direct API:', profileData);
            return profileData;
        }

        console.error('❌ Failed to fetch profile');
        return null;
    };

    /**
     * refreshProfile - Manually refresh the user's profile data
     * 
     * Useful when profile data might have changed (e.g., admin updated user's role)
     * Components can call this to get the latest profile information.
     */
    const refreshProfile = async () => {
        if (user && session) {
            const profileData = await fetchProfile(user.id, session.access_token);
            setProfile(profileData);
        }
    };

    /**
     * signIn - Log in a user with email and password
     * 
     * Flow:
     * 1. Call Supabase auth to verify credentials
     * 2. Supabase returns a session if successful
     * 3. onAuthStateChange listener (below) automatically updates our state
     * 4. User is redirected to dashboard by App.tsx
     * 
     * @throws Error if login fails (wrong password, user doesn't exist, etc.)
     */
    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    };

    /**
     * signUp - Register a new user
     * 
     * Flow:
     * 1. Create user in Supabase Auth
     * 2. Supabase automatically creates a profile in our database (via trigger)
     * 3. User receives confirmation email (if email confirmation is enabled)
     * 4. After confirmation, they can log in
     * 
     * Note: The full_name is stored in Supabase Auth metadata
     * Our database trigger copies it to the profiles table
     */
    const signUp = async (email: string, password: string, fullName: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,  // Stored in auth.users metadata
                },
            },
        });
        if (error) throw error;
    };

    /**
     * signInWithGoogle - Log in a user via Google OAuth
     */
    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/dashboard`,
                scopes: 'https://www.googleapis.com/auth/userinfo.email',
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
        if (error) throw error;
    };

    /**
     * signInWithFacebook - Log in a user via Facebook OAuth
     */
    const signInWithFacebook = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: `${window.location.origin}/dashboard`,
            },
        });
        if (error) throw error;
    };

    /**
     * signOut - Log out the current user
     * 
     * Flow:
     * 1. Call Supabase to end the session
     * 2. onAuthStateChange listener automatically clears our state
     * 3. User is redirected to login page by App.tsx
     */
    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUser(null);
        setProfile(null);
        setSession(null);
    };

    /**
     * useEffect - Authentication Initialization
     * 
     * This is a React "effect" - code that runs when the component mounts (loads).
     * Think of it as the "startup code" that runs once when the app loads.
     * 
     * What it does:
     * 1. Check if user is already logged in (session exists in browser storage)
     * 2. If yes, fetch their profile data
     * 3. Set up a listener for auth changes (login, logout, token refresh)
     * 4. Set loading to false when done
     * 
     * The empty [] at the end means "run this only once when component mounts"
     */
    useEffect(() => {
        // mounted: Tracks if component is still on screen
        // Prevents updating state after component is removed (causes errors)
        let mounted = true;

        // timeoutId: For the safety timeout (in case auth hangs)
        let timeoutId: number;

        /**
         * initAuth - Initialize authentication on app startup
         * 
         * This runs once when the app first loads to check if user is logged in.
         */
        const initAuth = async () => {
            try {
                console.log('🔐 Initializing auth...');

                let session = null;
                let retries = 3;

                /**
                 * Retry Logic for AbortError
                 * 
                 * Sometimes Supabase client throws an AbortError (request cancelled).
                 * We retry up to 3 times with a small delay to work around this.
                 * 
                 * This is a workaround - ideally the AbortError wouldn't happen.
                 */
                while (retries > 0) {
                    try {
                        // Ask Supabase: "Is there a logged-in user?"
                        // Checks browser storage for saved session
                        const { data, error } = await supabase.auth.getSession();

                        if (error) {
                            console.error('❌ Error getting session:', error);
                            if (mounted) setLoading(false);
                            return;
                        }

                        session = data.session;  // null if not logged in, Session object if logged in
                        break; // Success! Exit the retry loop

                    } catch (err: any) {
                        // If it's an AbortError and we have retries left, try again
                        if (err.name === 'AbortError' && retries > 1) {
                            console.warn(`⚠️ AbortError caught, retrying... (${retries - 1} attempts left)`);
                            retries--;
                            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
                            continue;  // Try again
                        }
                        throw err; // Not an AbortError or out of retries - give up
                    }
                }

                console.log('✅ Session retrieved:', session ? 'User logged in' : 'No session');

                // Safety check: Is component still mounted?
                if (!mounted) {
                    console.log('⚠️ Component unmounted, aborting...');
                    return;
                }

                /**
                 * Critical: Fetch Profile BEFORE Updating State
                 * 
                 * Why this order matters:
                 * 1. If we update state first, React re-renders immediately
                 * 2. App.tsx checks if user has profile
                 * 3. Profile isn't loaded yet → shows "Access Denied"
                 * 4. Profile finishes loading → shows Dashboard (flash/flicker)
                 * 
                 * By fetching profile FIRST (while loading=true):
                 * - User sees loading spinner
                 * - Profile data is ready
                 * - We update ALL state at once
                 * - React renders once with complete data
                 * - No flash/flicker!
                 */
                let profileData = null;
                if (session?.user) {
                    console.log('👤 Fetching profile for user...');
                    profileData = await fetchProfile(session.user.id, session.access_token);
                    console.log('📊 Profile data received:', profileData);

                    if (!mounted) {
                        console.log('⚠️ Component unmounted after profile fetch, aborting...');
                        return;
                    }
                }

                /**
                 * Batch State Updates
                 * 
                 * Update session, user, and profile all together.
                 * React will batch these and re-render once instead of three times.
                 */
                console.log('📝 Updating all state together...');

                // If there's a session but no profile, the user was deleted from the DB.
                // Auto sign out to clear the stale session and send them to login.
                if (session?.user && !profileData) {
                    console.warn('⚠️ Session exists but no profile found — user likely deleted. Signing out...');
                    await supabase.auth.signOut();
                    if (mounted) {
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                        setLoading(false);
                    }
                    return;
                }

                setSession(session);
                setUser(session?.user ?? null);
                setProfile(profileData);

                // Small delay to ensure React processes the state updates
                await new Promise(resolve => setTimeout(resolve, 50));

                if (mounted) {
                    console.log('✅ Auth initialization complete, setting loading to false');
                    setLoading(false);
                    console.log('📝 Loading state set to false');
                } else {
                    console.log('⚠️ Component unmounted, not setting loading to false');
                }
            } catch (err) {
                console.error('❌ Auth initialization error:', err);
                if (mounted) setLoading(false);
            }
        };

        // Start the authentication initialization
        initAuth();

        /**
         * Auth State Change Listener
         * 
         * This listens for ANY authentication changes:
         * - User logs in → _event = 'SIGNED_IN', session = new session
         * - User logs out → _event = 'SIGNED_OUT', session = null
         * - Token refreshes → _event = 'TOKEN_REFRESHED', session = updated session
         * 
         * Why we need this:
         * - initAuth() only runs once on app load
         * - This listener catches changes that happen while app is running
         * - Example: User logs in → listener updates our state → UI updates
         */
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!mounted) return;  // Don't update if component is gone

                console.log('🔄 Auth state changed:', _event);

                // Same strategy: Fetch profile FIRST, then update state
                let profileData = null;
                if (session?.user) {
                    console.log('👤 Fetching profile after auth change...');
                    profileData = await fetchProfile(session.user.id, session.access_token);
                    if (!mounted) return;

                    // Auto sign out if session exists but profile is gone (deleted user)
                    if (!profileData) {
                        console.warn('⚠️ Auth change: session but no profile — signing out stale session...');
                        await supabase.auth.signOut();
                        if (mounted) {
                            setSession(null);
                            setUser(null);
                            setProfile(null);
                            setLoading(false);
                        }
                        return;
                    }
                }

                // Batch all state updates
                setSession(session);
                setUser(session?.user ?? null);
                setProfile(profileData);

                // Small delay for React to process
                await new Promise(resolve => setTimeout(resolve, 50));

                if (mounted) setLoading(false);
            }
        );

        /**
         * Safety Timeout
         * 
         * If auth is still loading after 10 seconds, something is wrong.
         * Force loading to false so user isn't stuck on loading screen forever.
         */
        timeoutId = setTimeout(() => {
            if (mounted) {
                console.warn('⏱️ Auth loading timeout (10s) - forcing stop');
                setLoading(false);
            }
        }, 10000);

        /**
         * Cleanup Function
         * 
         * This runs when the component unmounts (is removed from screen).
         * Important for preventing memory leaks and errors.
         * 
         * What it cleans up:
         * - mounted flag → prevents state updates after unmount
         * - timeout → prevents timeout from running after unmount  
         * - subscription → stops listening to auth changes
         */
        return () => {
            mounted = false;
            if (timeoutId) clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []); // Empty array = run once when component mounts, cleanup when it unmounts

    /**
     * Provide the Context
     * 
     * This makes all our auth data and functions available to child components.
     * 
     * The "value" prop contains everything we want to share:
     * - State: user, profile, session, loading
     * - Functions: signIn, signUp, signOut, refreshProfile
     * 
     * Any component wrapped by <AuthProvider> can access these via useAuth()
     */
    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                session,
                loading,
                signIn,
                signUp,
                signInWithGoogle,
                signInWithFacebook,
                signOut,
                refreshProfile,
            }}
        >
            {children}  {/* All child components (your entire app) */}
        </AuthContext.Provider>
    );
}

/**
 * useAuth - Custom Hook for Accessing Auth Context
 * 
 * This is a helper function that makes it easy to use the auth context.
 * 
 * Usage in any component:
 * ```tsx
 * const { user, profile, loading, signIn, signOut } = useAuth();
 * 
 * if (loading) return <LoadingSpinner />;
 * if (!user) return <LoginPage />;
 * return <Dashboard user={user} profile={profile} />;
 * ```
 * 
 * The error check ensures you don't try to use auth outside of AuthProvider.
 */
export function useAuth() {
    const context = useContext(AuthContext);

    // If context is undefined, useAuth was called outside of <AuthProvider>
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}

// Role-based helpers
export function useIsAdmin() {
    const { profile } = useAuth();
    return profile?.role === 'admin' || profile?.role === 'super_admin';
}

export function useIsSuperAdmin() {
    const { profile } = useAuth();
    return profile?.role === 'super_admin';
}

export function useIsPriest() {
    const { profile } = useAuth();
    return profile?.role === 'priest';
}

export function useIsChurchAdmin() {
    const { profile } = useAuth();
    return profile?.role === 'church_admin';
}

export function useCanManageChurch(churchId: string) {
    const { profile } = useAuth();
    if (!profile) return false;
    if (profile.role === 'super_admin') return true;
    if ((profile.role === 'church_admin' || profile.role === 'volunteer') && profile.assigned_church_id === churchId) return true;
    if (profile.role === 'admin' && profile.church_id === churchId) return true;
    return false;
}
